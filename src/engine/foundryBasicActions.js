// =============================================================================
// foundryBasicActions: as ações que qualquer personagem pode tomar
// =============================================================================
// O QUE FAZ
//   Dash, Hide, Help, Study, Influence, Utilize. O dnd5e as publica como JOURNAL,
//   não como item, então nenhum ator (nem os 48 premades) traz um item "Dash", e o
//   jogador novo nunca descobre que tinha a opção. Aqui elas viram itens com o
//   botão na aba de ações.
//
// FUNÇÕES
//   activationFor(time): o tipo de ativação a partir do `time` do 5etools.
//   actionActivity(activation): a activity utilitária, sem consumo.
//   basicActionList(db): as ações do XPHB, na ordem do dado.
//   buildBasicActionItems(db): os itens (os mesmos para todo personagem).
//   isBasicActionItem(item): é uma ação básica NOSSA? (pela marca, não pelo nome)
//
// DECISÕES E ARMADILHAS
//   - Divergência DELIBERADA do SRD (DDL-0080 §1.2), a segunda depois do Unarmed
//     Strike, com o corolário à risca: FORMA própria (`flags.builder5e.basicAction`
//     e NENHUM `compendiumSource`, porque apontar para um near-match faria o
//     Foundry oferecer "atualizar do compêndio", DDL-0056) e uma entrada EXPECTED
//     nomeada no comparador (`basic-actions`), senão o placar sobe 18 por ficha. O
//     import descarta os itens pela marca.
//   - TUDO derivado: `actions.json` filtrado por XPHB (as 18 do livro 2024). As
//     de outras fontes NÃO saem (daria "Dash" em dobro).
//   - "Free" e "Varies" viram `special`: inventar um tipo faria o item sumir da aba.
//   - `consumption.targets` vazio: o padrão consome 1 uso, e com `uses.max` vazio
//     o botão ficaria travado.
//   - `system.type.value` vazio: nenhum featureType do dnd5e é "ação básica", e
//     encaixar numa categoria mentiria sobre a procedência.
// -----------------------------------------------------------------------------

import { entriesToHtml, randomFoundryId, slugify, itemStats, sourceBlock } from './foundryItems';

const ACTION_SOURCE = 'XPHB';

/** O tipo de ativação do dnd5e a partir do `time` do 5etools. */
function activationFor(time) {
  const first = Array.isArray(time) ? time[0] : time;
  if (first && typeof first === 'object') {
    const unit = String(first.unit ?? '').toLowerCase();
    if (['action', 'bonus', 'reaction'].includes(unit)) {
      return { type: unit, value: first.number ?? 1 };
    }
  }
  return { type: 'special', value: null };
}

/** A activity utilitária da ação, sem consumo. */
function actionActivity(activation) {
  return {
    _id: randomFoundryId(),
    type: 'utility',
    name: '',
    activation: { type: activation.type, value: activation.value, condition: '', override: false },
    consumption: { targets: [], scaling: { allowed: false }, spellSlot: false },
    description: { chatFlavor: '' },
    duration: { units: 'inst', concentration: false, override: false },
    effects: [],
    range: { units: 'self', special: '', override: false },
    target: {
      affects: { count: '', type: 'self', choice: false, special: '' },
      template: { contiguous: false, units: 'ft', type: '', stationary: false },
      override: false,
      prompt: false,
    },
    uses: { spent: 0, recovery: [], max: '' },
    sort: 0,
    flags: {},
    visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
    img: null,
    roll: { formula: '', name: '', prompt: false, visible: false },
  };
}

/**
 * As ações básicas do XPHB, na ordem do dado.
 * @param {object} db
 * @returns {object[]}
 */
export function basicActionList(db) {
  return (db?.actions?.action ?? []).filter((a) => a?.source === ACTION_SOURCE);
}

/**
 * Os itens Foundry das ações básicas.
 * @param {object} db
 * @returns {object[]}
 */
export function buildBasicActionItems(db) {
  return basicActionList(db).map((action) => {
    // ATENÇÃO: a chave do mapa de activities é o _id da própria activity; o Foundry resolve por ela.
    const activity = actionActivity(activationFor(action.time));
    return {
      _id: randomFoundryId(),
      name: action.name,
      type: 'feat',
      img: 'icons/svg/upgrade.svg',
      system: {
        type: { value: '', subtype: '' },
        identifier: slugify(action.name),
        description: { value: entriesToHtml(action.entries), chat: '' },
        source: sourceBlock(action.source),
        requirements: '',
        properties: [],
        uses: { max: '', spent: 0, recovery: [] },
        prerequisites: { level: null, repeatable: false, items: [] },
        activities: { [activity._id]: activity },
        advancement: {},
        enchant: {},
        crewed: false,
      },
      effects: [],
      flags: { builder5e: { basicAction: true } },
      _stats: itemStats(null),
    };
  });
}

/** O item é uma ação básica nossa (pela marca)? */
export function isBasicActionItem(item) {
  return item?.type === 'feat' && item?.flags?.builder5e?.basicAction === true;
}
