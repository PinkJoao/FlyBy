// =============================================================================
// Swap Lineages - a linhagem que a edição 2024 não escreveu (DDL-0063)
// =============================================================================
// Duas espécies 2014 tinham sub-raças IRMÃS - nenhuma delas era "a base", e
// escolher uma era obrigatório. O chassi 2024 não virou um guarda-chuva de
// linhagem como o do Elf ou o do Gnome: ele simplesmente **ABSORVEU o traço de
// UMA das sub-raças** para dentro da espécie, e as outras ficaram fora.
//
//   Halfling XPHB = Halfling 2014 + Naturally Stealthy (do *Lightfoot*)
//   Dwarf    XPHB = Dwarf    2014 + Dwarven Toughness  (do *Hill*)
//
// Isso é o que torna as três formas anteriores insuficientes (ver DDL-0059/0060):
//   · como LINHAGEM crua, o Stout ganharia Naturally Stealthy DE GRAÇA por cima
//     do que é dele - Lightfoot + Stout de uma vez;
//   · como ESPÉCIE à parte (o que Ghostwise/Lotusden eram entre 2026-07-22 e
//     2026-07-23), ela é balanceada mas espalha a família em várias linhas do
//     seletor, que é exatamente a confusão que se quer resolver;
//   · a REESCRITA do DDL-0061 precisa de um traço guarda-chuva com TABELA onde
//     encaixar, e nem o Halfling nem o Dwarf XPHB têm um.
//
// A quarta forma (`swap`): construir o guarda-chuva que faltou. O traço absorvido
// SAI da base e vira UMA das opções, de modo que cada linhagem TROCA o traço em
// vez de somar a ele:
//
//   Halfling Lineage  (ocupa o lugar de "Naturally Stealthy")
//     ├─ Lightfoot → Naturally Stealthy      ← reproduz a base 2024 EXATAMENTE
//     ├─ Stout     → Stout Resilience
//     ├─ Ghostwise → Silent Speech
//     └─ Lotusden  → Child of the Wood + Timberwalk + magias
//
//   Dwarf Lineage     (ocupa o lugar de "Dwarven Toughness")
//     ├─ Hill      → Dwarven Toughness       ← reproduz a base 2024 EXATAMENTE
//     └─ Mountain  → Dwarven Armor Training
//
// Regra que sustenta isso (DDL-0063, obrigatória para uma entrada futura): TODA
// opção substitui o traço absorvido, e o conjunto DEVE incluir a que reproduz a
// base 2024 exatamente. Sem essa opção a mudança TIRA algo de quem já tinha, e a
// pergunta "por que escolher a espécie pura?" volta.
//
// FIDELIDADE AO DADO (DDL-0003/0061: enviamos código, nunca conteúdo). O texto de
// cada opção são os `entries` da própria sub-raça 2014, sem uma palavra nossa -
// e o da opção ABSORVIDA vem da BASE 2024, não da sub-raça 2014, justamente
// porque ela tem de reproduzir a base (a redação 2024 do Naturally Stealthy diz
// "take the Hide action", a de 2014 dizia "attempt to hide"). A ÚNICA string
// autoral do módulo é a frase de moldura do guarda-chuva (`UMBRELLA_INTRO`), no
// mesmo espírito da nota de upcast do DDL-0061: moldura de UI, zero regra.
//
// NÃO NORMALIZAMOS a mecânica das opções (decisão do usuário): o Lotusden segue
// mais pesado que as irmãs (cantrip + magia@3 + magia@5, o formato de linhagem do
// Elf 2024) e com o atributo de conjuração FIXO em Sabedoria, como o dado 2014
// diz. É o mesmo tratamento que o Pallid recebe hoje no Elf (DDL-0060) - quem
// normaliza atributo e magias é a REESCRITA (DDL-0061), que aqui não se aplica.
//
// COMO ACRESCENTAR UMA ESPÉCIE: uma entrada em `SWAP_LINEAGES`. O método para
// achar o traço absorvido é o DIFF base-2024 × base-2014 (DDL-0063 regra 1); sem
// traço absorvido identificável **não é `swap`** - é `lineage` (Elf) ou `species`.
// -----------------------------------------------------------------------------

import { LEGACY_PROSE_SECTIONS } from './legacySubraces';

/** A única frase autoral do módulo: moldura de UI, sem regra de jogo. */
const UMBRELLA_INTRO = 'Choose one of the following options.';

/**
 * As espécies com traço ABSORVIDO, keyed por `Nome|FONTE` da base 2024.
 *  - `umbrella`  nome do traço guarda-chuva que criamos (e rótulo do seletor).
 *  - `absorbed`  traço que a base 2024 absorveu de uma sub-raça 2014 - o que sai
 *                do lugar para o guarda-chuva entrar.
 *  - `legacy`    base LEGADA de onde vêm as sub-raças (chave de 4 campos).
 *  - `options`   as linhagens. `from` é a sub-raça de origem em
 *                `db.races.subrace` ("Nome|FONTE"), ou `null` na opção ABSORVIDA
 *                - cujo traço vive na BASE 2024, porque foi ela quem o absorveu.
 *                `source` é a procedência exibida (o livro que deu NOME à
 *                sub-raça, inclusive na absorvida, mesmo que o texto seja do XPHB).
 * @type {Readonly<Record<string, {umbrella: string, absorbed: string,
 *   legacy: {raceName: string, raceSource: string},
 *   options: ReadonlyArray<{lineage: string, from: string|null, source: string}>}>>}
 */
export const SWAP_LINEAGES = Object.freeze({
  'Halfling|XPHB': {
    umbrella: 'Halfling Lineage',
    absorbed: 'Naturally Stealthy',
    legacy: { raceName: 'Halfling', raceSource: 'PHB' },
    options: [
      { lineage: 'Lightfoot', from: null, source: 'PHB' },
      { lineage: 'Stout', from: 'Stout|PHB', source: 'PHB' },
      { lineage: 'Ghostwise', from: 'Ghostwise|SCAG', source: 'SCAG' },
      { lineage: 'Lotusden', from: 'Lotusden|EGW', source: 'EGW' },
    ],
  },
  // O Dwarf tem o padrão IDÊNTICO ao do Halfling. Ficou de fora até 2026-07-29
  // por prioridade (o Halfling tinha o caso misto de variantes aparecendo e não
  // aparecendo); entrou quando o custo se mostrou trivial. As outras duas
  // sub-raças de Dwarf do dataset ficam fora pela política de reprint: Duergar
  // hoje é espécie própria (`Duergar|MPMM`) e Mark of Warding é uma marca
  // dracônica de Eberron - nenhuma das duas é irmã de Hill/Mountain.
  'Dwarf|XPHB': {
    umbrella: 'Dwarf Lineage',
    absorbed: 'Dwarven Toughness',
    legacy: { raceName: 'Dwarf', raceSource: 'PHB' },
    options: [
      { lineage: 'Hill', from: null, source: 'PHB' },
      { lineage: 'Mountain', from: 'Mountain|PHB', source: 'PHB' },
    ],
  },
});

/**
 * Campos ESTRUTURADOS que a opção leva da sub-raça para a variante. Só os que
 * SOBRESCREVEM: `buildVariant` faz `{...base, ...overrides}`, então um campo de
 * semântica CONCATENATIVA (traitTags, languageProficiencies) não pode entrar
 * aqui sem tratamento próprio. Nenhuma das opções de hoje usa um desses - quem
 * acrescentar uma que use precisa decidir a semântica antes.
 */
const LIFTED_FIELDS = Object.freeze([
  'resist', 'immune', 'vulnerable', 'additionalSpells',
  'speed', 'darkvision', 'skillProficiencies', 'toolProficiencies',
  // O Dwarven Armor Training do *Mountain* é a única mecânica dessa linhagem, e
  // ela vive num campo estruturado (`armorProficiencies`), não na prosa: sem
  // elevá-lo, a opção viraria só texto e o Anão da Montanha não ficaria
  // proficiente com armadura leve/média. `weaponProficiencies` entra pelo mesmo
  // motivo (nenhuma opção de hoje usa, mas é o campo irmão).
  'armorProficiencies', 'weaponProficiencies',
]);

/** A entrada do registro para uma espécie, ou null. */
function specFor(race) {
  return race?.name ? (SWAP_LINEAGES[`${race.name}|${race.source}`] ?? null) : null;
}

/** Quebra "Nome|FONTE" em `[nome, fonte]`. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Nome da variante gerada, no padrão das oficiais ("Gnome; Forest Gnome Lineage"). */
export function swapVersionName(baseName, lineage) {
  return `${baseName}; ${lineage} Lineage`;
}

/** Localiza a sub-raça de origem em `db.races.subrace` (chave de 4 campos). */
function findSubrace(db, legacy, from) {
  const [name, source] = split(from);
  return (
    (db?.races?.subrace ?? []).find(
      (s) =>
        s?.name === name &&
        s.source === source &&
        s.raceName === legacy.raceName &&
        s.raceSource === legacy.raceSource,
    ) ?? null
  );
}

/**
 * Os traços de uma opção, como `entries` prontos. Sem o `data.overwrite` da
 * sub-raça (ela apontava para o traço 2014, e quem decide o alvo aqui é o
 * guarda-chuva) e sem as seções de prosa que o chassi 2024 expressa em campos
 * estruturados (DDL-0059).
 */
function optionEntries(db, race, spec, option) {
  const source = option.from
    ? findSubrace(db, spec.legacy, option.from)?.entries
    : (race?.entries ?? []).filter((e) => e?.name === spec.absorbed);
  if (!Array.isArray(source) || source.length === 0) return null;
  const kept = source
    .filter((e) => e?.name && !LEGACY_PROSE_SECTIONS.has(e.name))
    .map(({ data, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return kept.length ? kept : null;
}

/** Os campos estruturados que a opção sobrescreve na variante. */
function liftedFields(db, spec, option) {
  if (!option.from) return {}; // a opção absorvida não muda campo nenhum: ela É a base
  const sr = findSubrace(db, spec.legacy, option.from);
  const out = {};
  for (const field of LIFTED_FIELDS) {
    if (sr?.[field] != null) out[field] = sr[field];
  }
  return out;
}

/**
 * Monta o descritor de versão (formato `_versions`) e o item da lista do
 * guarda-chuva a partir das MESMAS peças - é a lição do DDL-0061: reprocessar o
 * texto já montado faz a lista discordar do traço.
 * @returns {{version: object, item: object}|null} null se a origem não estiver
 *   no compêndio carregado
 */
function buildOption(db, race, spec, option) {
  const entries = optionEntries(db, race, spec, option);
  if (!entries) return null;
  return {
    version: {
      name: swapVersionName(race.name, option.lineage),
      source: option.source,
      ...liftedFields(db, spec, option),
      _mod: {
        entries: {
          mode: 'replaceArr',
          replace: spec.umbrella,
          items: { type: 'entries', name: `${spec.umbrella} (${option.lineage})`, entries },
        },
      },
    },
    item: { type: 'item', name: option.lineage, entries },
  };
}

// db → Map(`Nome|FONTE` → { versions, umbrella })
const cache = new WeakMap();

/** Mínimo de opções para o guarda-chuva existir: uma só não é escolha. */
const MIN_OPTIONS = 2;

const EMPTY = Object.freeze({ versions: [], umbrella: null });

/**
 * Versões + o traço guarda-chuva, montados juntos e memoizados por db+espécie.
 * Com menos de duas opções montáveis (compêndio incompleto) o resultado é vazio
 * e a espécie segue exatamente como está hoje - trocar o traço absorvido por um
 * seletor de uma opção só seria ruído puro.
 */
function build(db, race) {
  const spec = specFor(race);
  if (!db || !spec) return EMPTY;
  const byRace = cache.get(db) ?? new Map();
  cache.set(db, byRace);
  const key = `${race.name}|${race.source}`;
  const cached = byRace.get(key);
  if (cached) return cached;
  const built = spec.options.map((option) => buildOption(db, race, spec, option)).filter(Boolean);
  const out = built.length >= MIN_OPTIONS
    ? {
        versions: built.map((b) => b.version),
        umbrella: {
          type: 'entries',
          name: spec.umbrella,
          entries: [UMBRELLA_INTRO, { type: 'list', style: 'list-hang-notitle', items: built.map((b) => b.item) }],
        },
      }
    : EMPTY;
  byRace.set(key, out);
  return out;
}

/**
 * Os descritores de versão (formato `_versions`) das linhagens de swap. Só as
 * espécies do `SWAP_LINEAGES` têm; qualquer outra devolve lista vazia.
 *
 * Eles NÃO são marcados `_legacy`: ao contrário das sub-raças legadas opcionais
 * (DDL-0059), estas SUBSTITUEM um traço da base, então escolher uma é
 * obrigatório - é o que `requiresLineage` passa a devolver.
 * @param {object|null} db
 * @param {object|null} race  espécie BASE (objeto cru)
 * @returns {object[]}
 */
export function swapLineageVersions(db, race) {
  return build(db, race).versions;
}

/**
 * A espécie com o traço absorvido SUBSTITUÍDO pelo guarda-chuva. É o que faz a
 * base, antes de escolher, mostrar "Halfling Lineage"/"Dwarf Lineage" (a decisão
 * pendente) em vez do traço de UMA das opções, exibido como se fosse de todas.
 *
 * IDEMPOTENTE e devolve a MESMA referência quando não há o que mudar - quem
 * compara identidade (memo de render, caches) não vê churn. Precisa rodar ANTES
 * de `buildVariant`, senão o `replaceArr` das versões não acha o alvo e o traço
 * da linhagem some silenciosamente.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {object|null}
 */
export function withLineageUmbrella(db, race) {
  const spec = specFor(race);
  const { umbrella } = build(db, race);
  if (!umbrella || !spec || !Array.isArray(race.entries)) return race;
  const i = race.entries.findIndex((e) => e?.name === spec.absorbed);
  if (i < 0) return race; // já aplicado (idempotente) ou base inesperada
  const entries = [...race.entries];
  entries[i] = umbrella;
  return { ...race, entries };
}

/**
 * O nome do guarda-chuva desta espécie, para o rótulo do seletor de linhagem
 * (DDL-0062: o rótulo vem do traço substituído). Aqui o traço é nosso, então o
 * nome sai daqui - e continua sendo uma fonte única, não uma string solta na UI.
 * @param {object|null} race
 * @returns {string|null}
 */
export function lineageUmbrellaName(race) {
  return specFor(race)?.umbrella ?? null;
}

// --- Migração ----------------------------------------------------------------
// Toda mudança de FORMA de uma espécie legada exige isto (foi o que o DDL-0061
// fez com os tieflings): o nome antigo deixa de existir em catálogo nenhum, e a
// ficha perderia a espécie ao recarregar.

/** `'halfling (ghostwise)|SCAG'` → `{ id, source, lineage }` da forma nova. */
const STANDALONE_MIGRATION = new Map(
  Object.entries(SWAP_LINEAGES).flatMap(([key, spec]) => {
    const [baseName, baseSource] = split(key);
    return spec.options
      .filter((o) => o.from)
      .map((o) => {
        const [name, source] = split(o.from);
        return [
          `${baseName.toLowerCase()} (${name.toLowerCase()})|${source}`,
          { id: baseName.toLowerCase(), source: baseSource, lineage: swapVersionName(baseName, o.lineage) },
        ];
      });
  }),
);

/** `'halfling|XPHB'` → a linhagem que reproduz a base 2024 exatamente. */
const ABSORBED_LINEAGE = new Map(
  Object.entries(SWAP_LINEAGES).map(([key, spec]) => {
    const [baseName] = split(key);
    const absorbed = spec.options.find((o) => !o.from) ?? spec.options[0];
    return [key.toLowerCase(), swapVersionName(baseName, absorbed.lineage)];
  }),
);

/**
 * Converte uma espécie salva numa forma antiga para a nova. Duas conversões:
 *
 *  - **Espécie à parte** (`Halfling (Ghostwise)|SCAG`, `Halfling (Lotusden)|EGW`,
 *    que existiram entre 2026-07-22 e 2026-07-23) → a base 2024 + a linhagem.
 *    Zera o choice-bag, como o Builder faz ao trocar de linhagem.
 *  - **Base 2024 sem linhagem** → a opção ABSORVIDA (Lightfoot no Halfling, Hill
 *    no Dwarf), que reproduz a base de hoje. Migração SEM PERDA: o personagem
 *    mantém exatamente o traço que já tinha. O choice-bag é PRESERVADO - nada
 *    nele dependia da linhagem, porque a base não gerava escolha nenhuma.
 *
 * Qualquer outra espécie - e uma que já tenha linhagem - passa intacta.
 * @param {object|null} species  `character.species`
 * @returns {object|null}
 */
export function migrateSwapSpecies(species) {
  if (!species?.id) return species;
  const id = String(species.id).toLowerCase();
  const moved = STANDALONE_MIGRATION.get(`${id}|${species.source}`);
  if (moved) return { ...species, ...moved, choices: {} };
  const lineage = ABSORBED_LINEAGE.get(`${id}|${String(species.source ?? '').toLowerCase()}`);
  if (lineage && !species.lineage) return { ...species, lineage };
  return species;
}
