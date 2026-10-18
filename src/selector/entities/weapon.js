// =============================================================================
// weapon: a entity de arma (Weapon Mastery)
// =============================================================================
// O QUE FAZ
//   As armas base que TÊM propriedade de maestria (XPHB); latestOnly esconde as
//   PHB e as armas de outras eras ficam fora. Filtros: categoria e tipo. O meta
//   mostra dano e maestria. O preview reusa o da loja (itemEntity), com as
//   descrições da maestria e das propriedades; antes ficava vazio.
//
// FUNÇÕES
//   isMelee(w), masteryName(w), propertyNames(w), cap(s), damageText(w): os campos.
//   Exporta weaponEntity.
// -----------------------------------------------------------------------------

import { latestOnly } from '../reprints';
import itemEntity from './item';

const DMG_TYPE = { B: 'Bludgeoning', P: 'Piercing', S: 'Slashing' };

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
