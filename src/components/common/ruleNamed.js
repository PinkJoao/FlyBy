// =============================================================================
// ruleNamed: a regra do glossário por nome, para quem não tem uma tag do texto
// =============================================================================
// O QUE FAZ
//   Acha uma regra (ou outra entrada do glossário) pelo nome e abre a prévia dela: o
//   card do histórico do jogo e as janelas de explicação da ficha (Saving Throw,
//   Attunement, Carrying Capacity).
//
// FUNÇÕES
//   ruleNamed(db, ...names): a primeira entrada com um dos nomes, a do XPHB antes.
//   ruleOpener(db, ...names): a função que abre a prévia, ou null sem entrada.
//
// DECISÕES E ARMADILHAS
//   - Os nomes vêm em ordem de preferência: o conteúdo embutido (SRD) tem menos regras que
//     o 5e.tools inteiro, e quem chama deixa uma segunda opção.
// -----------------------------------------------------------------------------

import { glossaryIndexFor } from './glossaryIndex';
import { showRulePopup } from './RulePopup';
import { showDetailPopup } from './detailPopup';

/** A primeira entrada do glossário com um dos nomes. */
export function ruleNamed(db, ...names) {
  const entries = glossaryIndexFor(db).entries;
  for (const name of names) {
    const hits = entries.filter((e) => e.name.toLowerCase() === String(name).toLowerCase());
    const hit = hits.find((e) => e.source === 'XPHB') ?? hits[0];
    if (hit) return hit;
  }
  return null;
}

/** A função que abre a prévia de uma regra por nome, ou null. */
export function ruleOpener(db, ...names) {
  const rule = ruleNamed(db, ...names);
  if (rule?.kind === 'rule' && rule.ruleEntry) return () => showRulePopup(rule.ruleEntry);
  if (rule?.entity && rule.raw) return () => showDetailPopup({ entity: rule.entity, raw: rule.raw, db });
  return null;
}
