// GET /api/painel/acessos
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&onlyLogged=1&limit=200

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  const limit      = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 500);
  const onlyLogged = url.searchParams.get('onlyLogged') === '1';
  const startDate  = url.searchParams.get('startDate') || null;
  const endDate    = url.searchParams.get('endDate')   || null;

  if (!env.DB) {
    return json({ ok: true, rows: [], summary: {}, daily: [] });
  }

  // converte YYYY-MM-DD → epoch seconds (início e fim do dia em UTC-3)
  const startTs = startDate ? dateToEpoch(startDate, 0)      : 0;
  const endTs   = endDate   ? dateToEpoch(endDate, 86399)    : 9999999999;

  try {
    const conditions = ['accessed_at >= ? AND accessed_at <= ?'];
    const binds = [startTs, endTs];

    if (onlyLogged) conditions.push('is_logged_in = 1');
    const where = 'WHERE ' + conditions.join(' AND ');

    const { results: rows } = await env.DB.prepare(`
      SELECT id, accessed_at, path, ip_address, country, city, region, user_agent, referrer, is_logged_in
      FROM dash_access
      ${where}
      ORDER BY accessed_at DESC
      LIMIT ?
    `).bind(...binds, limit).all();

    const summary = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT ip_address) AS unique_ips,
        SUM(CASE WHEN is_logged_in = 1 THEN 1 ELSE 0 END) AS logged_in,
        SUM(CASE WHEN accessed_at >= ? THEN 1 ELSE 0 END) AS last_24h
      FROM dash_access
      ${where}
    `).bind(Math.floor(Date.now() / 1000) - 86400, ...binds).first();

    // acessos por dia para o gráfico
    const { results: daily } = await env.DB.prepare(`
      SELECT
        date(accessed_at, 'unixepoch', '-3 hours') AS day,
        COUNT(*) AS total,
        COUNT(DISTINCT ip_address) AS unique_ips
      FROM dash_access
      ${where}
      GROUP BY day
      ORDER BY day ASC
    `).bind(...binds).all();

    return json({ ok: true, rows: rows || [], summary: summary || {}, daily: daily || [] });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

// YYYY-MM-DD → epoch seconds (fuso Brasilia UTC-3)
function dateToEpoch(ymd, secondsOffset) {
  const [y, m, d] = ymd.split('-').map(Number);
  // meia-noite em Brasilia = 03:00 UTC
  return Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000) + secondsOffset;
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
