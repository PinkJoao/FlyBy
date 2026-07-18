// =============================================================================
// Rótulos de UI (inglês) - nomes legíveis para habilidades e perícias
// =============================================================================
// Mantidos separados da lógica: um tradutor futuro só troca estes mapas. As
// CHAVES (str, acr…) são estáveis; os valores são o que aparece na tela.
// -----------------------------------------------------------------------------

/** Habilidade (código) → rótulos curto e completo. */
export const ABILITY_SHORT = {
  str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha',
};

export const ABILITY_FULL = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/** Perícia (código) → nome completo. */
export const SKILL_LABEL = {
  acr: 'Acrobatics',
  ani: 'Animal Handling',
  arc: 'Arcana',
  ath: 'Athletics',
  dec: 'Deception',
  his: 'History',
  ins: 'Insight',
  itm: 'Intimidation',
  inv: 'Investigation',
  med: 'Medicine',
  nat: 'Nature',
  prc: 'Perception',
  prf: 'Performance',
  per: 'Persuasion',
  rel: 'Religion',
  slt: 'Sleight of Hand',
  ste: 'Stealth',
  sur: 'Survival',
};
