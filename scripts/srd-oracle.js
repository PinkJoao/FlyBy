// =============================================================================
// srd-oracle: magias e itens exportados contra o documento do SRD no dnd5e (T3)
// =============================================================================
// O QUE FAZ
//   O oráculo do documento da T3 (TESTING-PLAN §5b): para cada magia do `spells24`
//   e cada item do `equipment24` do sistema dnd5e, monta o NOSSO item pelo caminho
//   do export (buildSpellItem, buildInventoryItems) e compara os campos que a
//   ficha usa. Agrupa as diferenças por campo, com exemplos, e grava
//   `testing/report-srd-oracle.json`.
//   `npx vite-node scripts/srd-oracle.js` (ou `-- --spells`, `--items`).
//
// FUNÇÕES
//   walk(dir, out): os .yml de uma pasta, recursivo.
//   docs(pack): os documentos do pack, sem as pastas e sem as cópias de dentro dos
//     pacotes (`explorers-pack/rations.yml`, o avulso é o que vale).
//   multiset(list): a lista ordenada como texto (a comparação de conjuntos).
//   acts(doc): as activities do documento, sem a `forward`.
//   spellFields(doc), itemFields(doc): os campos comparados de um documento.
//   find5e(db, name, kind): a entrada do 5etools pelo nome do SRD, ou null.
//   linked5e(db, id): a entrada que o EXPORT liga ao documento (equipmentUuid).
//   compare(a, b, agg, id, kind): acumula as diferenças por campo, separando as
//     EXPECTED.
//   main(): a CLI.
//
// DECISÕES E ARMADILHAS
//   - Compara CAMPOS do sistema, não a descrição (prosa é DELIBERATE no t2).
//   - O nome do SRD tira o nome próprio do mago ("Hideous Laughter"): a busca da
//     magia passa pelo srdSpellNames ao contrário (o nosso nome gera os do SRD).
//   - A activity `forward` do lançamento grátis é nossa (os premades a usam) e sai
//     da comparação.
//   - EXPECTED nomeia o que difere e por quê, com um predicado sobre os DOIS lados
//     (nunca o campo inteiro sem olhar): o que casa sai como `expected`, o resto é
//     achado. Dano base vazio ("d:", "d0:") é o mesmo que nenhum. Os effects contam
//     sem o `enchantment` (o export o leva à parte, no item base da variante).
//   - O item pareia pelo vínculo do EXPORT (o equipmentUuid de cada item do
//     5etools), e só então pelo nome: documento sem par é item que o export nunca
//     liga ao SRD. O MODELO de variante (activity enchant com o effect enchantment:
//     Vicious Weapon, Plate Armor of Etherealness) fica fora: o export o leva como
//     encantamento do item base, e o t2 compara essa forma com os premades.
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { parseYaml } from './lib/yamlLite';
import { latestOnly } from '../src/selector/reprints';
import { loadFoundryMechanics } from '../src/engine/foundryMechanicsData';
import { buildSpellItem } from '../src/engine/foundrySpells';
import { buildInventoryItems } from '../src/engine/foundryItems';
import { srdSpellNames } from '../src/engine/spells';
import { equipmentUuid } from '../src/engine/compendiumUuids';
import { specificVariants } from '../src/engine/magicVariants';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const args = new Set(process.argv.slice(2));

/** Os .yml de uma pasta, recursivo. */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.yml') && !f.startsWith('_')) out.push(p);
  }
  return out;
}

/** Os documentos do pack, sem as pastas. */
function docs(pack) {
  return walk(join(PACKS, pack))
    .filter((f) => !basename(dirname(f)).endsWith('-pack'))
    .map((f) => parseYaml(readFileSync(f, 'utf8')))
    .filter((d) => d?.name && d.type && d.type !== 'Folder');
}

/** A lista ordenada como texto. */
function multiset(list) {
  return [...(list ?? [])].map(String).sort().join('+');
}

const SPELL_PROPS = new Set(['vocal', 'somatic', 'material', 'concentration', 'ritual']);
const acts = (doc) => Object.values(doc.system?.activities ?? {}).filter((a) => a?.type && a.type !== 'forward');

/** Os campos comparados de uma magia. */
function spellFields(doc) {
  const s = doc.system ?? {};
  const a = acts(doc);
  return {
    level: s.level ?? 0,
    school: s.school ?? '',
    properties: multiset((s.properties ?? []).filter((p) => SPELL_PROPS.has(p))),
    'activation.type': s.activation?.type ?? '',
    'activation.value': String(s.activation?.value ?? ''),
    'duration.units': s.duration?.units ?? '',
    'duration.value': String(s.duration?.value ?? ''),
    'range.units': s.range?.units ?? '',
    'range.value': String(s.range?.value ?? ''),
    'target.affects.type': s.target?.affects?.type ?? '',
    'target.affects.count': String(s.target?.affects?.count ?? ''),
    'target.template.type': s.target?.template?.type ?? '',
    'target.template.size': String(s.target?.template?.size ?? ''),
    'materials.consumed': !!s.materials?.consumed,
    'materials.cost': Number(s.materials?.cost ?? 0),
    activities: multiset(a.map((x) => x.type)),
    'save.ability': multiset(a.flatMap((x) => [].concat(x.save?.ability ?? []))),
    damage: multiset(a.flatMap((x) => (x.damage?.parts ?? []).map((p) => `${p.number ?? ''}d${p.denomination ?? ''}${p.custom?.enabled ? `=${p.custom.formula}` : ''}:${multiset(p.types)}`))),
  };
}

/** Os campos comparados de um item. */
function itemFields(doc) {
  const s = doc.system ?? {};
  const base = s.damage?.base;
  return {
    type: doc.type,
    'type.value': s.type?.value ?? '',
    'type.baseItem': s.type?.baseItem ?? '',
    properties: multiset((s.properties ?? []).filter((p) => p !== 'mgc' || doc.type !== 'loot')),
    'armor.value': s.armor?.value ?? null,
    'armor.dex': s.armor?.dex ?? null,
    damage: base ? `${base.number ?? ''}d${base.denomination ?? ''}:${multiset(base.types)}` : '',
    weight: Number(s.weight?.value ?? s.weight ?? 0),
    price: `${Number(s.price?.value ?? 0)}${s.price?.denomination ?? ''}`,
    rarity: s.rarity ?? '',
    attunement: s.attunement ?? '',
    'uses.max': String(s.uses?.max ?? ''),
    activities: multiset(acts(doc).map((x) => x.type)),
    effects: (doc.effects ?? []).filter((e) => e?.type !== 'enchantment').length,
  };
}

let BY_UUID = null;

/** A entrada do 5etools que o EXPORT liga a este documento (pelo equipmentUuid), ou null. */
function linked5e(db, id) {
  if (!BY_UUID) {
    BY_UUID = new Map();
    const all = [...latestOnly(db.items?.item ?? []), ...latestOnly(db['items-base']?.baseitem ?? []), ...specificVariants(db)];
    for (const i of all) {
      const u = equipmentUuid(i.name);
      if (u && !BY_UUID.has(u.split('.').pop())) BY_UUID.set(u.split('.').pop(), i);
    }
  }
  return BY_UUID.get(id) ?? null;
}

/** A entrada do 5etools pelo nome do SRD (2024 primeiro), ou null. */
function find5e(db, name, kind) {
  const lc = (x) => String(x ?? '').toLowerCase();
  if (kind === 'spell') {
    const spells = latestOnly(Object.keys(db).filter((k) => k.startsWith('spells-')).flatMap((k) => db[k].spell ?? []));
    return spells.find((s) => ['XPHB'].includes(s.source) && srdSpellNames(s.name).some((n) => lc(n) === lc(name))) ?? null;
  }
  const all = [...latestOnly(db.items?.item ?? []), ...latestOnly(db['items-base']?.baseitem ?? [])];
  return all.find((i) => lc(i.name) === lc(name) && ['XPHB', 'XDMG'].includes(i.source)) ?? null;
}

const EXPECTED = {
  spell: {
    'materials.cost': { why: 'o SRD deixa 0 (e 0.02 no Gentle Repose, que o 5etools não precifica); nós escrevemos o custo em PO', ok: (o, s, id) => (s === 0 && o > 0) || id === 'Gentle Repose' },
    'target.template.type': { why: 'o SRD não pôs a emanation do Pass without Trace; nós pomos', ok: (o, s, id) => id === 'Pass without Trace' },
    'target.template.size': { why: 'idem', ok: (o, s, id) => id === 'Pass without Trace' },
    properties: { why: 'o documento do SRD e o XPHB discordam da concentração/componentes; seguimos o livro', ok: (o, s, id) => ['Enthrall', 'Hypnotic Pattern', 'Resilient Sphere', 'Forbiddance', 'Power Word Heal'].includes(id) },
    'duration.value': { why: 'o SRD escala a duração por @item.level, ou o documento diverge do XPHB', ok: (o, s, id) => String(s).includes('@') || ['Commune with Nature', 'Transport via Plants'].includes(id) },
    'duration.units': { why: 'o documento do SRD diverge do XPHB; seguimos o livro', ok: (o, s, id) => id === 'Commune with Nature' },
    'activation.type': { why: 'dois tempos de conjuração (ação ou 8 horas); o 5etools põe a ação primeiro', ok: (o, s, id) => id === 'Plant Growth' },
    'materials.consumed': { why: 'o documento do SRD diverge do XPHB; seguimos o livro', ok: (o, s, id) => id === 'Sequester' },
    'activation.value': { why: 'o SRD escreve 1 numa ação em poucas magias; o Foundry lê igual', ok: (o, s) => o === '' && s === '1' },
  },
  item: {
    price: { why: 'o pack do dnd5e tem preços próprios (mágicos somam base e raridade); seguimos o livro', ok: () => true },
    weight: { why: 'idem, pesos do pack (0 em mágicos, frações)', ok: () => true },
    'type.baseItem': { why: 'nós damos baseItem a todo item; o SRD só a arma, armadura e ferramenta; inofensivo', ok: (o, s) => s === '' },

    rarity: { why: 'o SRD deixa a raridade vazia na Potion of Healing; o livro diz common', ok: (o, s) => s === '' },
    attunement: { why: 'o SRD deixa vazio; o livro exige sintonização', ok: (o, s) => s === '' && o === 'required' },
    effects: { why: 'nosso efeito de bônus (CA, resistência) onde o SRD não tem effect: o mesmo número na ficha', ok: (o, s) => s === 0 && o === 1 },
    damage: { why: 'o dano base de cajado do livro onde o SRD não pôs', ok: (o, s) => s === '' },
    properties: { why: 'o versátil do cajado do livro', ok: (o, s, id) => id === 'Staff of the Python' },
    type: { why: 'pacote do 5etools (Arrows (20)) sai desdobrado em contêiner e munição; o SRD tem uma pilha', ok: (o, s) => o === 'container' && ['consumable', 'loot'].includes(s) },
    'type.value': { why: 'idem, e o subtipo vazio do SRD', ok: (o, s) => s === '' || o === '' },
  },
};

/** Acumula as diferenças por campo, separando as EXPECTED. */
function compare(ours, srd, agg, id, kind) {
  for (const k of Object.keys(srd)) {
    const norm = (v) => (typeof v === 'string' ? v.replace(/^d0?:$/, '').replace(/^d0:/, 'd:') : v);
    if (JSON.stringify(norm(ours[k])) === JSON.stringify(norm(srd[k]))) continue;
    const exp = EXPECTED[kind]?.[k];
    if (exp?.ok(norm(ours[k]), norm(srd[k]), id)) {
      const x = (agg._expected ??= {});
      x[k] = (x[k] ?? 0) + 1;
      continue;
    }
    const e = (agg[k] ??= { count: 0, samples: [] });
    e.count += 1;
    if (e.samples.length < 8) e.samples.push(`${id}: ours ${JSON.stringify(ours[k])} srd ${JSON.stringify(srd[k])}`);
  }
}

async function main() {
  const db = loadDb();
  await loadFoundryMechanics();
  const both = !args.has('--spells') && !args.has('--items');
  const report = {};
  if (both || args.has('--spells')) {
    const agg = {};
    let n = 0, missing = [];
    for (const doc of docs('spells24').filter((d) => d.type === 'spell')) {
      const raw = find5e(db, doc.name, 'spell');
      if (!raw) { missing.push(doc.name); continue; }
      n += 1;
      const ours = buildSpellItem({ raw, prepared: true }, { kind: 'class', classId: 'wizard' }, { db });
      compare(spellFields(ours), spellFields(doc), agg, doc.name, 'spell');
    }
    report.spells = { compared: n, missing, fields: agg };
  }
  if (both || args.has('--items')) {
    const agg = {};
    let n = 0, missing = [];
    let templates = 0;
    for (const doc of docs('equipment24')) {
      if (acts(doc).some((a) => a.type === 'enchant') && (doc.effects ?? []).some((e) => e?.type === 'enchantment')) { templates += 1; continue; }
      const raw = linked5e(db, doc._id) ?? find5e(db, doc.name, 'item');
      if (!raw) { missing.push(doc.name); continue; }
      n += 1;
      const [ours] = buildInventoryItems({ inventory: [{ uid: 'x', itemId: raw.name, source: raw.source, quantity: 1 }] }, db);
      if (!ours) { missing.push(`${doc.name} (no export)`); continue; }
      compare(itemFields(ours), itemFields(doc), agg, doc.name, 'item');
    }
    report.items = { compared: n, templates, missing, fields: agg };
  }
  writeFileSync(join(ROOT, 'testing', 'report-srd-oracle.json'), JSON.stringify(report, null, 2));
  for (const [kind, r] of Object.entries(report)) {
    console.log(`\n${kind}: ${r.compared} compared, ${r.missing.length} without a 5etools match`);
    const { _expected: exp = {}, ...found } = r.fields;
    for (const [k, v] of Object.entries(found).sort((a, b) => b[1].count - a[1].count)) console.log(`  ${k}: ${v.count}  e.g. ${v.samples[0]}`);
    console.log(`  expected: ${JSON.stringify(exp)}`);
  }
}

await main();
