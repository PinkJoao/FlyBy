// =============================================================================
// attunement: o limite e os pré-requisitos de atunement (Fase B1)
// =============================================================================
// O QUE FAZ
//   No máximo 3 itens atunados por vez, ou o que uma feature do personagem diz ("you
//   can attune to up to four magic items at once": Use Magic Device do Thief, Magic Item
//   Adept, Savant ou Advanced Artifice e Master do Artificer).
//
// FUNÇÕES
//   unmetAttunement(attunedCount, raw, max, who): o motivo pelo qual atunar violaria o
//     limite ou o pré-requisito, ou null.
//   attunementMaxFor(db, classes): o limite, pela prosa das features de classe e de
//     subclasse que o personagem já alcançou.
//   attunementRequirement(raw, who): o requisito de quem pode atunar ('ok', 'bad', 'unknown'),
//     pelas `reqAttuneTags` do dado; null sem requisito.
//   tagStatus(tag, who, ctx): uma alternativa das tags (os critérios dela são E).
//   alignmentAxes(code): os dois eixos de uma tendência ('LG' -> L e G; 'N' -> NX e NY).
//   base(v): o nome sem a fonte, em minúsculas ("artificer|tce" -> "artificer").
//
// DECISÕES E ARMADILHAS
//   - O limite vem da PROSA (DDL-0217): a frase "attune to up to <número>" nas features
//     alcançadas, a maior vale. Medido no espelho: 7 features (o Thief 13 e o Artificer
//     10, 14 e 18, nas versões TCE e EFA), nenhuma em talento.
//   - O requisito de quem atuna vem das `reqAttuneTags` (uma lista de alternativas, OU; os
//     critérios de cada uma, E), não da frase "by a warlock" (DDL-0345). Medido no espelho:
//     classe em 225 itens, conjurador em 82, espécie em 32, antecedente em 10, tipo de criatura
//     em 9, tendência em 11, e um de perícia, idioma, tamanho e Inteligência. Psiônico e os itens
//     sem tags (54, só prosa: renome, "missing a hand") seguem 'unknown', com o aviso de antes.
//   - A tendência é por EIXO: a lista diz os valores aceitos em cada eixo que ela toca ("G" é
//     bom, qualquer lei; "L, NX, C, G, NY" é não mau). Sem tendência escolhida, 'unknown'.
//   - "Spellcaster" é quem conjura ao menos uma magia: a classe ou subclasse conjuradora
//     (`canCast` do prereq) ou qualquer origem de magia derivada (talento, espécie).
//   - O antecedente só se sabe com um background pronto (`origin.background`); a origem
//     montada por peças fica 'unknown'.
//   - Avisa, não bloqueia: o chamador pergunta "atunar mesmo assim?" pelo confirm
//     in-app, no mesmo padrão de unmetMulticlassReqs e prereqStatus.
// -----------------------------------------------------------------------------

import { attunementInfo } from './items';
import { prereqContext } from './prereq';
import { resolveRaceObj } from './resolve';
import { SKILL_NAME_TO_CODE } from './classData';

export const ATTUNEMENT_MAX = 3;

const WORDS = { four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const RAISE = /attune to up to (\w+)/i;

/**
 * O limite de atunement do personagem, pela prosa das features alcançadas.
 * @param {object} db
 * @param {{ classId: string, className: string, classSource: string, level: number, subclassShortName?: string, subclassSource?: string }[]} classes
 */
export function attunementMaxFor(db, classes = []) {
  let max = ATTUNEMENT_MAX;
  const read = (f) => {
    const m = JSON.stringify(f.entries ?? []).match(RAISE);
    const n = m ? WORDS[m[1].toLowerCase()] ?? Number(m[1]) : 0;
    if (n > max) max = n;
  };
  for (const c of classes) {
    const pool = db?.[`class-${c.classId}`] ?? {};
    for (const f of pool.classFeature ?? []) {
      if (f.className === c.className && f.classSource === c.classSource && f.level <= c.level && !f.isClassFeatureVariant) read(f);
    }
    if (!c.subclassShortName) continue;
    for (const f of pool.subclassFeature ?? []) {
      if (f.className === c.className && f.subclassShortName === c.subclassShortName && f.subclassSource === c.subclassSource && f.level <= c.level) read(f);
    }
  }
  return max;
}

/**
 * Por que atunar este item violaria o limite ou o pré-requisito, ou null.
 * @param {number} attunedCount
 * @param {object|null} raw
 * @param {number} [max]
 * @param {{ character: object, db: object, derived?: object }|null} [who]
 * @returns {string|null}
 */
export function unmetAttunement(attunedCount, raw, max = ATTUNEMENT_MAX, who = null) {
  const info = attunementInfo(raw);
  if (!info.required) return null;
  if (attunedCount >= max) {
    return `Already attuned to ${max} items (the maximum)`;
  }
  if (info.prereqText) {
    const status = who ? attunementRequirement(raw, who) : 'unknown';
    if (status === 'ok') return null;
    if (status === 'bad') return `Requires attunement ${info.prereqText}`;
    return `Requires attunement ${info.prereqText} - can't be checked automatically`;
  }
  return null;
}

const LAW = ['L', 'NX', 'C'];
const MORAL = ['G', 'NY', 'E'];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Os dois eixos de uma tendência ('LG' -> ['L', 'G']; 'N' -> ['NX', 'NY']), ou null. */
export function alignmentAxes(code) {
  const c = String(code ?? '').toUpperCase();
  if (c === 'N') return ['NX', 'NY'];
  if (c.length !== 2) return null;
  const law = c[0] === 'N' ? 'NX' : c[0];
  const moral = c[1] === 'N' ? 'NY' : c[1];
  return LAW.includes(law) && MORAL.includes(moral) ? [law, moral] : null;
}

const base = (v) => String(v).split('|')[0].toLowerCase();

/** Uma alternativa das tags: todos os critérios dela ('ok', 'bad' ou 'unknown'). */
function tagStatus(tag, who, ctx) {
  const { character, db, derived } = who;
  let status = 'ok';
  const fold = (s) => {
    if (s === 'bad') status = 'bad';
    else if (s === 'unknown' && status !== 'bad') status = 'unknown';
  };
  for (const [key, value] of Object.entries(tag ?? {})) {
    if (key === 'class') {
      fold((ctx.classLevels[base(value)] ?? 0) > 0 ? 'ok' : 'bad');
    } else if (key === 'spellcasting') {
      const origins = derived?.spellcasting?.origins ?? [];
      fold(ctx.canCast || origins.length > 0 ? 'ok' : ctx.canCast == null ? 'unknown' : 'bad');
    } else if (key === 'race') {
      fold(ctx.raceId ? (ctx.raceGroups?.has(base(value)) ? 'ok' : 'bad') : 'unknown');
    } else if (key === 'background') {
      const bg = character?.origin?.background?.id;
      fold(bg ? (base(bg) === base(value) ? 'ok' : 'bad') : 'unknown');
    } else if (key === 'creatureType') {
      const race = db && character?.species ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage) : null;
      const types = (race?.creatureTypes?.length ? race.creatureTypes : race ? ['humanoid'] : []).map(base);
      fold(types.length ? (types.includes(base(value)) ? 'ok' : 'bad') : 'unknown');
    } else if (key === 'size') {
      fold(ctx.raceSizes?.length ? (ctx.raceSizes.includes(value) ? 'ok' : 'bad') : 'unknown');
    } else if (key === 'alignment') {
      const axes = alignmentAxes(character?.identity?.alignment);
      const allowed = (value ?? []).map((v) => String(v).toUpperCase());
      const fits = (axis, i) => !allowed.some((v) => axis.includes(v)) || allowed.includes(axes[i]);
      fold(!axes ? 'unknown' : fits(LAW, 0) && fits(MORAL, 1) ? 'ok' : 'bad');
    } else if (key === 'skillProficiency') {
      const code = SKILL_NAME_TO_CODE[base(value)];
      fold(derived?.skills && code ? ((derived.skills[code]?.proficiency ?? 0) > 0 ? 'ok' : 'bad') : 'unknown');
    } else if (key === 'languageProficiency') {
      fold(derived?.languages ? (derived.languages.some((l) => base(l) === base(value)) ? 'ok' : 'bad') : 'unknown');
    } else if (ABILITIES.includes(key)) {
      fold((ctx.scores?.[key] ?? 0) >= Number(value) ? 'ok' : 'bad');
    } else {
      fold('unknown');
    }
  }
  return status;
}

/**
 * O requisito de quem pode atunar, pelas `reqAttuneTags`: 'ok', 'bad' ou 'unknown'; null sem requisito.
 * @param {object|null} raw
 * @param {{ character: object, db: object, derived?: object }} who
 */
export function attunementRequirement(raw, who) {
  if (typeof raw?.reqAttune !== 'string') return null;
  const tags = raw.reqAttuneTags ?? [];
  if (!tags.length || !who?.character) return 'unknown';
  const ctx = prereqContext(who.character, { db: who.db });
  const all = tags.map((t) => tagStatus(t, who, ctx));
  if (all.includes('ok')) return 'ok';
  return all.includes('unknown') ? 'unknown' : 'bad';
}
