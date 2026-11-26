// =============================================================================
// srd-art-picker: a página local para cruzar os retratos embutidos com o SRD
// =============================================================================
// O QUE FAZ
//   Um servidor local (http://localhost:8791, `npm run art:picker`) com uma página no
//   jeito do Portrait Studio: um retrato do Wesnoth por vez (`public/portraits-licensed`),
//   e o dono marca para quais espécies, classes e subclasses do SRD (`srdBundle.json`)
//   ele serve, quantas quiser. Cada marcação grava na hora em `testing/srd-art/picks.json`.
//   A aba "By target" mostra o que cada alvo recebeu, para resolver os conflitos depois.
//
// FUNÇÕES
//   srdTargets(): as espécies, classes e subclasses do pacote SRD, como alvos.
//   portraits(): os retratos embutidos com as etiquetas do Wesnoth.
//   readPicks() / writePicks(picks): o arquivo das escolhas.
//   send(res, status, body, type): a resposta HTTP.
//   page(): o HTML da página (CSS e script embutidos).
//
// DECISÕES E ARMADILHAS
//   - Sem dependência e fora do app: é uma ferramenta de curadoria; o mapa resolvido entra
//     no app depois, num registro próprio.
//   - Os alvos levam nome e fonte (`class:Bard|XPHB`): os mesmos do pacote, para o mapa
//     final casar com o que o seletor mostra.
//   - As etiquetas do Wesnoth (`portraitsLicensed.json`) só SUGEREM (contorno pontilhado);
//     nada vem marcado: quem escolhe é o dono.
//   - `reviewed` separa "visto sem alvo" de "ainda não visto", para o filtro "To do".
//   - A gravação tenta de novo por ~2 s: no Windows outro processo com o arquivo aberto
//     faz a troca falhar com EPERM (§6.1).
// -----------------------------------------------------------------------------

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8791;
const IMG_DIR = path.join(ROOT, 'public', 'portraits-licensed');
const PICKS = path.join(ROOT, 'testing', 'srd-art', 'picks.json');
const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'srdBundle.json'), 'utf8'));
const licensed = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'portraitsLicensed.json'), 'utf8'));

/** As espécies, classes e subclasses do pacote SRD, como alvos. */
function srdTargets() {
  const species = bundle.races.race.map((r) => ({ key: `species:${r.name}|${r.source}`, kind: 'species', name: r.name, source: r.source }));
  const classes = [];
  const subclasses = [];
  for (const k of Object.keys(bundle).filter((x) => x.startsWith('class-'))) {
    for (const c of bundle[k].class ?? []) classes.push({ key: `class:${c.name}|${c.source}`, kind: 'class', name: c.name, source: c.source });
    for (const s of bundle[k].subclass ?? []) {
      subclasses.push({ key: `subclass:${s.className}|${s.name}|${s.source}`, kind: 'subclass', name: s.name, source: s.source, className: s.className });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  classes.sort(byName);
  subclasses.sort((a, b) => a.className.localeCompare(b.className));
  return [...species.sort(byName), ...classes, ...subclasses];
}

/** Os retratos embutidos com as etiquetas do Wesnoth. */
function portraits() {
  return licensed.items.map(([file, tags]) => ({ id: file.replace(/\.webp$/, ''), file, tags: tags.map((i) => licensed.tags[i]) }));
}

/** O arquivo das escolhas. */
function readPicks() {
  try {
    return JSON.parse(fs.readFileSync(PICKS, 'utf8'));
  } catch {
    return {};
  }
}

/** Grava as escolhas, tentando de novo se o arquivo estiver preso. */
function writePicks(picks) {
  fs.mkdirSync(path.dirname(PICKS), { recursive: true });
  const text = `${JSON.stringify(picks, null, 1)}\n`;
  const tmp = `${PICKS}.tmp`;
  fs.writeFileSync(tmp, text);
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(tmp, PICKS);
      return;
    } catch (e) {
      if (i >= 20) {
        fs.writeFileSync(PICKS, text);
        fs.rmSync(tmp, { force: true });
        return;
      }
      const until = Date.now() + 100;
      while (Date.now() < until) { /* espera curta */ }
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e;
    }
  }
}

/** A resposta HTTP. */
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page(), 'text/html; charset=utf-8');
  if (req.method === 'GET' && url.pathname === '/api/state') {
    return send(res, 200, JSON.stringify({ portraits: portraits(), targets: srdTargets(), picks: readPicks(), credit: licensed.credit }));
  }
  if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
    const file = path.basename(decodeURIComponent(url.pathname.slice(5)));
    const full = path.join(IMG_DIR, file);
    if (!full.startsWith(IMG_DIR) || !fs.existsSync(full)) return send(res, 404, 'not found', 'text/plain');
    res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'max-age=3600' });
    return fs.createReadStream(full).pipe(res);
  }
  if (req.method === 'POST' && url.pathname === '/api/pick') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try {
        const { id, targets, reviewed } = JSON.parse(raw);
        const known = new Set(portraits().map((p) => p.id));
        if (!known.has(id)) return send(res, 400, JSON.stringify({ error: 'unknown portrait' }));
        const picks = readPicks();
        picks[id] = { targets: [...new Set(targets)].sort(), reviewed: !!reviewed };
        writePicks(picks);
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: String(e.message ?? e) }));
      }
    });
    return undefined;
  }
  return send(res, 404, 'not found', 'text/plain');
});

server.listen(PORT, () => {
  console.log(`SRD art picker: http://localhost:${PORT}  (picks in ${path.relative(ROOT, PICKS)})`);
});

/** O HTML da página (CSS e script embutidos). */
function page() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SRD art picker</title>
<style>
:root{--bg:#16130f;--surface:#211c17;--raised:#2b241d;--border:#3d342a;--text:#efe6d8;--muted:#a89a87;--accent:#d9a441;--ok:#6fbf73;--warn:#e0884f;--radius:12px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.4 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;display:flex;gap:12px;align-items:center;padding:10px 16px;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(6px);border-bottom:1px solid var(--border);flex-wrap:wrap}
h1{font-size:17px;margin:0 8px 0 0}
.seg{display:inline-flex;background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:3px}
.seg button{background:none;border:0;color:var(--muted);padding:6px 14px;border-radius:999px;font:inherit;cursor:pointer}
.seg button[aria-pressed=true]{background:var(--raised);color:var(--text);box-shadow:inset 0 0 0 1px var(--accent)}
.progress{margin-left:auto;color:var(--muted);font-size:13px}
.bar{height:4px;background:var(--surface);border-radius:4px;overflow:hidden;width:160px;margin-top:4px}
.bar>i{display:block;height:100%;background:var(--accent)}
main{max-width:1180px;margin:0 auto;padding:16px}
.strip{position:relative;display:flex;gap:6px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:thin}
.strip button{flex:0 0 auto;width:54px;height:54px;border-radius:10px;border:2px solid transparent;background:var(--surface) center/cover;padding:0;cursor:pointer;position:relative}
.strip button[data-active=true]{border-color:var(--accent)}
.strip button[data-state=done]::after{content:"";position:absolute;right:3px;bottom:3px;width:9px;height:9px;border-radius:50%;background:var(--ok)}
.strip button[data-state=none]::after{content:"";position:absolute;right:3px;bottom:3px;width:9px;height:9px;border-radius:50%;background:var(--muted)}
.layout{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:20px;align-items:start}
@media (max-width:760px){.layout{grid-template-columns:1fr}}
.art{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px;position:sticky;top:76px}
.art img{width:100%;aspect-ratio:1;object-fit:contain;background:radial-gradient(circle at 50% 40%,var(--raised),var(--surface));border-radius:10px}
.art h2{margin:10px 0 2px;font-size:18px}
.art .sub{color:var(--muted);font-size:13px}
.nav{display:flex;gap:8px;margin-top:12px}
.btn{flex:1;background:var(--raised);color:var(--text);border:1px solid var(--border);border-radius:10px;height:40px;font:inherit;cursor:pointer}
.btn:hover{border-color:var(--accent)}
.btn.primary{border-color:var(--accent)}
.hint{color:var(--muted);font-size:12px;margin-top:10px}
.group{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px}
.group h3{margin:0 0 10px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--border);background:var(--raised);color:var(--text);border-radius:999px;padding:6px 14px;font:inherit;font-size:14px;cursor:pointer;min-height:34px}
.chip small{color:var(--muted);margin-left:6px}
.chip.sug{border-style:dashed;border-color:var(--muted)}
.chip[aria-pressed=true]{background:color-mix(in srgb,var(--accent) 22%,var(--raised));border:1px solid var(--accent)}
.chip .n{display:inline-block;min-width:18px;margin-left:6px;font-size:12px;color:var(--muted)}
.chip[aria-pressed=true] .n{color:var(--text)}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.tags span{font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:4px;background:var(--raised);color:var(--muted)}
.targets{display:grid;gap:12px}
.trow{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px}
.trow h4{margin:0 0 8px;font-size:15px;display:flex;gap:8px;align-items:baseline}
.trow h4 small{color:var(--muted);font-weight:400}
.trow .count{margin-left:auto;font-size:12px;color:var(--muted)}
.trow .count.many{color:var(--warn)}
.trow .count.zero{color:var(--muted);opacity:.7}
.thumbs{display:flex;flex-wrap:wrap;gap:6px}
.thumbs button{width:72px;height:72px;border-radius:10px;border:1px solid var(--border);background:var(--raised) center/contain no-repeat;cursor:pointer;padding:0}
.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:var(--raised);border:1px solid var(--border);padding:8px 14px;border-radius:999px;font-size:13px;opacity:0;transition:opacity .2s}
.toast.on{opacity:1}
footer{color:var(--muted);font-size:12px;text-align:center;padding:20px}
</style></head><body>
<header>
  <h1>SRD art picker</h1>
  <div class="seg" id="views"><button data-v="pick" aria-pressed="true">Pick</button><button data-v="targets" aria-pressed="false">By target</button></div>
  <div class="seg" id="filter"><button data-f="all" aria-pressed="true">All</button><button data-f="todo" aria-pressed="false">To do</button><button data-f="picked" aria-pressed="false">Picked</button></div>
  <div class="progress"><span id="prog"></span><div class="bar"><i id="progbar"></i></div></div>
</header>
<main id="main"></main>
<div class="toast" id="toast"></div>
<footer id="credit"></footer>
<script>
const S = { portraits: [], targets: [], picks: {}, view: 'pick', filter: 'all', at: 0 };
const $ = (s, el = document) => el.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pretty = (id) => id.replace(/-(\\d)$/, ' $1').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const stateOf = (id) => { const p = S.picks[id]; if (!p || !p.reviewed) return 'todo'; return p.targets.length ? 'done' : 'none'; };
const visible = () => S.portraits.filter((p) => S.filter === 'all' || (S.filter === 'todo' ? stateOf(p.id) === 'todo' : stateOf(p.id) === 'done'));
const counts = () => { const c = {}; for (const p of Object.values(S.picks)) for (const t of p.targets) c[t] = (c[t] || 0) + 1; return c; };
const label = (t) => t.kind === 'subclass' ? t.name + ' <small>' + esc(t.className) + '</small>' : esc(t.name);
const suggested = (p, t) => p.tags.includes((t.kind === 'subclass' ? t.className : t.name).toLowerCase());

let toastTimer;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1200); }

async function save(id, targets, reviewed) {
  S.picks[id] = { targets: [...new Set(targets)].sort(), reviewed };
  render();
  const r = await fetch('/api/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, targets, reviewed }) });
  toast(r.ok ? 'Saved' : 'Save failed');
}

function current() { const list = visible(); if (!list.length) return null; S.at = Math.max(0, Math.min(S.at, list.length - 1)); return list[S.at]; }

function go(delta) { const list = visible(); if (!list.length) return; S.at = (S.at + delta + list.length) % list.length; render(); }

function renderPick() {
  const list = visible();
  const p = current();
  if (!p) return '<p class="hint">Nothing here with this filter.</p>';
  const picked = new Set(S.picks[p.id]?.targets ?? []);
  const c = counts();
  const group = (kind, title) => '<section class="group"><h3>' + title + '</h3><div class="chips">' + S.targets.filter((t) => t.kind === kind).map((t) =>
    '<button class="chip' + (suggested(p, t) ? ' sug' : '') + '" aria-pressed="' + picked.has(t.key) + '" data-key="' + esc(t.key) + '">' + label(t) + '<span class="n">' + (c[t.key] || '') + '</span></button>').join('') + '</div></section>';
  const strip = list.map((q, i) => '<button data-i="' + i + '" data-active="' + (q.id === p.id) + '" data-state="' + stateOf(q.id) + '" title="' + esc(pretty(q.id)) + '" style="background-image:url(/img/' + q.file + ')"></button>').join('');
  return '<div class="strip" id="strip">' + strip + '</div><div class="layout"><div class="art"><img src="/img/' + p.file + '" alt="">' +
    '<h2>' + esc(pretty(p.id)) + '</h2><div class="sub">' + (S.at + 1) + ' of ' + list.length + ' · ' + esc(stateOf(p.id) === 'todo' ? 'not reviewed' : stateOf(p.id) === 'none' ? 'reviewed, no target' : picked.size + ' target(s)') + '</div>' +
    '<div class="tags">' + p.tags.map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>' +
    '<div class="nav"><button class="btn" id="prev">Back</button><button class="btn" id="none">No target</button><button class="btn primary" id="next">Done, next</button></div>' +
    '<p class="hint">Dashed chips match the Wesnoth tags (a hint only). Keys: arrows move, Enter marks done and goes on, 0 marks no target. The number on a chip is how many portraits it already has.</p></div>' +
    '<div>' + group('species', 'Species') + group('class', 'Classes') + group('subclass', 'Subclasses') + '</div></div>';
}

function renderTargets() {
  const by = {};
  for (const [id, p] of Object.entries(S.picks)) for (const t of p.targets) (by[t] ??= []).push(id);
  const file = Object.fromEntries(S.portraits.map((p) => [p.id, p.file]));
  return '<div class="targets">' + S.targets.map((t) => {
    const ids = by[t.key] ?? [];
    const cls = ids.length === 0 ? 'zero' : ids.length > 1 ? 'many' : '';
    return '<div class="trow"><h4>' + label(t) + ' <small>' + t.kind + '</small><span class="count ' + cls + '">' + (ids.length === 0 ? 'none yet' : ids.length + (ids.length > 1 ? ' (to resolve)' : '')) + '</span></h4>' +
      '<div class="thumbs">' + ids.map((id) => '<button data-open="' + esc(id) + '" title="' + esc(pretty(id)) + '" style="background-image:url(/img/' + file[id] + ')"></button>').join('') + '</div></div>';
  }).join('') + '</div>';
}

function render() {
  for (const b of document.querySelectorAll('#views button')) b.setAttribute('aria-pressed', b.dataset.v === S.view);
  for (const b of document.querySelectorAll('#filter button')) b.setAttribute('aria-pressed', b.dataset.f === S.filter);
  $('#filter').style.visibility = S.view === 'pick' ? 'visible' : 'hidden';
  const done = S.portraits.filter((p) => stateOf(p.id) !== 'todo').length;
  $('#prog').textContent = done + ' of ' + S.portraits.length + ' reviewed';
  $('#progbar').style.width = (S.portraits.length ? (100 * done) / S.portraits.length : 0) + '%';
  $('#main').innerHTML = S.view === 'pick' ? renderPick() : renderTargets();
  const strip = $('#strip');
  const act = $('#strip [data-active=true]');
  if (strip && act) strip.scrollLeft = act.offsetLeft - strip.clientWidth / 2 + act.offsetWidth / 2;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.v) { S.view = b.dataset.v; return render(); }
  if (b.dataset.f) { S.filter = b.dataset.f; S.at = 0; return render(); }
  if (b.dataset.i) { S.at = Number(b.dataset.i); return render(); }
  if (b.dataset.open) { S.view = 'pick'; S.filter = 'all'; S.at = S.portraits.findIndex((p) => p.id === b.dataset.open); return render(); }
  const p = current();
  if (!p) return;
  if (b.dataset.key) {
    const set = new Set(S.picks[p.id]?.targets ?? []);
    set.has(b.dataset.key) ? set.delete(b.dataset.key) : set.add(b.dataset.key);
    return save(p.id, [...set], true);
  }
  if (b.id === 'prev') return go(-1);
  if (b.id === 'next') return done(p);
  if (b.id === 'none') return none(p);
});

function advance(p, before) {
  const list = visible();
  const i = list.findIndex((q) => q.id === p.id);
  S.at = i === -1 ? before : (i + 1) % Math.max(list.length, 1);
  render();
}

function done(p) {
  const before = S.at;
  save(p.id, S.picks[p.id]?.targets ?? [], true).then(() => advance(p, before));
}

function none(p) {
  const before = S.at;
  save(p.id, [], true).then(() => advance(p, before));
}

document.addEventListener('keydown', (e) => {
  if (S.view !== 'pick' || e.target.closest('input,textarea')) return;
  const p = current();
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === 'Enter' && p) { e.preventDefault(); done(p); }
  else if (e.key === '0' && p) none(p);
});

fetch('/api/state').then((r) => r.json()).then((d) => {
  Object.assign(S, d);
  const first = S.portraits.findIndex((p) => stateOf(p.id) === 'todo');
  S.at = first === -1 ? 0 : first;
  $('#credit').innerHTML = 'Portraits: <a style="color:inherit" href="' + d.credit.link + '">' + esc(d.credit.by) + '</a>';
  render();
});
</script></body></html>`;
}
