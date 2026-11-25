// =============================================================================
// multiclassOracle: o que a regra de multiclasse do XPHB manda, conferido numa ficha
// =============================================================================
// O QUE FAZ
//   A régua do multiclasse (scripts/release-bar.js) monta personagens de duas ou três classes
//   e passa cada um por aqui. Cada checagem sai do TEXTO do XPHB (a seção Multiclassing, p. 44)
//   e das tabelas do dado do 5etools, nunca do motor: a tabela "Multiclass Spellcaster" vem do
//   `book-xphb.json`, as colunas de cada classe do `classTableGroups`, as proficiências da
//   classe nova do `multiclassing.proficienciesGained`.
//
// FUNÇÕES
//   strip(s), num(v), fmt(o): texto sem tags, o número de uma célula, os espaços em texto.
//   sameSlots(a, b): os dois mapas de círculo -> quantidade são iguais?
//   labels(list, map): os rótulos minúsculos de uma lista de proficiências.
//   multiclassSlotTable(): a tabela de espaços do multiclasse, lida do livro (nível -> espaços).
//   colOf(classObj, label): a coluna de uma tabela da classe pelo rótulo (sem as tags), por nível.
//   ownSlots(obj, level): os espaços da tabela própria da classe ou subclasse num nível.
//   contribution(classObj, subObj, level): quanto a classe soma no nível de conjurador (null se não conjura).
//   expectedSlots(entries): os espaços que o texto manda para as classes da ficha.
//   multiclassProblems(db, built, deriveGranted, buildClassChoices, catalogFn, attacksFn): a lista dos
//     problemas de uma ficha montada, cada um com o motivo.
//
// DECISÕES E ARMADILHAS
//   - "Spell Slots": soma os níveis inteiros, metade ARREDONDADA PARA CIMA do Paladin, do Ranger
//     (e do Artificer, que diz o mesmo), um terço para baixo do Eldritch Knight e do Arcane
//     Trickster, e procura a soma na tabela; com Spellcasting de uma classe só, vale a tabela
//     dela ("follow the rules for that class"). A classe ainda sem espaço na própria tabela
//     não tem o Spellcasting e não conta. O Pact Magic fica de fora da soma.
//   - Magias preparadas e cantrips são "para cada classe individualmente, as if you were a
//     single-classed member": o limite tem de ser o da MESMA entrada de classe numa ficha só com
//     ela (mesmas escolhas, mesma espécie e talentos). A coluna da tabela sozinha mentia: o
//     Thaumaturge e o Magician somam uma cantrip e pareciam o nível total.
//   - Proficiências: a ficha só pode ter de armadura, arma e ferramenta o que a classe inicial
//     dá, o que cada classe nova dá no `proficienciesGained` e o que o resto da ficha dá
//     (espécie, talentos, opções). O resto é medido na MESMA ficha com os `classId` em branco
//     (o `deriveGrantedProficiencies` pula a classe sem id e ainda lê os sacos de escolha).
//   - Perícia e instrumento da classe nova (Bard, Ranger, Rogue, Artificer): a escolha tem de
//     existir na classe secundária, com a contagem do `proficienciesGained`.
//   - Saves: a BASE vem só da classe inicial. Um save de classe secundária é problema quando
//     nenhuma das outras fontes o dá: subclasse (o Unfettered Mind do Knowledge Domain do FRHoF dá
//     INT e parecia o do mago secundário), feature de classe, talento (o Resilient no ASI da classe
//     secundária), escolha `save`, ou feature que dá todos (Disciplined Survivor, Slippery Mind,
//     Diamond Soul, Elegant Courtier).
//   - Extra Attack não acumula: mais de 2 ataques só com Two Extra Attacks (Fighter 11) ou
//     Devouring Blade.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './loadDb.js';
import { resolveClassObj, resolveSubclassObj } from '../../src/engine/resolve.js';
import { proficiencyBonus } from '../../src/engine/math.js';
import { deriveFeatSaveProficiencies } from '../../src/engine/resolve.js';
import { deriveSubclassGrants } from '../../src/engine/subclassGrants.js';
import { deriveClassFeatureGrants } from '../../src/engine/classFeatureGrants.js';
import { collectChoicePicks } from '../../src/engine/choices.js';

const strip = (s) => String(s).replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1').trim();
const num = (v) => (typeof v === 'number' ? v : Number.parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0);

let TABLE = null;
/** A tabela de espaços do multiclasse, lida do livro (nível -> [espaços por círculo]). */
export function multiclassSlotTable() {
  if (TABLE) return TABLE;
  const book = JSON.parse(fs.readFileSync(join(dataDir(), 'book', 'book-xphb.json'), 'utf8'));
  let found = null;
  const walk = (o) => {
    if (found || !o || typeof o !== 'object') return;
    if (o.type === 'table' && /Multiclass Spellcaster/i.test(o.caption ?? '')) found = o;
    for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
  };
  walk(book);
  if (!found) throw new Error('a tabela Multiclass Spellcaster não está no book-xphb.json');
  TABLE = Object.fromEntries(found.rows.map((r) => [num(r[0]), r.slice(1).map(num)]));
  return TABLE;
}

/** A coluna de uma tabela da classe pelo rótulo, por nível (índice 0 = nível 1), ou null. */
export function colOf(classObj, label) {
  for (const g of classObj?.classTableGroups ?? []) {
    const i = (g.colLabels ?? []).findIndex((c) => strip(c).toLowerCase() === label.toLowerCase());
    if (i >= 0 && g.rows) return g.rows.map((r) => num(r[i]));
  }
  return null;
}

/** Os espaços da tabela própria da classe ou subclasse num nível ([] sem tabela). */
export function ownSlots(obj, level) {
  const groups = [...(obj?.classTableGroups ?? []), ...(obj?.subclassTableGroups ?? [])];
  const g = groups.find((x) => x.rowsSpellProgression);
  return g ? (g.rowsSpellProgression[level - 1] ?? []).map(num) : [];
}

/** Quanto a classe soma no nível de conjurador, ou null se ela não conjura nesse nível. */
export function contribution(classObj, subObj, level) {
  const code = subObj?.casterProgression ?? classObj?.casterProgression;
  if (!code || code === 'pact') return null;
  const own = ownSlots(subObj?.casterProgression ? subObj : classObj, level);
  if (!own.some((n) => n > 0)) return null;
  if (code === 'full') return level;
  if (code === '1/2' || code === 'artificer') return Math.ceil(level / 2);
  if (code === '1/3') return Math.floor(level / 3);
  return null;
}

/** Os espaços que o texto manda ({ círculo: n }) para as entradas de classe resolvidas. */
export function expectedSlots(entries) {
  const casters = entries.map((e) => ({ ...e, c: contribution(e.classObj, e.subObj, e.level) })).filter((e) => e.c !== null);
  let row = [];
  if (casters.length >= 2) row = multiclassSlotTable()[casters.reduce((n, e) => n + e.c, 0)] ?? [];
  else if (casters.length === 1) {
    const e = casters[0];
    row = ownSlots(e.subObj?.casterProgression ? e.subObj : e.classObj, e.level);
  }
  return Object.fromEntries(row.map((n, i) => [String(i + 1), n]).filter(([, n]) => n > 0));
}

const sameSlots = (a, b) => {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].every((k) => (a?.[k] ?? 0) === (b?.[k] ?? 0));
};
const fmt = (o) => Object.entries(o ?? {}).filter(([, n]) => n).map(([k, n]) => `${k}:${n}`).join(' ') || 'nenhum';
const ARMOR = { light: 'light armor', medium: 'medium armor', heavy: 'heavy armor', shield: 'shields' };
const WEAPON = { simple: 'simple weapons', martial: 'martial weapons' };

/** O que a lista de proficiências de um campo dá, em rótulos minúsculos. */
function labels(list, map) {
  return (list ?? []).filter((x) => typeof x === 'string').map((x) => map[x] ?? strip(x).toLowerCase());
}

/**
 * Os problemas de uma ficha multiclasse montada, cada um com o motivo.
 * @returns {string[]}
 */
export function multiclassProblems(db, built, { deriveGranted, buildClassChoices, catalog, attacksPerAction, derive }) {
  const c = built.character;
  const d = built.derived;
  const out = [];
  const entries = c.classes.map((cls) => {
    const classObj = resolveClassObj(db, cls.classId, cls.source);
    const subObj = cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
    return { cls, classObj, subObj, level: cls.level };
  });
  const total = entries.reduce((n, e) => n + e.level, 0);
  const original = entries.find((e) => e.cls.isOriginalClass) ?? entries[0];
  const others = entries.filter((e) => e !== original);

  if (d.proficiencyBonus !== proficiencyBonus(total)) out.push(`bônus de proficiência ${d.proficiencyBonus}, o nível total ${total} dá ${proficiencyBonus(total)}`);

  const want = expectedSlots(entries);
  if (!sameSlots(d.spellcasting?.slots, want)) out.push(`espaços ${fmt(d.spellcasting?.slots)}, o texto dá ${fmt(want)}`);

  const warlock = entries.find((e) => e.classObj?.casterProgression === 'pact');
  if (warlock) {
    const n = colOf(warlock.classObj, 'Spell Slots')?.[warlock.level - 1] ?? 0;
    const lvl = colOf(warlock.classObj, 'Slot Level')?.[warlock.level - 1] ?? 0;
    const got = d.spellcasting?.pactSlots;
    if (!got || (got.count ?? got.slots ?? got.max) !== n || (got.level ?? got.slotLevel) !== lvl) out.push(`espaços de pacto ${JSON.stringify(got)}, a tabela do bruxo dá ${n} de círculo ${lvl}`);
  }

  for (const o of d.spellcasting?.origins ?? []) {
    if (o.kind !== 'class') continue;
    const e = entries.find((x) => x.cls.uid === o.uid);
    if (!e) continue;
    const alone = derive({ ...c, classes: [{ ...e.cls, isOriginalClass: true }] }, db).spellcasting?.origins?.find((x) => x.uid === o.uid);
    for (const [field, label] of [['prepareLimit', 'Prepared Spells'], ['cantripLimit', 'Cantrips']]) {
      if (o[field] == null || alone?.[field] == null) continue;
      if (o[field] !== alone[field]) out.push(`${e.classObj.name}: ${label} ${o[field]}, a mesma classe sozinha no nível ${e.level} dá ${alone[field]}`);
    }
  }

  const dice = {};
  for (const e of entries) {
    const f = e.classObj?.hd?.faces;
    if (f) dice[`d${f}`] = (dice[`d${f}`] ?? 0) + e.level;
  }
  const gotDice = Object.fromEntries((catalog.resources ?? []).filter((r) => r.kind === 'hitDice').map((r) => [r.name?.split(' ')[0] ?? r.key, r.max]));
  if (!sameSlots(gotDice, dice)) out.push(`dados de vida ${fmt(gotDice)}, o texto dá ${fmt(dice)}`);

  const blank = { ...c, classes: c.classes.map((cls) => ({ ...cls, classId: '' })) };
  const rest = deriveGranted(blank, db);
  const mine = deriveGranted(c, db);
  for (const [field, map, key] of [['armor', ARMOR, 'armor'], ['weapons', WEAPON, 'weapons']]) {
    const allowed = new Set([
      ...labels(original.classObj?.startingProficiencies?.[key], map),
      ...others.flatMap((e) => labels(e.classObj?.multiclassing?.proficienciesGained?.[key], map)),
      ...(rest[field] ?? []).map((x) => String(x).toLowerCase()),
    ]);
    for (const x of mine[field] ?? []) {
      const l = String(x).toLowerCase();
      if (!allowed.has(l) && ![...allowed].some((a) => l.startsWith(a) || a.startsWith(l))) out.push(`proficiência "${x}" que a regra de multiclasse não dá`);
    }
  }

  for (const e of others) {
    const gained = e.classObj?.multiclassing?.proficienciesGained ?? {};
    const skillCount = (gained.skills ?? []).reduce((n, s) => n + (s?.choose?.count ?? 0), 0);
    const choices = buildClassChoices(db, e.cls, c);
    const skillChoices = choices.filter((ch) => ch.id === 'skill');
    const offered = skillChoices.reduce((n, ch) => n + (ch.count ?? 1), 0);
    if (offered !== skillCount) out.push(`${e.classObj.name} secundário oferece ${offered} perícia(s) de classe, o multiclasse dá ${skillCount}`);
    const instruments = (gained.toolProficiencies ?? []).reduce((n, t) => n + (t?.anyMusicalInstrument ?? 0), 0);
    if (instruments && !choices.some((ch) => ch.kind === 'tool')) out.push(`${e.classObj.name} secundário não oferece o instrumento do multiclasse`);
  }

  const saves = new Set(d.proficientSaves ?? []);
  const other = new Set([
    ...(original.classObj?.proficiency ?? []),
    ...deriveSubclassGrants(c, db).saves,
    ...deriveClassFeatureGrants(c).saves,
    ...deriveFeatSaveProficiencies(c, db),
    ...c.classes.flatMap((x) => collectChoicePicks(x.choices, 'save')),
  ]);
  const allSaves = (catalog.featureList ?? []).some((f) => /disciplined survivor|slippery mind|diamond soul|elegant courtier/i.test(f.name));
  for (const s of saves) {
    if (other.has(s) || allSaves) continue;
    if (others.some((e) => (e.classObj?.proficiency ?? []).includes(s))) out.push(`save de ${s} da classe secundária`);
  }

  const max = attacksPerAction(catalog);
  const fighter = entries.find((e) => e.cls.classId === 'fighter');
  const allowedMax = fighter?.level >= 20 ? 4 : fighter?.level >= 11 ? 3 : 2;
  if (max > allowedMax && !(catalog.featureList ?? []).some((f) => /devouring blade/i.test(f.name))) out.push(`${max} ataques na ação Attack, o texto dá no máximo ${allowedMax}`);

  return out;
}
