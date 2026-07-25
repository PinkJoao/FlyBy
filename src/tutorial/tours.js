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

// --- Micro-tours por ABA (F3) ------------------------------------------------
// Disparados pelo Builder na 1a vez que cada aba e aberta (contextual, um por
// vez). Curtos: uma abertura + os elementos ESTAVEIS da aba (os que existem
// mesmo com a aba "vazia"); o que aparece dinamicamente e mencionado no texto.

const tabSpecies = {
  id: 'tab-species',
  steps: [
    {
      title: 'Species',
      body: 'Your species sets your size, speed and innate traits. Here is how this tab works.',
    },
    {
      anchor: TUT.TAB_SPECIES_PICKER,
      title: 'Choose a species',
      body: "Pick your species here. If it has lineages (like an Elf's Drow, High or Wood), a second picker appears - then any trait choices, and the full description below.",
      placement: 'bottom',
    },
  ],
};

const tabBackground = {
  id: 'tab-background',
  steps: [
    {
      title: 'Background',
      body: 'Your origin: where the character came from, and the mechanical benefits it grants.',
    },
    {
      anchor: TUT.TAB_BG_BOOSTS,
      title: 'Ability boosts',
      body: 'In the 2024 rules your ability increases come from your background: +2 and +1, or +1 to three. Choose the abilities here.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_BG_FEAT,
      title: 'Origin feat',
      body: 'Your starting feat goes here - and if it has its own choices (like Magic Initiate), they show up right below it.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_BG_PROFS,
      title: 'Proficiencies & language',
      body: 'Pick your background skills, a tool and a language here.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_BG_STORY,
      title: 'Story',
      body: 'Write where they came from. It also fills the background description when you export.',
      placement: 'top',
    },
  ],
};

const tabClass = {
  id: 'tab-class',
  steps: [
    {
      title: 'Class',
      body: 'Your class drives most of the sheet - hit points, proficiencies, features and spells.',
    },
    {
      anchor: TUT.TAB_CLASS_TABS,
      title: 'One tab per class',
      body: 'Each tab is a class. The first is your original class; use + to multiclass into another.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_CLASS_CARD,
      title: 'Configure the class',
      body: 'Choose the class here, then set its level, its subclass (from level 3), and any class choices. The full feature progression is listed underneath.',
      placement: 'auto',
    },
  ],
};

const tabInventory = {
  id: 'tab-inventory',
  steps: [
    {
      title: 'Inventory',
      body: 'Everything the character carries - gear, weapons, armor, coins.',
    },
    {
      anchor: TUT.TAB_INV_TOP,
      title: 'Coins & load',
      body: 'Your currency on the left; carried weight and attunement (max 3 items) on the right.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_INV_CONTROLS,
      title: 'Search & shop',
      body: 'Search what you carry, or open the Shop to buy gear - it stays open across purchases. Items then group into sub-tabs you can sort and filter.',
      placement: 'bottom',
    },
  ],
};

const tabSpellbook = {
  id: 'tab-spellbook',
  steps: [
    {
      title: 'Spellbook',
      body: 'Your spells, grouped by where they come from. Only shown for spellcasters.',
    },
    {
      anchor: TUT.TAB_SPELL_CARDS,
      title: 'Slots & numbers',
      body: 'Your spell slots (or pact slots), save DC and attack bonus, and how many cantrips and spells you can prepare.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_SPELL_ORIGINS,
      title: 'By source',
      body: 'One tab per source: each caster class, plus racial and feat spells.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_SPELL_CONTROLS,
      title: 'Prepare spells',
      body: 'Search your list, or use "Prepare spell" to add one. Spells granted for free show "Always Prepared" and do not count against your limit.',
      placement: 'bottom',
    },
  ],
};

const tabBiography = {
  id: 'tab-biography',
  steps: [
    {
      title: 'Biography',
      body: 'Who the character is, outside the rules - none of this affects your numbers.',
    },
    {
      anchor: TUT.TAB_BIO_TRAITS,
      title: 'Traits',
      body: 'Personality, ideals, bonds and flaws - free text, or roll 🎲 for a suggestion. Appearance goes here too.',
      placement: 'bottom',
    },
    {
      anchor: TUT.TAB_BIO_DETAILS,
      title: 'Details',
      body: 'Physical descriptors: age, height, eyes, faith and more.',
      placement: 'top',
    },
  ],
};

export const TOURS = {
  selector,
  sheet,
  'tab-species': tabSpecies,
  'tab-background': tabBackground,
  'tab-class': tabClass,
  'tab-inventory': tabInventory,
  'tab-spellbook': tabSpellbook,
  'tab-biography': tabBiography,
};

export const ALL_TOUR_IDS = Object.keys(TOURS);

export function getTour(id) {
  return TOURS[id] ?? null;
}
