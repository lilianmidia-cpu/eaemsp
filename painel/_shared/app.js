// Painel — utilitários compartilhados (sidebar, formatters, fetch)

const NAV = [
  { key: 'meta-ads',   label: 'Meta Ads',   href: '/painel',            icon: '▶' },
  { key: 'financeiro', label: 'Financeiro', href: '/painel/financeiro', icon: '$' },
  { key: 'acessos',    label: 'Acessos',    href: '/painel/acessos',    icon: '◉' },
];

// === Renderiza layout (sidebar + container do conteúdo) ===
// Chame com mountLayout({ active: 'meta-ads' }) no início de cada página.
export function mountLayout({ active }) {
  const root = document.getElementById('painel-root');
  if (!root) throw new Error('Falta <div id="painel-root"></div>');

  const navHtml = NAV.map((n) => `
    <a href="${n.href}" class="nav-item ${n.key === active ? 'active' : ''}">
      <span class="ico mono">${n.icon}</span>
      <span>${n.label}</span>
    </a>
  `).join('');

  root.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-badge">IE</div>
          <div>
            <div class="brand-name">Painel</div>
            <div class="brand-sub">Imersão Escritores</div>
          </div>
        </div>
        <div class="nav-section">Relatórios</div>
        ${navHtml}
        <div class="sidebar-footer">
          <div>Meta Marketing API</div>
          <button class="logout-btn" id="logoutBtn">Sair</button>
        </div>
      </aside>
      <main class="main" id="painel-main"></main>
    </div>
  `;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/painel/logout', { method: 'POST' });
    window.location.href = '/painel/login';
  });
}

// Helpers de fetch =============================================
export async function api(path) {
  const r = await fetch(path, { credentials: 'same-origin' });
  if (r.status === 401) {
    window.location.href = '/painel/login';
    throw new Error('unauthorized');
  }
  return r.json();
}

// Formatters pt-BR ============================================
export const fmt = {
  brl(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
    });
  },
  num(v) { return Number(v || 0).toLocaleString('pt-BR'); },
  pct(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }) + '%';
  },
  dec(v, n = 2) {
    return Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: n, maximumFractionDigits: n,
    });
  },
  // "2026-03-15" → "15/03/2026"
  dateBR(s) {
    if (!s) return '—';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  },
  // epoch seconds → "15/03/2026 14:32"
  ts(epochSec) {
    if (!epochSec) return '—';
    const d = new Date(epochSec * 1000);
    const opt = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' };
    return d.toLocaleString('pt-BR', opt);
  },
  // User-Agent → "Chrome · Mac"
  ua(uaStr) {
    if (!uaStr) return '—';
    let browser = 'Outro';
    if (/Edg\//.test(uaStr)) browser = 'Edge';
    else if (/Chrome\//.test(uaStr) && !/Edg\//.test(uaStr)) browser = 'Chrome';
    else if (/Firefox\//.test(uaStr)) browser = 'Firefox';
    else if (/Safari\//.test(uaStr) && !/Chrome\//.test(uaStr)) browser = 'Safari';
    let os = 'Outro';
    if (/iPhone|iPad|iPod/.test(uaStr)) os = 'iOS';
    else if (/Android/.test(uaStr)) os = 'Android';
    else if (/Mac OS X/.test(uaStr)) os = 'Mac';
    else if (/Windows/.test(uaStr)) os = 'Windows';
    else if (/Linux/.test(uaStr)) os = 'Linux';
    return `${browser} · ${os}`;
  },
  country(code) {
    if (!code) return '—';
    const flag = code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
    return `${flag} ${code}`;
  },
};

// Time window picker (botões 7d/14d/30d/etc) ==================
export function rangePicker({ container, onChange, defaultDays = 30 }) {
  const opts = [
    { label: 'Hoje',   days: 0 },
    { label: 'Ontem',  days: 1, single: true },
    { label: '7 dias', days: 7 },
    { label: '14 dias', days: 14 },
    { label: '30 dias', days: 30 },
    { label: 'Este mês', month: 'this' },
    { label: 'Mês passado', month: 'prev' },
  ];
  container.innerHTML = opts
    .map((o, i) => `<button class="range-btn ${o.days === defaultDays ? 'active' : ''}" data-i="${i}">${o.label}</button>`)
    .join('');

  function dateNDaysAgo(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function monthStart(offset = 0) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + offset);
    return d.toISOString().slice(0, 10);
  }
  function monthEnd(offset = 0) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + offset + 1, 0);
    return d.toISOString().slice(0, 10);
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.range-btn');
    if (!btn) return;
    container.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const opt = opts[parseInt(btn.dataset.i, 10)];
    let startDate, endDate;
    if (opt.month === 'this')       { startDate = monthStart(0);  endDate = today(); }
    else if (opt.month === 'prev')  { startDate = monthStart(-1); endDate = monthEnd(-1); }
    else if (opt.single)            { startDate = dateNDaysAgo(opt.days); endDate = startDate; }
    else                            { startDate = dateNDaysAgo(opt.days); endDate = today(); }
    onChange({ startDate, endDate });
  });

  // dispara o default
  const def = opts.find((o) => o.days === defaultDays);
  onChange({
    startDate: dateNDaysAgo(def.days),
    endDate: today(),
  });
}
