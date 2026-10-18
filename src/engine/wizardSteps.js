// =============================================================================
// wizardSteps: o motor de passos da criação guiada (Character Guidance)
// =============================================================================
// O QUE FAZ
//   Decide QUAIS passos de criação existem para um personagem e o ESTADO de cada
//   um; não desenha tela (isso é components/wizard). As telas escrevem no MESMO
//   `character` e derivam pelo mesmo engine: o wizard nunca é uma segunda fonte de
//   verdade da mecânica (DDL-0013).
//
//   Cada passo: { id, title, subtitle, when(character, derived), status(character,
//   derived) } com status 'complete', 'incomplete' ou 'optional'. O status
//   alimenta os selos e a Revisão e NUNCA trava o Avançar (decisão do usuário). A
//   Revisão não é um passo: o shell a acrescenta no fim. O texto de guia vive na
//   própria tela.
//
// FUNÇÕES
//   hasClass(c), nameSet(c): utilitários.
//   classSpellOrigins(d), hasCantrips(d), hasClassPrepared(d), cantripsFull(d),
//     preparedFull(d): o estado das magias de CLASSE.
//   scoresTouched(c), boostsComplete(c): atributos (também usados pelo
//     guidancePendencies do botão do guia).
//   storyTouched(c): algo de personalidade ou história foi escrito?
//   subclassLevelOf(c), pendingSubclassClass(c): a pendência de subclasse.
//   featuresStepShows(c, ctx): o passo de features aparece?
//   buildCreateSteps(character, derived, ctx): os passos relevantes, na ordem.
//
// DECISÕES E ARMADILHAS
//   - Ordem de criação do nível 1 (DDL-0013, revisada em 2026-07-11). As telas de
//     proficiências e de features FATIAM o choice-bag da classe por kind.
//   - Completo é PROFUNDO (DDL-0018): espécie com linhagem e todas as
//     sub-escolhas, talento com as dele, kit com os itens a escolher (TC-0024).
//     Essas flags precisam do db e vêm do `ctx`; sem ctx, cai no check raso.
//     buildCreateSteps assa o ctx na closure de cada status.
//   - Magia de espécie ou talento não abre passo (não há o que ESCOLHER): só as
//     origens de CLASSE contam. Os passos de cantrips e de magias somem quando a
//     classe não os tem (Ranger e Paladino sem cantrips).
//   - O passo de subclasse só aparece para quem já passou do nível dela.
//   - O guia leve de fixup e level-up precisa do db e mora em
//     components/wizard/fixupSteps.js.
// -----------------------------------------------------------------------------

const hasClass = (c) => (c?.classes ?? []).some((x) => x.classId);
const nameSet = (c) => !!c?.meta?.name && c.meta.name !== 'New Character';

const classSpellOrigins = (d) => (d?.spellcasting?.origins ?? []).filter((o) => o.kind === 'class');
const hasCantrips = (d) => classSpellOrigins(d).some((o) => o.cantripLimit > 0);
const hasClassPrepared = (d) => classSpellOrigins(d).some((o) => o.prepareLimit > 0);
const cantripsFull = (d) =>
  classSpellOrigins(d).filter((o) => o.cantripLimit > 0).every((o) => (o.cantrips?.length ?? 0) >= o.cantripLimit);
const preparedFull = (d) =>
  classSpellOrigins(d).filter((o) => o.prepareLimit > 0).every((o) => (o.prepared?.length ?? 0) >= o.prepareLimit);

const DEFAULT_SCORE = 10;
/** O jogador mexeu nos scores base? */
export const scoresTouched = (c) => {
  const m = c?.scoreMethod?.type;
  if (m && m !== 'manual') return true;
  return Object.values(c?.scores ?? {}).some((v) => v !== DEFAULT_SCORE);
};
/** Todo boost do background tem atributo escolhido? */
export const boostsComplete = (c) => {
  const b = c?.origin?.abilityBoosts ?? [];
  return b.length > 0 && b.every((x) => x.ability);
};
const STORY_FIELDS = ['personality', 'ideals', 'bonds', 'flaws', 'backstory'];
const storyTouched = (c) => STORY_FIELDS.some((k) => (c?.identity?.[k] ?? '').trim());

/** O nível em que a classe ganha subclasse. */
const subclassLevelOf = (c) => c?.rulesConfig?.subclassLevel ?? 3;
/** Uma classe no nível de subclasse sem subclasse escolhida, ou null. */
export const pendingSubclassClass = (c) =>
  (c?.classes ?? []).find((x) => x.classId && x.level >= subclassLevelOf(c) && !x.subclassId) ?? null;

const CREATE_CATALOG = [
  {
    id: 'intro',
    title: "Let's build your character",
    subtitle: 'Getting started',
    when: () => true,
    status: () => 'info',
  },
  {
    id: 'class',
    title: 'What do they do?',
    subtitle: 'Class',
    when: () => true,
    status: (c) => (hasClass(c) ? 'complete' : 'incomplete'),
  },
  {
    id: 'species',
    title: 'What are they?',
    subtitle: 'Species & lineage',
    when: () => true,
    status: (c, d, ctx) => (c?.species && (ctx?.speciesComplete ?? true) ? 'complete' : 'incomplete'),
  },
  {
    id: 'subclass',
    title: 'Choose a subclass',
    subtitle: 'Subclass',
    when: (c) => (c?.classes ?? []).some((x) => x.classId && x.level >= subclassLevelOf(c)),
    status: (c) => (pendingSubclassClass(c) ? 'incomplete' : 'complete'),
  },
  {
    id: 'originFeat',
    title: 'A knack from their past',
    subtitle: 'Origin feat',
    when: () => true,
    status: (c, d, ctx) =>
      (c?.origin?.originFeat && (ctx?.originFeatComplete ?? true) ? 'complete' : 'incomplete'),
  },
  {
    id: 'proficiencies',
    title: 'What are they good at?',
    subtitle: 'Skills, tools & languages',
    when: () => true,
    status: (c, d, ctx) => (ctx?.proficienciesComplete ? 'complete' : 'incomplete'),
  },
  {
    id: 'abilities',
    title: 'How capable are they?',
    subtitle: 'Ability scores',
    when: () => true,
    status: (c) => (scoresTouched(c) ? 'complete' : 'incomplete'),
  },
  {
    id: 'boosts',
    title: 'What sets them apart?',
    subtitle: 'Background boosts',
    when: () => true,
    status: (c) => (boostsComplete(c) ? 'complete' : 'incomplete'),
  },
  {
    id: 'equipment',
    title: 'Gear up',
    subtitle: 'Starting equipment',
    when: () => true,
    status: (c, d, ctx) => (c?.meta?.startingKit && (ctx?.kitComplete ?? true) ? 'complete' : 'incomplete'),
  },
  {
    id: 'story',
    title: 'What are they like?',
    subtitle: 'Personality & story',
    when: () => true,
    status: (c) => (storyTouched(c) ? 'complete' : 'optional'),
  },
  {
    id: 'alignment',
    title: 'Their moral compass',
    subtitle: 'Alignment',
    when: () => true,
    status: (c) => (c?.identity?.alignment ? 'complete' : 'optional'),
  },
  {
    id: 'identity',
    title: 'Who are they?',
    subtitle: 'Name & portrait',
    when: () => true,
    status: (c) => (nameSet(c) ? 'complete' : 'optional'),
  },
  {
    id: 'featuresIntro',
    title: 'Your character is ready',
    subtitle: 'A few class choices left',
    when: (c, d, ctx) => featuresStepShows(c, ctx) || hasCantrips(d) || hasClassPrepared(d),
    status: () => 'info',
  },
  {
    id: 'features',
    title: 'Their special abilities',
    subtitle: 'Class features',
    when: (c, d, ctx) => featuresStepShows(c, ctx),
    status: (c, d, ctx) => (ctx?.featuresComplete ? 'complete' : 'incomplete'),
  },
  {
    id: 'cantrips',
    title: 'Their cantrips',
    subtitle: 'Cantrips',
    when: (c, d) => hasCantrips(d),
    status: (c, d) => (cantripsFull(d) ? 'complete' : 'incomplete'),
  },
  {
    id: 'spells',
    title: 'Their spells',
    subtitle: 'Level 1 spells',
    when: (c, d) => hasClassPrepared(d),
    status: (c, d) => (preparedFull(d) ? 'complete' : 'incomplete'),
  },
];

/** O passo de features aparece (há classe e escolhas de feature)? */
const featuresStepShows = (c, ctx) => hasClass(c) && !!ctx?.hasFeatureChoices;

/**
 * Os passos de criação relevantes para o personagem, na ordem.
 * @param {object} character
 * @param {object} derived
 * @param {{ hasFeatureChoices?: boolean }} [ctx]
 * @returns {Array<{id,title,subtitle,status:Function}>}
 */
export function buildCreateSteps(character, derived, ctx = {}) {
  return CREATE_CATALOG.filter((s) => s.when(character, derived, ctx)).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    status: (c, d) => s.status(c, d, ctx),
  }));
}
