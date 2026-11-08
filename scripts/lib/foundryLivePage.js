// =============================================================================
// foundryLivePage: o harness que roda DENTRO de um mundo Foundry real (T2d)
// =============================================================================
// O QUE FAZ
//   Carregado por eval no console de um mundo dnd5e (o servidor do
//   `scripts/foundry-live.js serve` entrega o arquivo), importa os atores do lote
//   como o botão "Import Data" faria, mede o que o Foundry deriva e devolve tudo
//   ao servidor local: a ficha guardada (para a volta pelo nosso import) e o
//   relatório. Fica em `window.FLYBY_LIVE`.
//
// FUNÇÕES
//   folder(name): a pasta de atores do lote (criada se faltar).
//   capture(): grava console.error e console.warn enquanto um ator entra.
//   unresolved(formula, rollData): a fórmula com referência que não resolve, ou null.
//   check(actor): os problemas de runtime (fórmula sem dado, alvo de consumo sem
//     item, item sem usos que é gasto) e os números derivados.
//   snapshot(actor): os números que a ficha mostra (CA, HP, CD, perícias, armas,
//     contêineres, peso), para o lado a lado com o premade oficial.
//   tempActor(text, name): o ator só em memória (o padrão das rodadas).
//   importText(text, name, folderId): cria o ator no mundo e aplica o JSON
//     (importFromJSON), para o que precisa de interação (`persist: true`).
//   importOne(file, opts): um ator do lote, checado e devolvido ao servidor.
//   run(opts): o lote inteiro, em série (`persist` grava numa pasta).
//   runPremades(opts): cada premade oficial e a nossa reexportação, lado a lado.
//
// DECISÕES E ARMADILHAS
//   - O navegador do app bloqueia a página pública de buscar `localhost` até a
//     permissão de rede local; o fetch leva `targetAddressSpace: 'loopback'`.
//     Janela nova (window.open) troca a PRÓPRIA aba e o iframe é barrado: o
//     caminho que funciona é o fetch direto.
//   - ROLL_TIME: caminhos que faltam no ator e NÃO são defeito. `@mod` em bônus de
//     perícia e no Martial Arts é dado da rolagem (os premades usam igual);
//     `@attributes.spell.level` é o nível de conjurador de NPC, somado ao
//     `@details.level` do personagem na mesma fórmula (Booming Blade: o Foundry
//     conta o ausente como 0 e rola 3d8 no nível 20, medido); a flag do módulo
//     oficial `dnd-players-handbook` vem do próprio pack do SRD (Mirror Image).
//     A regra geral fica estrita: foi ela que pegou o Persistent Rage.
//   - Não embrulhar `ui.notifications.notify`: o libWrapper do Plutonium acusa
//     conflito em toda chamada.
//   - As rodadas usam ator TEMPORÁRIO por padrão (tempActor: o JSON com os mesmos
//     `_id`, sem pasta e dono, num `new Actor` que não grava; o `fromCompendium`
//     do Foundry 13 exige um documento, não um objeto): cerca de 1.000
//     atores gravados esgotaram a RAM do servidor do dono (2026-11-08). Usar uma
//     activity ou subir de nível pede ator gravado (`persist: true`).
//   - Nada é apagado no mundo: o gravado fica na pasta para o dono limpar. Por isso
//     o ator já importado se procura DENTRO da pasta da rodada: `getName` acha o
//     de uma rodada velha (aconteceu, e o lado a lado mediu o export de antes).
// -----------------------------------------------------------------------------

const { game, Actor, Folder, Roll, foundry } = globalThis;
const BASE = 'http://127.0.0.1:8787';
const NET = { targetAddressSpace: 'loopback' };
const MISSING = '§MISSING§';
const ROLL_TIME = /@mod\b|@attributes[.]spell[.]level|@flags[.]dnd-players-handbook[.]/;

async function folder(name) {
  return game.folders.find((f) => f.type === 'Actor' && f.name === name)
    || Folder.implementation.create({ name, type: 'Actor' });
}

function capture() {
  const logs = [];
  const orig = { error: console.error, warn: console.warn };
  const grab = (tag, fn) => (...a) => { logs.push(`${tag}: ${a.map((x) => x?.message ?? String(x)).join(' ').slice(0, 400)}`); fn(...a); };
  console.error = grab('E', orig.error);
  console.warn = grab('W', orig.warn);
  return { logs, restore() { console.error = orig.error; console.warn = orig.warn; } };
}

function unresolved(formula, rollData) {
  if (formula == null || formula === '' || typeof formula === 'number') return null;
  const s = String(formula);
  if (!s.includes('@') || ROLL_TIME.test(s)) return null;
  const r = Roll.replaceFormulaData(s, rollData, { missing: MISSING });
  return r.includes(MISSING) || r.includes('@') ? s : null;
}

function check(actor) {
  const issues = [];
  const add = (kind, where, detail) => issues.push({ kind, where, detail });
  for (const item of actor.items) {
    const where = `${item.type}:${item.name}`;
    const rd = item.getRollData?.() ?? actor.getRollData();
    const srcMax = item._source.system?.uses?.max;
    if (srcMax) {
      const u = unresolved(srcMax, rd);
      if (u) add('uses-formula', where, u);
    }
    for (const act of item.system.activities ?? []) {
      const aw = `${where} > ${act.name || act.type}`;
      const ard = act.getRollData?.() ?? rd;
      const formulas = [
        ...(act.damage?.parts ?? []).map((p) => (p.custom?.enabled ? p.custom.formula : null)),
        ...(act.damage?.parts ?? []).map((p) => p.scaling?.formula),
        act.healing?.custom?.enabled ? act.healing.custom.formula : null,
        act._source?.uses?.max, act.attack?.bonus, act.save?.dc?.formula, act.check?.dc?.formula, act.roll?.formula,
      ];
      for (const f of formulas) { const u = unresolved(f, ard); if (u) add('formula', aw, u); }
      for (const t of act.consumption?.targets ?? []) {
        const tag = `${t.type}:${typeof t.target === 'object' ? JSON.stringify(t.target) : t.target} x${t.value}`;
        if (t.type === 'itemUses') {
          const target = t.target ? actor.items.get(t.target) : item;
          if (!target) add('consume-missing-item', aw, tag);
          else if (!target.system.uses?.max && target.type === 'feat') add('consume-item-no-uses', aw, `${tag} -> ${target.name}`);
        } else if (t.type === 'activityUses' && !act.uses?.max) add('consume-activity-no-uses', aw, tag);
        else if (t.type === 'attribute' && foundry.utils.getProperty(actor.system, t.target) === undefined) add('consume-bad-attribute', aw, tag);
        const u = typeof t.value === 'string' ? unresolved(t.value, ard) : null;
        if (u) add('consume-cost-formula', aw, u);
      }
    }
  }
  for (const e of [...actor.effects, ...actor.items.contents.flatMap((i) => [...i.effects])]) {
    for (const c of e.changes ?? []) {
      const u = typeof c.value === 'string' && !c.value.includes('<') ? unresolved(c.value, actor.getRollData()) : null;
      if (u) add('effect-formula', `${e.parent?.name ?? ''} > ${e.name} ${c.key}`, u);
    }
  }
  for (const w of actor._preparationWarnings ?? []) add('preparation-warning', actor.name, w.message);
  return issues;
}

function snapshot(a) {
  const s = a.system;
  const weapons = {};
  for (const i of a.items.filter((x) => x.type === 'weapon')) {
    const atk = i.system.activities?.find((x) => x.type === 'attack');
    weapons[i.name] = atk ? { toHit: atk.labels?.toHit ?? null, dmg: (atk.labels?.damages ?? []).map((d) => d.formula).join(' + ') } : null;
  }
  return {
    level: s.details.level, ac: s.attributes.ac.value, hpMax: s.attributes.hp.max, prof: s.attributes.prof,
    init: s.attributes.init.total, spellDc: s.attributes.spell?.dc, speed: s.attributes.movement.walk,
    enc: Math.round((s.attributes.encumbrance.value ?? 0) * 100) / 100,
    saves: Object.fromEntries(Object.entries(s.abilities).map(([k, v]) => [k, v.save?.value ?? v.save])),
    skills: Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v.total])),
    slots: Object.fromEntries(Object.entries(s.spells).filter(([, v]) => v.max).map(([k, v]) => [k, v.max])),
    weapons,
    containers: a.items.filter((i) => i.type === 'container').map((p) => ({ name: p.name, n: a.items.filter((i) => i.system.container === p.id).length })),
    spellActivities: Object.fromEntries(a.items.filter((i) => i.type === 'spell')
      .map((i) => [i.name, [...i.system.activities].map((x) => x.type).filter((t) => t !== 'forward').sort().join('+')])),
  };
}

/** O ator SÓ em memória: o Foundry prepara e calcula, nada vai para o mundo. */
function tempActor(text, name) {
  const source = JSON.parse(text);
  delete source.folder;
  delete source.ownership;
  source.name = name;
  return new Actor.implementation(source);
}

async function importText(text, name, folderId) {
  const data = JSON.parse(text);
  let actor = await Actor.implementation.create({ name: data.name, type: 'character', folder: folderId });
  await actor.importFromJSON(text);
  actor = game.actors.get(actor.id);
  await actor.update({ name, folder: folderId });
  return actor;
}

async function importOne(file, { persist = false, folderId = null } = {}) {
  const text = await (await fetch(`${BASE}/a/${encodeURIComponent(file)}`, NET)).text();
  const cap = capture();
  let actor = null;
  let error = null;
  const name = file.replace(/[.]json$/, '');
  try { actor = persist ? await importText(text, name, folderId) : tempActor(text, name); } catch (e) { error = String(e?.stack ?? e).slice(0, 800); }
  cap.restore();
  const res = { file, error, logs: cap.logs, persisted: persist };
  if (actor) {
    res.issues = check(actor);
    res.snapshot = snapshot(actor);
    await fetch(`${BASE}/save/${encodeURIComponent(file)}`, { ...NET, method: 'POST', body: JSON.stringify(actor.toObject()) });
  }
  return res;
}

async function run({ files, persist = false, folderName = 'FlyBy live' } = {}) {
  const f = persist ? await folder(folderName) : null;
  const list = (files ?? (await (await fetch(`${BASE}/list`, NET)).json())).filter((x) => !x.startsWith('_'));
  const L = window.FLYBY_LIVE;
  L.results = [];
  L.progress = { done: 0, total: list.length, startedAt: Date.now() };
  for (const file of list) {
    const already = f && game.actors.find((a) => a.name === file.replace(/[.]json$/, '') && a.folder?.id === f.id);
    if (!already) L.results.push(await importOne(file, { persist, folderId: f?.id }));
    L.progress.done += 1;
  }
  await fetch(`${BASE}/save/_results.json`, { ...NET, method: 'POST', body: JSON.stringify(L.results) });
  L.progress.finishedAt = Date.now();
  return L.progress;
}

async function runPremades({ persist = false, folderName = 'FlyBy live premades' } = {}) {
  const f = persist ? await folder(folderName) : null;
  const pairs = await (await fetch(`${BASE}/a/_pairs.json`, NET)).json();
  const L = window.FLYBY_LIVE;
  L.pres = [];
  L.preProgress = { done: 0, total: pairs.length };
  for (const p of pairs) {
    const base = p.orig.replace(/[.]json$/, '');
    const row = { orig: p.orig };
    try {
      const get = async (prefix, url) => {
        const name = prefix + base;
        if (!persist) return tempActor(await (await fetch(url, NET)).text(), name);
        return game.actors.find((a) => a.name === name && a.folder?.id === f.id)
          ?? importText(await (await fetch(url, NET)).text(), name, f.id);
      };
      const P = await get('OFFICIAL ', `${BASE}/p/${encodeURIComponent(p.orig)}`);
      const A = await get('OURS ', `${BASE}/a/${encodeURIComponent(p.ours)}`);
      Object.assign(row, { official: snapshot(P), ours: snapshot(A), oursIssues: check(A) });
    } catch (e) { row.error = String(e?.stack ?? e).slice(0, 600); }
    L.pres.push(row);
    L.preProgress.done += 1;
  }
  await fetch(`${BASE}/save/_premades.json`, { ...NET, method: 'POST', body: JSON.stringify(L.pres) });
  L.preProgress.fin = true;
  return L.preProgress;
}

window.FLYBY_LIVE = { folder, check, snapshot, tempActor, importText, importOne, run, runPremades };
