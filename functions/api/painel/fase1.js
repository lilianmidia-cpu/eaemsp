// GET /api/painel/fase1
// O que o antigo /dash mostrava da fase 1 (venda da Imersão presencial),
// agora dentro do /painel e com o login dele:
//   - leads (evento Lead) com a origem de cada um
//   - status de envio de leads e compras pro Meta / GA4 / Google Ads
//   - saúde do rastreamento (adblock e ITP recuperados pelo servidor)
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Tudo termina no go-live da Gravação: dali pra frente é fase 2.

const GRAVACAO_GO_LIVE_TS = Math.floor(Date.UTC(2026, 8, 22, 14, 51, 22) / 1000); // 22/09/2026 11:51 (BRT)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const vazio = { leads: [], resumo_leads: [], envios: {}, compras: [], saude: {} };
  if (!env.DB) return json({ ok: true, data: vazio });

  const startDate = url.searchParams.get('startDate') || daysAgo(30);
  const endDate   = url.searchParams.get('endDate')   || today();
  const startTs   = dateToEpoch(startDate, 0);
  const endTs     = Math.min(dateToEpoch(endDate, 86399), GRAVACAO_GO_LIVE_TS - 1);

  try {
    const { results: leadsRaw } = await env.DB.prepare(`
      SELECT
        e.timestamp, e.raw_email, e.browser, e.os, e.is_mobile,
        e.meta_response_ok, e.ga4_response_ok,
        s.utm_source, s.utm_medium, s.utm_campaign,
        s.fbclid, s.gclid, s.referrer, s.landing_url, s.city
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND (e.is_bot IS NULL OR e.is_bot = 0)
      ORDER BY e.timestamp DESC
      LIMIT 500
    `).bind(startTs, endTs).all();

    const leads = (leadsRaw || []).map(r => ({
      data: r.timestamp,
      email: r.raw_email || '',
      origem: origem(r),
      campanha: r.utm_campaign || '',
      pagina: pagina(r.landing_url),
      aparelho: r.is_mobile ? 'Celular' : 'Computador',
      cidade: r.city || '',
      meta_ok: r.meta_response_ok,
      ga4_ok: r.ga4_response_ok,
    }));

    const porOrigem = {};
    for (const l of leads) porOrigem[l.origem] = (porOrigem[l.origem] || 0) + 1;
    const resumo_leads = Object.entries(porOrigem)
      .map(([origem, total]) => ({ origem, total }))
      .sort((a, b) => b.total - a.total);

    const envLeads = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN meta_response_ok = 1 THEN 1 ELSE 0 END) AS meta_ok,
        SUM(CASE WHEN meta_response_ok = 0 THEN 1 ELSE 0 END) AS meta_erro,
        SUM(CASE WHEN ga4_response_ok = 1 THEN 1 ELSE 0 END) AS ga4_ok,
        SUM(CASE WHEN ga4_response_ok = 0 THEN 1 ELSE 0 END) AS ga4_erro,
        SUM(CASE WHEN pixel_was_blocked = 1 THEN 1 ELSE 0 END) AS adblock_recuperado,
        SUM(CASE WHEN fbp_source = 'middleware_http' THEN 1 ELSE 0 END) AS itp_recuperado
      FROM event_log
      WHERE event_name = 'Lead'
        AND timestamp >= ? AND timestamp <= ?
        AND (is_bot IS NULL OR is_bot = 0)
    `).bind(startTs, endTs).first();

    const { results: comprasRaw } = await env.DB.prepare(`
      SELECT created_at, raw_name, raw_email, value, product_name, product_id,
             utm_source, utm_campaign,
             meta_response_ok, ga4_response_ok,
             google_ads_response_ok, google_ads_response_body
      FROM purchase_log
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
      LIMIT 200
    `).bind(startTs, endTs).all();

    const compras = (comprasRaw || []).map(r => ({
      data: r.created_at,
      nome: r.raw_name || '',
      email: r.raw_email || '',
      valor: r.value || 0,
      produto: r.product_name || r.product_id || '',
      origem: [r.utm_source, r.utm_campaign].filter(Boolean).join(' · '),
      meta_ok: r.meta_response_ok,
      ga4_ok: r.ga4_response_ok,
      gads_ok: String(r.google_ads_response_body || '').startsWith('skipped:') ? null : r.google_ads_response_ok,
    }));

    const e = envLeads || {};
    return json({
      ok: true,
      data: {
        leads,
        resumo_leads,
        envios: {
          leads_total: e.total || 0,
          leads_meta_ok: e.meta_ok || 0,
          leads_meta_erro: e.meta_erro || 0,
          leads_ga4_ok: e.ga4_ok || 0,
          leads_ga4_erro: e.ga4_erro || 0,
          compras_total: compras.length,
          compras_meta_ok: compras.filter(c => c.meta_ok === 1).length,
          compras_ga4_ok: compras.filter(c => c.ga4_ok === 1).length,
        },
        compras,
        saude: {
          adblock_recuperado: e.adblock_recuperado || 0,
          itp_recuperado: e.itp_recuperado || 0,
        },
      },
    });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

// Mesma lógica de "origem" das outras telas: UTM > fbclid/gclid > referrer > direto.
function origem(r) {
  if (r.utm_source) return [r.utm_source, r.utm_medium].filter(Boolean).join(' · ');
  if (r.fbclid) return 'Meta (pago)';
  if (r.gclid) return 'Google (pago)';
  if (r.referrer) {
    try { return new URL(r.referrer).hostname.replace(/^www\./, ''); } catch (_) { return r.referrer; }
  }
  return 'Direto';
}

function pagina(landingUrl) {
  if (!landingUrl) return '';
  try { return new URL(landingUrl, 'https://x').pathname; } catch (_) { return landingUrl; }
}

function dateToEpoch(ymd, offset) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000) + offset;
}
// Datas no fuso de Brasília (UTC-3), pra bater com o cálculo de startDate/endDate.
function today()    { return daysAgo(0); }
function daysAgo(n) { const d = new Date(Date.now() - 3 * 3600 * 1000); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
function parseCookies(h) {
  const o = {};
  h.split(';').forEach(c => { const [k, ...v] = c.trim().split('='); if (k) o[k.trim()] = v.join('='); });
  return o;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
