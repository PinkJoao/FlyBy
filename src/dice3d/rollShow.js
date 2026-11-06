// =============================================================================
// rollShow: o que a animação do d20 encena a partir de um evento do play mode
// =============================================================================
// O QUE FAZ
//   Lê o evento já gravado (o engine rolou primeiro) e diz o que a animação mostra:
//   os d20 (um, ou dois com vantagem e desvantagem, com o descartado marcado), o
//   natural, crítico e falha crítica, o total e o rótulo. Também decide se a
//   animação roda (preferência, movimento reduzido, dado de mesa). Puro.
//
// FUNÇÕES
//   d20Show(event): o que encenar, ou null quando o evento não tem d20 do app.
//   shouldAnimate(show, { setting, reduced }): a animação roda?
//   critLabel(event): o selo do 20 natural ("Critical hit" no ataque).
//
// DECISÕES E ARMADILHAS
//   - O número vem do evento, NUNCA da animação: o histórico, o desfazer e o refazer
//     continuam confiáveis (docs/PLAY-MODE-V2-PLAN.md §2).
//   - O dado da mesa (`rolls.physical`, digitado no diálogo) não anima: já rolou.
//   - O valor mostrado na face é o BRUTO do dado (`raw`): o piso do Reliable Talent
//     muda o resultado, não a face que caiu.
//   - O crítico segue o limiar do evento (`isCritical`: o 19 do Champion brilha).
// -----------------------------------------------------------------------------

/**
 * O que a animação encena, ou null (sem d20 do app no evento).
 * @returns {{ dice: Array<{ value: number, kept: boolean }>, natural: number, crit: boolean, fumble: boolean, total: number, label: string, tag: string|null }|null}
 */
export function d20Show(event) {
  const r = event?.rolls;
  const part = r?.parts?.[0];
  if (!r || r.physical || part?.label !== 'd20') return null;
  const results = part.groups?.[0]?.results ?? [];
  if (!results.length) return null;
  const single = results.length === 1;
  const dice = results.map((x) => ({ value: x.raw ?? x.value, kept: single || !!x.kept }));
  const crit = !!r.isCritical;
  const fumble = !!r.isFumble;
  return { dice, natural: r.natural, crit, fumble, total: r.total, label: event.label ?? '', tag: crit ? critLabel(event) : fumble ? 'Natural 1' : null };
}

/** O selo do 20 natural: "Critical hit" num ataque, "Natural 20" no resto. */
export function critLabel(event) {
  if (event?.kind === 'attack' || event?.kind === 'use') return 'Critical hit';
  return event?.rolls?.natural === 20 ? 'Natural 20' : 'Critical';
}

/** A animação roda? Só com algo a encenar, a preferência ligada e sem pedido de menos movimento. */
export function shouldAnimate(show, { setting = 'd20', reduced = false } = {}) {
  return !!show && setting !== 'off' && !reduced;
}
