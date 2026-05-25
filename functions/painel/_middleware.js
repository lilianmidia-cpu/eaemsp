// Middleware do painel (dashboard) — /painel/*
//
// 1. Bloqueia acesso se NÃO houver cookie `painel_auth` válido,
//    exceto para /painel/login (que precisa ser livre).
// 2. Registra cada acesso autenticado em dash_access (para a aba Acessos).
//
// A senha é validada pelo POST /api/painel/login.
// Aqui só verificamos se o cookie está presente e bate com a env PAINEL_SENHA.

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // /painel/login.html e o submit do form precisam passar livre
  const isLoginPage =
    url.pathname === '/painel/login' ||
    url.pathname === '/painel/login.html' ||
    url.pathname === '/painel/login/';

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const authToken = cookies['painel_auth'] || '';
  const expected = (env.PAINEL_SENHA || 'sucesso').trim();
  const isLoggedIn = authToken && authToken === expected;

  // Bloqueio: se não logado e não é a página de login → manda pra login
  if (!isLoggedIn && !isLoginPage) {
    return Response.redirect(new URL('/painel/login', url).toString(), 302);
  }

  // Já logado tentando ir pra login? Manda direto pro dash
  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL('/painel', url).toString(), 302);
  }

  // Segue o request normalmente
  const response = await next();

  // Loga o acesso (só páginas HTML, não arquivos estáticos)
  const isPageRequest = !url.pathname.match(
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map|json|webp|avif)$/i
  );

  if (isPageRequest && env.DB) {
    context.waitUntil(logAccess(env.DB, request, url, isLoggedIn));
  }

  return response;
}

async function logAccess(db, request, url, isLoggedIn) {
  try {
    const cf = request.cf || {};
    const ip = request.headers.get('cf-connecting-ip') || '';
    const country = request.headers.get('cf-ipcountry') || cf.country || '';
    const city = cf.city || '';
    const region = cf.region || '';
    const ua = request.headers.get('user-agent') || '';
    const ref = request.headers.get('referer') || '';
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO dash_access
        (accessed_at, path, ip_address, country, city, region, user_agent, referrer, is_logged_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(now, url.pathname, ip, country, city, region, ua, ref, isLoggedIn ? 1 : 0).run();
  } catch (e) {
    console.error('dash_access log error:', e.message);
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
