// =============================================================================
// foundryCompat: o export escrito para o dnd5e ATUAL e os próximos
// =============================================================================
// O QUE FAZ
//   O dnd5e muda o lugar de alguns dados entre versões e mantém a chave velha por
//   um tempo, com aviso de deprecação. O FlyBy escreve sempre a chave NOVA (a
//   decisão do dono, DDL-0167: o export é future-proof; versão mais velha que a
//   5.3 não é o alvo). Este módulo reescreve, num passo final do export, as
//   chaves de Active Effect que o sistema já moveu, venham elas do overlay, do
//   SRD ou do nosso registro.
//
// FUNÇÕES
//   modernKey(key): a chave atual de um change, ou a mesma.
//   modernizeEffects(effects): os effects com as chaves atuais (cópia só do que muda).
//   modernizeEffectKeys(items): o mesmo em todos os itens do ator.
//
// DECISÕES E ARMADILHAS
//   - MOVED_EFFECT_KEYS é a tabela `ActiveEffect5e.SHIM_FIELDS` do dnd5e 5.3.3
//     (`module/documents/active-effect.mjs`): a chave velha avisa desde a 5.3 e o
//     apoio sai na 6.1. Nova versão do sistema: conferir a tabela dela e somar.
//   - O próprio pack do SRD ainda usa a chave velha (o Belt of Dwarvenkind): por
//     isso o passo é no FIM, sobre tudo.
//   - Nunca muta o effect recebido: registros gerados são compartilhados (DDL-0166).
// -----------------------------------------------------------------------------

const MOVED_EFFECT_KEYS = {
  'system.attributes.movement.speed': 'system.attributes.movement.walk',
  'system.attributes.senses.darkvision': 'system.attributes.senses.ranges.darkvision',
  'system.attributes.senses.blindsight': 'system.attributes.senses.ranges.blindsight',
  'system.attributes.senses.tremorsense': 'system.attributes.senses.ranges.tremorsense',
  'system.attributes.senses.truesight': 'system.attributes.senses.ranges.truesight',
};

/** A chave atual de um change, ou a mesma. */
export function modernKey(key) {
  return MOVED_EFFECT_KEYS[key] ?? key;
}

/** Os effects com as chaves atuais; copia só o effect que muda. */
export function modernizeEffects(effects) {
  return (effects ?? []).map((e) => {
    if (!(e?.changes ?? []).some((c) => MOVED_EFFECT_KEYS[c?.key])) return e;
    return { ...e, changes: e.changes.map((c) => (MOVED_EFFECT_KEYS[c?.key] ? { ...c, key: modernKey(c.key) } : c)) };
  });
}

/** Reescreve as chaves movidas nos effects de todos os itens do ator. */
export function modernizeEffectKeys(items) {
  for (const item of items ?? []) {
    if (item?.effects?.length) item.effects = modernizeEffects(item.effects);
  }
}
