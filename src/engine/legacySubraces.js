// =============================================================================
// legacySubraces: as sub-raças legadas curadas (DDL-0058)
// =============================================================================
// O QUE FAZ
//   O latestOnly esconde uma raça reprintada (Tiefling PHB para XPHB) e, por
//   COLATERAL, as sub-raças dela, que não têm equivalente 2024. Este registro é a
//   lista FECHADA das que voltam SEM reescrita, curada olho a olho (2026-07-22).
//   Os Tieflings foram reescritos (legacyFiendishLegacies) e o Halfling e o Dwarf
//   viraram swap (legacySwapLineages); nenhum deles está aqui.
//
// FUNÇÕES
//   split(id), toRef(entry): uma entrada como referência ao dado.
//   legacySubracesFor(race): as que viram LINHAGEM de uma raça atual.
//   legacyStandaloneRefs(): as que viram ESPÉCIE à parte.
//
// DECISÕES E ARMADILHAS
//   - Descarte (critério do usuário: existe versão moderna autônoma mais
//     completa): Eladrin (Eladrin MPMM), Asmodeus e Variant; Infernal Legacy (são
//     a Infernal XPHB), as quatro "Descent" do Half-Elf (Khoravar EFA),
//     Draconblood e Ravenite (sem tipo de dano para o sopro ao lado das 10 cores).
//   - REGRA DE ATRIBUTO (decisão do usuário): o `ability` 2014 é IGNORADO; a
//     linhagem entra pelo que tem de próprio. Quem aplica é o prepareLegacySubrace
//     do speciesData.
//   - DUAS FORMAS DE VOLTAR (`as`), decididas por BALANCEAMENTO (DDL-0060):
//     'species' é a regra prática: espécie à parte, fundida na base LEGADA, sempre
//     que a base 2024 dá ALGO A MAIS (absorveu um traço de sub-raça, ganhou traço
//     novo, foi reescrita: o Keldon somaria ao Versatile do Human 2024).
//     'lineage' só quando o chassi 2024 é o de 2014 mais um guarda-chuva que a
//     sub-raça ocupa via `supersedes`; hoje só o Elf (o Pallid ocupa o Elven
//     Lineage). Regra: liste os traços das duas bases; sobrou qualquer coisa além
//     do guarda-chuva, é 'species'.
//   - Os campos: `race` (a raça ATUAL, ou só a procedência em 'species'),
//     `subrace` e `of` (a base LEGADA; juntos, a chave de 4 campos do 5etools),
//     `as`, `supersedes` (o traço 2024 que a linhagem ocupa; o `overwrite` 2014
//     mirava o nome antigo, e sem isso a ficha mostrava os dois).
//   - LEGACY_PROSE_SECTIONS: seções de prosa 2014 que o chassi 2024 expressa em
//     campos (o Keldon traz as quatro). Só o TEXTO cai, nunca o campo.
//   - O swap e a reescrita NÃO afrouxam a regra do `as`: ela julga a fusão CRUA.
// -----------------------------------------------------------------------------

/** @type {ReadonlySet<string>} */
export const LEGACY_PROSE_SECTIONS = Object.freeze(
  new Set(['Age', 'Alignment', 'Size', 'Speed', 'Languages']),
);

/**
 * @type {ReadonlyArray<{race: string, subrace: string, of: string,
 *   as?: 'lineage'|'species', supersedes?: string[]}>}
 */
export const LEGACY_SUBRACES = Object.freeze([
  { race: 'Elf|XPHB', subrace: 'Pallid|EGW', of: 'Elf|PHB', supersedes: ['Elven Lineage'] },

  { race: 'Human|XPHB', subrace: 'Keldon|PSD', of: 'Human|PHB', as: 'species' },
]);

/** Quebra "Nome|FONTE" em [nome, fonte]. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Uma entrada do registro como referência ao dado. */
function toRef(entry) {
  const [name, source] = split(entry.subrace);
  const [raceName, raceSource] = split(entry.of);
  return { name, source, raceName, raceSource, supersedes: entry.supersedes ?? [] };
}

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

const standaloneRefs = Object.freeze(
  LEGACY_SUBRACES.filter((e) => e.as === 'species').map(toRef),
);

/**
 * As sub-raças legadas que viram linhagem de uma raça atual.
 * @param {object|null} race
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacySubracesFor(race) {
  if (!race?.name) return [];
  return lineagesByRace.get(`${race.name}|${race.source}`) ?? [];
}

/**
 * As sub-raças legadas que viram espécie à parte.
 * @returns {ReadonlyArray<{name: string, source: string, raceName: string,
 *   raceSource: string, supersedes: string[]}>}
 */
export function legacyStandaloneRefs() {
  return standaloneRefs;
}
