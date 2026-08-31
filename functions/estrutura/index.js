export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const authToken = cookies['estrutura_auth'] || '';
  const expected = (env.ESTRUTURA_SENHA || 'VEJA').trim();

  if (!authToken || authToken !== expected) {
    return Response.redirect(new URL('/estrutura/login', url).toString(), 302);
  }

  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach((c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) out[k.trim()] = rest.join('=');
  });
  return out;
}

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Grupo LC · Estrutura & Jornada do Autor</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --white:       #FFFFFF;
  --off-white:   #FAF8FC;
  --purple-main: #9B7EC8;
  --purple-light:#C4A8E8;
  --purple-pale: #EDE4F7;
  --purple-deep: #6B4FA0;
  --black:       #1A1A1A;
  --gray:        #5A5A5A;
  --gray-light:  #E8E4EF;
  --line:        #D5C8EA;
}

body {
  background: var(--white);
  font-family: 'Inter', sans-serif;
  color: var(--black);
  padding: 0;
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* — HERO — */
.hero {
  background: var(--black);
  padding: 56px 48px 48px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(155,126,200,0.25) 0%, transparent 70%);
}

.hero-eyebrow {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--purple-light);
  margin-bottom: 16px;
  position: relative;
}

.hero h1 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 900;
  color: var(--white);
  line-height: 1.08;
  position: relative;
}

.hero h1 em {
  font-style: italic;
  color: var(--purple-light);
}

.hero-sub {
  margin-top: 18px;
  font-size: 18px;
  font-weight: 300;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.3px;
  line-height: 1.5;
  position: relative;
}

/* — SECTION LABEL — */
.section-label {
  text-align: center;
  padding: 40px 48px 0;
}
.section-label span {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--purple-main);
}

/* — ORGANOGRAMA — */
.org-wrap {
  padding: 32px 40px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.org-root {
  display: flex;
  justify-content: center;
  margin-bottom: 0;
}

.root-box {
  background: var(--black);
  color: var(--white);
  border-radius: 8px;
  padding: 18px 48px;
  text-align: center;
  position: relative;
}

.root-box .rb-name {
  font-family: 'Playfair Display', serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--white);
}

.v-line-root {
  display: flex;
  justify-content: center;
  height: 32px;
}
.v-line-root::after {
  content: '';
  width: 2px;
  height: 100%;
  background: var(--purple-main);
}

.h-bar-wrap {
  display: flex;
  justify-content: center;
}
.h-bar {
  width: 75%;
  height: 2px;
  background: var(--purple-main);
  position: relative;
}
.h-bar::before,
.h-bar::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--purple-main);
  top: -4px;
}
.h-bar::before { left: 0; }
.h-bar::after  { right: 0; }
.h-bar .h-mid {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--purple-main);
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
}

.branches {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  max-width: 1200px;
  margin: 0 auto;
}

.branch {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.branch-vline {
  width: 2px;
  height: 28px;
  background: var(--purple-main);
}

.empresa-card {
  width: 100%;
  max-width: 320px;
  border: 2px solid var(--purple-main);
  border-radius: 10px;
  overflow: hidden;
  background: var(--white);
  box-shadow: 0 4px 24px rgba(155,126,200,0.13);
}

.ec-header {
  background: var(--purple-pale);
  padding: 16px 20px 14px;
  border-bottom: 2px solid var(--purple-main);
  text-align: center;
}

.ec-phase {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--purple-deep);
  margin-bottom: 8px;
  background: white;
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  border: 2px solid var(--purple-deep);
}

.ec-name {
  font-family: 'Playfair Display', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--black);
  line-height: 1.15;
}

.ec-tagline {
  font-size: 14.5px;
  color: var(--gray);
  margin-top: 7px;
  line-height: 1.5;
}

.ec-services {
  padding: 16px 18px 18px;
}

.ec-services-title {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--purple-main);
  margin-bottom: 10px;
}

.svc {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 9px;
}
.svc:last-child { margin-bottom: 0; }

.svc-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--purple-main);
  flex-shrink: 0;
  margin-top: 5px;
}

.svc-name {
  font-size: 15.5px;
  font-weight: 600;
  color: var(--black);
  line-height: 1.4;
}

.svc-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  background: var(--purple-pale);
  color: var(--purple-deep);
  border: 1px solid var(--purple-light);
  border-radius: 3px;
  padding: 1px 5px;
  margin-left: 5px;
  vertical-align: middle;
}

/* — JORNADA STRIP — */
.journey-strip {
  background: var(--purple-pale);
  border-top: 2px solid var(--line);
  border-bottom: 2px solid var(--line);
  padding: 28px 48px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  margin: 0;
}

.jstep {
  text-align: center;
  padding: 0 40px;
  position: relative;
}

.jstep:not(:last-child)::after {
  content: '→';
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 22px;
  color: var(--purple-main);
  font-weight: 700;
}

.jstep-num {
  font-family: 'Playfair Display', serif;
  font-size: 42px;
  font-weight: 900;
  color: var(--purple-light);
  line-height: 1;
}

.jstep-word {
  font-family: 'Playfair Display', serif;
  font-size: 24px;
  font-weight: 700;
  color: var(--black);
  margin-top: 4px;
}

.jstep-who {
  font-size: 13.5px;
  color: var(--gray);
  margin-top: 6px;
  font-weight: 400;
}

/* — DETALHE DOS SERVIÇOS — */
.detail-section {
  padding: 56px 48px;
  max-width: 1200px;
  margin: 0 auto;
}

.detail-header {
  text-align: center;
  margin-bottom: 48px;
}

.detail-header .eyebrow {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--purple-main);
  margin-bottom: 12px;
}

.detail-header h2 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(30px, 4.5vw, 46px);
  font-weight: 700;
  color: var(--black);
  line-height: 1.2;
}

.detail-header h2 span {
  color: var(--purple-main);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

.detail-col {
  border: 1.5px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.dcol-header {
  background: var(--purple-pale);
  padding: 20px 24px 16px;
  border-bottom: 1.5px solid var(--line);
}

.dcol-phase {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--purple-deep);
  margin-bottom: 6px;
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  border: 2px solid var(--purple-deep);
  background: white;
}

.dcol-name {
  font-family: 'Playfair Display', serif;
  font-size: 25px;
  font-weight: 700;
  color: var(--black);
}

.dcol-body {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dsvc {
  border-left: 3px solid var(--purple-light);
  padding-left: 14px;
}

.dsvc-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--black);
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.35;
}

.dsvc-desc {
  font-size: 15px;
  font-weight: 400;
  color: var(--gray);
  line-height: 1.65;
}

.dsvc-para {
  font-size: 14px;
  font-weight: 500;
  color: var(--purple-deep);
  margin-top: 7px;
  font-style: italic;
  line-height: 1.5;
}

/* — TOGGLE DE MÓDULOS — */
.btn-modulos {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: 1.5px solid var(--purple-light);
  border-radius: 8px;
  padding: 11px 16px;
  font-family: 'Inter', sans-serif;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--purple-deep);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  width: 100%;
  text-align: left;
}
.btn-modulos:hover {
  background: var(--purple-pale);
  border-color: var(--purple-main);
}
.btn-modulos .chevron {
  margin-left: auto;
  font-size: 11px;
  transition: transform 0.2s;
}
.btn-modulos.aberto .chevron {
  transform: rotate(180deg);
}

.modulos-lista {
  display: none;
  flex-direction: column;
  gap: 18px;
}
.modulos-lista.aberto {
  display: flex;
}

/* — FOOTER — */
footer {
  background: var(--black);
  padding: 32px 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.footer-tagline {
  font-family: 'Playfair Display', serif;
  font-size: 19px;
  font-style: italic;
  color: rgba(255,255,255,0.6);
}

.footer-tagline strong {
  color: var(--purple-light);
  font-style: normal;
}

.footer-tag {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

@media (max-width: 860px) {
  .branches { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .journey-strip { flex-direction: column; gap: 20px; }
  .jstep:not(:last-child)::after { display: none; }
  .h-bar { width: 60%; }
}
</style>
</head>
<body>

<!-- HERO -->
<div class="hero">
  <p class="hero-eyebrow">Grupo LC · Documento Interno</p>
  <h1>Escrever · Publicar · Divulgar —<br><em>a jornada completa do autor</em></h1>
  <p class="hero-sub">Entenda como o Grupo LC está estruturado e o que cada empresa faz</p>
</div>

<!-- ORGANOGRAMA -->
<div class="section-label" style="padding-top:48px;">
  <span>Estrutura do grupo</span>
</div>

<div class="org-wrap">

  <!-- RAIZ -->
  <div class="org-root">
    <div class="root-box">
      <div class="rb-name">Grupo LC</div>
    </div>
  </div>

  <!-- LINHA VERTICAL -->
  <div class="v-line-root"></div>

  <!-- BARRA HORIZONTAL -->
  <div class="h-bar-wrap">
    <div class="h-bar"><div class="h-mid"></div></div>
  </div>

  <!-- 3 BRANCHES -->
  <div class="branches">

    <!-- Lilian Cardoso -->
    <div class="branch">
      <div class="branch-vline"></div>
      <div class="empresa-card">
        <div class="ec-header">
          <div class="ec-phase">Fase 01 · Escrever</div>
          <div class="ec-name">Lilian Cardoso</div>
          <div class="ec-tagline">Marca pessoal da fundadora — para quem ainda está criando ou quer divulgar por conta própria</div>
        </div>
        <div class="ec-services">
          <div class="ec-services-title">Produto 01</div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Escritores Admiráveis 5.0</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">+182 aulas · 45h · Acesso vitalício</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Concurso literário exclusivo p/ alunos</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Aulas ao vivo trimestrais (bônus)</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name"><a href="https://escritoresadmiraveis.com.br" target="_blank" style="color:var(--purple-deep);text-decoration:none;font-size:12px;">→ escritoresadmiraveis.com.br</a></div></div>
          <div style="border-top:1.5px solid var(--line);margin:10px 0;"></div>
          <div class="ec-services-title">Produto 02</div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Mentoria Arquitetos do Livro</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">4 meses · encontros quinzenais ao vivo</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">8 módulos · da ideia ao lançamento</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Orientação individual por projeto</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name"><a href="https://liliancardoso.com.br/arquitetosdolivro/" target="_blank" style="color:var(--purple-deep);text-decoration:none;font-size:13px;">→ liliancardoso.com.br/arquitetosdolivro</a></div></div>
          <div style="border-top:1.5px solid var(--line);margin:10px 0;"></div>
          <div class="ec-services-title">Livro</div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">O Livro Secreto do Escritor</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name"><a href="https://www.olivrosecretodoescritor.com.br/" target="_blank" style="color:var(--purple-deep);text-decoration:none;font-size:13px;">→ olivrosecretodoescritor.com.br</a></div></div>
        </div>
      </div>
    </div>

    <!-- LC Books -->
    <div class="branch">
      <div class="branch-vline"></div>
      <div class="empresa-card">
        <div class="ec-header">
          <div class="ec-phase">Fase 02 · Publicar</div>
          <div class="ec-name">LC Books</div>
          <div class="ec-tagline">Editora do grupo — transforma o manuscrito em livro publicado e o distribui nacionalmente</div>
        </div>
        <div class="ec-services">
          <div class="ec-services-title">Serviços</div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Editoração completa (capa, diagramação, ISBN, ficha catalográfica)</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Distribuição nacional (Catavento + Loyola)</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">+1.000 pontos de venda · Bookinfo</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Inscrição em prêmios literários</div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Posicionamento e acesso aos cursos LC</div></div>
          <div class="svc"><div class="svc-dot"></div>
            <div class="svc-name"><a href="https://lcbookseditora.com.br" target="_blank" style="color:var(--purple-deep);text-decoration:none;font-size:12px;">→ lcbookseditora.com.br</a></div>
          </div>
        </div>
      </div>
    </div>

    <!-- LC Agência -->
    <div class="branch">
      <div class="branch-vline"></div>
      <div class="empresa-card">
        <div class="ec-header">
          <div class="ec-phase">Fase 03 · Divulgar</div>
          <div class="ec-name">LC Agência</div>
          <div class="ec-tagline">Agência especializada no universo literário — visibilidade e posicionamento do autor no mercado</div>
        </div>
        <div class="ec-services">
          <div class="ec-services-title">Foco atual — tráfego ativo</div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Press LC — Assessoria de imprensa <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Consultoria de Marketing Editorial <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Leitura Coletiva <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div></div>
          <div class="svc"><div class="svc-dot"></div><div class="svc-name">Leitura Crítica <span class="svc-badge">pré-publicação</span> <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div></div>
          <div class="ec-services-title" style="margin-top:12px;">Em breve</div>
          <div class="svc"><div class="svc-dot" style="background:#C4A8E8;"></div><div class="svc-name">Redes Express <span class="svc-badge" style="background:#fff3cd;color:#856404;border-color:#ffc107;">em breve</span></div></div>
          <div class="ec-services-title" style="margin-top:12px;">Outros serviços</div>
          <div class="svc"><div class="svc-dot" style="background:#C4A8E8;"></div><div class="svc-name">Master LC · DNA Best-Seller · Consultoria para Editoras · Dev de Sites</div></div>
          <div class="svc"><div class="svc-dot" style="background:#C4A8E8;"></div>
            <div class="svc-name"><a href="https://lcagencia.com.br/divulgacao/" target="_blank" style="color:var(--purple-deep);text-decoration:none;font-size:12px;">→ lcagencia.com.br/divulgacao</a></div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- JORNADA STRIP -->
<div class="journey-strip">
  <div class="jstep">
    <div class="jstep-num">01</div>
    <div class="jstep-word">Escrever</div>
    <div class="jstep-who">Lilian Cardoso</div>
  </div>
  <div class="jstep">
    <div class="jstep-num">02</div>
    <div class="jstep-word">Publicar</div>
    <div class="jstep-who">LC Books</div>
  </div>
  <div class="jstep">
    <div class="jstep-num">03</div>
    <div class="jstep-word">Divulgar</div>
    <div class="jstep-who">LC Agência</div>
  </div>
</div>

<!-- DETALHE DOS SERVIÇOS -->
<div class="detail-section">
  <div class="detail-header">
    <p class="eyebrow">Conheça cada serviço</p>
    <h2>O que cada empresa <span>entrega na prática</span></h2>
  </div>

  <div class="detail-grid">

    <!-- Lilian Cardoso detalhe -->
    <div class="detail-col">
      <div class="dcol-header">
        <div class="dcol-phase">Fase 01 · Escrever</div>
        <div class="dcol-name">Lilian Cardoso</div>
      </div>
      <div class="dcol-body">

        <div style="font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--purple-main);margin-bottom:8px;">Produto 01</div>

        <div class="dsvc">
          <div class="dsvc-name">Escritores Admiráveis 5.0 <span class="svc-badge" style="font-size:9px;background:#EDE4F7;color:#6B4FA0;border:1px solid #C4A8E8;border-radius:3px;padding:1px 6px;margin-left:4px;">Hotmart</span></div>
          <div class="dsvc-desc">O curso para escritores mais completo do Brasil. +182 aulas, 45h de conteúdo, acesso e suporte vitalícios. Cobre da ideia ao lançamento — escrita, publicação, marketing e vendas.</div>
          <div class="dsvc-para">Para quem: quem quer escrever, publicar e vender seu livro com estratégia</div>
        </div>

        <!-- TOGGLE DE MÓDULOS -->
        <button class="btn-modulos" id="btn-modulos" onclick="toggleModulos()">
          <span>📚 Ver módulos do curso (5 módulos + extras)</span>
          <span class="chevron">▼</span>
        </button>

        <!-- MÓDULOS OCULTOS -->
        <div class="modulos-lista" id="modulos-lista">

          <div class="dsvc">
            <div class="dsvc-name">Módulo 1 — Que tipo de escritor você é?</div>
            <div class="dsvc-desc">Desenvolvimento pessoal, identificação de voz, objetivos e público-alvo. 11 lições.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 2 — Construindo sua marca</div>
            <div class="dsvc-desc">Marketing pessoal, conexão com leitores e posicionamento no mercado literário. 40 lições.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 3 — Produza seu livro</div>
            <div class="dsvc-desc">Etapas editoriais completas: capa, gráfica, editoras, ISBN, ficha catalográfica. 53 lições.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 4 — Marketing e divulgação</div>
            <div class="dsvc-desc">Estratégias práticas para decolar as vendas — tipos de marketing aplicados ao mercado literário. 49 lições.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 5 — Vendas e carreira</div>
            <div class="dsvc-desc">Distribuição, venda em livrarias, outras formas de renda e planejamento de carreira com estratégia financeira. 29 lições.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Oficinas extras 2026</div>
            <div class="dsvc-desc">CapCut, Canva, Oratória, Amazon KDP, Escrita Criativa, Livro Infantil, Escrita Terapêutica, Roteiro Cinematográfico, Direito Autoral, TikTok para Escritores e mais.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">🎁 Bônus — Aulas ao Vivo Trimestrais</div>
            <div class="dsvc-desc">1 encontro ao vivo por trimestre com tendências do mercado editorial, estratégias atualizadas de marketing e espaço para perguntas dos alunos.</div>
            <div class="dsvc-para">Exclusivo para alunos do curso</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">🎖 Concurso Literário Exclusivo</div>
            <div class="dsvc-desc">Alunos podem concorrer a prêmios literários com publicação e distribuição nacional por editora tradicional, assessoria de imprensa, marketing nas redes, website e book trailer.</div>
            <div class="dsvc-para">Para quem: alunos ativos do curso</div>
          </div>

        </div>
        <!-- /módulos ocultos -->

        <div class="dsvc">
          <div class="dsvc-name">Site do curso</div>
          <div class="dsvc-desc"><a href="https://escritoresadmiraveis.com.br" target="_blank" style="color:var(--purple-deep);font-weight:600;">escritoresadmiraveis.com.br →</a></div>
        </div>

        <!-- DIVISOR -->
        <div style="border-top:1.5px solid var(--line);margin:0;"></div>

        <!-- PRODUTO 2 -->
        <div style="font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--purple-main);margin-bottom:8px;">Produto 02</div>

        <div class="dsvc">
          <div class="dsvc-name">Mentoria Arquitetos do Livro <span class="svc-badge" style="font-size:9px;background:#EDE4F7;color:#6B4FA0;border:1px solid #C4A8E8;border-radius:3px;padding:1px 6px;margin-left:4px;">Hotmart</span></div>
          <div class="dsvc-desc">Programa intensivo de escrita com 4 meses de duração, coordenado por Lilian Cardoso e a equipe de especialistas do Grupo LC. Acompanha o autor da concepção à finalização do livro com qualidade editorial. Encontros quinzenais online ao vivo, com gravações disponíveis na Hotmart. Acesso de 4 meses de suporte mais 6 meses de aulas gravadas.</div>
          <div class="dsvc-para">Para quem: autor que começou e não consegue terminar, que tem boas ideias mas não sabe desenvolver, ou que terminou e tem insegurança sobre a qualidade</div>
        </div>

        <!-- TOGGLE MENTORIA -->
        <button class="btn-modulos" id="btn-mentoria" onclick="toggleMentoria()">
          <span>🏛 Ver os 8 módulos da mentoria</span>
          <span class="chevron">▼</span>
        </button>

        <div class="modulos-lista" id="mentoria-lista">

          <div class="dsvc">
            <div class="dsvc-name">Módulo 1 · Tema e compromisso</div>
            <div class="dsvc-desc">Definição temática, gênero e metas de escrita.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 2 · Público-leitor e escaleta</div>
            <div class="dsvc-desc">Persona, pesquisa de nicho e posicionamento.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 3 · Estrutura narrativa</div>
            <div class="dsvc-desc">Começo, desenvolvimento, final, ritmo e fluidez.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 4 · Construção de personagens</div>
            <div class="dsvc-desc">Personagens profundos ou voz autoral forte.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 5 · Clichês e originalidade</div>
            <div class="dsvc-desc">Evitar repetições e riscos de plágio.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 6 · Sumário e sinopse</div>
            <div class="dsvc-desc">Estruturação final e textos descritivos.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 7 · Miolo e complementos</div>
            <div class="dsvc-desc">Ajustes finais, orelha, contracapa e prefácio.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Módulo 8 · Publicação e lançamento</div>
            <div class="dsvc-desc">Registro autoral e caminhos de distribuição.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">O que está incluído</div>
            <div class="dsvc-desc">Orientação individual por projeto, feedback e críticas de especialistas, ferramentas e inteligências artificiais para organização, indicação de editoras e modelos de proposta comercial, orientação sobre autopublicação e Amazon, kit de boas-vindas enviado pelo correio e suporte por email.</div>
          </div>

          <div class="dsvc">
            <div class="dsvc-name">Não está incluído</div>
            <div class="dsvc-desc">Impressão ou publicação do livro, revisão profissional e leitura crítica pós-mentoria (recomendadas após a mentoria).</div>
          </div>

        </div>

        <div class="dsvc">
          <div class="dsvc-name">Site da mentoria</div>
          <div class="dsvc-desc"><a href="https://liliancardoso.com.br/arquitetosdolivro/" target="_blank" style="color:var(--purple-deep);font-weight:600;">liliancardoso.com.br/arquitetosdolivro →</a></div>
        </div>

        <!-- DIVISOR -->
        <div style="border-top:1.5px solid var(--line);margin:0;"></div>

        <!-- LIVRO -->
        <div style="font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--purple-main);margin-bottom:8px;">Livro</div>

        <div class="dsvc">
          <div class="dsvc-name">O Livro Secreto do Escritor</div>
          <div class="dsvc-desc">Guia prático da Lilian Cardoso sobre os bastidores do mercado editorial brasileiro. Conduz o leitor por três etapas: entender o mercado literário, escrever e publicar (com capa, ISBN e produção) e as estratégias de pós-lançamento para construir carreira.</div>
          <div class="dsvc-para">Para quem: autor iniciante que quer transformar sua história em livro publicado</div>
          <div style="margin-top:8px;"><a href="https://www.olivrosecretodoescritor.com.br/" target="_blank" style="color:var(--purple-deep);font-weight:600;">olivrosecretodoescritor.com.br →</a></div>
        </div>

      </div>
    </div>

    <!-- LC Books detalhe -->
    <div class="detail-col">
      <div class="dcol-header">
        <div class="dcol-phase">Fase 02 · Publicar</div>
        <div class="dcol-name">LC Books</div>
      </div>
      <div class="dcol-body">

        <div class="dsvc">
          <div class="dsvc-name">Editoração completa</div>
          <div class="dsvc-desc">Processo editorial profissional de ponta a ponta: design de capa, diagramação, ISBN, ficha catalográfica e selo editorial. Cada obra é conduzida por um editor profissional com rigor técnico e participação ativa do autor — do manuscrito ao livro pronto para impressão e distribuição.</div>
          <div class="dsvc-para">Para quem: autor com manuscrito pronto que quer publicar com qualidade premium</div>
          <div style="margin-top:8px;padding:8px 10px;background:#fff8e1;border-left:3px solid #ffc107;border-radius:3px;font-size:11px;color:#856404;">⚠️ <strong>A confirmar com Brenda:</strong> selo editorial — verificar se o autor usa o selo da LC Books ou pode ter o próprio. <em>(Informação não consta no site)</em></div>
        </div>

        <div class="dsvc">
          <div class="dsvc-name">Distribuição nacional</div>
          <div class="dsvc-desc">Logística em São Paulo via duas grandes distribuidoras — Catavento e Loyola — que atendem as principais redes e livrarias do Brasil. Obras cadastradas na Bookinfo, maior ecossistema B2B do mercado editorial nacional. Mais de 1.000 pontos de venda.</div>
          <div class="dsvc-para">Para quem: autor publicado pela LC Books que quer presença física nas livrarias</div>
        </div>

        <div class="dsvc">
          <div class="dsvc-name">Divulgação estratégica integrada</div>
          <div class="dsvc-desc">Acesso direto à LC Agência — maior agência de assessoria de imprensa literária do Brasil — para posicionar o livro na mídia nacional, conectando autor a jornalistas e veículos relevantes.</div>
          <div class="dsvc-para">Para quem: autor publicado que quer visibilidade na mídia junto à publicação</div>
        </div>

        <div class="dsvc">
          <div class="dsvc-name">Inscrição em prêmios literários</div>
          <div class="dsvc-desc">Acompanhamento do calendário editorial e inscrição em prêmios nacionais sempre que alinhado ao perfil da obra — fortalecendo o posicionamento do autor no mercado.</div>
          <div class="dsvc-para">Para quem: autor que quer reconhecimento e credibilidade no mercado</div>
        </div>

        <div class="dsvc">
          <div class="dsvc-name">Posicionamento do autor</div>
          <div class="dsvc-desc">Publicar é também construir autoridade. A LC Books orienta estrategicamente os autores e dá acesso aos cursos editoriais e de marketing da Lilian Cardoso para que a obra seja parte de uma presença mais ampla e consistente.</div>
          <div class="dsvc-para">Para quem: autor que quer construir carreira, não só publicar um livro</div>
        </div>

        <div class="dsvc">
          <div class="dsvc-name">Site e loja</div>
          <div class="dsvc-desc">
            <a href="https://lcbookseditora.com.br" target="_blank" style="color:var(--purple-deep);font-weight:600;">lcbookseditora.com.br →</a> — site institucional e loja com catálogo completo
          </div>
        </div>

      </div>
    </div>

    <!-- LC Agência detalhe -->
    <div class="detail-col">
      <div class="dcol-header">
        <div class="dcol-phase">Fase 03 · Divulgar</div>
        <div class="dcol-name">LC Agência</div>
      </div>
      <div class="dcol-body">

        <div style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--purple-main);margin-bottom:4px;">Foco atual — tráfego ativo</div>

        <div class="dsvc" style="border-left-color:var(--purple-main);">
          <div class="dsvc-name">Press LC — Assessoria de Imprensa <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div>
          <div class="dsvc-desc">Release profissional, calendário de 60 dias, envio para até 60 mil contatos (6 disparos), follow ativo com jornalistas, clipagem completa e relatório final. Garante inserções em portais, jornais, revistas, rádios, TV e podcasts.</div>
          <div class="dsvc-para">Para quem: autor publicado que quer visibilidade na mídia nacional</div>
        </div>

        <div class="dsvc" style="border-left-color:var(--purple-main);">
          <div class="dsvc-name">Consultoria de Marketing Editorial <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div>
          <div class="dsvc-desc">Plano de marketing personalizado: análise de público, estratégia de conteúdo, nova identidade visual, templates prontos, dicas de anúncios (criativos, segmentações, testes A/B) e direcionamento por plataforma (Instagram, TikTok, Facebook, LinkedIn).</div>
          <div class="dsvc-para">Para quem: autor que quer posicionamento e clareza antes ou após o lançamento</div>
        </div>

        <div class="dsvc" style="border-left-color:var(--purple-main);">
          <div class="dsvc-name">Leitura Coletiva <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div>
          <div class="dsvc-desc">Curadoria de 20 a 30 bookstagrammers e booktokers qualificados que recebem o livro, participam de debate virtual com o autor e publicam resenhas. Incentiva avaliações na Amazon. Relatório final com resultados.</div>
          <div class="dsvc-para">Para quem: autor no lançamento que quer prova social e avaliações reais</div>
        </div>

        <div class="dsvc" style="border-left-color:var(--purple-main);">
          <div class="dsvc-name">Leitura Crítica <span class="svc-badge">pré-publicação</span> <span class="svc-badge" style="background:#d4edda;color:#155724;border-color:#c3e6cb;">→ tráfego</span></div>
          <div class="dsvc-desc">Especialista no tema do livro lê o manuscrito antes da publicação e faz apontamentos críticos — onde aprofundar, corrigir ou fortalecer o conteúdo.</div>
          <div class="dsvc-para">Para quem: autor com o manuscrito escrito, prestes a publicar — na transição entre escrever e publicar</div>
        </div>

        <div style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#856404;margin:4px 0 4px;">Em breve</div>

        <div class="dsvc" style="border-left-color:#ffc107;">
          <div class="dsvc-name">Redes Express <span class="svc-badge" style="background:#fff3cd;color:#856404;border-color:#ffc107;">em breve</span></div>
          <div class="dsvc-desc">Gestão das redes sociais do autor — conteúdo, calendário editorial e presença digital no Instagram. Tráfego pago sendo estruturado.</div>
          <div class="dsvc-para">Para quem: autor que quer presença digital gerenciada pela agência</div>
        </div>

        <div style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--gray);margin:4px 0 4px;">Outros serviços disponíveis</div>

        <div class="dsvc" style="border-left-color:var(--line);">
          <div class="dsvc-name" style="color:var(--gray);">Master LC · Mentoria DNA Best-Seller · Consultoria para Editoras · Desenvolvimento de Sites</div>
          <div class="dsvc-desc">Serviços disponíveis no portfólio da agência. Consulte em <a href="https://lcagencia.com.br/produtos-e-servicos/" target="_blank" style="color:var(--purple-deep);">lcagencia.com.br/produtos-e-servicos →</a></div>
        </div>

        <div class="dsvc" style="border-left-color:var(--line);">
          <div class="dsvc-name">Sites de captação</div>
          <div class="dsvc-desc">
            <a href="https://lcagencia.com.br" target="_blank" style="color:var(--purple-deep);font-weight:600;">lcagencia.com.br →</a> — site institucional<br>
            <a href="https://lcagencia.com.br/divulgacao/" target="_blank" style="color:var(--purple-deep);font-weight:600;">lcagencia.com.br/divulgacao →</a> — página de tráfego pago
          </div>
        </div>

      </div>
    </div>

  </div>
</div>

<!-- IMAGEM ORGANOGRAMA -->
<div style="padding:56px 48px;text-align:center;">
  <img src="/organograma-grupo-lc.png" alt="Organograma do Grupo LC — Lilian Cardoso, LC Books e LC Agência"
       style="max-width:1100px;width:100%;height:auto;border-radius:14px;box-shadow:0 8px 40px rgba(155,126,200,0.18);">
</div>

<!-- PROPÓSITO -->
<div style="background:var(--purple-pale);padding:64px 48px;text-align:center;">
  <div style="max-width:760px;margin:0 auto;">
    <p style="font-size:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--purple-main);margin-bottom:22px;">Por que o Grupo LC existe</p>
    <h2 style="font-family:'Playfair Display',serif;font-size:clamp(32px,5vw,52px);font-weight:700;color:var(--black);line-height:1.2;margin-bottom:30px;">O mundo merece ler<br><em style="color:var(--purple-main);">a sua história.</em></h2>
    <p style="font-size:19px;font-weight:300;color:var(--gray);line-height:1.85;margin-bottom:16px;">Não prometemos fórmulas de enriquecimento. Prometemos realizar o sonho de ver seu livro nas livrarias, de ter pessoas lendo sua história, de ser conhecido pelo que você tem a dizer.</p>
    <p style="font-size:19px;font-weight:300;color:var(--gray);line-height:1.85;margin-bottom:16px;">Para quem escreve ficção, poesia ou qualquer gênero — sua voz importa e merece chegar longe.</p>
    <p style="font-size:19px;font-weight:300;color:var(--gray);line-height:1.85;">Para quem é profissional ou especialista — um livro abre portas, constrói autoridade e deixa um legado.</p>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <p class="footer-tagline">Escrever · Publicar · Divulgar — <strong>o autor nunca está sozinho.</strong></p>
  <p class="footer-tag">Grupo LC · Uso interno da equipe</p>
</footer>

<script>
  function toggleModulos() {
    const lista = document.getElementById('modulos-lista');
    const btn = document.getElementById('btn-modulos');
    const aberto = lista.classList.contains('aberto');

    if (aberto) {
      lista.classList.remove('aberto');
      btn.classList.remove('aberto');
      btn.querySelector('span:first-child').textContent = '📚 Ver módulos do curso (5 módulos + extras)';
    } else {
      lista.classList.add('aberto');
      btn.classList.add('aberto');
      btn.querySelector('span:first-child').textContent = '📚 Ocultar módulos do curso';
    }
  }

  function toggleMentoria() {
    const lista = document.getElementById('mentoria-lista');
    const btn = document.getElementById('btn-mentoria');
    const aberto = lista.classList.contains('aberto');

    if (aberto) {
      lista.classList.remove('aberto');
      btn.classList.remove('aberto');
      btn.querySelector('span:first-child').textContent = '🏛 Ver os 8 módulos da mentoria';
    } else {
      lista.classList.add('aberto');
      btn.classList.add('aberto');
      btn.querySelector('span:first-child').textContent = '🏛 Ocultar os 8 módulos da mentoria';
    }
  }
</script>

</body>
</html>`;
