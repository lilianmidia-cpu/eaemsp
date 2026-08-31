// GET /api/painel/paginas
// Uma linha por página de tráfego: visitas, cliques em CTA, cliques em "Comprar"
// e conversão. Serve para comparar as páginas entre si (teste A/B) sem ficar
// trocando o filtro e decorando número.
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&country=BR
//
// Classificar por CASE numa query só resolve de graça a colisão de prefixo:
// '/vendas3pre' é testado ANTES de '/vendas3', então cada sessão cai em um
// balde e um só. Com LIKE separado por página, '%/vendas3%' pegaria as duas.

const NO_BOT = (t) => `
  AND ${t}.user_agent IS NOT NULL AND length(${t}.user_agent) > 15
  AND ${t}.user_agent NOT LIKE '%bot%'
  AND ${t}.user_agent NOT LIKE '%crawler%'
  AND ${t}.user_agent NOT LIKE '%spider%'
  AND ${t}.user_agent NOT LIKE '%headless%'
  AND ${t}.user_agent NOT LIKE '%python%'
  AND ${t}.user_agent NOT LIKE '%curl%'
  AND ${t}.user_agent NOT LIKE '%wget%'
  AND ${t}.user_agent NOT LIKE '%Go-http%'
  AND ${t}.user_agent NOT LIKE '%facebookexternalhit%'
`;

// A ordem importa: do caminho mais específico para o mais genérico.
const CLASSIFICA = (t) => `
  CASE
    WHEN ${t}.landing_url LIKE '%/painel%'     THEN '_interna'
    WHEN ${t}.landing_url LIKE '%/estrutura%'  THEN '_interna'
    WHEN ${t}.landing_url LIKE '%/dash%'       THEN '_interna'
    WHEN ${t}.landing_url LIKE '%/vendas3pre%' THEN 'vendas3pre'
    WHEN ${t}.landing_url LIKE '%/vendas4pre%' THEN 'vendas4pre'
    WHEN ${t}.landing_url LIKE '%/vendaspre%'  THEN 'vendaspre'
    WHEN ${t}.landing_url LIKE '%/vendas2%'    THEN 'vendas2'
    WHEN ${t}.landing_url LIKE '%/vendas3%'    THEN 'vendas3'
    WHEN ${t}.landing_url LIKE '%/vendas4%'    THEN 'vendas4'
    WHEN ${t}.landing_url LIKE '%/sp2026pre%'  THEN 'sp2026pre'
    WHEN ${t}.landing_url LIKE '%/vendasvideo2%' THEN 'vendasvideo2'
    WHEN ${t}.landing_url LIKE '%/vendasvideo%'  THEN 'vendasvideo'
    WHEN ${t}.landing_url LIKE '%/vendas5pre%' THEN 'vendas5pre'
    WHEN ${t}.landing_url LIKE '%/vendas5%'    THEN 'vendas5'
    ELSE 'home'
  END
`;

const ROTULOS = {
  home:       'Home',
  vendas2:    '/vendas2',
  vendas3:    '/vendas3 (roxo)',
  vendas4:    '/vendas4 (verde)',
  vendas3pre: '/vendas3pre (roxo + form)',
  vendas4pre: '/vendas4pre (verde + form)',
  vendaspre:  '/vendaspre',
  sp2026pre:  '/sp2026pre',
  vendasvideo:  '/vendasvideo',
  vendasvideo2: '/vendasvideo2',
  vendas5:      '/vendas5',
  vendas5pre:   '/vendas5pre (+ form)',
};
const ORDEM = ['home', 'vendas2', 'vendas3', 'vendas4', 'vendas3pre', 'vendas4pre', 'vendaspre', 'sp2026pre', 'vendasvideo', 'vendasvideo2', 'vendas5', 'vendas5pre'];

const ANCORA = ['btn_cta_ancora'];
const COMPRA = ['btn_compra_alunos', 'btn_compra_publico'];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }
  if (!env.DB) return json({ ok: true, data: { linhas: [], total: null } });

  const startDate = url.searchParams.get('startDate') || daysAgo(30);
  const endDate   = url.searchParams.get('endDate')   || today();
  const country   = url.searchParams.get('country')   || '';
  const startTs   = dateToEpoch(startDate, 0);
  const endTs     = dateToEpoch(endDate, 86399);

  const paisS = country ? `AND s.country = ?` : '';
  const paisP = country ? [country] : [];

  try {
    // Visitas por página
    const { results: visitas } = await env.DB.prepare(`
      SELECT ${CLASSIFICA('s')} AS pagina,
             COUNT(*) AS visitas,
             COUNT(DISTINCT s.ip_address) AS unicos
      FROM sessions s
      WHERE s.created_at >= ? AND s.created_at <= ?
        ${paisS}
        ${NO_BOT('s')}
      GROUP BY pagina
    `).bind(startTs, endTs, ...paisP).all();

    // Cliques por página. O event_log não guarda a página, só session_id: a
    // página vem do JOIN, ou seja, o clique é atribuído à página onde a pessoa
    // ENTROU. É o modelo certo pra comparar páginas entre si.
    const todos = [...ANCORA, ...COMPRA];
    const { results: cliques } = await env.DB.prepare(`
      SELECT ${CLASSIFICA('s')} AS pagina,
             SUM(CASE WHEN e.event_name IN (${ANCORA.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS ancora,
             SUM(CASE WHEN e.event_name IN (${COMPRA.map(() => '?').join(',')}) THEN 1 ELSE 0 END) AS compra
      FROM event_log e
      JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name IN (${todos.map(() => '?').join(',')})
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND (e.is_bot IS NULL OR e.is_bot = 0)
        ${paisS}
        ${NO_BOT('s')}
      GROUP BY pagina
    `).bind(...ANCORA, ...COMPRA, ...todos, startTs, endTs, ...paisP).all();

    const porPagina = {};
    for (const v of visitas || []) {
      if (v.pagina === '_interna') continue;
      porPagina[v.pagina] = { visitas: v.visitas || 0, unicos: v.unicos || 0, ancora: 0, compra: 0 };
    }
    for (const c of cliques || []) {
      if (c.pagina === '_interna' || !porPagina[c.pagina]) continue;
      porPagina[c.pagina].ancora = c.ancora || 0;
      porPagina[c.pagina].compra = c.compra || 0;
    }

    const linhas = ORDEM.filter(k => porPagina[k]).map(k => {
      const d = porPagina[k];
      return {
        key: k,
        label: ROTULOS[k] || k,
        visitas: d.visitas,
        unicos: d.unicos,
        ancora: d.ancora,
        compra: d.compra,
        conversao: pct(d.compra, d.visitas),
      };
    });

    const total = linhas.reduce((a, l) => ({
      visitas: a.visitas + l.visitas,
      unicos:  a.unicos  + l.unicos,
      ancora:  a.ancora  + l.ancora,
      compra:  a.compra  + l.compra,
    }), { visitas: 0, unicos: 0, ancora: 0, compra: 0 });
    total.conversao = pct(total.compra, total.visitas);
    total.label = 'TOTAL';

    return json({ ok: true, data: { linhas, total } });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function pct(part, tot) {
  if (!tot) return 0;
  return Math.round((part / tot) * 1000) / 10;
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
