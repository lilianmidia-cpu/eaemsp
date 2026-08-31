// Busca o script de terceiro uma vez, guarda no cache do edge e serve do
// nosso domínio dali pra frente. Só o ARQUIVO da biblioteca passa por aqui —
// as chamadas de rastreamento que o script faz em runtime (pixel, Clarity)
// continuam indo direto pro domínio deles, com as URLs absolutas que já vêm
// escritas dentro do próprio script. Isso não muda tracking, só onde o
// arquivo é baixado.
async function proxyScript(context, originUrl) {
  const { request } = context;
  const cache = caches.default;
  const cacheKey = new Request(originUrl, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const origin = await fetch(originUrl, {
      headers: { 'User-Agent': request.headers.get('User-Agent') || '' },
    });

    if (!origin.ok) {
      return new Response('// fetch failed', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    const scriptBody = await origin.text();

    const response = new Response(scriptBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });

    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return new Response('// proxy error', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = (params.path || []).join('/');

  if (path === 'fbevents.js') {
    return proxyScript(context, 'https://connect.facebook.net/en_US/fbevents.js');
  }

  if (path === 'clarity.js') {
    const clarityId = url.searchParams.get('id');
    if (!clarityId) {
      return new Response('// no clarity id', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
    return proxyScript(context, `https://www.clarity.ms/tag/${clarityId}`);
  }

  // padrão: gtag.js (compatível com o /scripts/gtag.js?id=... que já existia)
  const measurementId = url.searchParams.get('id') || env.GA4_MEASUREMENT_ID;

  if (!measurementId) {
    return new Response('// no measurement id', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  return proxyScript(context, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
}
