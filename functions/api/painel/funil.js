// GET /api/painel/funil
// Funil de cliques das páginas de venda.
// Etapas:
//   1. Acessaram a página   → tabela sessions
//   2. Clicaram em âncora  → event_log (btn_cta_ancora)
//   3. Clicaram "Comprar"  → event_log (btn_compra_alunos, btn_compra_publico)
// Aceita ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&country=BR&page=vendas3
//
// O event_log não guarda a página do clique, só o session_id. A página vem do
// JOIN com sessions.landing_url, ou seja: cada clique é atribuído à página onde
// a pessoa ENTROU no site. É o modelo certo para comparar páginas entre si.

const NO_BOT_SQL = (t) => `
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

// Data a partir da qual cliques e visitas passaram a ser medidos juntos.
// Nunca alterar para uma data anterior — isso sujaria o funil com visitas sem cliques.
const FUNIL_START_TS = Math.floor(Date.UTC(2026, 5, 15, 3, 0, 0) / 1000); // 15/06/2026

// A /vendas3 e a /vendas4 só passaram a mandar eventos btn_* a partir daqui.
// Antes desta data elas registram visita mas nenhum clique — comparar o funil
// delas com período anterior daria conversão zero e leitura errada.
const VENDAS34_START_TS = Math.floor(Date.UTC(2026, 6, 14, 3, 0, 0) / 1000); // 14/07/2026

// A /vendas3pre e a /vendas4pre nasceram nesta data.
const VENDAS34PRE_START_TS = Math.floor(Date.UTC(2026, 6, 15, 3, 0, 0) / 1000); // 15/07/2026

const ANCHOR_BTNS = ['btn_cta_ancora'];
const CHECKOUT_BTNS = ['btn_compra_alunos', 'btn_compra_publico'];
// WhatsApp não é âncora nem compra — só entra no ALL_BTNS pra aparecer no
// breakdown "Botões individualmente", sem contar nas etapas do funil.
const WHATSAPP_BTNS = ['btn_whatsapp'];
const ALL_BTNS = [...ANCHOR_BTNS, ...CHECKOUT_BTNS, ...WHATSAPP_BTNS];

// Páginas internas que nunca entram na contagem de tráfego.
const INTERNAS = ['%/painel%', '%/estrutura%', '%/dash%'];

// Cada página vira um filtro sobre sessions.landing_url (que guarda a URL cheia).
// `since` marca a partir de quando o funil daquela página é confiável.
//
// ATENÇÃO ao `except`: '%/vendas3%' casa TAMBÉM com '/vendas3pre/'. Sem excluir,
// as duas se somariam no funil e o teste A/B leria errado. Toda página nova cujo
// caminho seja prefixo de outra precisa da mesma proteção.
const PAGINAS = {
  todas:      { label: 'Todas as páginas' },
  gravacao:   { label: '/gravacao-preview (Hotmart)', like: '%/gravacao-preview%' },
  home:       { label: 'Home' },
  vendas2:    { label: '/vendas2',    like: '%/vendas2%' },
  vendas3:    { label: '/vendas3',    like: '%/vendas3%', except: ['%/vendas3pre%'], since: VENDAS34_START_TS },
  vendas4:    { label: '/vendas4',    like: '%/vendas4%', except: ['%/vendas4pre%'], since: VENDAS34_START_TS },
  vendas3pre: { label: '/vendas3pre', like: '%/vendas3pre%', since: VENDAS34PRE_START_TS },
  vendas4pre: { label: '/vendas4pre', like: '%/vendas4pre%', since: VENDAS34PRE_START_TS },
  vendaspre:  { label: '/vendaspre',  like: '%/vendaspre%' },
  sp2026pre:  { label: '/sp2026pre',  like: '%/sp2026pre%' },
  vendasvideo:  { label: '/vendasvideo',  like: '%/vendasvideo%', except: ['%/vendasvideo2%'] },
  vendasvideo2: { label: '/vendasvideo2', like: '%/vendasvideo2%' },
  vendas5:      { label: '/vendas5',      like: '%/vendas5%', except: ['%/vendas5pre%'] },
  vendas5pre:   { label: '/vendas5pre',   like: '%/vendas5pre%' },
};

// Monta o recorte de página como SQL + params. `t` é o alias da tabela sessions.
function filtroPagina(pageKey, t) {
  if (pageKey === 'home') {
    // Home = qualquer entrada que não seja uma das outras páginas nem interna.
    // Basta excluir os `like`: os mais específicos (vendas3pre) já estão
    // cobertos pelos mais genéricos (vendas3).
    const outras = Object.values(PAGINAS).filter(p => p.like).map(p => p.like);
    const excluir = [...outras, ...INTERNAS];
    return {
      sql: excluir.map(() => `AND ${t}.landing_url NOT LIKE ?`).join(' '),
      params: excluir,
    };
  }
  const p = PAGINAS[pageKey];
  if (p && p.like) {
    const except = p.except || [];
    return {
      sql: `AND ${t}.landing_url LIKE ?` +
           except.map(() => ` AND ${t}.landing_url NOT LIKE ?`).join(''),
      params: [p.like, ...except],
    };
  }
  // "todas": só tira as páginas internas.
  return {
    sql: INTERNAS.map(() => `AND ${t}.landing_url NOT LIKE ?`).join(' '),
    params: INTERNAS,
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  if (!cookies['painel_auth'] || cookies['painel_auth'] !== expected) {
    return json({ ok: false, error: 'Não autenticado' }, 401);
  }

  if (!env.DB) return json({ ok: true, data: { steps: [], breakdown: [] } });

  const startDate = url.searchParams.get('startDate') || daysAgo(30);
  const endDate   = url.searchParams.get('endDate')   || today();
  const country   = url.searchParams.get('country')   || '';

  const pageKey = PAGINAS[url.searchParams.get('page')] ? url.searchParams.get('page') : 'todas';
  const pageSince = PAGINAS[pageKey].since || FUNIL_START_TS;

  const startTs = Math.max(dateToEpoch(startDate, 0), pageSince);
  const endTs   = dateToEpoch(endDate, 86399);

  // Recorte de página/país aplicado sobre sessions — nas queries de clique a
  // tabela entra via JOIN, por isso o alias muda.
  const paginaS = filtroPagina(pageKey, 's');
  const countrySql    = country ? `AND s.country = ?` : '';
  const countryParams = country ? [country] : [];

  // Fatia comum a toda query de clique: event_log + a sessão que originou.
  const cliqueFrom = `
    FROM event_log e
    JOIN sessions s ON e.session_id = s.session_id
  `;
  const cliqueWhere = `
    AND e.timestamp >= ? AND e.timestamp <= ?
    AND (e.is_bot IS NULL OR e.is_bot = 0)
    ${paginaS.sql}
    ${countrySql}
    ${NO_BOT_SQL('s')}
  `;
  const cliqueParams = [startTs, endTs, ...paginaS.params, ...countryParams];

  try {
    // Etapa 1: visitas à(s) página(s) selecionada(s)
    const pageviews = await env.DB.prepare(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT s.ip_address) AS unicos
      FROM sessions s
      WHERE s.created_at >= ? AND s.created_at <= ?
        ${paginaS.sql}
        ${countrySql}
        ${NO_BOT_SQL('s')}
    `).bind(startTs, endTs, ...paginaS.params, ...countryParams).first();

    // Etapa 2: cliques em âncoras
    const anchorPlaceholders = ANCHOR_BTNS.map(() => '?').join(',');
    const ancoraCounts = await env.DB.prepare(`
      SELECT COUNT(*) AS total, COUNT(DISTINCT e.session_id) AS sessoes
      ${cliqueFrom}
      WHERE e.event_name IN (${anchorPlaceholders})
      ${cliqueWhere}
    `).bind(...ANCHOR_BTNS, ...cliqueParams).first();

    // Etapa 3a: cliques em "Comprar (Alunos)"
    const alunosCount = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      ${cliqueFrom}
      WHERE e.event_name = 'btn_compra_alunos'
      ${cliqueWhere}
    `).bind(...cliqueParams).first();

    // Etapa 3b: cliques em "Comprar (Público)"
    const publicoCount = await env.DB.prepare(`
      SELECT COUNT(*) AS total
      ${cliqueFrom}
      WHERE e.event_name = 'btn_compra_publico'
      ${cliqueWhere}
    `).bind(...cliqueParams).first();

    // Breakdown individual de cada botão
    const allPlaceholders = ALL_BTNS.map(() => '?').join(',');
    const { results: breakdown } = await env.DB.prepare(`
      SELECT e.event_name, COUNT(*) AS total
      ${cliqueFrom}
      WHERE e.event_name IN (${allPlaceholders})
      ${cliqueWhere}
      GROUP BY e.event_name
      ORDER BY total DESC
    `).bind(...ALL_BTNS, ...cliqueParams).all();

    const visitas   = pageviews?.total    || 0;
    const ancora    = ancoraCounts?.total || 0;
    const alunos    = alunosCount?.total  || 0;
    const publico   = publicoCount?.total || 0;
    const compras   = alunos + publico;

    return json({
      ok: true,
      data: {
        page: pageKey,
        pageLabel: PAGINAS[pageKey].label,
        steps: [
          { label: pageKey === 'todas' ? 'Acessaram o site' : `Acessaram ${PAGINAS[pageKey].label}`, value: visitas, pct: 100 },
          { label: 'Clicaram em CTA (ir p/ ingressos)', value: ancora, pct: pct(ancora, visitas) },
          { label: 'Clicaram "Comprar (Alunos)"',  value: alunos,  pct: pct(alunos, visitas) },
          { label: 'Clicaram "Comprar (Público)"', value: publico, pct: pct(publico, visitas) },
          { label: 'Total "Comprar" (ambos)',       value: compras, pct: pct(compras, visitas) },
        ],
        breakdown: breakdown || [],
      },
    });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
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
