// =============================================================================
// gen-icons: gera src/components/common/iconsData.js (npm run gen:icons)
// =============================================================================
// O QUE FAZ
//   Extrai só os ícones que o app usa (o registro ICONS abaixo) dos conjuntos
//   Iconify instalados como devDependency: game-icons.net (CC BY 3.0) para os
//   temáticos e Lucide (ISC) para os de interface. Grava o SVG de cada um e,
//   para os do game-icons, o AUTOR, que o crédito pede ícone a ícone e que o
//   pacote Iconify não traz: ele vem da árvore do repositório oficial
//   (game-icons/icons), onde cada autor é uma pasta. A SAÍDA é commitada.
//
// FUNÇÕES
//   authorsOf(): nome do ícone -> pasta do autor, pela API do GitHub (uma
//     chamada).
//   authorName(folder): o nome de exibição de um autor.
//   main(): lê, monta e grava.
//
// DECISÕES E ARMADILHAS
//   - Ícone novo: uma linha em ICONS (`nome: 'game:<ícone>'` ou
//     `'lucide:<ícone>'`) e rodar o gerador; o nome à esquerda é o que o app usa
//     (`<Icon name="..." />`), então trocar o desenho não muda nenhum componente.
//   - A API do GitHub só é chamada aqui, no desenvolvimento: o app não busca nada.
//   - 63 nomes se repetem entre pastas do repositório; a pasta `badges` não é um
//     autor e perde para a outra. Ícone sem autor encontrado FALHA o gerador, para
//     nunca publicar um crédito incompleto.
//   - O cabeçalho do arquivo gerado já segue o modelo de comentários (DDL-0090).
// -----------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'src', 'components', 'common', 'iconsData.js');
const TREE = 'https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1';

const ICONS = {
  close: 'lucide:x',
  chevron: 'lucide:chevron-down',
  chevronUp: 'lucide:chevron-up',
  chevronLeft: 'lucide:chevron-left',
  chevronRight: 'lucide:chevron-right',
  plus: 'lucide:plus',
  sort: 'lucide:arrow-up-down',
  menu: 'lucide:menu',
  more: 'lucide:ellipsis-vertical',
  check: 'lucide:check',
  swap: 'lucide:arrow-left-right',
  down: 'lucide:arrow-down',
  up: 'lucide:arrow-up',
  fullscreen: 'lucide:maximize-2',
  search: 'lucide:search',
  cart: 'lucide:shopping-cart',
  addImage: 'lucide:image-plus',
  idea: 'lucide:lightbulb',
  undo: 'lucide:undo-2',
  redo: 'lucide:redo-2',
  history: 'lucide:scroll-text',
  edit: 'lucide:pencil',

  dice: 'game:dice-twenty-faces-twenty',
  guide: 'game:compass',
  proficiency: 'game:skills',
  portrait: 'game:cowled',
  sparkles: 'game:sparkles',

  itemAll: 'game:chest',
  itemWeapon: 'game:crossed-swords',
  itemArmor: 'game:breastplate',
  itemFocus: 'game:crystal-ball',
  itemAmmo: 'game:quiver',
  itemTool: 'game:toolbox',
  itemInstrument: 'game:lyre',
  itemGear: 'game:knapsack',
  itemFood: 'game:meat',
  itemWondrous: 'game:magic-swirl',
  itemRing: 'game:diamond-ring',
  itemWand: 'game:fairy-wand',
  itemRod: 'game:wizard-staff',
  itemPotion: 'game:round-potion',
  itemScroll: 'game:scroll-unfurled',
  itemTreasure: 'game:cut-diamond',
  itemOther: 'game:uncertainty',

  originClass: 'game:spell-book',
  originSpecies: 'game:dna2',
  originFeat: 'game:laurel-crown',

  schoolAbjuration: 'game:magic-shield',
  schoolConjuration: 'game:magic-portal',
  schoolDivination: 'game:third-eye',
  schoolEnchantment: 'game:charm',
  schoolEvocation: 'game:fireball',
  schoolIllusion: 'game:drama-masks',
  schoolNecromancy: 'game:death-skull',
  schoolTransmutation: 'game:cycle',
  schoolPsionic: 'game:brain',
};

const AUTHOR_NAMES = { 'caro-asercion': 'Caro Asercion', darkzaitzev: 'DarkZaitzev', sbed: 'Sbed' };

/** Nome do ícone -> pasta do autor, pela árvore do repositório do game-icons. */
async function authorsOf() {
  const res = await fetch(TREE, { headers: { 'User-Agent': 'flyby-gen-icons' } });
  if (!res.ok) throw new Error(`API do GitHub respondeu ${res.status}`);
  const { tree } = await res.json();
  const by = {};
  for (const { path } of tree) {
    if (!path.endsWith('.svg')) continue;
    const parts = path.split('/');
    const name = parts[parts.length - 1].slice(0, -4);
    if (by[name] && parts[0] === 'badges') continue;
    by[name] = parts[0];
  }
  return by;
}

/** O nome de exibição de um autor (a pasta, capitalizada). */
function authorName(folder) {
  return AUTHOR_NAMES[folder] ?? folder.charAt(0).toUpperCase() + folder.slice(1);
}

async function main() {
  const sets = {
    game: JSON.parse(readFileSync(join(ROOT, 'node_modules/@iconify-json/game-icons/icons.json'), 'utf8')),
    lucide: JSON.parse(readFileSync(join(ROOT, 'node_modules/@iconify-json/lucide/icons.json'), 'utf8')),
  };
  const authors = await authorsOf();
  const icons = {};
  const credits = {};
  for (const [name, ref] of Object.entries(ICONS)) {
    const [setKey, iconName] = ref.split(':');
    const set = sets[setKey];
    const icon = set.icons[iconName];
    if (!icon) throw new Error(`Ícone inexistente: ${ref}`);
    const w = icon.width ?? set.width;
    const h = icon.height ?? set.height;
    icons[name] = { viewBox: `0 0 ${w} ${h}`, body: icon.body };
    if (setKey === 'game') {
      const folder = authors[iconName];
      if (!folder) throw new Error(`Sem autor no repositório do game-icons: ${iconName}`);
      (credits[authorName(folder)] ??= []).push(iconName);
    }
  }
  const header = `// =============================================================================
// iconsData: os ícones do app, GERADO por scripts/gen-icons.js (npm run gen:icons)
// =============================================================================
// O QUE FAZ
//   ICONS: nome usado no app -> { viewBox, body } (o SVG interno, em currentColor).
//   ICON_CREDITS: os autores dos ícones do game-icons.net (CC BY 3.0) com os
//   ícones de cada um, para a página About. Os de interface são do Lucide (ISC).
//
// DECISÕES E ARMADILHAS
//   - Não editar à mão: mudar o registro no gerador e rodar de novo.
// -----------------------------------------------------------------------------
`;
  const sortedCredits = Object.keys(credits)
    .sort()
    .map((author) => ({ author, icons: credits[author].sort() }));
  const out = `${header}
export const ICONS = ${JSON.stringify(icons, null, 2)};

export const ICON_CREDITS = ${JSON.stringify(sortedCredits, null, 2)};
`;
  writeFileSync(OUT, out);
  console.log(`${Object.keys(icons).length} ícones; ${sortedCredits.length} autores do game-icons.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
