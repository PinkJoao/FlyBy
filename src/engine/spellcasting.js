// =============================================================================
// spellcasting: slots, nível de conjurador, limites e DC (Spellbook, Fase B2.2)
// =============================================================================
// O QUE FAZ
//   Os números de conjuração, a partir das decisões e dos dados de classe.
//   Replica FIELMENTE o dnd5e do Foundry (DDL-0001): as tabelas e o algoritmo vêm
//   de module/config.mjs (SPELL_SLOT_TABLE, pactCastingProgression) e do
//   computeProgression do spellcasting-model.mjs:
//     rounding = prog.roundUp ? ceil : floor; progression += rounding(níveis /
//     divisor); e com uma classe só, não full, arredonda para CIMA.
//   Em 2024 a contagem é `preparedSpellsProgression` para TODOS (full; Paladino e
//   Ranger 'artificer'; Eldritch Knight e Arcane Trickster '1/3' na subclasse;
//   Warlock 'pact'), e os cantrips são `cantripProgression`.
//
// FUNÇÕES
//   Slots
//   arcanumLevels(casterCode, classLevel): os círculos de Mystic Arcanum.
//   isLeveledProgression(code): a progressão entra na tabela leveled?
//   slotContribution(code, level, opts): a contribuição de uma classe.
//   leveledCasterLevel(casters): o nível de conjurador combinado (sem pacto).
//   spellSlots(casterLevel): os slots por círculo.
//   maxPrepareCircle(code, classLevel): o círculo máximo que a classe prepara.
//   pactSlots(warlockLevel): { slots, level } do pacto, ou null.
//   Números e limites
//   atLevel(progression, level): o valor de uma progressão no nível.
//   spellSaveDc(profBonus, abilityMod), spellAttackBonus(profBonus, abilityMod).
//   casterInfo(classObj, subclassObj): a config de conjuração da classe ou da
//     subclasse.
//   isPreparedRef(ref): a escolha está preparada?
//   cantripLimit(info, level), prepareLimit(info, level), knownLimit(info,
//     level): os limites.
//   spellLimitsGrew(classObj, subclassObj, prevLevel, level): os limites
//     cresceram no level-up?
//   Entre origens
//   preparedElsewhere(origins, excludeKey): as magias já tidas em OUTRAS origens.
//   redundantPreparations(origins): as obtidas em duplicidade, para o guia.
//
// DECISÕES E ARMADILHAS
//   - MYSTIC ARCANUM (ARCANUM_TABLE, DDL-0010): a tabela de pacto trava no 5º
//     círculo; do 11 em diante, a cada dois níveis, uma magia de círculo alto 1 vez
//     por descanso longo, sem slot. É prosa no 5etools, então mora aqui. Ela NÃO
//     conta nas preparadas, e magia acima do pacto só entra por um arcanum livre
//     daquele círculo.
//   - Multiclasse tem duas contas (PHB): os SLOTS são combinados, mas "you
//     determine what spells you can prepare using the levels of your individual
//     classes". Um Cleric 2 / Druid 1 tem slot de 2º e nenhuma das duas prepara
//     magia de 2º: maxPrepareCircle usa a classe SOZINHA.
//   - knownLimit: só existe para quem tem repertório próprio, o grimório do Mago
//     (`spellsKnownProgressionFixed`, o único campo do gênero). O campo é DELTA
//     por nível ([6,2,2,...]), daí a soma acumulada. É PISO, não teto (copiar de
//     pergaminho é legítimo; a UI só sinaliza, DDL-0026).
//   - isPreparedRef é a fonte única da convenção: a bandeira só diz NÃO (DDL-0076).
//   - preparedElsewhere (TC-0031): um multiclasse PODE querer a mesma magia nas
//     duas classes, então é aviso, nunca bloqueio; a primeira origem dá o rótulo.
//   - redundantPreparations (DDL-0048) é só SUGESTÃO: conta quando ao menos uma
//     origem CONCEDE a magia e ela aparece em duas origens; preparar à mão em duas
//     classes não é redundância (ambas custam slot). A cópia trocável fica em
//     `alsoFrom`.
// -----------------------------------------------------------------------------

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

export const ARCANUM_TABLE = { 11: 6, 13: 7, 15: 8, 17: 9 };

/**
 * Os círculos de arcanum que um conjurador de pacto já destravou.
 * @param {string|null} casterCode
 * @param {number} classLevel
 * @returns {number[]}
 */
export function arcanumLevels(casterCode, classLevel) {
  if (casterCode !== 'pact') return [];
  return Object.entries(ARCANUM_TABLE)
    .filter(([lvl]) => classLevel >= Number(lvl))
    .map(([, spellLevel]) => spellLevel)
    .sort((a, b) => a - b);
}

const PROGRESSIONS = {
  full: { divisor: 1, roundUp: false },
  '1/2': { divisor: 2, roundUp: true },
  half: { divisor: 2, roundUp: true },
  '1/3': { divisor: 3, roundUp: false },
  third: { divisor: 3, roundUp: false },
  artificer: { divisor: 2, roundUp: true },
};

/** A progressão contribui com slots na tabela leveled? */
export function isLeveledProgression(code) {
  return !!PROGRESSIONS[code];
}

/**
 * A contribuição de uma classe para o nível de conjurador leveled.
 * @param {string} code
 * @param {number} level
 * @param {{single?: boolean}} [opts]
 * @returns {number}
 */
export function slotContribution(code, level, { single = false } = {}) {
  const cfg = PROGRESSIONS[code];
  if (!cfg || !level) return 0;
  const base = cfg.roundUp ? Math.ceil(level / cfg.divisor) : Math.floor(level / cfg.divisor);
  // ATENÇÃO: arredondar para cima só depois do floor dar 1+, senão o EK ganha slot nos níveis 1 e 2.
  if (single && cfg.divisor > 1 && base) return Math.ceil(level / cfg.divisor);
  return base;
}

/**
 * O nível de conjurador combinado das classes leveled.
 * @param {{code: string, level: number}[]} casters
 * @returns {number}
 */
export function leveledCasterLevel(casters) {
  const leveled = (casters ?? []).filter((c) => isLeveledProgression(c.code));
  const single = leveled.length === 1;
  return leveled.reduce((sum, c) => sum + slotContribution(c.code, c.level, { single }), 0);
}

/**
 * Os slots por círculo para um nível de conjurador.
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
 * O círculo máximo que uma classe prepara, pelo nível individual.
 * @param {string|null} code
 * @param {number} classLevel
 * @returns {number}
 */
export function maxPrepareCircle(code, classLevel) {
  const levels = Object.keys(spellSlots(slotContribution(code, classLevel, { single: true }))).map(Number);
  return levels.length ? Math.max(...levels) : 0;
}

/**
 * Os slots de pacto do Warlock, ou null.
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

/** O valor de uma progressão no nível dado (0 fora do range). */
function atLevel(progression, level) {
  if (!Array.isArray(progression) || !level) return 0;
  return progression[level - 1] ?? 0;
}

/** DC de magia: 8 + proficiência + modificador. */
export function spellSaveDc(profBonus, abilityMod) {
  return 8 + (profBonus ?? 0) + (abilityMod ?? 0);
}

/** Ataque com magia: proficiência + modificador. */
export function spellAttackBonus(profBonus, abilityMod) {
  return (profBonus ?? 0) + (abilityMod ?? 0);
}

/**
 * A config de conjuração da classe ou da subclasse, ou null.
 * @param {object|null} classObj
 * @param {object|null} subclassObj
 * @returns {null | {
 *   code: string, ability: string, source: 'class'|'subclass',
 *   cantripProgression: number[]|null, preparedSpellsProgression: number[]|null,
 *   spellcaster: object
 *   }}
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
    spellsKnownAdded: o.spellsKnownProgressionFixed ?? null,
    spellcaster: o,
  };
}

/**
 * A magia escolhida está preparada? (ausente ou true é sim)
 * @param {{prepared?: boolean}} ref
 */
export function isPreparedRef(ref) {
  return ref?.prepared !== false;
}

/** Quantos cantrips a origem conhece no nível. */
export function cantripLimit(info, level) {
  return atLevel(info?.cantripProgression, level);
}

/** Quantas magias de círculo a origem prepara no nível. */
export function prepareLimit(info, level) {
  return atLevel(info?.preparedSpellsProgression, level);
}

/**
 * Quantas magias de círculo a classe tem no livro, ou null.
 * @param {object|null} info
 * @param {number} level
 * @returns {number|null}
 */
export function knownLimit(info, level) {
  const added = info?.spellsKnownAdded;
  if (!Array.isArray(added) || !added.length) return null;
  return added.slice(0, Math.max(0, level)).reduce((n, v) => n + (Number(v) || 0), 0);
}

/**
 * Os limites de magia cresceram de `prevLevel` para `level`?
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
 * As magias já conhecidas em outras origens, com o rótulo de onde vêm.
 * @param {Array} origins
 * @param {string} excludeKey
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
 * As magias obtidas em duplicidade entre origens.
 * @param {Array} origins
 * @returns {Array<{name:string, level:number, grantedFrom:string[], alsoFrom:string[]}>}
 */
export function redundantPreparations(origins) {
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
    const alsoFrom = [...other].filter((l) => !granted.has(l));
    const distinct = new Set([...granted, ...other]).size;
    if (grantedFrom.length >= 1 && distinct >= 2) {
      out.push({ name: display, level, grantedFrom, alsoFrom });
    }
  }
  return out;
}
