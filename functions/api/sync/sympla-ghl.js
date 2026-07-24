// POST /api/sync/sympla-ghl
//
// Polls Sympla orders for the configured event and tags the matching GHL
// contact with the current purchase status. Sympla has no outbound webhook
// (confirmed against its public API spec), so this is a periodic pull
// called on a schedule by an external cron (see docs/sympla-ghl-sync.md).
//
// Auth:     header `x-sync-secret: <env.SYNC_SECRET>` — same secret already
//           used by /api/sync/meta-ads.
// Required env:
//   SYNC_SECRET       shared between cron and this endpoint
//   SYMPLA_TOKEN      Sympla API token ("Minha Conta" > Integrações)
//   GHL_API_TOKEN     GHL Private Integration Token (View + Edit Contacts)
//   GHL_LOCATION_ID   GHL sub-account id
//
// If any required env is missing, returns 200 with skipped:true so the cron
// provider doesn't mark the endpoint as failing.
//
// GET /api/sync/sympla-ghl — read-only diagnostic. Only needs SYMPLA_TOKEN
// and SYNC_SECRET; resolves the event and tallies orders by status group.
// Makes no GHL calls and writes nothing to D1, so it's safe to use before
// GHL_API_TOKEN/GHL_LOCATION_ID are configured.

const EVENT_NAME = 'Imersão Escritores Admiráveis';

const TAG_APROVADA    = 'compra-aprovada-admiraveis-ipea-sp-2026';
const TAG_RECUPERACAO = 'recuperacao-admiraveis-ipea-sp-2026';
const TAG_CANCELADA   = 'cancelada-admiraveis-ipea-sp-2026';

// Maps Sympla's order_status enum to one of the three tag groups.
const STATUS_GROUP = {
  APPROVED:     'aprovada',
  PENDING:      'recuperacao',
  UNPAID:       'recuperacao',
  NOT_APPROVED: 'recuperacao',
  CANCELLED:    'cancelada',
  REFUNDED:     'cancelada',
};

const GROUP_TAG = {
  aprovada:     TAG_APROVADA,
  recuperacao:  TAG_RECUPERACAO,
  cancelada:    TAG_CANCELADA,
};

const SYMPLA_API = 'https://api.sympla.com.br/public/v1.5.1';
const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export async function onRequestGet(context) {
  const { request, env } = context;

  const sentSecret = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sentSecret !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.SYMPLA_TOKEN) {
    return json({ ok: true, skipped: true, reason: 'SYMPLA_TOKEN must be set' });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('list_events') === '1') {
    const resp = await symplaFetch(env.SYMPLA_TOKEN, `${SYMPLA_API}/events?page_size=100`);
    return json({ ok: true, events: (resp.data || []).map(e => ({ id: e.id, name: e.name })) });
  }

  try {
    const eventId = await resolveEventId(env.SYMPLA_TOKEN, EVENT_NAME);
    const resp = await symplaFetch(
      env.SYMPLA_TOKEN,
      `${SYMPLA_API}/events/${eventId}/orders?status=true&field_sort=updated_date&sort=DESC&page_size=200&page=1`
    );
    const orders = resp.data || [];
    const byStatus = {};
    for (const order of orders) {
      byStatus[order.order_status] = (byStatus[order.order_status] || 0) + 1;
    }

    const recentParam = parseInt(url.searchParams.get('recent') || '0', 10);
    const recent = recentParam > 0
      ? orders.slice(0, recentParam).map(o => ({
          buyer_name: [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' '),
          buyer_email: o.buyer_email,
          order_status: o.order_status,
          updated_date: o.updated_date,
          utm: o.utm,
        }))
      : undefined;

    let utmSummary;
    if (url.searchParams.get('utm_summary') === '1') {
      const bySource = {};
      const googleOrders = [];
      for (const o of orders) {
        if (o.order_status !== 'APPROVED') continue;
        const source = (o.utm && o.utm.utm_source) ? o.utm.utm_source : 'sem_utm';
        bySource[source] = (bySource[source] || 0) + 1;
        if (source === 'google') {
          googleOrders.push({
            buyer_name: [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' '),
            buyer_email: o.buyer_email,
            updated_date: o.updated_date,
            utm_campaign: o.utm.utm_campaign,
            utm_medium: o.utm.utm_medium,
          });
        }
      }
      utmSummary = { by_utm_source_approved: bySource, google_orders: googleOrders };
    }

    let creativeSummary;
    if (url.searchParams.get('creative_summary') === '1') {
      const byContent = {};
      for (const o of orders) {
        if (o.order_status !== 'APPROVED') continue;
        const content = (o.utm && o.utm.utm_content) ? o.utm.utm_content : 'sem_utm_content';
        if (!byContent[content]) {
          byContent[content] = { vendas: 0, utm_source: o.utm && o.utm.utm_source, utm_campaign: o.utm && o.utm.utm_campaign };
        }
        byContent[content].vendas++;
      }
      creativeSummary = Object.entries(byContent)
        .map(([utm_content, v]) => ({ utm_content, ...v }))
        .sort((a, b) => b.vendas - a.vendas);
    }

    // Debug: dump the raw shape of the first order (and its participants) to
    // check whether Sympla exposes any custom-form / tracking field we could
    // use for real UTM attribution. Temporary — remove once resolved.
    let rawOrder, rawParticipants;
    if (url.searchParams.get('raw') === '1' && orders[0]) {
      rawOrder = orders[0];
      const pResp = await symplaFetch(
        env.SYMPLA_TOKEN,
        `${SYMPLA_API}/events/${eventId}/orders/${orders[0].id}/participants`
      );
      rawParticipants = pResp.data || pResp;
    }

    return json({
      ok: true,
      event_id: eventId,
      event_name: EVENT_NAME,
      orders_page_1: orders.length,
      by_status: byStatus,
      ...(recent ? { recent } : {}),
      ...(utmSummary ? { utm_summary: utmSummary } : {}),
      ...(creativeSummary ? { creative_summary: creativeSummary } : {}),
      ...(rawOrder ? { raw_order: rawOrder, raw_participants: rawParticipants } : {}),
      note: 'Diagnóstico só da primeira página (até 200 pedidos, ordenada por mais recente) — não escreve no D1 nem chama o GHL.',
    });
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const sentSecret = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sentSecret !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!env.SYMPLA_TOKEN || !env.GHL_API_TOKEN || !env.GHL_LOCATION_ID) {
    return json({
      ok: true,
      skipped: true,
      reason: 'SYMPLA_TOKEN, GHL_API_TOKEN and GHL_LOCATION_ID must be set to enable sync',
    });
  }

  const runStartedAt = Date.now();
  let status = 'ok';
  let errorMessage = null;
  let rowsUpserted = 0;

  try {
    const eventId = await resolveEventId(env.SYMPLA_TOKEN, EVENT_NAME);
    const watermark = await getWatermark(env.DB);
    const orders = await fetchOrdersSince(env.SYMPLA_TOKEN, eventId, watermark);

    let maxUpdatedSeen = watermark;
    for (const order of orders) {
      await syncOrder(env, eventId, order);
      rowsUpserted++;
      if (!maxUpdatedSeen || order.updated_date > maxUpdatedSeen) {
        maxUpdatedSeen = order.updated_date;
      }
    }

    if (maxUpdatedSeen) await setWatermark(env.DB, maxUpdatedSeen);
  } catch (err) {
    status = 'error';
    errorMessage = err.message || String(err);
  }

  const durationMs = Date.now() - runStartedAt;
  const runAt = Math.floor(Date.now() / 1000);

  try {
    await env.DB.prepare(`
      INSERT INTO sync_log (platform, status, rows_upserted, error_message, duration_ms, run_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind('sympla-ghl', status, rowsUpserted, errorMessage, durationMs, runAt).run();
  } catch (_) { /* ignore */ }

  if (status === 'error') {
    return json({ ok: false, error: errorMessage, rows_upserted: rowsUpserted, duration_ms: durationMs }, 500);
  }
  return json({ ok: true, rows_upserted: rowsUpserted, duration_ms: durationMs });
}

// -----------------------------------------------------------------------------
// Sympla
// -----------------------------------------------------------------------------

async function resolveEventId(token, eventName) {
  const resp = await symplaFetch(token, `${SYMPLA_API}/events?page_size=100`);
  const target = normalize(eventName);
  const match = (resp.data || []).find(e => normalize(e.name) === target);
  if (!match) throw new Error(`Evento Sympla "${eventName}" não encontrado`);
  return match.id;
}

// Pages through orders (all statuses), newest updated_date first, stopping
// as soon as we reach an order already covered by the stored watermark —
// avoids re-fetching the full order history on every hourly run.
async function fetchOrdersSince(token, eventId, watermark) {
  const collected = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const url = `${SYMPLA_API}/events/${eventId}/orders` +
      `?status=true&field_sort=updated_date&sort=DESC&page_size=${pageSize}&page=${page}`;
    const resp = await symplaFetch(token, url);
    const rows = resp.data || [];
    if (rows.length === 0) break;

    let reachedWatermark = false;
    for (const order of rows) {
      if (watermark && order.updated_date <= watermark) {
        reachedWatermark = true;
        break;
      }
      collected.push(order);
    }
    if (reachedWatermark || rows.length < pageSize) break;
    page++;
    if (page > 50) break; // safety valve
  }

  return collected;
}

async function symplaFetch(token, url) {
  const resp = await fetch(url, { headers: { S_TOKEN: token } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Sympla API ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}

// -----------------------------------------------------------------------------
// Sync one order: diff against D1, call GHL only if the tag group changed.
// -----------------------------------------------------------------------------

async function syncOrder(env, eventId, order) {
  const group = STATUS_GROUP[order.order_status];
  if (!group) return; // unknown status, skip defensively

  const previous = await env.DB.prepare(
    `SELECT order_status, ghl_contact_id FROM sympla_ghl_sync WHERE order_id = ?`
  ).bind(order.id).first();

  const previousGroup = previous ? STATUS_GROUP[previous.order_status] : null;
  const now = Math.floor(Date.now() / 1000);

  let contactId = previous?.ghl_contact_id || null;

  if (previousGroup !== group) {
    contactId = await ghlUpsertContactWithTag(env, order, GROUP_TAG[group]);
    if (previousGroup && previousGroup !== group) {
      await ghlRemoveTag(env, contactId, GROUP_TAG[previousGroup]);
    }
  }

  await env.DB.prepare(`
    INSERT INTO sympla_ghl_sync (order_id, event_id, buyer_email, order_status, ghl_contact_id, synced_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET
      order_status   = excluded.order_status,
      ghl_contact_id = excluded.ghl_contact_id,
      synced_at      = excluded.synced_at
  `).bind(order.id, eventId, order.buyer_email, order.order_status, contactId, now).run();
}

// -----------------------------------------------------------------------------
// GHL
// -----------------------------------------------------------------------------

async function ghlUpsertContactWithTag(env, order, tag) {
  const resp = await fetch(`${GHL_API}/contacts/upsert`, {
    method: 'POST',
    headers: ghlHeaders(env),
    body: JSON.stringify({
      locationId: env.GHL_LOCATION_ID,
      email: order.buyer_email,
      firstName: order.buyer_first_name || undefined,
      lastName: order.buyer_last_name || undefined,
      tags: [tag],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`GHL upsert ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.contact?.id || data.id;
}

async function ghlRemoveTag(env, contactId, tag) {
  if (!contactId) return;
  const resp = await fetch(`${GHL_API}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: ghlHeaders(env),
    body: JSON.stringify({ tags: [tag] }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`GHL remove tag ${resp.status}: ${text.slice(0, 300)}`);
  }
}

function ghlHeaders(env) {
  return {
    Authorization: `Bearer ${env.GHL_API_TOKEN}`,
    Version: GHL_API_VERSION,
    'Content-Type': 'application/json',
  };
}

// -----------------------------------------------------------------------------
// Watermark (single-row state) + helpers
// -----------------------------------------------------------------------------

async function getWatermark(db) {
  const row = await db.prepare(`SELECT last_watermark FROM sympla_sync_state WHERE id = 1`).first();
  return row?.last_watermark || null;
}

async function setWatermark(db, value) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`
    INSERT INTO sympla_sync_state (id, last_watermark, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_watermark = excluded.last_watermark, updated_at = excluded.updated_at
  `).bind(value, now).run();
}

function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
