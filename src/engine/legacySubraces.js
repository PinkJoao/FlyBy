// =============================================================================
// Sub-raças LEGADAS curadas (DDL-0058)
// =============================================================================
// A política `latestOnly` esconde uma raça reprintada (Tiefling PHB → XPHB), e
// com ela somem por COLATERAL as SUB-RAÇAS dessa base: elas não têm
// `reprintedAs` próprio, mas `raceLineages` só roda sobre as bases LISTADAS, e a
// base legada não é listada. Nenhuma delas tem equivalente 2024.
//
// Este registro é a lista FECHADA das que voltam, ANEXADAS À BASE ATUAL (as
// linhagens do Tiefling PHB entram no Tiefling XPHB). Registro explícito, no
// mesmo espírito de SUBCLASS_GRANTS / NATURAL_ARMOR: nada de heurística de nome
// — a curadoria foi manual, olho a olho (2026-07-22).
//
// CRITÉRIO DE DESCARTE (do usuário): existe uma versão moderna AUTÔNOMA mais
// completa e atual. Foram DESCARTADAS, deliberadamente:
//  - Eladrin (Elf|PHB, DMG)            → `Eladrin|MPMM` já é espécie própria.
//  - Asmodeus (Tiefling|PHB, MTF)      → a entrada não tem mecânica NENHUMA no
//    dado; é o tiefling PHB padrão, ou seja, a Infernal Legacy do XPHB.
//  - Variant; Infernal Legacy (SCAG)   → Thaumaturgy/Hellish Rebuke/Darkness,
//    idêntica à Fiendish Legacy (Infernal) do Tiefling XPHB.
//  - As 4 `Variant; … Descent` do Half-Elf (SCAG) → a base atual delas seria o
//    `Khoravar|EFA`, versão moderna autônoma (e de outro cenário).
//  - Draconblood e Ravenite (Dragonborn|PHB, EGW) → o Dragonborn XPHB põe a
//    ancestralidade de dragão nas próprias `_versions` (as 10 cores), então como
//    linhagens IRMÃS elas ficariam sem tipo de dano derivado para o sopro.
//
// REGRA DE ATRIBUTO (DDL-0058, decisão do usuário): o campo `ability` de uma
// sub-raça 2014 (+2/+1 fixos) é IGNORADO. O FlyBy é um builder de regras 2024, e
// nelas os aumentos de atributo vêm SEMPRE da origem. A linhagem legada entra
// pelo que tem de próprio (traços, sentidos, velocidade, proficiências, magias).
// Quem aplica isso é `subraceVersions` (engine/speciesData), que descarta o
// campo antes do merge — ver `stripLegacyAbility` lá.
// -----------------------------------------------------------------------------

/**
 * Seções de PROSA que uma raça 2014 escrevia à mão e o chassi 2024 não tem mais
 * (o dado moderno as expressa em campos estruturados: `size`, `speed`,
 * `languageProficiencies`…). Anexá-las ao traço de uma linhagem encheria a ficha
 * de texto morto — o Keldon (PSD) traz as quatro. Descartadas de TODA sub-raça
 * legada; só o TEXTO cai, nunca o campo estruturado homônimo.
 * @type {ReadonlySet<string>}
 */
export const LEGACY_PROSE_SECTIONS = Object.freeze(
  new Set(['Age', 'Alignment', 'Size', 'Speed', 'Languages']),
);

/**
 * DUAS FORMAS DE VOLTAR (campo `as`), porque nem toda base 2024 é o mesmo
 * chassi que a base 2014 da sub-raça:
 *
 *  - `'lineage'` (padrão) — a sub-raça vira LINHAGEM da base ATUAL. Só é
 *    correto quando o chassi 2024 é genérico: o Elf e o Tiefling 2024 têm um
 *    traço GUARDA-CHUVA ("Elven Lineage", "Fiendish Legacy") que a linhagem
 *    ocupa via `supersedes`, e nada de sub-raça vaza para ela.
 *
 *  - `'species'` — a sub-raça vira uma ESPÉCIE À PARTE no seletor de espécies,
 *    fundida na base LEGADA (`of`), como o `Eladrin|MPMM` já é hoje. É o caso
 *    quando a base 2024 ABSORVEU os traços de UMA das sub-raças 2014: o
 *    Halfling XPHB é o Halfling 2014 + **Naturally Stealthy**, que era o traço
 *    do *Lightfoot* — então um Ghostwise pendurado nele ganharia de graça um
 *    traço que nunca teve (e que o Silent Speech dele substituía). Sobre a base
 *    2014 ele sai correto: Lucky/Brave/Nimbleness + Silent Speech.
 *
 * REGRA para uma entrada nova: compare os traços da base 2024 com os da base
 * 2014. Se a 2024 trouxer o traço de alguma sub-raça 2014, use `'species'`; se
 * ela só tiver o guarda-chuva de linhagem, `'lineage'` + `supersedes`.
 *
 * Lista curada. Cada entrada:
 *  - `race`    raça ATUAL que recebe a linhagem ("Nome|FONTE"). Em `'species'`
 *    é só a procedência (de onde a sub-raça veio); a fusão usa `of`.
 *  - `subrace` entrada de `db.races.subrace` que volta ("Nome|FONTE").
 *  - `of`      raça LEGADA a que a sub-raça pertence no dado ("Nome|FONTE").
 *    Junto com `subrace` forma a chave de 4 campos que o 5etools usa
 *    (name/source/raceName/raceSource) — nome+fonte sozinhos não são únicos.
 *  - `as`      `'lineage'` (padrão) ou `'species'` — ver acima.
 *  - `supersedes` (opcional) traços da BASE ATUAL que esta linhagem SUBSTITUI.
 *    Uma sub-raça 2014 substituía o traço-de-linhagem 2014 (`data.overwrite:
 *    "Infernal Legacy"`), cujo nome mudou no chassi 2024 ("Fiendish Legacy"),
 *    então o merge do 5etools não acha o alvo e ANEXA — a ficha ficaria com o
 *    traço 2024 pedindo para escolher uma legacy AO LADO da legacy escolhida, e
 *    com a mecânica dele já sobrescrita pelo `additionalSpells` da linhagem.
 *    Listar o traço aqui é dizer "esta linhagem ocupa o lugar daquele".
 * @type {ReadonlyArray<{race: string, subrace: string, of: string,
 *   as?: 'lineage'|'species', supersedes?: string[]}>}
 */
export const LEGACY_SUBRACES = Object.freeze([
  // --- Elf ------------------------------------------------------------------
  // Pallid não declara overwrite (o dado 2014 do Elf não tinha traço-guarda-chuva),
  // mas ocupa o mesmo lugar: é a linhagem élfica escolhida.
  { race: 'Elf|XPHB', subrace: 'Pallid|EGW', of: 'Elf|PHB', supersedes: ['Elven Lineage'] },

  // --- Halfling: ESPÉCIES à parte -------------------------------------------
  // O Halfling XPHB absorveu o Naturally Stealthy do Lightfoot, então estas duas
  // não podem pendurar nele — vêm do chassi 2014, como espécies próprias.
  { race: 'Halfling|XPHB', subrace: 'Ghostwise|SCAG', of: 'Halfling|PHB', as: 'species' },
  { race: 'Halfling|XPHB', subrace: 'Lotusden|EGW', of: 'Halfling|PHB', as: 'species' },

  // --- Human ----------------------------------------------------------------
  { race: 'Human|XPHB', subrace: 'Keldon|PSD', of: 'Human|PHB' },

  // --- Tiefling: as legacies infernais de Mordenkainen… ----------------------
  { race: 'Tiefling|XPHB', subrace: 'Baalzebul|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Dispater|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Fierna|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Glasya|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Levistus|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Mammon|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Mephistopheles|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Zariel|MTF', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  // …e as variantes da Costa da Espada (a "Infernal Legacy" ficou de fora acima).
  { race: 'Tiefling|XPHB', subrace: "Variant; Devil's Tongue|SCAG", of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Variant; Hellfire|SCAG', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
  { race: 'Tiefling|XPHB', subrace: 'Variant; Winged|SCAG', of: 'Tiefling|PHB', supersedes: ['Fiendish Legacy'] },
]);

/** Quebra "Nome|FONTE" em `[nome, fonte]`. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Normaliza uma entrada do registro numa referência ao dado: a chave de 4
 * campos que casa `db.races.subrace`, mais a base LEGADA em que fundir. */
function toRef(entry) {
  const [name, source] = split(entry.subrace);
  const [raceName, raceSource] = split(entry.of);
  return { name, source, raceName, raceSource, supersedes: entry.supersedes ?? [] };
}

/** Índice 'Raça ATUAL|FONTE' → referências das que voltam como LINHAGEM. */
const lineagesByRace = (() => {
  const map = new Map();
  for (const entry of LEGACY_SUBRACES) {
    if (entry.as === 'species') continue;
    const list = map.get(entry.race) ?? [];
    list.push(toRef(entry));
    map.set(entry.race, list);
  }
  return map;
})();

/** As que voltam como ESPÉCIE própria (fundidas na base LEGADA `of`). */
const standaloneRefs = Object.freeze(
  LEGACY_SUBRACES.filter((e) => e.as === 'species').map(toRef),
);

/**
 * As sub-raças legadas curadas que viram LINHAGEM de uma raça ATUAL, como
 * referências ao dado.
 * @param {object|null} race  raça base ATUAL (objeto cru)
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacySubracesFor(race) {
  if (!race?.name) return [];
  return lineagesByRace.get(`${race.name}|${race.source}`) ?? [];
}

/**
 * As sub-raças legadas curadas que viram ESPÉCIE à parte. A `raceName`/
 * `raceSource` de cada uma é a base LEGADA em que ela deve ser fundida.
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacyStandaloneRefs() {
  return standaloneRefs;
}
