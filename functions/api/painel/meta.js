// GET /api/painel/meta
// Dados de tráfego do site a partir da tabela sessions.
// Aceita ?type=kpis|daily|devices|campaigns&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD

const NO_BOT = `
  AND user_agent IS NOT NULL AND length(user_agent) > 15
  AND user_agent NOT LIKE '%bot%'
  AND user_agent NOT LIKE '%crawler%'
  AND user_agent NOT LIKE '%spider%'
  AND user_agent NOT LIKE '%scraper%'
  AND user_agent NOT LIKE '%headless%'
  AND user_agent NOT LIKE '%python%'
  AND user_agent NOT LIKE '%curl%'
  AND user_agent NOT LIKE '%wget%'
  AND user_agent NOT LIKE '%Go-http%'
  AND user_agent NOT LIKE '%okhttp%'
  AND user_agent NOT LIKE '%Java/%'
  AND user_agent NOT LIKE '%facebookexternalhit%'
  AND user_agent NOT LIKE '%Twitterbot%'
  AND user_agent NOT LIKE '%LinkedInBot%'
  AND user_agent NOT LIKE '%Slackbot%'
`;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  if (!env.DB) return json({ ok: true, meta_connected: true, data: {} });

  const type      = url.searchParams.get('type') || 'kpis';
  const startDate = url.searchParams.get('startDate') || daysAgo(30);
  const endDate   = url.searchParams.get('endDate')   || today();
  const country   = url.searchParams.get('country')   || '';
  const startTs   = dateToEpoch(startDate, 0);
  const endTs     = dateToEpoch(endDate, 86399);

  const COUNTRY_FILTER = country ? `AND country = '${country.replace(/'/g, '')}'` : '';
  const WHERE = `WHERE landing_url NOT LIKE '/painel%' AND created_at >= ? AND created_at <= ? ${COUNTRY_FILTER} ${NO_BOT}`;
  const B = [startTs, endTs];

  try {
    if (type === 'kpis') {
      const r = await env.DB.prepare(`
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT ip_address) AS unique_visitors,
          SUM(CASE WHEN fbclid IS NOT NULL AND fbclid != '' THEN 1
                   WHEN lower(utm_source) IN ('facebook','instagram','fb','meta') THEN 1
                   ELSE 0 END) AS meta_paid,
          SUM(CASE WHEN gclid IS NOT NULL AND gclid != ''  THEN 1
                   WHEN lower(utm_source) IN ('google','google-ads','googleads') THEN 1
                   ELSE 0 END) AS google_paid,
          SUM(CASE WHEN (fbclid IS NULL OR fbclid='') AND (gclid IS NULL OR gclid='')
                    AND (utm_source IS NULL OR utm_source='')
                    AND (referrer IS NULL OR referrer='') THEN 1 ELSE 0 END) AS direct,
          SUM(CASE WHEN (fbclid IS NULL OR fbclid='') AND (gclid IS NULL OR gclid='')
                    AND (utm_source IS NULL OR utm_source='')
                    AND referrer IS NOT NULL AND referrer!='' THEN 1 ELSE 0 END) AS organic
        FROM sessions ${WHERE}
      `).bind(...B).first();
      return json({ ok: true, meta_connected: true, data: r || {} });
    }

    if (type === 'daily') {
      const { results } = await env.DB.prepare(`
        SELECT
          date(created_at, 'unixepoch', '-3 hours') AS day,
          COUNT(*) AS total,
          SUM(CASE WHEN device_type = 'mobile' THEN 1 ELSE 0 END) AS mobile,
          SUM(CASE WHEN device_type = 'desktop' OR device_type IS NULL OR device_type='' THEN 1 ELSE 0 END) AS desktop
        FROM sessions ${WHERE}
        GROUP BY day ORDER BY day ASC
      `).bind(...B).all();
      return json({ ok: true, meta_connected: true, data: results || [] });
    }

    if (type === 'devices') {
      const { results } = await env.DB.prepare(`
        SELECT
          COALESCE(NULLIF(device_type,''), 'desktop') AS device,
          COUNT(*) AS total
        FROM sessions ${WHERE}
        GROUP BY device ORDER BY total DESC
      `).bind(...B).all();
      return json({ ok: true, meta_connected: true, data: results || [] });
    }

    if (type === 'origens') {
      const { results } = await env.DB.prepare(`
        SELECT
          CASE
            WHEN fbclid IS NOT NULL AND fbclid != '' THEN 'Meta (pago)'
            WHEN gclid  IS NOT NULL AND gclid  != '' THEN 'Google (pago)'
            WHEN lower(utm_source) IN ('facebook','instagram','fb','meta','ig')
              THEN 'Meta' || CASE WHEN utm_medium != '' THEN ' · ' || utm_medium ELSE '' END
            WHEN lower(utm_source) IN ('google','google-ads','googleads')
              THEN 'Google' || CASE WHEN utm_medium != '' THEN ' · ' || utm_medium ELSE '' END
            WHEN utm_source != ''
              THEN utm_source || CASE WHEN utm_medium != '' THEN ' · ' || utm_medium ELSE '' END
            WHEN referrer IS NOT NULL AND referrer != '' THEN
              CASE
                WHEN referrer LIKE 'https://%' THEN
                  REPLACE(SUBSTR(referrer, 9, INSTR(SUBSTR(referrer, 9) || '/', '/') - 1), 'www.', '')
                WHEN referrer LIKE 'http://%' THEN
                  REPLACE(SUBSTR(referrer, 8, INSTR(SUBSTR(referrer, 8) || '/', '/') - 1), 'www.', '')
                ELSE referrer
              END
            ELSE 'Direto'
          END AS origem,
          COUNT(*) AS visitas,
          COUNT(DISTINCT ip_address) AS unicos
        FROM sessions ${WHERE}
        GROUP BY origem
        ORDER BY visitas DESC
        LIMIT 20
      `).bind(...B).all();
      return json({ ok: true, meta_connected: true, data: results || [] });
    }

    if (type === 'campaigns') {
      const { results } = await env.DB.prepare(`
        SELECT
          CASE
            WHEN utm_source IS NOT NULL AND utm_source != '' THEN lower(utm_source)
            WHEN fbclid IS NOT NULL AND fbclid != '' THEN 'meta'
            WHEN gclid  IS NOT NULL AND gclid  != '' THEN 'google'
            ELSE 'direto'
          END AS fonte,
          COALESCE(NULLIF(utm_medium,''), '—')   AS meio,
          COALESCE(NULLIF(utm_campaign,''), '—') AS campanha,
          COUNT(*) AS visitas,
          COUNT(DISTINCT ip_address) AS unicos
        FROM sessions ${WHERE}
        GROUP BY fonte, meio, campanha
        ORDER BY visitas DESC
        LIMIT 50
      `).bind(...B).all();
      return json({ ok: true, meta_connected: true, data: results || [] });
    }

    if (type === 'cities') {
      const { results } = await env.DB.prepare(`
        SELECT
          COALESCE(NULLIF(city,''), 'Desconhecida') AS cidade,
          COALESCE(NULLIF(region,''), '') AS estado,
          COALESCE(NULLIF(country,''), '') AS pais,
          COUNT(*) AS visitas,
          COUNT(DISTINCT ip_address) AS unicos
        FROM sessions ${WHERE}
        GROUP BY cidade, estado, pais
        ORDER BY visitas DESC
        LIMIT 25
      `).bind(...B).all();
      return json({ ok: true, meta_connected: true, data: results || [] });
    }

    return json({ ok: false, error: 'type inválido' }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
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
  h.split(';').forEach(c => { const [k,...v]=c.trim().split('='); if(k) o[k.trim()]=v.join('='); });
  return o;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
