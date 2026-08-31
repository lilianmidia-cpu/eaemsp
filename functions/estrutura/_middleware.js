// Middleware para /estrutura/* — página interna da equipe
// Usa cookie próprio `estrutura_auth`, independente do painel.
// Sem registro em DB — essa página não é rastreada.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const isLoginPage =
    url.pathname === '/estrutura/login' ||
    url.pathname === '/estrutura/login/';

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const authToken = cookies['estrutura_auth'] || '';
  const expected = (env.ESTRUTURA_SENHA || 'VEJA').trim();
  const isLoggedIn = authToken && authToken === expected;

  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL('/estrutura/login', url).toString(), 302);
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL('/estrutura', url).toString(), 302);
  }

  return next();
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) out[k.trim()] = rest.join('=');
  });
  return out;
}
