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
//   trayShow(event): os dados da bandeja (D2), ou null.
//   shouldTray(show, { setting, reduced }): a bandeja roda (só com "all")?
//   TRAY_MAX: quantos dados cabem na bandeja; o resto vira "+N".
//
// DECISÕES E ARMADILHAS
//   - Com "All dice" (DDL-0153), o teste de d20 continua no d20 em destaque e a
//     bandeja fica com o que não tem d20 (dano, cura, dados de vida). Os dados extras
//     de um teste de d20 (o d4 do Bless) não entram em nenhum dos dois.
//   - O d100 é o par de d10 de dezenas (00 a 90) e unidades (0 a 9): 00 e 0 é 100.
//   - Dado sem sólido (d2, d3, d7) vira ficha redonda; mais de TRAY_MAX dados, só os
//     primeiros caem e o resto aparece como "+N".
//   - O número vem do evento, NUNCA da animação: o histórico, o desfazer e o refazer
//     continuam confiáveis (docs/PLAY-MODE-V2-PLAN.md §2).
//   - O dado da mesa (`rolls.physical`, digitado no diálogo) não anima: já rolou.
//   - O valor mostrado na face é o BRUTO do dado (`raw`): o piso do Reliable Talent
//     muda o resultado, não a face que caiu.
//   - O crítico segue o limiar do evento (`isCritical`: o 19 do Champion brilha).
// -----------------------------------------------------------------------------

import { DIE_SIDES } from './geometry';

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

/** A animação do d20 roda? Só com algo a encenar, a preferência ligada e sem pedido de menos movimento. */
export function shouldAnimate(show, { setting = 'd20', reduced = false } = {}) {
  return !!show && setting !== 'off' && !reduced;
}

export const TRAY_MAX = 24;

/**
 * Os dados da bandeja (fase D2): toda rolagem SEM d20 do app (dano, cura, dados de
 * vida), um dado por resultado; o d100 vira o par de d10 (dezenas e unidades).
 * @returns {{ dice: Array<{ sides: number, value: number, kept: boolean, mode?: string, token?: boolean }>, more: number, total: number, label: string, tag: string|null }|null}
 */
export function trayShow(event) {
  const r = event?.rolls;
  if (!r || r.physical || !Array.isArray(r.parts) || r.parts[0]?.label === 'd20') return null;
  const dice = [];
  for (const part of r.parts) for (const g of part.groups ?? []) for (const x of g.results ?? []) {
    const value = x.raw ?? x.value;
    const kept = x.kept !== false;
    if (g.faces === 100) {
      dice.push({ sides: 10, mode: 'tens', value: Math.floor((value % 100) / 10) + 1, kept }, { sides: 10, mode: 'ones', value: (value % 10) + 1, kept });
    } else if (DIE_SIDES.includes(g.faces)) dice.push({ sides: g.faces, value, kept });
    else dice.push({ sides: g.faces, value, kept, token: true });
  }
  if (!dice.length) return null;
  const critical = !!(event.payload?.critical || r.critical);
  return { dice: dice.slice(0, TRAY_MAX), more: Math.max(0, dice.length - TRAY_MAX), total: r.total, label: event.label ?? '', tag: critical ? 'Critical' : null };
}

/** A bandeja roda? Só com "All dice" ligado e sem pedido de menos movimento. */
export function shouldTray(show, { setting = 'd20', reduced = false } = {}) {
  return !!show && setting === 'all' && !reduced;
}
