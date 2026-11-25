// =============================================================================
// cardShape: a forma fixa dos cards de um seletor (DDL-0286)
// =============================================================================
// O QUE FAZ
//   Cada entity declara `cardShape`: quantas linhas o título reserva, se há a linha
//   da fonte (subtitle), quantas linhas a meta reserva, quantas fileiras de etiquetas
//   e se o card leva miniatura. O SelectorPanel reserva esse espaço em TODO card do
//   painel, cheio ou vazio, e corta o que passa: todos os cards de uma categoria têm
//   o mesmo tamanho e cada peça (o stepper da loja inclusive) fica no mesmo lugar.
//
// FUNÇÕES
//   cardShapeOf(entity): a forma da entity, com os padrões.
//   bodyHeight(shape): a altura do corpo do card em px, a soma das peças reservadas.
//   cardVars(shape): as variáveis CSS do card (--title-lines, --meta-lines, --tag-rows,
//     --body-h).
//   cardTags(card): as etiquetas do card numa lista só (raridade, pré-requisitos,
//     badges), com o tom de cada uma.
//   overflowSlots(card, shape): as peças que o card preenche e a forma não reserva.
//
// DECISÕES E ARMADILHAS
//   - Pedido do dono: gastar um pouco mais de espaço e manter tamanho e posição iguais
//     numa categoria, em vez de cada card encolher ao próprio conteúdo. O que não cabe
//     é cortado com reticências e fica inteiro no `title` e no preview.
//   - Uma fileira de etiquetas (`tags: 1`) não quebra: as etiquetas encolhem lado a
//     lado; com duas ou mais, quebram e o que passa da última fileira some.
//   - Desde o DDL-0288 a forma é um ORÇAMENTO de altura (bodyHeight), não uma vaga por
//     peça: o corpo do card tem sempre a mesma altura, o essencial entra primeiro (título,
//     fonte, meta, etiquetas, cada um no máximo de linhas da forma) e o que sobra recebe
//     as linhas extras da entity (`cardExtra`), só as que cabem inteiras. Assim o item
//     mundano sem etiqueta mostra o peso e as propriedades no lugar vazio, e o card não
//     cresce. As medidas (fonte x entrelinha) espelham o SelectorPanel.module.css.
//   - overflowSlots existe para o aviso em dev do SelectorPanel e para o teste: uma
//     entity que passa a preencher uma peça sem reservá-la quebraria o padrão calada.
// -----------------------------------------------------------------------------

export const DEFAULT_SHAPE = { title: 2, subtitle: false, meta: 0, tags: 0, thumb: false };

const PREREQ_TONE = { ok: 'success', bad: 'danger', unknown: 'warning' };
const BADGE_TONE = { blue: 'info', accent: 'accent', red: 'danger', neutral: 'neutral' };

/** A forma dos cards da entity, com os padrões. */
export function cardShapeOf(entity) {
  return { ...DEFAULT_SHAPE, ...(entity?.cardShape ?? {}) };
}

const TITLE_LINE = 15 * 1.3;
const SUB_LINE = 12 * 1.4;
const META_LINE = 11 * 1.35;
const TAG_ROW = 16;
const GAP = 3;

/** A altura do corpo do card: a soma das peças que a forma reserva, com os espaços entre elas. */
export function bodyHeight(shape) {
  const parts = [shape.title * TITLE_LINE];
  if (shape.subtitle) parts.push(SUB_LINE);
  if (shape.meta) parts.push(2 + shape.meta * META_LINE);
  if (shape.tags) parts.push(4 + shape.tags * TAG_ROW + (shape.tags - 1) * 4);
  return Math.ceil(parts.reduce((a, b) => a + b, 0) + GAP * (parts.length - 1));
}

/** As variáveis CSS do card: o máximo de linhas de cada peça e a altura do corpo. */
export function cardVars(shape) {
  return { '--title-lines': shape.title, '--meta-lines': shape.meta, '--tag-rows': shape.tags, '--body-h': `${bodyHeight(shape)}px` };
}

/** As etiquetas do card numa lista só: raridade, pré-requisitos, badges. */
export function cardTags(card) {
  const out = [];
  if (card?.rarity) out.push({ text: card.rarity.label, color: card.rarity.color ?? null, tone: 'neutral' });
  for (const p of card?.prereqs ?? []) out.push({ text: p.text, tone: PREREQ_TONE[p.status] ?? 'neutral' });
  for (const b of card?.badges ?? []) {
    if (!b) continue;
    if (typeof b === 'string') out.push({ text: b, tone: 'accent' });
    else out.push({ text: b.text, tone: BADGE_TONE[b.tone] ?? 'accent' });
  }
  return out;
}

/** As peças que o card preenche e a forma não reserva. */
export function overflowSlots(card, shape) {
  const out = [];
  if (card?.subtitle && !shape.subtitle) out.push('subtitle');
  if (card?.meta && !shape.meta) out.push('meta');
  if (cardTags(card).length && !shape.tags) out.push('tags');
  return out;
}
