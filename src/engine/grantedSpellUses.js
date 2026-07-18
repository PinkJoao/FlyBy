// =============================================================================
// grantedSpellUses - overlay CURADO de frequência para concessões inatas
// =============================================================================
// Puro: sem rede/DOM. Ver DDL-0011.
//
// A maior parte do 5etools codifica a frequência de uma magia concedida no
// próprio `additionalSpells` (`innate: { 3: { daily: { 1: [...] } } }`), e a
// derivação a lê sem ajuda nenhuma. É o caso das espécies MAIS RECENTES (Elf e
// Tiefling XPHB, por exemplo) - e a expectativa é que conteúdo novo siga esse
// formato. Este arquivo NÃO se aplica a elas.
//
// Um punhado de entradas mais antigas, porém, traz uma LISTA CRUA sob `innate`,
// sem tipo de recarga. A forma é ambígua: no Aarakocra significa 1×/descanso
// longo, no Yuan-Ti significa "à vontade", e no Great Old One significa apenas
// "sempre preparada" (nenhuma conjuração grátis). Como a mesma forma cobre
// regras opostas, a derivação se recusa a adivinhar (rótulo "No Spell Slot") e
// a frequência real vem daqui, curada do texto do próprio traço.
//
// Cada entrada cita a prosa que a justifica. Chave: "Nome|FONTE" da ENTIDADE
// (espécie, classe ou subclasse); dentro, o nome da magia em minúsculas.
//
// `castType` aceito: 'restLong' (1×/descanso longo), 'rest' (curto ou longo),
// 'will' (à vontade), ou `null` = a magia NÃO tem conjuração grátis (gasta
// espaço de magia como qualquer preparada).
// -----------------------------------------------------------------------------

/** @typedef {{ castType: 'restLong'|'rest'|'will'|null, count?: number }} UsesOverride */

/** @type {Record<string, Record<string, UsesOverride>>} */
export const INNATE_USES = {
  // "Once you cast the spell with this trait, you can't do so again until you
  // finish a long rest." (Wind Caller)
  'Aarakocra|MPMM': {
    'gust of wind': { castType: 'restLong', count: 1 },
  },

  // "Once you cast either of these spells with this trait, you can't cast that
  // spell with it again until you finish a long rest." (Firbolg Magic)
  'Firbolg|MPMM': {
    'detect magic': { castType: 'restLong', count: 1 },
    'disguise self': { castType: 'restLong', count: 1 },
  },

  // "You can cast animal friendship an unlimited number of times with this
  // trait, but you can target only snakes with it." (Serpentine Spellcasting)
  'Yuan-Ti|MPMM': {
    'animal friendship': { castType: 'will' },
  },
  'Yuan-ti Pureblood|VGM': {
    'animal friendship': { castType: 'will' },
  },

  // "Once you cast that spell with this trait, you can't do so again until you
  // finish a long rest." (Merge with Stone) - entrada de `subrace`, que a
  // derivação ainda não consulta; curada por completude.
  'Earth|MPMM': {
    'pass without trace': { castType: 'restLong', count: 1 },
  },

  // "Once you cast any of these spells with this trait, you can't cast that
  // spell with it again until you finish a long rest." (Magical Detection)
  'Variant; Mark of Detection|ERLW': {
    'detect magic': { castType: 'restLong', count: 1 },
    'detect poison and disease': { castType: 'restLong', count: 1 },
  },
  // "Once you cast either spell with this trait…" (Finder's Magic)
  'Variant; Mark of Finding|ERLW': {
    "hunter's mark": { castType: 'restLong', count: 1 },
  },
  // "Once you cast either spell with this trait…" (Healing Touch)
  'Mark of Healing|ERLW': {
    'cure wounds': { castType: 'restLong', count: 1 },
  },

  // "You know the Mending cantrip." (Tinker's Magic) - cantrip, à vontade.
  'Artificer|EFA': {
    mending: { castType: 'will' },
  },

  // "After you cast either spell in this way, you can't use this feature again
  // until you finish a short or long rest." (Consult the Spirits)
  'Path of the Ancestral Guardian|XGE': {
    augury: { castType: 'rest', count: 1 },
    clairvoyance: { castType: 'rest', count: 1 },
  },

  // "you learn a cantrip of your choice: either druidcraft or thaumaturgy"
  // (Giant Power) - cantrip conhecido, à vontade.
  'Path of the Giant|BGG': {
    druidcraft: { castType: 'will' },
    thaumaturgy: { castType: 'will' },
  },

  // "Once you use this feature, you can't use it again until you finish a long
  // rest…" (Mantle of Majesty)
  'College of Glamour|XGE': {
    command: { castType: 'restLong', count: 1 },
  },
  'College of Glamour|XPHB': {
    command: { castType: 'restLong', count: 1 },
  },

  // "You always have the Hex spell prepared." (Eldritch Hex) - o dado usa o
  // bucket `innate`, mas NÃO há conjuração grátis: Hex gasta espaço de magia.
  'Great Old One Patron|XPHB': {
    hex: { castType: null },
  },

  // "You can cast See Invisibility without expending a spell slot… You can't
  // use this feature again until you finish a Short Rest or Long Rest."
  'Diviner|XPHB': {
    'see invisibility': { castType: 'rest', count: 1 },
  },
};

/** Chave da entidade no overlay. */
function overlayKey(entity) {
  return entity?.name && entity?.source ? `${entity.name}|${entity.source}` : null;
}

/**
 * Aplica o overlay às magias concedidas por uma entidade. Só toca nas entradas
 * cuja frequência o DADO não declara (`castType === 'innate'`); tudo que o
 * 5etools já codifica passa intacto.
 * @param {Array<object>} spells      saída de `grantedSpells().spells`
 * @param {{name?: string, source?: string}|null} entity  espécie/classe/subclasse
 * @returns {Array<object>}  nova lista (não muta a entrada)
 */
export function applyUsesOverlay(spells, entity) {
  const table = INNATE_USES[overlayKey(entity)];
  if (!table) return spells ?? [];
  return (spells ?? []).map((s) => {
    if (s.castType !== 'innate') return s;
    const override = table[s.name.toLowerCase()];
    if (!override) return s;
    return { ...s, castType: override.castType, count: override.count ?? null, scale: null };
  });
}
