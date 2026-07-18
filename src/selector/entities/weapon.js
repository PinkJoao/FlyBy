// =============================================================================
// Entity config: Weapon (para o Weapon Mastery - Fase 6)
// =============================================================================
// Armas base (items-base.json) que TÊM propriedade de maestria (2024/XPHB).
// Filtros: categoria (Simple/Martial) e tipo (Melee/Ranged). O meta mostra
// dano e a mastery property - o jogador compara antes de escolher.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import itemEntity from './item';

const DMG_TYPE = { B: 'Bludgeoning', P: 'Piercing', S: 'Slashing' };

/** Nome legível das propriedades (mesmo mapa estático do item entity - o
 * precompute não recebe db). */
const PROPERTY_NAMES = {
  A: 'Ammunition', AF: 'Ammunition', BF: 'Burst Fire', F: 'Finesse', H: 'Heavy',
  L: 'Light', LD: 'Loading', R: 'Reach', RLD: 'Reload', S: 'Special', T: 'Thrown',
  V: 'Versatile', '2H': 'Two-Handed', Vst: 'Vestige of Divergence',
};

const isMelee = (w) => String(w.type).startsWith('M');
const masteryName = (w) => (w.mastery ?? []).map((m) => String(m).split('|')[0]).join(', ');
const propertyNames = (w) =>
  (w.property ?? []).map((p) => {
    const code = String(p?.uid ?? p).split('|')[0];
    return PROPERTY_NAMES[code] ?? code;
  });

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function damageText(w) {
  if (!w.dmg1) return '-';
  return `${w.dmg1} ${DMG_TYPE[w.dmgType] ?? w.dmgType ?? ''}`.trim();
}

const weaponEntity = {
  type: 'weapon',
  title: 'Weapon',

  // Só armas com mastery (XPHB); latestOnly esconde as versões antigas (PHB).
  // Armas de fogo de outras eras (age: modern/futuristic…) ficam de fora - não
  // entram na escolha padrão de Weapon Mastery.
  list: (db) =>
    latestOnly(db?.['items-base']?.baseitem ?? []).filter(
      (i) => i.weaponCategory && i.mastery && !i.age
    ),

  idOf: (w) => `${w.name}|${w.source}`,

  precompute: (w) => ({
    searchText: `${w.name} ${w.source} ${masteryName(w)}`.toLowerCase(),
    filterValues: {
      category: [cap(w.weaponCategory)],
      kind: [isMelee(w) ? 'Melee' : 'Ranged'],
      property: propertyNames(w),
      mastery: [masteryName(w)].filter(Boolean),
    },
  }),

  filters: [
    { id: 'category', header: 'Category', options: ['Simple', 'Martial'] },
    { id: 'kind', header: 'Type', options: ['Melee', 'Ranged'] },
    { id: 'property', header: 'Property', derive: true },
    { id: 'mastery', header: 'Mastery', derive: true },
  ],

  // Preview COMPLETO, igual ao da loja de itens: reaproveita o item entity -
  // dano/alcance/propriedades/mastery no meta E, o mais importante aqui, as
  // DESCRIÇÕES resolvidas da mastery e das propriedades (+ arte do fluff) no
  // corpo. Antes o preview de Weapon Mastery ficava vazio (sem entries/fluff).
  meta: (w, db) => itemEntity.meta(w, db),
  entries: (w, db) => itemEntity.entries(w, db),
  fluff: (w, db) => itemEntity.fluff(w, db),

  card: (w) => ({
    title: w.name,
    subtitle: w.source,
    meta: `${damageText(w)} · ${cap(w.weaponCategory)}`,
    badges: [masteryName(w)].filter(Boolean),
  }),
};

export default weaponEntity;
