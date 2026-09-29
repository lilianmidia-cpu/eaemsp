// GET /api/relatorio/vendas-diarias
// Header: X-Report-Key: <env.REPORT_KEY>
//
// Vendas aprovadas da Gravação (Hotmart) por dia, desde o go-live, no fuso de
// Brasília. Consumido pelo Apps Script da planilha "Vendas Hotmart - controle
// diario" (relatorio-gastos/hotmart-apps-script.js), que o Claude lê pelo Drive
// pra montar o relatório diário. Só números: nenhum dado de comprador sai daqui.

const HOTMART_PRODUCT_ID_GRAVACAO = '8500318';
const GRAVACAO_GO_LIVE_TS = Math.floor(Date.UTC(2026, 8, 22, 14, 51, 22) / 1000); // 22/09/2026 11:51 (BRT)

export async function onRequestGet(context) {
  const { request, env } = context;

  const expected = (env.REPORT_KEY || '').trim();
  const sent = (request.headers.get('X-Report-Key') || '').trim();
  if (!expected || !sent || !timingSafeEqual(sent, expected)) {
    return json({ ok: false, error: 'Não autorizado' }, 401);
  }
  if (!env.DB) return json({ ok: false, error: 'DB indisponível' }, 500);

  try {
    const { results } = await env.DB.prepare(`
      SELECT date(created_at - 10800, 'unixepoch') AS dia,
             SUM(CASE WHEN COALESCE(status, 'approved') = 'approved' THEN 1 ELSE 0 END) AS vendas,
             SUM(CASE WHEN COALESCE(status, 'approved') = 'approved' THEN value ELSE 0 END) AS faturamento,
             SUM(CASE WHEN COALESCE(status, 'approved') = 'approved' THEN 0 ELSE 1 END) AS desfeitas
      FROM purchase_log
      WHERE product_id = ? AND created_at >= ?
      GROUP BY dia
      ORDER BY dia
    `).bind(HOTMART_PRODUCT_ID_GRAVACAO, GRAVACAO_GO_LIVE_TS).all();

    return json({ ok: true, produto: 'Gravação (Hotmart ' + HOTMART_PRODUCT_ID_GRAVACAO + ')', dias: results || [] });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
