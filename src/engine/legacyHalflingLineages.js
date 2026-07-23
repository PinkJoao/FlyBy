// =============================================================================
// Halfling Lineage — a linhagem que a edição 2024 não escreveu (DDL-0063)
// =============================================================================
// O Halfling 2014 tinha quatro sub-raças IRMÃS (Lightfoot e Stout no PHB,
// Ghostwise no SCAG, Lotusden no EGW). Nenhuma delas era "a base": escolher uma
// era obrigatório. O chassi 2024 não virou um guarda-chuva de linhagem como o do
// Elf ou o do Gnome — ele simplesmente **ABSORVEU o traço do Lightfoot**
// (Naturally Stealthy) para dentro da espécie, e as outras três ficaram fora.
//
// Isso é o que torna as três formas anteriores insuficientes (ver DDL-0059/0060):
//   · como LINHAGEM crua, o Stout ganharia Naturally Stealthy DE GRAÇA por cima
//     do que é dele — Lightfoot + Stout de uma vez;
//   · como ESPÉCIE à parte (o que Ghostwise/Lotusden eram entre 2026-07-22 e
//     2026-07-23), ela é balanceada mas espalha a família em várias linhas do
//     seletor, que é exatamente a confusão que se quer resolver;
//   · a REESCRITA do DDL-0061 precisa de um traço guarda-chuva com TABELA onde
//     encaixar, e o Halfling XPHB não tem nenhum.
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
// Regra que sustenta isso (DDL-0063, obrigatória para uma entrada futura): TODA
// opção substitui o traço absorvido, e o conjunto DEVE incluir a que reproduz a
// base 2024 exatamente. Sem essa opção a mudança TIRA algo de quem já tinha, e a
// pergunta "por que escolher a espécie pura?" volta.
//
// FIDELIDADE AO DADO (DDL-0003/0061: enviamos código, nunca conteúdo). O texto de
// cada opção são os `entries` da própria sub-raça 2014, sem uma palavra nossa —
// e o do Lightfoot é o `Naturally Stealthy` da BASE 2024, não o do Lightfoot|PHB,
// justamente porque ele tem de reproduzir a base (a redação 2024 diz "take the
// Hide action", a de 2014 dizia "attempt to hide"). A ÚNICA string autoral do
// módulo é a frase de moldura do guarda-chuva (`UMBRELLA_INTRO`), no mesmo
// espírito da nota de upcast do DDL-0061: moldura de UI, zero regra de jogo.
//
// NÃO NORMALIZAMOS a mecânica das opções (decisão do usuário): o Lotusden segue
// mais pesado que as irmãs (cantrip + magia@3 + magia@5, o formato de linhagem do
// Elf 2024) e com o atributo de conjuração FIXO em Sabedoria, como o dado 2014
// diz. É o mesmo tratamento que o Pallid recebe hoje no Elf (DDL-0060) — quem
// normaliza atributo e magias é a REESCRITA (DDL-0061), que aqui não se aplica.
//
// O Dwarf tem exatamente o mesmo padrão (Dwarf XPHB = Dwarf 2014 + o Dwarven
// Toughness do *Hill*, e o *Mountain* ficou de fora com o Dwarven Armor
// Training). Foi deixado FORA de propósito, a pedido do usuário — o escopo aqui é
// só o Halfling. Adicioná-lo depois é um segundo alvo neste mesmo módulo.
// -----------------------------------------------------------------------------

import { LEGACY_PROSE_SECTIONS } from './legacySubraces';

/** A espécie 2024 que recebe estas linhagens. */
const TARGET_RACE = 'Halfling|XPHB';
/** Nome do traço guarda-chuva que criamos (e rótulo do seletor de linhagem). */
export const UMBRELLA_TRAIT = 'Halfling Lineage';
/** Traço que a base 2024 ABSORVEU de uma sub-raça 2014 — o que sai do lugar. */
const ABSORBED_TRAIT = 'Naturally Stealthy';
/** Base LEGADA de onde vêm as sub-raças (a chave de 4 campos do 5etools). */
const LEGACY_BASE = Object.freeze({ raceName: 'Halfling', raceSource: 'PHB' });
/** A única frase autoral do módulo: moldura de UI, sem regra de jogo. */
const UMBRELLA_INTRO = 'Choose one of the following options.';

/**
 * Campos ESTRUTURADOS que a opção leva da sub-raça para a variante. Só os que
 * SOBRESCREVEM: `buildVariant` faz `{...base, ...overrides}`, então um campo de
 * semântica CONCATENATIVA (traitTags, languageProficiencies) não pode entrar
 * aqui sem tratamento próprio. Nenhuma das quatro opções usa um desses hoje —
 * quem acrescentar uma que use precisa decidir a semântica antes.
 */
const LIFTED_FIELDS = Object.freeze([
  'resist', 'immune', 'vulnerable', 'additionalSpells',
  'speed', 'darkvision', 'skillProficiencies', 'toolProficiencies',
]);

/**
 * As quatro linhagens. Cada entrada:
 *  - `lineage` rótulo da opção, do nome da variante e da linha da lista.
 *  - `from`    sub-raça de origem em `db.races.subrace` ("Nome|FONTE"), ou
 *              `null` no Lightfoot — cujo traço vive na BASE 2024, porque foi
 *              ela quem o absorveu (ver o cabeçalho).
 *  - `source`  procedência exibida (o chip de fonte da linhagem). É sempre o
 *              livro que deu NOME à sub-raça, inclusive no Lightfoot, mesmo que
 *              o texto dele venha do XPHB.
 * @type {ReadonlyArray<{lineage: string, from: string|null, source: string}>}
 */
export const HALFLING_LINEAGES = Object.freeze([
  { lineage: 'Lightfoot', from: null, source: 'PHB' },
  { lineage: 'Stout', from: 'Stout|PHB', source: 'PHB' },
  { lineage: 'Ghostwise', from: 'Ghostwise|SCAG', source: 'SCAG' },
  { lineage: 'Lotusden', from: 'Lotusden|EGW', source: 'EGW' },
]);

/** Quebra "Nome|FONTE" em `[nome, fonte]`. */
function split(id) {
  const i = id.lastIndexOf('|');
  return i < 0 ? [id, ''] : [id.slice(0, i), id.slice(i + 1)];
}

/** Nome da variante gerada, no padrão das oficiais ("Gnome; Forest Gnome Lineage"). */
export function halflingVersionName(lineage) {
  return `Halfling; ${lineage} Lineage`;
}

/** É a espécie que recebe estas linhagens? */
function isTarget(race) {
  return !!race?.name && `${race.name}|${race.source}` === TARGET_RACE;
}

/** Localiza a sub-raça de origem em `db.races.subrace` (chave de 4 campos). */
function findSubrace(db, from) {
  const [name, source] = split(from);
  return (
    (db?.races?.subrace ?? []).find(
      (s) =>
        s?.name === name &&
        s.source === source &&
        s.raceName === LEGACY_BASE.raceName &&
        s.raceSource === LEGACY_BASE.raceSource,
    ) ?? null
  );
}

/**
 * Os traços de uma opção, como `entries` prontos. Sem o `data.overwrite` da
 * sub-raça (ela apontava para o traço 2014, e quem decide o alvo aqui é o
 * guarda-chuva) e sem as seções de prosa que o chassi 2024 expressa em campos
 * estruturados (DDL-0059).
 */
function optionEntries(db, race, spec) {
  const source = spec.from
    ? findSubrace(db, spec.from)?.entries
    : (race?.entries ?? []).filter((e) => e?.name === ABSORBED_TRAIT);
  if (!Array.isArray(source) || source.length === 0) return null;
  const kept = source
    .filter((e) => e?.name && !LEGACY_PROSE_SECTIONS.has(e.name))
    .map(({ data, ...rest }) => rest); // eslint-disable-line no-unused-vars
  return kept.length ? kept : null;
}

/** Os campos estruturados que a opção sobrescreve na variante. */
function liftedFields(db, spec) {
  if (!spec.from) return {}; // Lightfoot não muda campo nenhum: ele É a base
  const sr = findSubrace(db, spec.from);
  const out = {};
  for (const field of LIFTED_FIELDS) {
    if (sr?.[field] != null) out[field] = sr[field];
  }
  return out;
}

/**
 * Monta o descritor de versão (formato `_versions`) e o item da lista do
 * guarda-chuva a partir das MESMAS peças — é a lição do DDL-0061: reprocessar o
 * texto já montado faz a lista discordar do traço.
 * @returns {{version: object, item: object}|null} null se a origem não estiver
 *   no compêndio carregado
 */
function buildOption(db, race, spec) {
  const entries = optionEntries(db, race, spec);
  if (!entries) return null;
  return {
    version: {
      name: halflingVersionName(spec.lineage),
      source: spec.source,
      ...liftedFields(db, spec),
      _mod: {
        entries: {
          mode: 'replaceArr',
          replace: UMBRELLA_TRAIT,
          items: { type: 'entries', name: `${UMBRELLA_TRAIT} (${spec.lineage})`, entries },
        },
      },
    },
    item: { type: 'item', name: spec.lineage, entries },
  };
}

const cache = new WeakMap(); // db → { versions, umbrella }

/** Mínimo de opções para o guarda-chuva existir: uma só não é escolha. */
const MIN_OPTIONS = 2;

/**
 * Versões + o traço guarda-chuva, montados juntos e memoizados por db.
 * Com menos de duas opções montáveis (compêndio incompleto) o resultado é vazio
 * e a espécie segue exatamente como está hoje — trocar o Naturally Stealthy por
 * um seletor de uma opção só seria ruído puro.
 */
function build(db, race) {
  if (!db || !isTarget(race)) return { versions: [], umbrella: null };
  const cached = cache.get(db);
  if (cached) return cached;
  const built = HALFLING_LINEAGES.map((spec) => buildOption(db, race, spec)).filter(Boolean);
  const out = built.length >= MIN_OPTIONS
    ? {
        versions: built.map((b) => b.version),
        umbrella: {
          type: 'entries',
          name: UMBRELLA_TRAIT,
          entries: [UMBRELLA_INTRO, { type: 'list', style: 'list-hang-notitle', items: built.map((b) => b.item) }],
        },
      }
    : { versions: [], umbrella: null };
  cache.set(db, out);
  return out;
}

/**
 * Os descritores de versão (formato `_versions`) das linhagens do Halfling. Só o
 * Halfling XPHB tem; qualquer outra espécie devolve lista vazia.
 *
 * Eles NÃO são marcados `_legacy`: ao contrário das sub-raças legadas opcionais
 * (DDL-0059), estas SUBSTITUEM um traço da base, então escolher uma é
 * obrigatório — é o que `requiresLineage` passa a devolver.
 * @param {object|null} db
 * @param {object|null} race  espécie BASE (objeto cru)
 * @returns {object[]}
 */
export function halflingLineageVersions(db, race) {
  return build(db, race).versions;
}

/**
 * A espécie com o traço absorvido SUBSTITUÍDO pelo guarda-chuva. É o que faz a
 * base, antes de escolher, mostrar "Halfling Lineage" (a decisão pendente) em
 * vez de "Naturally Stealthy" (o traço de UMA das opções, exibido como se fosse
 * de todas).
 *
 * IDEMPOTENTE e devolve a MESMA referência quando não há o que mudar — quem
 * compara identidade (memo de render, caches) não vê churn. Precisa rodar ANTES
 * de `buildVariant`, senão o `replaceArr` das versões não acha o alvo e o traço
 * da linhagem some silenciosamente.
 * @param {object|null} db
 * @param {object|null} race
 * @returns {object|null}
 */
export function withLineageUmbrella(db, race) {
  const { umbrella } = build(db, race);
  if (!umbrella || !Array.isArray(race.entries)) return race;
  const i = race.entries.findIndex((e) => e?.name === ABSORBED_TRAIT);
  if (i < 0) return race; // já aplicado (idempotente) ou base inesperada
  const entries = [...race.entries];
  entries[i] = umbrella;
  return { ...race, entries };
}

/**
 * O nome do guarda-chuva desta espécie, para o rótulo do seletor de linhagem
 * (DDL-0062: o rótulo vem do traço substituído). Aqui o traço é nosso, então o
 * nome sai daqui — e continua sendo uma fonte única, não uma string solta na UI.
 * @param {object|null} race
 * @returns {string|null}
 */
export function lineageUmbrellaName(race) {
  return isTarget(race) ? UMBRELLA_TRAIT : null;
}

// --- Migração ----------------------------------------------------------------
// Duas formas antigas precisam virar "Halfling XPHB + linhagem". Toda mudança de
// FORMA de uma espécie legada exige isto (foi o que o DDL-0061 fez com os
// tieflings): o nome antigo deixa de existir em catálogo nenhum, e a ficha
// perderia a espécie ao recarregar.

/** 'halfling (ghostwise)|SCAG' → a linhagem correspondente. */
const STANDALONE_MIGRATION = new Map(
  HALFLING_LINEAGES.filter((spec) => spec.from).map((spec) => {
    const [name, source] = split(spec.from);
    return [`halfling (${name.toLowerCase()})|${source}`, halflingVersionName(spec.lineage)];
  }),
);

/** A linhagem que reproduz a base 2024 exatamente (o traço absorvido). */
const ABSORBED_LINEAGE = halflingVersionName(
  (HALFLING_LINEAGES.find((spec) => !spec.from) ?? HALFLING_LINEAGES[0]).lineage,
);

/**
 * Converte uma espécie salva numa forma antiga para a nova. Duas conversões:
 *
 *  - **Espécie à parte** (`Halfling (Ghostwise)|SCAG`, `Halfling (Lotusden)|EGW`,
 *    que existiram entre 2026-07-22 e 2026-07-23) → Halfling XPHB + a linhagem.
 *    Zera o choice-bag, como o Builder faz ao trocar de linhagem.
 *  - **Halfling XPHB sem linhagem** → *Lightfoot*, a opção que reproduz a base de
 *    hoje. Migração SEM PERDA: o personagem mantém exatamente o Naturally
 *    Stealthy que já tinha. O choice-bag é PRESERVADO (nada nele dependia da
 *    linhagem — a base não gerava escolha nenhuma).
 *
 * Qualquer outra espécie — e um Halfling que já tenha linhagem — passa intacta.
 * @param {object|null} species  `character.species`
 * @returns {object|null}
 */
export function migrateHalflingSpecies(species) {
  if (!species?.id) return species;
  const id = String(species.id).toLowerCase();
  const lineage = STANDALONE_MIGRATION.get(`${id}|${species.source}`);
  if (lineage) return { ...species, id: 'halfling', source: 'XPHB', lineage, choices: {} };
  if (id === 'halfling' && species.source === 'XPHB' && !species.lineage) {
    return { ...species, lineage: ABSORBED_LINEAGE };
  }
  return species;
}
