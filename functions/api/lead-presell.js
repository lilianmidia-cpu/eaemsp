// POST /api/lead-presell
// Recebe { name, email, phone, ticket_choice } do form da /vendaspre.
// 1. Salva o lead em D1 (tabela leads_presell) com toda atribuição
// 2. Envia para o webhook do GoHighLevel (env GHL_WEBHOOK_URL) se configurado
// 3. Devolve a URL do Sympla pra qual o front deve redirecionar
//
// As URLs do Sympla por tipo de ingresso são lidas das envs:
//   SYMPLA_URL_LOTE1, SYMPLA_URL_LOTE2, SYMPLA_URL_VIP
// Se a env do tipo escolhido estiver faltando, cai no SYMPLA_URL_DEFAULT.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const ticketChoice = String(body.ticket_choice || 'default').trim();

  // Validação básica
  if (!name || name.length < 2) {
    return json({ ok: false, error: 'Nome inválido' }, 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Email inválido' }, 400);
  }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    return json({ ok: false, error: 'Telefone inválido' }, 400);
  }

  // Atribuição (cookies setados pelo middleware)
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionId = cookies['_krob_sid'] || '';
  const fbp = cookies['_fbp'] || '';
  const fbc = cookies['_fbc'] || '';

  // UTMs vêm pelo body (o front passa o que pegou da URL/sessionStorage)
  const utm = body.utm || {};

  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const now = Math.floor(Date.now() / 1000);

  // Resolve URL do Sympla
  const symplaUrl = resolveSymplaUrl(env, ticketChoice);

  // GHL webhook (opcional — só roda se a env estiver setada)
  let ghlStatus = 'skipped';
  let ghlResponse = '';
  if (env.GHL_WEBHOOK_URL) {
    try {
      const r = await fetch(env.GHL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          first_name: name.split(' ')[0],
          last_name: name.split(' ').slice(1).join(' '),
          email,
          phone: phoneDigits,
          tags: ['vendaspre', 'imersao-escritores', `ticket-${ticketChoice}`],
          source: 'vendaspre',
          ticket_choice: ticketChoice,
          utm_source: utm.source || '',
          utm_medium: utm.medium || '',
          utm_campaign: utm.campaign || '',
          utm_content: utm.content || '',
          utm_term: utm.term || '',
          fbp,
          fbc,
        }),
      });
      ghlStatus = r.ok ? 'sent' : 'failed';
      ghlResponse = (await r.text()).slice(0, 1000);
    } catch (e) {
      ghlStatus = 'failed';
      ghlResponse = String(e.message || e).slice(0, 1000);
    }
  }

  // Persistência em D1 (background — não bloqueia o redirect)
  if (env.DB) {
    context.waitUntil(
      env.DB.prepare(`
        INSERT INTO leads_presell
          (created_at, name, email, phone, ticket_choice, session_id, fbp, fbc,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           ip_address, user_agent, ghl_status, ghl_response, redirected_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        now, name, email, phoneDigits, ticketChoice, sessionId, fbp, fbc,
        utm.source || '', utm.medium || '', utm.campaign || '',
        utm.content || '', utm.term || '',
        ip, ua, ghlStatus, ghlResponse, symplaUrl
      ).run().catch((e) => console.error('leads_presell insert:', e.message))
    );
  }

  return json({ ok: true, redirect: symplaUrl, ghl: ghlStatus });
}

function resolveSymplaUrl(env, ticketChoice) {
  const map = {
    'lote-1': env.SYMPLA_URL_LOTE1,
    'lote-2': env.SYMPLA_URL_LOTE2,
    'vip':    env.SYMPLA_URL_VIP,
  };
  return (
    map[ticketChoice] ||
    env.SYMPLA_URL_DEFAULT ||
    'https://www.sympla.com.br/'
  );
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) out[k.trim()] = rest.join('=');
  });
  return out;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
