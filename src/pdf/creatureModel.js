// =============================================================================
// creatureModel: os blocos de summon e de forma para a ficha PDF
// =============================================================================
// O QUE FAZ
//   A seção opcional "Summons & forms" do PDF (S6 do plano de summons, DDL-0196):
//   um cartão por criatura que o personagem pode trazer à mesa, com CA, PV,
//   deslocamento, atributos, traços e ações, já resolvidos para ele pelo núcleo da
//   criatura (engine/creature.js) e o contexto do invocador (engine/playSummons.js):
//     - as criaturas das magias de invocação que ele tem, no círculo da magia;
//     - os companheiros das features de classe (CLASS_SUMMONS), no nível da classe;
//     - as formas conhecidas do Wild Shape (`character.wildShapeForms`).
//
// FUNÇÕES
//   statLine(stats): os seis atributos em uma linha ("STR 14 (+2) ...").
//   speedLine(speed): o deslocamento em uma linha.
//   cardOf(block, ctx, key, origin): o cartão de uma criatura.
//   named(list, suffix): as entradas do bloco no formato que o toBlocks lê.
//   fold(formula), resolved(list, ctx): o texto com os números do invocador
//     (ataque, CD, o círculo e o PB nos danos), somando as constantes.
//   creatureCards(character, derived, db, bestiary): os cartões da seção.
//
// DECISÕES E ARMADILHAS
//   - Puro: quem exporta carrega o bestiário antes (exportPdf, só com a seção ligada).
//   - O Find Familiar fica de fora: as formas são todas as feras de ND 0, dezenas de
//     cartões; a magia já está na seção de magias.
//   - O bloco com formas (Air, Land, Water) sai na primeira, com as outras citadas
//     no cartão; o texto das ações diz o que muda.
//   - O companheiro de classe usa o nível da classe que o bloco cita
//     (`summonedByClass` "Artificer|TCE").
// -----------------------------------------------------------------------------

import { derivePlayCatalog } from '../engine/playCatalog';
import { creatureStats, damageFormula } from '../engine/creature';
import { summonCreaturesFor, summonContext, featureSummons, isSummonFeature } from '../engine/playSummons';
import { resolveSpellObj } from '../engine/spells';
import { toBlocks } from './entries';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Os seis atributos em uma linha. */
function statLine(stats) {
  return ABILITIES.map((a) => `${a.toUpperCase()} ${stats.scores[a]} (${stats.mods[a] >= 0 ? '+' : ''}${stats.mods[a]})`).join('  ');
}

/** O deslocamento em uma linha ("40 ft., climb 30 ft."). */
function speedLine(speed) {
  return Object.entries(speed ?? {})
    .filter(([k, v]) => k !== 'canHover' && k !== 'choose' && v)
    .map(([k, v]) => `${k === 'walk' ? '' : `${k} `}${typeof v === 'object' ? v.number : v} ft.`)
    .join(', ');
}

/** O cartão de uma criatura. */
function cardOf(block, ctx, key, origin) {
  const stats = creatureStats(block, ctx);
  const variant = stats.variants[0] ?? null;
  const s = variant ? creatureStats(block, { ...ctx, variant }) : stats;
  return {
    key,
    name: s.name,
    origin,
    forms: s.variants.length ? `Forms: ${s.variants.join(', ')} (shown: ${variant})` : '',
    ac: s.ac.value ?? s.ac.text,
    hp: s.hp.value ?? s.hp.text,
    speed: speedLine(s.speed),
    stats: statLine(s),
    traits: toBlocks(resolved(named(block.trait), ctx)),
    actions: toBlocks(resolved([...named(block.action), ...named(block.bonus, ' (Bonus Action)'), ...named(block.reaction, ' (Reaction)')], ctx)),
  };
}

/** "2d6 + 3 + 3" -> "2d6 + 6": soma os números soltos (só com sinais de mais). */
function fold(formula) {
  if (/-/.test(formula)) return formula;
  const parts = formula.split('+').map((p) => p.trim()).filter(Boolean);
  const n = parts.filter((p) => /^[0-9]+$/.test(p)).reduce((a, p) => a + Number(p), 0);
  const dice = parts.filter((p) => !/^[0-9]+$/.test(p));
  return [...dice, ...(n ? [String(n)] : [])].join(' + ');
}

/** O texto do bloco com os números do invocador: ataque, CD e o círculo nos danos. */
function resolved(list, ctx) {
  let text = JSON.stringify(list);
  if (ctx.spellAttack != null) text = text.replace(/[{]@hitYourSpellAttack[^}]*[}]/g, `{@hit ${ctx.spellAttack}}`);
  if (ctx.spellDc != null) text = text.replace(/[{]@dcYourSpellSave[}]/g, `{@dc ${ctx.spellDc}}`).replace(/DC equals your spell save DC/g, `DC ${ctx.spellDc}`);
  text = text.replace(/[{]@damage ([^}|]*(?:summonSpellLevel|PB)[^}|]*)[}]/g, (m, expr) => `{@damage ${fold(damageFormula(expr, '', ctx))}}`);
  return JSON.parse(text);
}

/** As entradas do bloco ({ name, entries }, sem `type`) no formato que o toBlocks lê. */
function named(list, suffix = '') {
  return (list ?? []).map((e) => ({ type: 'entries', name: `${e.name ?? ''}${suffix}`, entries: e.entries ?? [] }));
}

/**
 * Os cartões da seção "Summons & forms".
 * @param {object} character
 * @param {object} derived
 * @param {object} db
 * @param {object[]} bestiary  as criaturas carregadas (data/bestiary.js)
 */
export function creatureCards(character, derived, db, bestiary) {
  if (!bestiary?.length) return [];
  const catalog = derivePlayCatalog(character, db, { derived });
  const out = [];
  const seen = new Set();
  const push = (block, ctx, origin) => {
    const key = `${block.name}|${block.source}|${origin}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cardOf(block, ctx, key, origin));
  };
  for (const origin of catalog.spells ?? []) {
    const classLevel = (character.classes ?? []).find((c) => `class:${c.classId}` === origin.key)?.level ?? null;
    for (const spell of origin.spells ?? []) {
      if (/^find familiar$/i.test(spell.name)) continue;
      const raw = resolveSpellObj(db, spell.name, spell.source);
      if (!(raw?.miscTags ?? []).includes('SMN')) continue;
      for (const block of summonCreaturesFor(bestiary, spell)) {
        const level = Math.max(spell.level ?? 0, block.summonedBySpellLevel ?? 0);
        push(block, summonContext(catalog, origin, { spellLevel: level, classLevel }), `${spell.name} (level ${level})`);
      }
    }
  }
  for (const name of catalog.features ?? []) {
    if (!isSummonFeature(name)) continue;
    for (const block of featureSummons(bestiary, name)) {
      const classId = String(block.summonedByClass ?? '').split('|')[0].toLowerCase();
      const cls = (character.classes ?? []).find((c) => c.classId === classId) ?? character.classes?.[0];
      const origin = (catalog.spells ?? []).find((o) => o.key === `class:${cls?.classId}`) ?? null;
      push(block, summonContext(catalog, origin, { classLevel: cls?.level ?? null }), block.name);
    }
  }
  for (const f of character.wildShapeForms ?? []) {
    const block = bestiary.find((m) => m.name === f.name && m.source === f.source) ?? bestiary.find((m) => m.name === f.name);
    if (block) push(block, {}, 'Wild Shape form');
  }
  return out;
}
