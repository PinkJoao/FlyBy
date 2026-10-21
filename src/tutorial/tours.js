// =============================================================================
// tours: a definição dos tutoriais de uso
// =============================================================================
// O QUE FAZ
//   Cada tour é uma lista de passos:
//     anchor: a chave do TUT a destacar (sem ela, balão central);
//     title, body: o texto (body pode ser { desktop, mobile });
//     placement: 'auto', 'top', 'bottom', 'left' ou 'right' (só uma dica);
//     only: 'mobile' ou 'desktop', quando a ÂNCORA muda entre as interfaces (se só o
//       texto muda, use o body com as duas versões).
//   O tutorial é SEPARADO da Character Guidance (DDL-0069): a guidance ensina O QUE
//   decidir; o tour ensina COMO usar o app.
//
// FUNÇÕES
//   getTour(id): o tour de um id.
//
// DECISÕES E ARMADILHAS
//   - Tours: `selector` (na 1a abertura do seletor), `sheet` (F2, na 1a ficha) e os
//     micro-tours por ABA (F3, na 1a abertura de cada uma; curtos, só os elementos
//     estáveis).
//   - No mobile o tour do seletor ABRE a gaveta e a tela de detalhe
//     (`mobileAction`) e as fecha ao avançar e terminar; por isso a âncora é o
//     painel, não o botão "Filters" (que some com a gaveta aberta).
//   - O passo do botão do guia degrada para balão central quando o botão não está
//     na tela.
// -----------------------------------------------------------------------------

import { TUT } from './anchors';

const selector = {
  id: 'selector',
  steps: [
    {
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
      only: 'desktop',
      anchor: TUT.SELECTOR_FILTERS,
      title: 'Filters',
      body: 'Narrow the list with these filters. Tap a chip once to require it (purple), twice to exclude it (red).',
      placement: 'right',
    },
    {
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
      only: 'desktop',
      anchor: TUT.SELECTOR_PREVIEW,
      title: 'Preview',
      body: 'Point at any result to see its art, lore and full details here.',
      placement: 'left',
    },
    {
      only: 'mobile',
      anchor: TUT.SELECTOR_DETAIL,
      mobileAction: 'detail',
      title: 'Details',
      body: 'Tapping a card opens its full details, art and lore. Select adds it - or go back to pick another.',
      placement: 'top',
    },
    {
      only: 'desktop',
      anchor: TUT.SELECTOR_SELECT,
      title: 'Select',
      body: 'Happy with it? Press Select to add it to your character.',
      placement: 'top',
    },
  ],
};

const sheet = {
  id: 'sheet',
  steps: [
    {
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
      anchor: TUT.SHEET_GUIDE,
      title: 'The guide',
      body: 'When required choices are still missing, this button appears with a count. Tap it to be walked through what is left.',
      placement: 'bottom',
    },
    {
      anchor: TUT.SHEET_MENU,
      title: 'Menu',
      body: "The rules glossary, export to Foundry VTT or PDF, this character's guide, and settings like the theme and these tutorials.",
      placement: 'bottom',
    },
  ],
};

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
