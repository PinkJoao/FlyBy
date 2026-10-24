// =============================================================================
// anchors: as chaves data-tour do tutorial
// =============================================================================
// O QUE FAZ
//   O TutorialOverlay acha o alvo de cada passo por `[data-tour="<chave>"]`. Estas
//   constantes são a FONTE ÚNICA das chaves, usadas pelos componentes (que marcam o
//   elemento) e pelos tours, para não haver string solta. Um elemento novo que
//   vire alvo declara a chave aqui e a põe no `data-tour`.
//
//   Grupos: o SelectorPanel (os filtros: o painel no desktop e o botão da gaveta
//   no mobile; o preview: a coluna no desktop e a tela de detalhe no mobile); a
//   ficha (retrato, nível, tiles, atributos, proficiências, abas, o botão do guia e
//   o menu); e as abas, com os elementos estáveis de cada uma (Class: sub-abas e o
//   card de classe; Inventory: moedas e carga, busca e loja; Spellbook: os cards,
//   as sub-abas de origem, busca e preparar); e o play mode (os números, a faixa
//   de estado, as abas, as rolagens, o histórico e a barra de combate).
//   O histórico tem a MESMA chave na coluna (desktop) e no botão da gaveta
//   (celular): o overlay acende o que está visível.
// -----------------------------------------------------------------------------

export const TUT = {
  SELECTOR_SEARCH: 'sel-search',
  SELECTOR_FILTERS: 'sel-filters',
  SELECTOR_FILTERS_TOGGLE: 'sel-filters-toggle',
  SELECTOR_RESULTS: 'sel-results',
  SELECTOR_PREVIEW: 'sel-preview',
  SELECTOR_DETAIL: 'sel-detail',
  SELECTOR_SELECT: 'sel-select',

  SHEET_IDENTITY: 'sheet-identity',
  SHEET_LEVEL: 'sheet-level',
  SHEET_TILES: 'sheet-tiles',
  SHEET_ABILITIES: 'sheet-abilities',
  SHEET_PROFICIENCIES: 'sheet-proficiencies',
  SHEET_TABS: 'sheet-tabs',
  SHEET_GUIDE: 'sheet-guide',
  SHEET_MENU: 'sheet-menu',

  TAB_SPECIES_PICKER: 'tab-species-picker',
  TAB_BG_BOOSTS: 'tab-bg-boosts',
  TAB_BG_FEAT: 'tab-bg-feat',
  TAB_BG_PROFS: 'tab-bg-profs',
  TAB_BG_STORY: 'tab-bg-story',
  TAB_CLASS_TABS: 'tab-class-tabs',
  TAB_CLASS_CARD: 'tab-class-card',
  TAB_INV_TOP: 'tab-inv-top',
  TAB_INV_CONTROLS: 'tab-inv-controls',
  TAB_SPELL_CARDS: 'tab-spell-cards',
  TAB_SPELL_ORIGINS: 'tab-spell-origins',
  TAB_SPELL_CONTROLS: 'tab-spell-controls',
  TAB_BIO_TRAITS: 'tab-bio-traits',
  TAB_BIO_DETAILS: 'tab-bio-details',

  PLAY_STATS: 'play-stats',
  PLAY_ABILITIES: 'play-abilities',
  PLAY_STATUS: 'play-status',
  PLAY_TABS: 'play-tabs',
  PLAY_ROLLS: 'play-rolls',
  PLAY_HISTORY: 'play-history',
  PLAY_COMBAT: 'play-combat',
};
