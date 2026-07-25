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
      // Mobile: o tour ABRE a gaveta de filtros (mobileAction) e destaca-a; ao
      // avancar, o SelectorPanel a fecha. Por isso a ancora e o painel, nao o
      // botao "Filters" (que some quando a gaveta esta aberta).
      only: 'mobile',
      anchor: TUT.SELECTOR_FILTERS,
      mobileAction: 'filters',
      title: 'Filters',
      body: 'The "Filters" button opens this drawer. Tap a chip once to include it (purple), twice to exclude it (red).',
      placement: 'top',
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
      // Mobile: nao ha coluna de preview; o tour ABRE a tela de detalhe (do 1o
      // resultado) para demonstra-la, e a fecha ao terminar - deixando o usuario
      // livre para tocar num card e selecionar o que quiser.
      only: 'mobile',
      anchor: TUT.SELECTOR_DETAIL,
      mobileAction: 'detail',
      title: 'Details',
      body: 'Tapping a card opens its full details, art and lore. Select adds it - or go back to pick another.',
      placement: 'top',
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

/**
 * Tour da FICHA (F2), disparado na 1a vez que o Builder monta uma ficha "cheia":
 * apresenta o retrato/nome, o nivel, os tiles derivados, os mini cards de
 * atributo, o card de proficiencias, as abas e os botoes do topo (guia + menu).
 * Os micro-tours POR ABA sao a F3 - aqui as abas sao so apresentadas.
 */
const sheet = {
  id: 'sheet',
  steps: [
    {
      // Abertura: balao central apresentando a ficha.
      title: 'Your character sheet',
      body: 'Everything about your character lives here. Let us walk through it - the numbers up top update on their own as you make choices below.',
    },
    {
      anchor: TUT.SHEET_IDENTITY,
      title: 'Portrait & name',
      body: {
        desktop: 'Set the name here, and click the portrait to add art (upload a file or paste an image URL).',
        mobile: 'Tap the name to edit it, and tap the portrait to add art (upload a file or paste an image URL).',
      },
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_LEVEL,
      title: 'Level',
      body: 'Raise or lower your level here. When a new level unlocks a decision, the guide opens to help.',
      placement: 'auto',
    },
    {
      anchor: TUT.SHEET_TILES,
      title: 'Key numbers',
      body: 'Level, Hit Points, Armor Class and Alignment. Tap any tile to expand it - see the breakdown, roll HP, or set your alignment.',
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_ABILITIES,
      title: 'Ability scores',
      body: 'Your six abilities, each with its total and modifier. Tap a card to set the base score - bonuses from your species and background fold in automatically.',
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_PROFICIENCIES,
      title: 'Proficiencies',
      body: 'Your proficiency bonus, plus every save, skill, tool, language and more you are proficient in. Tap to expand the full list - it all comes from your choices.',
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_TABS,
      title: 'Building tabs',
      body: {
        desktop: 'Switch between Species, Background, Class, Inventory, Spellbook and Biography here. This is where you actually build the character.',
        mobile: 'Tap through Species, Background, Class, Inventory, Spellbook and Biography here. This is where you actually build the character.',
      },
      placement: 'bottom',
    },
    {
      // Botao do guia (⚛): so aparece enquanto ha pendencias. Se ausente, o passo
      // vira um balao central (o overlay degrada sozinho).
      anchor: TUT.SHEET_GUIDE,
      title: 'The guide',
      body: 'When required choices are still missing, this button appears with a count. Tap it to be walked through what is left.',
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_MENU,
      title: 'Menu',
      body: 'Export to Foundry VTT or PDF, open the rules glossary, import a character, or replay these tutorials.',
      placement: 'bottom',
    },
  ],
};

export const TOURS = {
  selector,
  sheet,
};

export const ALL_TOUR_IDS = Object.keys(TOURS);

export function getTour(id) {
  return TOURS[id] ?? null;
}
