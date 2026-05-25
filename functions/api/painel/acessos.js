// GET /api/painel/acessos
// Lista os últimos acessos ao painel (para a aba "Acessos").
// Aceita ?limit=50 (default 100, max 500) e ?onlyLogged=1 para filtrar só logados.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Auth (mesmo cookie que o middleware checa, defensivo)
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
  const onlyLogged = url.searchParams.get('onlyLogged') === '1';

  if (!env.DB) {
    return json({ ok: true, rows: [], note: 'DB binding ausente' });
  }

  try {
    const where = onlyLogged ? 'WHERE is_logged_in = 1' : '';
    const stmt = env.DB.prepare(`
      SELECT id, accessed_at, path, ip_address, country, city, region, user_agent, referrer, is_logged_in
      FROM dash_access
      ${where}
      ORDER BY accessed_at DESC
      LIMIT ?
    `).bind(limit);
    const { results } = await stmt.all();

    // Resumo simples: total + por país + por dia
    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT ip_address) AS unique_ips,
        SUM(CASE WHEN is_logged_in = 1 THEN 1 ELSE 0 END) AS logged_in,
        SUM(CASE WHEN accessed_at >= ? THEN 1 ELSE 0 END) AS last_24h
      FROM dash_access
    `).bind(Math.floor(Date.now() / 1000) - 86400).first();

    return json({ ok: true, rows: results || [], summary });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
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
