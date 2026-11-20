// =============================================================================
// itemOracle: o que os campos estruturados de um item mágico mandam, conferido na ficha e no jogo
// =============================================================================
// O QUE FAZ
//   O recorte dos itens na régua do lançamento (DDL-0271). Um hospedeiro fixo (o mago do XPHB no nível 9, com
//   conjuração para os bônus de magia) recebe cada item mágico do seletor equipado e sintonizado; a ficha e o
//   catálogo do jogo com o item são comparados com os sem ele, campo por campo do dado do 5etools:
//   `bonusAc`, `bonusSavingThrow`, `ability`, `bonusSpellAttack`, `bonusSpellSaveDc`, `charges`, `attachedSpells`,
//   `resist`, `immune`, `conditionImmune`, `modifySpeed` (só o `static` e o `bonus`) e `bonusWeapon` (a arma vira
//   ataque no jogo).
//
// FUNÇÕES
//   num(v): o número de um bônus do dado ("+2").
//   magicItems(db): os itens mágicos do seletor (os genéricos e uma amostra por modelo de variante).
//   withItem(db, host, raw): a ficha e o catálogo do jogo com o item equipado e sintonizado.
//   itemProblems(db, host, base, raw): os campos que a ficha ou o jogo não refletem.
//   itemRows(db): uma linha por item { name, source, fields, problems }.
//
// DECISÕES E ARMADILHAS
//   - Um hospedeiro só, clonado por item: montar uma ficha por item levaria minutos (2 mil itens).
//   - A CA esperada sai da fórmula da armadura (o `ac` do item, a DES pelo tipo, o `flatBonusAc`, que já zera o
//     bônus que o texto torna condicional), do escudo somado à ficha, ou da CA base que o texto do item dá
//     (`itemBaseAc`). Comparar com o item base falhava: o escudo do PHB de 2014 não está no `items-base`.
//   - O grimório (o texto fala em spellbook) e a poção com magia anexa não lançam pelo item: explicado no DDL-0262.
//   - `modifySpeed` com `multiply` ou `equal` é ativado (Boots of Speed, Cloak of Arachnida): fica fora da conta.
//   - O `baseItem` vem em minúsculas ("scale mail|xphb"): a busca do item base ignora a caixa. A resistência conta a
//     da ficha também (o hospedeiro anão já resiste a veneno, e a ficha não duplica no `fromItems`). O ataque de uma
//     arma mágica é qualquer ataque NOVO no jogo (o cajado pode aparecer com o nome da arma base).
//   - Item que pede sintonia por uma classe que não é o mago (Holy Avenger) fica de fora: o hospedeiro não sintoniza.
// -----------------------------------------------------------------------------
import { autoBuild } from './autoBuild.js';
import { classMatrix, defaultSpecies, itemMatrix } from './matrix.js';
import { deriveFromDb } from '../../src/engine/resolve.js';
import { resolveItemObj } from '../../src/engine/items.js';
import { derivePlayCatalog } from '../../src/engine/playCatalog.js';
import { flatBonusAc, itemBaseAc } from '../../src/engine/armorClass.js';
import { speedActivated } from '../../src/engine/itemEffects.js';

const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const num = (v) => Number(String(v ?? '').replace(/[^0-9-]/g, '')) || 0;

/** Os itens mágicos do seletor: os genéricos e uma amostra por modelo de variante. */
export function magicItems(db) {
  return itemMatrix(db)
    .map((r) => ({ row: r, raw: resolveItemObj(db, r.name, r.source) }))
    .filter(({ raw }) => raw && raw.rarity && raw.rarity !== 'none' && raw.rarity !== 'unknown');
}

/** A ficha e o catálogo com o item (equipado e sintonizado), ou com o item base no lugar dele. */
function withItem(db, host, raw) {
  const c = structuredClone(host);
  c.inventory.push({ uid: 'oracle', itemId: raw.name, source: raw.source, quantity: 1, equipped: true, attuned: !!raw.reqAttune });
  return { d: deriveFromDb(c, db), cat: derivePlayCatalog(c, db) };
}

/** Os campos que a ficha ou o jogo não refletem. */
export function itemProblems(db, host, base, raw) {
  const out = [];
  const { d, cat } = withItem(db, host, raw);
  const slot = String(raw.type ?? '').split('|')[0];
  const dex = base.d.modifiers?.dex ?? 0;
  const bonus = flatBonusAc(raw);
  const textBase = itemBaseAc([{ raw, attuned: true }]);
  let want = null;
  if (raw.bonusAc || textBase.length) {
    if (slot === 'S') want = (base.d.armorClass?.total ?? 0) + (raw.ac ?? 2) + bonus;
    else if (slot === 'LA') want = (raw.ac ?? 0) + dex + bonus;
    else if (slot === 'MA') want = (raw.ac ?? 0) + Math.min(dex, 2) + bonus;
    else if (slot === 'HA') want = (raw.ac ?? 0) + bonus;
    else want = Math.max(base.d.armorClass?.total ?? 0, ...textBase.map((b) => b.base + dex)) + bonus;
    if (raw.ac == null && ['LA', 'MA', 'HA'].includes(slot)) want = null;
  }
  if (want != null && d.armorClass?.total !== want) out.push(`CA: o texto e o dado dão ${want}, a ficha ${d.armorClass?.total}`);
  if (raw.bonusSavingThrow) {
    const n = num(raw.bonusSavingThrow);
    if (ABIL.some((a) => (d.saves?.[a] ?? 0) !== (base.d.saves?.[a] ?? 0) + n)) out.push(`bonusSavingThrow ${raw.bonusSavingThrow}`);
  }
  for (const blk of [].concat(raw.ability ?? [])) {
    for (const [k, v] of Object.entries(blk?.static ?? {})) if (ABIL.includes(k) && (d.scores?.[k] ?? 0) < Math.max(v, base.d.scores?.[k] ?? 0)) out.push(`ability static ${k} ${v}: ${d.scores?.[k]}`);
    for (const [k, v] of Object.entries(blk ?? {})) if (ABIL.includes(k) && typeof v === 'number' && (d.scores?.[k] ?? 0) !== Math.min(blk.max ?? 99, (base.d.scores?.[k] ?? 0) + v) && (d.scores?.[k] ?? 0) === (base.d.scores?.[k] ?? 0)) out.push(`ability ${k} +${v}`);
  }
  const o = d.spellcasting?.origins?.find((x) => x.kind === 'class');
  const ob = base.d.spellcasting?.origins?.find((x) => x.kind === 'class');
  if (raw.bonusSpellAttack && o && o.attackBonus !== ob.attackBonus + num(raw.bonusSpellAttack)) out.push(`bonusSpellAttack ${raw.bonusSpellAttack}`);
  if (raw.bonusSpellSaveDc && o && o.saveDc !== ob.saveDc + num(raw.bonusSpellSaveDc)) out.push(`bonusSpellSaveDc ${raw.bonusSpellSaveDc}`);
  if (raw.charges && !(cat.resources ?? []).some((r) => String(r.key).startsWith('charges:oracle'))) out.push(`charges ${raw.charges}`);
  const book = /spellbook/i.test(JSON.stringify(raw.entries ?? [])) || slot === 'P';
  if (raw.attachedSpells && !book && !(cat.spells ?? []).some((x) => String(x.key ?? '').includes('oracle'))) out.push('attachedSpells');
  const has = (kind, t) => [...(d.damageTraits?.[kind] ?? []), ...(d.damageTraits?.fromItems?.[kind] ?? [])].map((x) => String(x).toLowerCase()).includes(t);
  for (const t of [].concat(raw.resist ?? []).filter((x) => typeof x === 'string')) if (!has('resist', t) && !has('immune', t)) out.push(`resist ${t}`);
  for (const t of [].concat(raw.immune ?? []).filter((x) => typeof x === 'string')) if (!has('immune', t)) out.push(`immune ${t}`);
  const ms = raw.modifySpeed;
  if ((ms?.static || ms?.bonus) && !speedActivated(raw)) {
    for (const [k, v] of Object.entries({ ...(ms.static ?? {}) })) if ((cat.stats?.speeds?.[k]?.feet ?? 0) < v) out.push(`modifySpeed static ${k} ${v}`);
    for (const [k, v] of Object.entries({ ...(ms.bonus ?? {}) })) if ((cat.stats?.speeds?.[k === '*' ? 'walk' : k]?.feet ?? 0) < (base.cat.stats?.speeds?.[k === '*' ? 'walk' : k]?.feet ?? 0) + v) out.push(`modifySpeed bonus ${k} ${v}`);
  }
  const extraAttacks = (cat.attacks ?? []).filter((a) => !(base.cat.attacks ?? []).some((b) => b.name === a.name));
  if (raw.bonusWeapon && raw.weaponCategory && !extraAttacks.length) out.push(`bonusWeapon ${raw.bonusWeapon}: sem ataque no jogo`);
  return out;
}

/** Uma linha por item mágico: os campos que ele declara e os problemas. */
export function itemRows(db) {
  const row = classMatrix(db).find((r) => r.classId === 'wizard' && r.classSource === 'XPHB' && r.subclassSource === 'XPHB');
  const host = autoBuild(db, { ...row, level: 9, ...defaultSpecies(db), seed: 5 }).character;
  const base = { d: deriveFromDb(host, db), cat: derivePlayCatalog(host, db) };
  const out = [];
  for (const { row: r, raw } of magicItems(db)) {
    const byClass = /by an? (?!wizard|spellcaster)/i.test(JSON.stringify(raw.reqAttune ?? ''));
    if (byClass) {
      out.push({ name: raw.name, source: raw.source, kind: r.kind, problems: [], skip: 'sintonia de outra classe' });
      continue;
    }
    try {
      out.push({ name: raw.name, source: raw.source, kind: r.kind, problems: itemProblems(db, host, base, raw) });
    } catch (e) {
      out.push({ name: raw.name, source: raw.source, kind: r.kind, problems: [`erro: ${String(e?.message ?? e).slice(0, 100)}`] });
    }
  }
  return out;
}
