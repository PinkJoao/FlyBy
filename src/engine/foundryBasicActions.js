// =============================================================================
// foundryBasicActions - as ações que QUALQUER personagem pode tomar
// =============================================================================
// Dash, Hide, Help, Study, Influence, Utilize… O jogador novo não sabe que elas
// existem, e no Foundry elas não aparecem em lugar nenhum da ficha: o dnd5e
// publica as ações básicas como JOURNAL (`packs/_source/rules/`), não como
// documento de item, então nenhum ator - nem os 48 premades oficiais - traz um
// item "Dash". Quem já conhece a regra procura no livro; quem não conhece nunca
// descobre que tinha a opção.
//
// **Divergência DELIBERADA do SRD**, sob o princípio do DDL-0080 §1.2: onde
// seguir o SRD penaliza o jogador, divergimos. É a segunda (a primeira foi o
// Unarmed Strike universal), e por isso segue o COROLÁRIO à risca:
//
//  - **FORMA própria**, que não se passa pela do SRD: todo item carrega
//    `flags.builder5e.basicAction`, e NENHUM leva `_stats.compendiumSource` -
//    não existe documento publicado para apontar, e apontar para um near-match
//    faria o Foundry oferecer "atualizar do compêndio" (DDL-0056).
//  - **Entrada `EXPECTED` nomeada** no comparador da T2 (`basic-actions`), senão
//    o placar sobe em 18 achados por ficha e esconde lacuna de verdade.
//
// TUDO DERIVADO, zero curadoria: a lista é `actions.json` filtrado por
// `source === 'XPHB'` (as 18 ações do livro 2024), que o app já baixa desde o
// glossário. Uma ação nova numa errata entra sozinha.
//
// Fora de escopo, e é decisão: as ações de outras fontes (PHB 2014, DMG, XGE)
// NÃO saem - o app é um builder de regras 2024, e emitir as duas edições daria
// "Dash" em dobro na ficha.
// -----------------------------------------------------------------------------

import { entriesToHtml, randomFoundryId, slugify, itemStats, sourceBlock } from './foundryItems';

/** Só as ações do livro 2024. */
const ACTION_SOURCE = 'XPHB';

/**
 * Tipo de ativação do dnd5e a partir do campo `time` do 5etools.
 * As três formas do dado: `{number, unit}` (action/bonus/reaction), a string
 * "Free" (End Concentration) e "Varies" (Improvising an Action). As duas
 * strings viram `special`, que é o que o dnd5e usa para "não é um dos slots
 * padrão" - inventar um tipo faria o item sumir da aba de ações.
 */
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

/**
 * Activity utilitária da ação: é ela que põe o botão na aba de ações do Foundry
 * (um item sem activity é só texto). Não consome nada - uma ação básica não tem
 * recurso -, por isso `consumption.targets` fica VAZIO: o padrão do
 * `baseActivity` consome 1 uso do item, e com `uses.max` vazio isso deixaria o
 * botão travado.
 */
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
 * As ações básicas do XPHB, na ordem em que o dado as traz.
 * @param {object} db
 * @returns {object[]} entradas cruas do 5etools
 */
export function basicActionList(db) {
  return (db?.actions?.action ?? []).filter((a) => a?.source === ACTION_SOURCE);
}

/**
 * Itens Foundry das ações básicas - os mesmos para todo personagem (não dependem
 * de classe, nível ou escolha alguma).
 *
 * `system.type.value` fica VAZIO de propósito: o `featureTypes` do dnd5e não tem
 * categoria para "ação básica" (as que há são background/class/monster/race/
 * feat/enchantment), e encaixá-la numa delas mentiria sobre a procedência.
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildBasicActionItems(db) {
  return basicActionList(db).map((action) => {
    // A CHAVE do mapa de activities tem de ser o `_id` da própria activity - é
    // assim em todo item do dnd5e, e o Foundry usa a chave para resolvê-la.
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
      // A MARCA da divergência (DDL-0080 §1.2): é por ela que o import as
      // descarta em vez de tentar lê-las como decisão do jogador.
      flags: { builder5e: { basicAction: true } },
      // Sem `compendiumSource`: o dnd5e não publica documento para estas.
      _stats: itemStats(null),
    };
  });
}

/** Um item é uma ação básica NOSSA? (a marca, não o nome - ver o import.) */
export function isBasicActionItem(item) {
  return item?.type === 'feat' && item?.flags?.builder5e?.basicAction === true;
}
