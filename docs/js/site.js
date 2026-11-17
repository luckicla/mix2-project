'use strict';
// Mix²: lee las releases de MixUp y de Mix4Up en GitHub y rellena la web
// (versión, tamaños, novedades, tablas y cifras). Primero pregunta a la API
// de GitHub; si falla (sin internet o límite de peticiones), usa
// data/releases.json, que el workflow de esta web regenera cada hora.

const APPS = {
  mixup: {
    name: 'MixUp', repo: 'luckicla/zentor', logo: 'img/mixup.png',
    apk: 'https://github.com/luckicla/zentor/releases/download/android-latest/MixUp.apk',
    // del 1.x se llamaba ZenTor
    label: tag => (/^v?1\./.test(tag) ? 'ZenTor ' : 'MixUp ') + tag.replace(/^v/, ''),
    isMain: tag => /^v?[2-9]\d*\./.test(tag),
    files: { inst: /Instalador.*\.exe$/i, port: /Portable.*\.exe$/i, apk: /\.apk$/i, single: /^(MixUp|ZenTor)\.exe$/i },
  },
  mix4up: {
    name: 'Mix4Up', repo: 'luckicla/mix4up', logo: 'img/mix4up.svg',
    apk: 'https://github.com/luckicla/mix4up/releases/download/mix4up-android-latest/Mix4Up.apk',
    label: tag => 'Mix4Up ' + tag.replace(/^v/, ''),
    isMain: () => true,
    files: { inst: /Instalador.*\.exe$/i, port: /Portable.*\.exe$/i, apk: /\.apk$/i },
  },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fecha = d => new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = d => new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
const mb = b => b >= 1048576 ? (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const num = n => n.toLocaleString('es');
const hace = d => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return 'hace ' + Math.max(1, Math.round(s / 60)) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  const dd = Math.round(s / 86400);
  return dd === 1 ? 'ayer' : dd < 30 ? 'hace ' + dd + ' días' : fechaCorta(d);
};
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------- menú del móvil ---------- */
const burger = $('.burger'), menu = $('#menu');
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') !== 'true';
  burger.setAttribute('aria-expanded', open);
  menu.hidden = !open;
});
menu.addEventListener('click', e => { if (e.target.closest('a')) { menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); } });

/* ---------- pestañas (descargas y versiones) ---------- */
function tabs(attr, paneOf) {
  const btns = $$(`[${attr}]`);
  const pick = b => {
    btns.forEach(x => {
      const on = x === b;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      paneOf(x.getAttribute(attr)).hidden = !on;
    });
  };
  btns.forEach((b, i) => {
    b.addEventListener('click', () => pick(b));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
      pick(n); n.focus();
    });
  });
  return pick;
}
const pickTab = tabs('data-tab', id => $('#pane-' + id));
tabs('data-vtab', id => $('#vpane-' + id));
// si llegas con #descargas-mix4up, abre esa pestaña
if (/mix4up/i.test(location.hash) && location.hash !== '#mix4up') pickTab($('[data-tab="mix4up"]'));

/* ---------- QR de los APK ---------- */
for (const [id, app] of Object.entries(APPS)) {
  try {
    const q = qrcode(0, 'M'); q.addData(app.apk); q.make();
    $('#qr-' + id).innerHTML = q.createSvgTag({ cellSize: 6, margin: 1, scalable: true });
  } catch (e) { console.error(e); }
}

/* ---------- la cinta: se duplica para que gire sin cortes ---------- */
const ticker = $('#ticker');
ticker.innerHTML += ticker.innerHTML;

/* ---------- markdown sencillo para las notas ---------- */
function md(t) {
  const out = []; let list = false;
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])[_*]([^_*]+?)[_*](?=[\s).,:;!?]|$)/g, '$1<i>$2</i>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  for (const raw of String(t || '').replace(/\r/g, '').split('\n')) {
    const l = raw.trimEnd(); let m;
    if ((m = /^\s*[-*]\s+(.*)/.exec(l))) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if ((m = /^(#{1,4})\s+(.*)/.exec(l))) out.push(`<h4>${inline(m[2])}</h4>`);
    else if (l.trim()) out.push('<p>' + inline(l) + '</p>');
  }
  if (list) out.push('</ul>');
  return out.join('');
}
// quita de las notas lo que ya explica la web: el título repetido y lo de «¿Es seguro?»
function cleanNotes(body) {
  return String(body || '').replace(/\r/g, '')
    .split(/\n#{2,4}\s*¿Es seguro/)[0]
    .replace(/^\s*##\s+(MixUp|Mix4Up)[^\n]*\n/, '')
    .split('\n').filter(l => !/^Windows o Android pueden avisar/.test(l)).join('\n').trim();
}

/* ---------- cargar las releases ---------- */
const slim = r => ({
  tag_name: r.tag_name, name: r.name, published_at: r.published_at, html_url: r.html_url, body: r.body,
  assets: (r.assets || []).map(a => ({ name: a.name, size: a.size, download_count: a.download_count, browser_download_url: a.browser_download_url })),
});
let snapshot = null;
async function fromSnapshot() {
  if (!snapshot) snapshot = fetch('data/releases.json?_=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
  return snapshot;
}
async function load(id) {
  const app = APPS[id], key = 'mix2:' + id;
  const newest = l => (l && l.length ? Math.max(...l.map(r => +new Date(r.published_at))) : 0);
  const sort = l => l.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  // siempre se pregunta a GitHub, sin caché: así una versión recién publicada sale al momento
  try {
    const r = await fetch(`https://api.github.com/repos/${app.repo}/releases?per_page=100&_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (r.ok) {
      const list = (await r.json()).filter(x => !x.draft && !x.prerelease && /^v\d/.test(x.tag_name)).map(slim);
      store.set(key, { t: Date.now(), list });
      return sort(list);
    }
  } catch {}
  // si GitHub no contesta, la copia más nueva que haya: la del navegador o la de la web
  const c = store.get(key), s = await fromSnapshot();
  const a = c && c.list, b = s && s.apps && s.apps[id];
  const best = newest(a) >= newest(b) ? a : b;
  return best && best.length ? sort(best) : null;
}

const asset = (r, re) => (r.assets || []).find(a => re.test(a.name));
const fileOf = (id, r, kind) => asset(r, APPS[id].files[kind]) || (kind === 'inst' && APPS[id].files.single ? asset(r, APPS[id].files.single) : null);

/* ---------- pintar ---------- */
function paintApp(id, list) {
  const app = APPS[id];
  const latest = list.find(r => app.isMain(r.tag_name)) || list[0];
  if (!latest) return;
  const v = latest.tag_name.replace(/^v/, '');
  $$(`[data-ver="${id}"]`).forEach(el => { el.textContent = 'v' + v; });
  $$(`[data-verline="${id}"]`).forEach(el => { el.textContent = `Versión ${v} · ${fecha(latest.published_at)} · gratis`; });
  // tamaños de los archivos (los botones siguen bajando la release fija «latest»)
  for (const kind of ['inst', 'port', 'apk']) {
    const a = fileOf(id, latest, kind);
    if (a) $$(`[data-size="${id}:${kind}"]`).forEach(el => { el.textContent = mb(a.size); });
  }
  // la tabla de versiones
  const link = a => a ? `<a href="${esc(a.browser_download_url)}">Descargar</a><small>${mb(a.size)}</small>` : '<small>—</small>';
  $('#vers-' + id).innerHTML = list.map((r, i) => `<tr>
    <td><b>${esc(app.label(r.tag_name))}</b>${r === latest ? '<span class="latest">Última</span>' : ''}</td>
    <td>${fechaCorta(r.published_at)}</td>
    <td>${link(fileOf(id, r, 'inst'))}</td><td>${link(fileOf(id, r, 'port'))}</td><td>${link(fileOf(id, r, 'apk'))}</td></tr>`).join('');
}

function failApp(id) {
  const app = APPS[id];
  $$(`[data-verline="${id}"]`).forEach(el => { el.textContent = 'Gratis · Windows y Android'; });
  $('#vers-' + id).innerHTML = `<tr><td colspan="5" class="fine">No he podido cargar las versiones. Míralas en <a href="https://github.com/${app.repo}/releases">GitHub</a>.</td></tr>`;
}

let feed = [], filter = 'all', shown = 8;
function paintFeed() {
  const items = feed.filter(x => filter === 'all' || x.id === filter);
  const log = $('#log');
  if (!items.length) { log.innerHTML = '<p class="fine">No he podido cargar las novedades. Míralas en GitHub: <a href="https://github.com/luckicla/zentor/releases">MixUp</a> · <a href="https://github.com/luckicla/mix4up/releases">Mix4Up</a>.</p>'; $('#more').hidden = true; return; }
  const firstOf = {};
  feed.forEach(x => { if (!firstOf[x.id] && APPS[x.id].isMain(x.r.tag_name)) firstOf[x.id] = x.r; });
  log.innerHTML = items.slice(0, shown).map((x, i) => {
    const app = APPS[x.id], r = x.r, first = firstOf[x.id] === r;
    const files = ['inst', 'port', 'apk'].map(k => [k, fileOf(x.id, r, k)]).filter(([, a]) => a);
    const names = { inst: 'Windows', port: 'Portable', apk: 'Android' };
    const notes = cleanNotes(r.body);
    return `<article class="rel ${x.id}${first ? ' first' : ''}" style="animation-delay:${Math.min(i, 8) * 40}ms">
      <header><img src="${app.logo}" alt=""><b>${esc(app.label(r.tag_name))}</b>${first ? '<span class="tag new">Última</span>' : ''}<time datetime="${esc(r.published_at)}" title="${fecha(r.published_at)}">${hace(r.published_at)}</time></header>
      ${files.length ? `<div class="assets">${files.map(([k, a]) => `<a href="${esc(a.browser_download_url)}">↓ ${names[k]} <small>${mb(a.size)}</small></a>`).join('')}</div>` : ''}
      ${notes ? `<details${i === 0 ? ' open' : ''}><summary>Notas de la versión</summary><div class="notes">${md(notes)}</div></details>` : ''}
    </article>`;
  }).join('');
  $('#more').hidden = items.length <= shown;
}
$$('.chip').forEach(c => c.addEventListener('click', () => {
  filter = c.dataset.f; shown = 8;
  $$('.chip').forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', x === c); });
  paintFeed();
}));
$('#more').addEventListener('click', () => { shown += 8; paintFeed(); });

// las cifras cuentan hacia arriba al verlas
function countUp(el, to, fmt = num) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1200;
  setTimeout(() => { el.textContent = fmt(to); }, dur + 300);
  const step = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function paintStats(all) {
  const versions = all.length;
  const downloads = all.reduce((s, x) => s + (x.r.assets || []).reduce((t, a) => t + (a.download_count || 0), 0), 0);
  const last = all[0] && all[0].r.published_at;
  const go = () => {
    countUp($('[data-stat="versions"]'), versions);
    if (downloads) countUp($('[data-stat="downloads"]'), downloads); else $('[data-stat="downloads"]').textContent = '—';
    if (last) $('[data-stat="last"]').textContent = hace(last);
  };
  const box = $('#stats');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { threshold: .4 });
    io.observe(box);
    setTimeout(() => { io.disconnect(); if ($('[data-stat="versions"]').textContent === '—') go(); }, 4000);
  } else go();
}

(async () => {
  const ids = Object.keys(APPS);
  const lists = await Promise.all(ids.map(load));
  ids.forEach((id, i) => { if (lists[i] && lists[i].length) paintApp(id, lists[i]); else failApp(id); });
  feed = ids.flatMap((id, i) => (lists[i] || []).map(r => ({ id, r }))).sort((a, b) => new Date(b.r.published_at) - new Date(a.r.published_at));
  paintFeed();
  if (feed.length) paintStats(feed);
  const s = await fromSnapshot();
  if (s && s.generated) $('#updated').textContent = 'Datos de versiones revisados ' + hace(s.generated);
})();
