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
  // CLASSE, não espécie. O `additionalSpells` do Warlock declara Contact Other
  // Plane como `prepared` no nível 9 - sempre preparada, sem frequência nenhuma.
  // A conjuração GRÁTIS existe só na prosa do Contact Patron @9: "you can cast
  // the spell without expending a spell slot to contact your patron… Once you
  // cast the spell with this feature, you can't do so in this way again until
  // you finish a Long Rest." Sem esta linha o uso grátis sumia do export.
  'Warlock|XPHB': {
    'contact other plane': { castType: 'restLong', count: 1 },
  },

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

// -----------------------------------------------------------------------------
// Concessões que a PROSA declara mas o `additionalSpells` do 5etools OMITE
// (TC-0026). Caso raro - o normal é o dado codificar tudo; cada entrada cita a
// prosa. O valor é UM grupo no formato de `additionalSpells`, FUNDIDO no
// primeiro grupo do dado (nunca anexado como grupo novo: grupos múltiplos são
// ALTERNATIVAS e virariam um choice `spellSet` falso - ver TC-0011).
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Concessões cujo NÍVEL o `additionalSpells` do 5etools erra (TC-0044). Mesma
// família do registro acima - a PROSA manda -, mas aqui a magia existe no dado e
// só está no nível errado, então corrigir é MOVER, não acrescentar. Cada entrada
// cita a prosa; `from`/`to` são as chaves de nível dentro do bucket.
// -----------------------------------------------------------------------------

/** @typedef {{ bucket: string, spell: string, from: number|string, to: number|string }} SpellRegrade */

/** @type {Record<string, SpellRegrade[]>} */
export const REGRADED_ADDITIONAL_SPELLS = {
  // Gnomish Lineage (Forest Gnome): "You know the Minor Illusion cantrip. You
  // also always have the Speak with Animals spell prepared." - SEM nível: as
  // duas magias vêm no nível 1 (o cantrip já vem). O dado XPHB põe o Speak with
  // Animals sob `innate: {3: …}`; nenhuma outra espécie XPHB tem essa divergência
  // (as que gatilham por nível dizem "Starting at 3rd level" na prosa).
  'Gnome; Forest Gnome Lineage|XPHB': [
    { bucket: 'innate', spell: 'speak with animals|xphb', from: 3, to: 1 },
  ],
};

/**
 * O INVERSO do registro acima: concessões que o dado declara e que a REGRA não
 * concede. O 5etools guarda no balde `prepared` uma magia que a feature apenas
 * PERMITE conjurar, e nós a líamos como "sempre preparada" - a ficha ganhava uma
 * magia a mais, e o export a mandava para o Foundry (TC-0082).
 *
 * A varredura que fechou este registro (refazer antes de acrescentar uma entrada):
 * cruzar toda magia de balde `prepared`/`known` com o texto da própria entidade
 * procurando "…to cast {@spell X}". Dá 10 candidatos, e 9 são falsos positivos -
 * a magia é concedida por OUTRA via e a frase só oferece um jeito alternativo de
 * conjurá-la (o War God's Blessing gasta Channel Divinity para lançar um Shield
 * of Faith que o domínio já dá; os talentos de Magic Initiate idem). Sobra UMA.
 * @type {Record<string, string[]>}
 */
export const REMOVED_ADDITIONAL_SPELLS = {
  // Wild Companion (Druida 2): "you can expend a spell slot or a use of Wild
  // Shape to cast the Find Familiar spell" - é PERMISSÃO de conjurar, não uma
  // magia preparada. O premade não a lista e o SRD do dnd5e não a concede como
  // item. O Speak with Animals do nível 1 fica: esse é concedido mesmo.
  'Druid|XPHB': ['find familiar'],
};

/** @type {Record<string, object>} */
export const MISSING_ADDITIONAL_SPELLS = {
  // Channeler (L3): "You know the Guidance cantrip. It has a range of 60 feet
  // when you cast it." O dado RHW só codifica o Spirit Guardians de L6; a versão
  // VRGR (legacy) trazia `known: {3: [guidance#c]}` - restaurado aqui na grafia
  // 2024.
  'College of Spirits|RHW': { known: { 3: ['guidance|xphb#c'] } },
};

/** Poda arrays/objetos que ficaram vazios depois de remover uma magia. */
function pruneEmpty(node) {
  if (Array.isArray(node)) return node.length ? node : null;
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const p = pruneEmpty(v);
      if (p !== null) out[k] = p;
    }
    return Object.keys(out).length ? out : null;
  }
  return node;
}

/**
 * Remove `spell` de dentro de um nó de nível (array de refs, ou o objeto
 * `{daily: {pb: [...]}}` das entradas inatas), devolvendo o nó novo e o CAMINHO
 * de chaves onde a magia estava - para reinseri-la igual no nível de destino.
 * @returns {{node: object|Array|null, path: string[]}|null}
 */
function takeSpell(node, spell) {
  if (Array.isArray(node)) {
    const i = node.findIndex((s) => typeof s === 'string' && s.toLowerCase() === spell);
    return i < 0 ? null : { node: node.filter((_, k) => k !== i), path: [] };
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const found = takeSpell(v, spell);
      if (found) return { node: { ...node, [k]: found.node }, path: [k, ...found.path] };
    }
  }
  return null;
}

/** Insere `spell` no nó de destino, no mesmo caminho de onde saiu. */
function putSpell(node, path, spell) {
  if (path.length === 0) return [...(Array.isArray(node) ? node : []), spell];
  const [k, ...rest] = path;
  const base = node && typeof node === 'object' && !Array.isArray(node) ? node : {};
  return { ...base, [k]: putSpell(base[k], rest, spell) };
}

/** Aplica as correções de nível curadas (TC-0044) sobre os grupos. */
function applyRegrades(groups, regrades) {
  return groups.map((group) => {
    let next = group;
    for (const { bucket, spell, from, to } of regrades) {
      const byLevel = next[bucket];
      const taken = byLevel?.[from] ? takeSpell(byLevel[from], spell.toLowerCase()) : null;
      if (!taken) continue;
      const merged = { ...byLevel, [from]: taken.node };
      const pruned = pruneEmpty(merged[from]);
      if (pruned === null) delete merged[from];
      else merged[from] = pruned;
      merged[to] = putSpell(merged[to], taken.path, spell);
      next = { ...next, [bucket]: merged };
    }
    return next;
  });
}

/** O nome nu de uma ref de magia ("find familiar|xphb#c" → "find familiar"). */
const refName = (s) => String(s).toLowerCase().split('|')[0].split('#')[0].trim();

/** Tira as magias curadas como NÃO-concedidas (TC-0082) de todos os baldes,
 * em qualquer profundidade (o balde inato aninha por frequência). */
function stripSpells(node, wanted) {
  if (Array.isArray(node)) return node.filter((s) => !(typeof s === 'string' && wanted.has(refName(s))));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, stripSpells(v, wanted)]));
  }
  return node;
}

function applyRemovals(groups, spells) {
  const wanted = new Set(spells.map((s) => refName(s)));
  return groups.map((group) =>
    Object.fromEntries(
      Object.entries(group).map(([bucket, byLevel]) => [bucket, pruneEmpty(stripSpells(byLevel, wanted)) ?? {}]),
    ),
  );
}

/**
 * `additionalSpells` da entidade + as concessões curadas que o dado omite,
 * fundidas no primeiro grupo (bucket a bucket, nível a nível), + as correções de
 * NÍVEL curadas. Sem entrada nos registros, devolve o campo original intacto;
 * nunca muta o dado.
 * @param {{name?: string, source?: string, additionalSpells?: Array}|null} entity
 * @returns {Array<object>|undefined}
 */
export function curatedAdditionalSpells(entity) {
  const key = overlayKey(entity);
  const extra = MISSING_ADDITIONAL_SPELLS[key];
  const regrades = REGRADED_ADDITIONAL_SPELLS[key];
  const removed = REMOVED_ADDITIONAL_SPELLS[key];
  if (!extra && !regrades && !removed) return entity?.additionalSpells;
  let groups = entity?.additionalSpells ?? [];
  if (regrades) groups = applyRegrades(groups, regrades);
  if (removed) groups = applyRemovals(groups, removed);
  if (!extra) return groups;
  const first = { ...(groups[0] ?? {}) };
  for (const [bucket, byLevel] of Object.entries(extra)) {
    const merged = { ...(first[bucket] ?? {}) };
    for (const [lvl, spells] of Object.entries(byLevel)) {
      merged[lvl] = [...(merged[lvl] ?? []), ...spells];
    }
    first[bucket] = merged;
  }
  return [first, ...groups.slice(1)];
}

/**
 * Aplica o overlay às magias concedidas por uma entidade. Só toca nas entradas
 * cuja frequência o DADO não declara; tudo que o 5etools já codifica
 * (`will`/`ritual`/`daily`/`rest`) passa intacto.
 *
 * Duas formas de "não declara", e as duas precisam do overlay:
 *  - **`castType === 'innate'`** - o dado diz que conjura sem espaço mas não diz
 *    com que frequência (o caso original, DDL-0011);
 *  - **sem `castType` nenhum** - o dado põe a magia em `prepared` (sempre
 *    preparada) e a conjuração GRÁTIS existe só na prosa da feature. É o Contact
 *    Patron do Warlock @9: o `additionalSpells` da classe declara a magia como
 *    preparada no nível 9, e só o texto diz "you can cast the spell without
 *    expending a spell slot… once… until you finish a Long Rest". Sem isto o
 *    jogador perdia o uso grátis inteiro no export.
 * @param {Array<object>} spells      saída de `grantedSpells().spells`
 * @param {{name?: string, source?: string}|null} entity  espécie/classe/subclasse
 * @returns {Array<object>}  nova lista (não muta a entrada)
 */
export function applyUsesOverlay(spells, entity) {
  const table = INNATE_USES[overlayKey(entity)];
  if (!table) return spells ?? [];
  return (spells ?? []).map((s) => {
    if (s.castType && s.castType !== 'innate') return s;
    const override = table[s.name.toLowerCase()];
    if (!override) return s;
    return { ...s, castType: override.castType, count: override.count ?? null, scale: null };
  });
}
