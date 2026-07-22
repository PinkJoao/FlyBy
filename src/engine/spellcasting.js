// =============================================================================
// spellcasting - slots, nível de conjurador, limites e DC (Spellbook, Fase B2.2)
// =============================================================================
// Puro: sem rede/DOM. Números de conjuração derivados das DECISÕES + dados de
// classe do 5etools. Replica FIELMENTE o sistema dnd5e do Foundry (nosso alvo,
// DDL-0001) - as tabelas e o algoritmo de progressão vêm de
// `module/config.mjs` (SPELL_SLOT_TABLE, pactCastingProgression) e
// `module/data/spellcasting/spellcasting-model.mjs` (computeProgression):
//
//   const rounding = prog.roundUp ? Math.ceil : Math.floor;
//   progression[key] += rounding(levels / divisor);
//   // single-classed, non-full → arredonda p/ cima em vez de p/ baixo
//   if (count === 1 && divisor > 1 && progression[key]) progression[key] = ceil(levels/divisor);
//
// 2024 (XPHB) unificou a contagem em `preparedSpellsProgression` p/ TODOS (full,
// Paladin/Ranger = 'artificer', Eldritch Knight/Arcane Trickster = '1/3' na
// subclasse, Warlock = 'pact'). Cantrips vêm de `cantripProgression`.
// -----------------------------------------------------------------------------

/**
 * Tabela de slots do multiclasse/full-caster (índice = nível de conjurador − 1;
 * posição i do array = slots do círculo i+1). Idêntica a DND5E.SPELL_SLOT_TABLE.
 */
export const SPELL_SLOT_TABLE = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

/** Progressão de Pact Magic (Warlock): nível de warlock → { slots, level }.
 * Esparsa: usa a maior chave ≤ nível. Idêntica a DND5E.pactCastingProgression. */
export const PACT_TABLE = {
  1: { slots: 1, level: 1 },
  2: { slots: 2, level: 1 },
  3: { slots: 2, level: 2 },
  5: { slots: 2, level: 3 },
  7: { slots: 2, level: 4 },
  9: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
};

/**
 * MYSTIC ARCANUM (Warlock, XPHB) - o edge case da Pact Magic. A tabela de pacto
 * trava no 5º círculo; do nível 11 em diante o warlock ganha, a cada dois
 * níveis, UMA magia de círculo alto que conjura **uma vez por descanso longo**,
 * sem gastar slot. Nível de classe → círculo da magia. É prosa no 5etools
 * (feature "Mystic Arcanum" nos níveis 11/13/15/17), então mora aqui.
 *
 * Consequências que o resto do engine respeita: uma magia de arcanum NÃO conta
 * contra o limite de preparadas, e magias acima do círculo do pacto SÓ podem
 * entrar por um arcanum livre daquele círculo exato.
 */
export const ARCANUM_TABLE = { 11: 6, 13: 7, 15: 8, 17: 9 };

/**
 * Círculos de arcanum que um conjurador de pacto já destravou.
 * @param {string|null} casterCode  'pact' p/ o Warlock
 * @param {number} classLevel
 * @returns {number[]}  ex: nível 15 → [6, 7, 8]
 */
export function arcanumLevels(casterCode, classLevel) {
  if (casterCode !== 'pact') return [];
  return Object.entries(ARCANUM_TABLE)
    .filter(([lvl]) => classLevel >= Number(lvl))
    .map(([, spellLevel]) => spellLevel)
    .sort((a, b) => a - b);
}

/** Código de progressão do 5etools → { divisor, roundUp } do Foundry. 'pact' e
 * ausência = não contribui p/ a tabela de slots (tratados à parte / não-caster). */
const PROGRESSIONS = {
  full: { divisor: 1, roundUp: false },
  '1/2': { divisor: 2, roundUp: true },
  half: { divisor: 2, roundUp: true },
  '1/3': { divisor: 3, roundUp: false },
  third: { divisor: 3, roundUp: false },
  artificer: { divisor: 2, roundUp: true },
};

/** Uma progressão contribui com slots na tabela leveled? (exclui pact/não-caster) */
export function isLeveledProgression(code) {
  return !!PROGRESSIONS[code];
}

/**
 * Contribuição de uma classe para o nível de conjurador leveled (a linha da
 * SPELL_SLOT_TABLE), seguindo o Foundry. `single` = o personagem tem UMA única
 * classe conjuradora leveled (aí não-full arredonda p/ cima em vez de baixo).
 * @param {string} code   casterProgression ('full'|'1/3'|'artificer'…)
 * @param {number} level  nível NA classe
 * @param {{single?: boolean}} [opts]
 * @returns {number}
 */
export function slotContribution(code, level, { single = false } = {}) {
  const cfg = PROGRESSIONS[code];
  if (!cfg || !level) return 0;
  const base = cfg.roundUp ? Math.ceil(level / cfg.divisor) : Math.floor(level / cfg.divisor);
  // Guard de truthiness do Foundry: o override só vale quando o floor já deu ≥1
  // (senão EK nível 1/2 ganharia slot cedo demais).
  if (single && cfg.divisor > 1 && base) return Math.ceil(level / cfg.divisor);
  return base;
}

/**
 * Nível de conjurador combinado (para a tabela de slots leveled) a partir das
 * classes conjuradoras. Pact (Warlock) NÃO entra aqui.
 * @param {{code: string, level: number}[]} casters  classes com progressão leveled
 * @returns {number}
 */
export function leveledCasterLevel(casters) {
  const leveled = (casters ?? []).filter((c) => isLeveledProgression(c.code));
  const single = leveled.length === 1;
  return leveled.reduce((sum, c) => sum + slotContribution(c.code, c.level, { single }), 0);
}

/**
 * Slots por círculo para um nível de conjurador. { 1: 4, 2: 3, … }.
 * @param {number} casterLevel
 * @returns {Record<number, number>}
 */
export function spellSlots(casterLevel) {
  if (!casterLevel || casterLevel < 1) return {};
  const row = SPELL_SLOT_TABLE[Math.min(Math.floor(casterLevel), 20) - 1] ?? [];
  const out = {};
  row.forEach((n, i) => {
    if (n) out[i + 1] = n;
  });
  return out;
}

/**
 * Círculo MÁXIMO que uma classe conjuradora prepara, pelo seu nível INDIVIDUAL.
 *
 * Multiclasse tem duas contas distintas (PHB "Multiclassing / Spellcasting"): os
 * SLOTS são combinados (`leveledCasterLevel` + `spellSlots`), mas "you determine
 * what spells you know and can prepare **using the levels of your individual
 * classes**". Um Cleric 2 / Druid 1 tem slot de 2º círculo, e ainda assim nenhuma
 * das duas classes prepara magia de 2º - o slot alto só serve para conjurar em
 * círculo superior uma magia de círculo baixo.
 *
 * Por isso este teto vem da classe SOZINHA (`single: true`, a mesma regra de
 * arredondamento que um personagem de classe única teria).
 * @param {string|null} code   casterProgression da classe ('full'|'1/2'…)
 * @param {number} classLevel  nível NA classe
 * @returns {number}  0 quando a classe ainda não conjura magias de círculo
 */
export function maxPrepareCircle(code, classLevel) {
  const levels = Object.keys(spellSlots(slotContribution(code, classLevel, { single: true }))).map(Number);
  return levels.length ? Math.max(...levels) : 0;
}

/**
 * Slots de pacto do Warlock. Retorna { slots, level } (nível = círculo dos
 * slots) ou null se não for Warlock / nível 0.
 * @param {number} warlockLevel
 * @returns {{slots: number, level: number}|null}
 */
export function pactSlots(warlockLevel) {
  if (!warlockLevel || warlockLevel < 1) return null;
  let best = null;
  for (const key of Object.keys(PACT_TABLE).map(Number).sort((a, b) => a - b)) {
    if (key <= warlockLevel) best = PACT_TABLE[key];
  }
  return best ? { ...best } : null;
}

/** Valor de um array de progressão no nível dado (index level−1), 0 fora do range. */
function atLevel(progression, level) {
  if (!Array.isArray(progression) || !level) return 0;
  return progression[level - 1] ?? 0;
}

/** DC de resistência de magia: 8 + bônus de proficiência + modificador. */
export function spellSaveDc(profBonus, abilityMod) {
  return 8 + (profBonus ?? 0) + (abilityMod ?? 0);
}

/** Bônus de ataque com magia: proficiência + modificador. */
export function spellAttackBonus(profBonus, abilityMod) {
  return (profBonus ?? 0) + (abilityMod ?? 0);
}

/**
 * Extrai a config de conjuração de uma classe (ou da subclasse, p/ EK/AT que
 * conjuram pela subclasse). Retorna null se nem a classe nem a subclasse conjuram.
 * @param {object|null} classObj      objeto cru da classe (5etools)
 * @param {object|null} subclassObj   objeto cru da subclasse escolhida (ou null)
 * @returns {null | {
 *   code: string, ability: string, source: 'class'|'subclass',
 *   cantripProgression: number[]|null, preparedSpellsProgression: number[]|null,
 *   spellcaster: object
 * }}
 */
export function casterInfo(classObj, subclassObj) {
  const holder = classObj?.casterProgression
    ? { obj: classObj, source: 'class' }
    : subclassObj?.casterProgression
      ? { obj: subclassObj, source: 'subclass' }
      : null;
  if (!holder) return null;
  const o = holder.obj;
  return {
    code: o.casterProgression,
    ability: o.spellcastingAbility ?? null,
    source: holder.source,
    cantripProgression: o.cantripProgression ?? null,
    preparedSpellsProgression: o.preparedSpellsProgression ?? null,
    spellcaster: o,
  };
}

/** Quantos cantrips esta origem conhece no nível dado (0 se não tiver). */
export function cantripLimit(info, level) {
  return atLevel(info?.cantripProgression, level);
}

/** Quantas magias (de círculo) esta origem prepara no nível dado (R8). */
export function prepareLimit(info, level) {
  return atLevel(info?.preparedSpellsProgression, level);
}

/**
 * Os limites de magia da classe CRESCERAM de `prevLevel` para `level`? (mais
 * cantrips OU mais magias preparadas). Usado no level-up para decidir se abre o
 * passo de magias (DDL-0014). Puro; recebe os objetos de classe/subclasse.
 * @param {object|null} classObj
 * @param {object|null} subclassObj
 * @param {number} prevLevel
 * @param {number} level
 * @returns {boolean}
 */
export function spellLimitsGrew(classObj, subclassObj, prevLevel, level) {
  const info = casterInfo(classObj, subclassObj);
  if (!info) return false;
  return (
    cantripLimit(info, level) > cantripLimit(info, prevLevel) ||
    prepareLimit(info, level) > prepareLimit(info, prevLevel)
  );
}

/**
 * Magias já conhecidas/preparadas nas OUTRAS origens (TC-0031): nome (minúsculo)
 * → rótulo da origem que a tem. Alimenta o filtro "Already Prepared" dos
 * seletores e a confirmação ao adicionar mesmo assim - um multiclasse PODE
 * querer a mesma magia nas duas classes (atributos diferentes), então é aviso,
 * nunca bloqueio. A primeira origem encontrada dá o rótulo.
 * @param {Array} origins   derived.spellcasting.origins
 * @param {string} excludeKey  a origem sendo editada (fica de fora)
 * @returns {Map<string, string>}
 */
export function preparedElsewhere(origins, excludeKey) {
  const out = new Map();
  for (const o of origins ?? []) {
    if (o.key === excludeKey) continue;
    const buckets = [o.cantrips, o.prepared, o.alwaysPrepared, o.arcanumSpells];
    for (const bucket of buckets) {
      for (const s of bucket ?? []) {
        const name = String(s.raw?.name ?? s.name ?? '').toLowerCase();
        if (name && !out.has(name)) out.set(name, o.label);
      }
    }
  }
  return out;
}

/**
 * Redundâncias de preparação ENTRE origens, para o guia sugerir (QoL). Uma magia
 * que uma origem SEMPRE concede (subclasse/talento/raça → `alwaysPrepared`) e que
 * o personagem TAMBÉM tem por outra via - preparada à mão numa outra classe
 * (multiclasse) ou concedida por outra fonte, como Magic Initiate - está sendo
 * obtida em duplicidade. Preparar a mesma magia por múltiplas vias é permitido e
 * às vezes desejado (atributos diferentes num multiclasse), então isto é só uma
 * SUGESTÃO - nunca bloqueio nem remoção automática. Mas é incomum, e o guia é
 * feito para novatos, então vale chamar atenção.
 *
 * Só conta quando ao menos uma origem concede a magia sempre-preparada (uma magia
 * meramente preparada à mão em duas classes não é redundância - ambas custam um
 * slot e podem ser intencionais). A cópia sugerível de trocar é a das origens em
 * `alsoFrom` (onde ela não é sempre-concedida).
 *
 * @param {Array} origins  derived.spellcasting.origins
 * @returns {Array<{name:string, level:number, grantedFrom:string[], alsoFrom:string[]}>}
 */
export function redundantPreparations(origins) {
  // nome (minúsculo) → { display, level, granted:Set<label>, other:Set<label> }
  const byName = new Map();
  const touch = (s, always, label) => {
    const display = String(s.raw?.name ?? s.name ?? '');
    const key = display.toLowerCase();
    if (!key) return;
    let e = byName.get(key);
    if (!e) {
      e = { display, level: s.raw?.level ?? 0, granted: new Set(), other: new Set() };
      byName.set(key, e);
    }
    e[always ? 'granted' : 'other'].add(label);
  };
  for (const o of origins ?? []) {
    for (const s of o.alwaysPrepared ?? []) touch(s, true, o.label);
    for (const bucket of [o.cantrips, o.prepared, o.arcanumSpells]) {
      for (const s of bucket ?? []) touch(s, false, o.label);
    }
  }

  const out = [];
  for (const { display, level, granted, other } of byName.values()) {
    const grantedFrom = [...granted];
    // Uma origem que também prepara à mão o que concede já colapsa na derivação
    // (a concessão vence), então `other` e `granted` não se sobrepõem; ainda
    // assim filtramos por segurança.
    const alsoFrom = [...other].filter((l) => !granted.has(l));
    const distinct = new Set([...granted, ...other]).size;
    // Redundante quando há ≥1 concessão e a magia aparece em ≥2 origens distintas
    // (concedida em duas vias, ou concedida numa e preparada/obtida noutra).
    if (grantedFrom.length >= 1 && distinct >= 2) {
      out.push({ name: display, level, grantedFrom, alsoFrom });
    }
  }
  return out;
}
