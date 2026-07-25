// =============================================================================
// tours - definicao (dados puros) dos tutoriais de uso
// =============================================================================
// Cada tour e uma lista ordenada de passos. Um passo:
//
//   {
//     anchor?: chave do TUT (data-tour) a destacar; ausente/null => balao central
//     title?:  titulo curto
//     body:    texto; string OU { desktop, mobile } quando o texto muda de layout
//     placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' (dica; o overlay
//                 vira/ajusta sozinho pelas bordas)
//     only?:   'mobile' | 'desktop' - passo exclusivo de um dispositivo (usado
//              quando a ANCORA muda entre as duas interfaces; quando so o TEXTO
//              muda, prefira o `body` com { desktop, mobile })
//   }
//
// O tutorial e SEPARADO da Character Guidance (o wizard de criacao/level-up): a
// guidance ensina O QUE decidir; o tour ensina COMO usar o app / onde fica cada
// coisa. Ver DDL do tutorial.
// -----------------------------------------------------------------------------

import { TUT } from './anchors';

/** Tour do seletor generico (SelectorPanel), disparado na 1a vez que ele abre. */
const selector = {
  id: 'selector',
  steps: [
    {
      // Abertura: balao central apresentando o painel.
      title: 'Picking things',
      body: 'This panel is how you choose species, classes, spells, items and more. Here is a quick tour of it.',
    },
    {
      anchor: TUT.SELECTOR_SEARCH,
      title: 'Search',
      body: 'Type here to find something by name.',
      placement: 'bottom',
    },
    {
      // Desktop: o painel de filtros fica sempre visivel a esquerda.
      only: 'desktop',
      anchor: TUT.SELECTOR_FILTERS,
      title: 'Filters',
      body: 'Narrow the list with these filters. Tap a chip once to require it (purple), twice to exclude it (red).',
      placement: 'right',
    },
    {
      // Mobile: os filtros vivem numa gaveta atras deste botao.
      only: 'mobile',
      anchor: TUT.SELECTOR_FILTERS_TOGGLE,
      title: 'Filters',
      body: 'Tap to open the filters. Inside, tap a chip once to include it (purple), twice to exclude it (red).',
      placement: 'bottom',
    },
    {
      anchor: TUT.SELECTOR_RESULTS,
      title: 'Results',
      body: 'Matches show up here, with the count at the top.',
      placement: 'auto',
    },
    {
      // Desktop: preview sempre visivel na coluna da direita.
      only: 'desktop',
      anchor: TUT.SELECTOR_PREVIEW,
      title: 'Preview',
      body: 'Point at any result to see its art, lore and full details here.',
      placement: 'left',
    },
    {
      // Mobile: nao ha coluna de preview; o detalhe abre ao tocar num card.
      only: 'mobile',
      anchor: TUT.SELECTOR_RESULTS,
      title: 'Details',
      body: 'Tap any card to open its full details, art and lore, then confirm your choice.',
      placement: 'auto',
    },
    {
      // Desktop: botao Select no rodape do preview.
      only: 'desktop',
      anchor: TUT.SELECTOR_SELECT,
      title: 'Select',
      body: 'Happy with it? Press Select to add it to your character.',
      placement: 'top',
    },
  ],
};

export const TOURS = {
  selector,
};

export const ALL_TOUR_IDS = Object.keys(TOURS);

export function getTour(id) {
  return TOURS[id] ?? null;
}
