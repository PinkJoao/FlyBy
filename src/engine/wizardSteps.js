// =============================================================================
// wizardSteps - o motor de passos do Character Guidance (Fase D, DDL-0013)
// =============================================================================
// PURO: sem rede/DOM. Não decide COMO uma tela é desenhada (isso é do
// `components/wizard`); decide QUAIS passos existem para um personagem e QUAL o
// estado de cada um. As telas próprias (decisão do usuário) apenas consomem esta
// lista e escrevem no MESMO `character`, derivando pelo mesmo engine - o wizard
// nunca é uma segunda fonte de verdade da mecânica (o guard-rail da DDL-0013).
//
// Modelo de passo:
//   { id, title, subtitle,
//     status(character, derived) -> 'complete' | 'incomplete' | 'optional' }
// (o texto instrutivo vive na PRÓPRIA tela, num card de guia - não mais um `help`
// abaixo do título.)
// `status` alimenta os selos e a tela de Revisão; NUNCA trava o Avançar
// (validação não-bloqueante, decisão do usuário).
//
// Dois fluxos, a partir do ESTADO (não de um roteiro fixo):
//   buildCreateSteps(character, derived)  → o conjunto completo (filtrado por
//     relevância: magias só p/ conjurador, etc.).
//   buildLevelUpSteps(character, derived, {classUid, toLevel}) → só o DIFF que o
//     novo nível abriu. Vazio ⇒ nada a decidir ⇒ o `+` aplica direto, sem wizard.
//
// D1 entrega o MOTOR + o shell com placeholders; as telas de cada passo são D2/D3.
// A ordem e o texto abaixo são um RASCUNHO - serão muito ajustados com o usuário.
// -----------------------------------------------------------------------------

const hasClass = (c) => (c?.classes ?? []).some((x) => x.classId);
const nameSet = (c) => !!c?.meta?.name && c.meta.name !== 'New Character';

// Origens de MAGIA que são de CLASSE (não racial/talento). Magias concedidas por
// espécie/talento (ex: Aasimar Barbarian com o cantrip Light) NÃO abrem passo:
// não há nada a ESCOLHER. Por isso tudo aqui olha só as origens de classe.
const classSpellOrigins = (d) => (d?.spellcasting?.origins ?? []).filter((o) => o.kind === 'class');
// Tem cantrips a escolher? (Ranger/Paladin não têm - passo some.)
const hasCantrips = (d) => classSpellOrigins(d).some((o) => o.cantripLimit > 0);
// Tem magias de círculo a preparar?
const hasClassPrepared = (d) => classSpellOrigins(d).some((o) => o.prepareLimit > 0);
// Cantrips/preparadas todas escolhidas? (para marcar o passo como completo.)
const cantripsFull = (d) =>
  classSpellOrigins(d).filter((o) => o.cantripLimit > 0).every((o) => (o.cantrips?.length ?? 0) >= o.cantripLimit);
const preparedFull = (d) =>
  classSpellOrigins(d).filter((o) => o.prepareLimit > 0).every((o) => (o.prepared?.length ?? 0) >= o.prepareLimit);

const DEFAULT_SCORE = 10;
/** O jogador mexeu nos scores base? (método != manual, ou algum score != 10).
 *  Exportado: também alimenta a checagem de pendências do botão ✦
 *  (guidancePendencies) - atributos são um passo obrigatório. */
export const scoresTouched = (c) => {
  const m = c?.scoreMethod?.type;
  if (m && m !== 'manual') return true;
  return Object.values(c?.scores ?? {}).some((v) => v !== DEFAULT_SCORE);
};
/** Todos os boosts do background têm uma habilidade escolhida? Exportado pelo
 *  mesmo motivo que `scoresTouched` (pendência obrigatória do botão ✦). */
export const boostsComplete = (c) => {
  const b = c?.origin?.abilityBoosts ?? [];
  return b.length > 0 && b.every((x) => x.ability);
};
/** O jogador escreveu algo de personalidade/história? */
const STORY_FIELDS = ['personality', 'ideals', 'bonds', 'flaws', 'backstory'];
const storyTouched = (c) => STORY_FIELDS.some((k) => (c?.identity?.[k] ?? '').trim());

/** Nível em que a classe ganha subclasse (2024: 3 p/ todas; configurável). */
const subclassLevelOf = (c) => c?.rulesConfig?.subclassLevel ?? 3;
/** Uma classe que já alcançou o nível de subclasse e ainda NÃO escolheu uma
 * (a pendência de subclasse). Null se não houver. */
export const pendingSubclassClass = (c) =>
  (c?.classes ?? []).find((x) => x.classId && x.level >= subclassLevelOf(c) && !x.subclassId) ?? null;

// ---------------------------------------------------------------------------
// Catálogo de CRIAÇÃO
// ---------------------------------------------------------------------------
// Cada passo: id/title/subtitle, `when(character, derived)` (relevância) e
// `status(character, derived)`. A tela de Revisão NÃO é um passo - o shell a
// acrescenta sempre no fim.

// Ordem de CRIAÇÃO do NÍVEL 1 (DDL-0013, atualização 2026-07-11). Cada tela
// própria (D2) escreve no MESMO `character` e reusa os componentes atômicos.
// As telas dos passos 4 (proficiências) e 8 (features) FATIAM o choice-bag da
// classe por `kind` - perícia/ferramenta/idioma vs. feature/invocação/mastery.
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
    // Espécie escolhida E completa (DDL-0018): linhagem quando a raça tem, e
    // TODAS as sub-escolhas preenchidas - tamanho, perícia/idioma racial,
    // sub-bags de feat. A flag profunda vem do ctx (precisa do db); sem ctx
    // (testes/uso puro) cai no check raso de antes.
    status: (c, d, ctx) => (c?.species && (ctx?.speciesComplete ?? true) ? 'complete' : 'incomplete'),
  },
  {
    // Só p/ personagens que JÁ passaram do nível de subclasse (reabrindo o guia
    // com pendência) - na criação de nível 1 nunca aparece.
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
    // Feat escolhido E com as sub-escolhas dele preenchidas (DDL-0018) - flag
    // profunda do ctx; sem ctx, o check raso de antes.
    status: (c, d, ctx) =>
      (c?.origin?.originFeat && (ctx?.originFeatComplete ?? true) ? 'complete' : 'incomplete'),
  },
  {
    id: 'proficiencies',
    title: 'What are they good at?',
    subtitle: 'Skills, tools & languages',
    when: () => true,
    // Completo quando todas as escolhas de proficiência (classe + background)
    // estão preenchidas - flag do ctx (precisa do db).
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
    // Kit escolhido E com os chooses dele preenchidos (Bard XPHB: o instrumento
    // do kit A - TC-0024). A flag profunda vem do ctx (precisa do db); sem ctx,
    // o check raso de antes.
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
    // Só quando HÁ o que escolher a seguir: features com escolhas OU magias de
    // CLASSE (cantrips/preparadas). Magia só racial/talento não conta.
    when: (c, d, ctx) => featuresStepShows(c, ctx) || hasCantrips(d) || hasClassPrepared(d),
    status: () => 'info',
  },
  {
    id: 'features',
    title: 'Their special abilities',
    subtitle: 'Class features',
    // Só aparece se a classe tem ALGUMA escolha de feature no nível (ctx do
    // WizardPage, que tem o db); sem escolhas, o passo é pulado (ex: Artificer 1).
    when: (c, d, ctx) => featuresStepShows(c, ctx),
    status: (c, d, ctx) => (ctx?.featuresComplete ? 'complete' : 'incomplete'),
  },
  {
    id: 'cantrips',
    title: 'Their cantrips',
    subtitle: 'Cantrips',
    // Só quando há cantrips a escolher (Ranger/Paladin não têm - passo some).
    when: (c, d) => hasCantrips(d),
    status: (c, d) => (cantripsFull(d) ? 'complete' : 'incomplete'),
  },
  {
    id: 'spells',
    title: 'Their spells',
    subtitle: 'Level 1 spells',
    // Só quando há magias de CLASSE a preparar (não abre p/ magia só racial -
    // ex: Aasimar Barbarian com o cantrip Light não tem nada a escolher aqui).
    when: (c, d) => hasClassPrepared(d),
    status: (c, d) => (preparedFull(d) ? 'complete' : 'incomplete'),
  },
];

/** O passo de features aparece? (tem classe E há escolhas de feature). O flag
 * `hasFeatureChoices` vem do ctx - computado onde há `db` (WizardPage). */
const featuresStepShows = (c, ctx) => hasClass(c) && !!ctx?.hasFeatureChoices;

/**
 * Os passos de CRIAÇÃO relevantes p/ este personagem, na ordem do catálogo.
 * @param {object} character
 * @param {object} derived  saída de deriveFromDb (p/ saber se é conjurador etc.)
 * @param {{ hasFeatureChoices?: boolean }} [ctx]  contexto que precisa do `db`
 *   (o WizardPage o calcula), ex: se a classe tem escolhas de feature no nível.
 * @returns {Array<{id,title,subtitle,status:Function}>}
 */
export function buildCreateSteps(character, derived, ctx = {}) {
  // Assa o `ctx` (flags que precisam do db: proficiências/features completas) na
  // closure do status - buildCreateSteps roda a cada render com ctx fresco, então
  // o status continua ao vivo quando o shell o chama com (character, derived).
  return CREATE_CATALOG.filter((s) => s.when(character, derived, ctx)).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    status: (c, d) => s.status(c, d, ctx),
  }));
}

// O guia LEVE de fixup/level-up (subclasse/features/magias por preencher) NÃO
// vive aqui: precisa do `db` (buildClassChoices) e mora em
// `components/wizard/fixupSteps.js`. Este módulo só cuida do catálogo de CRIAÇÃO.
