// =============================================================================
// magicItemPrice: o preço derivado de itens mágicos
// =============================================================================
// O QUE FAZ
//   Quase nenhum item mágico do 5e.tools tem preço (`value`). Ele é derivado de
//   três tabelas FIXAS do 5e.tools, embutidas como constantes: "Magic Item
//   Crafting Time and Cost" (por raridade), "Spell Scroll Costs" (por nível de
//   magia) e "Hirelings" (profissional hábil a 2 gp por dia).
//     preço = custo do item base (se houver) + custo da tabela + 2 gp x dias.
//   A semana de trabalho tem 5 dias. Exemplo: Cast-Off Plate Armor (Common, base
//   Plate 1500 gp) = 1500 + 50 + 5 x 2 = 1560 gp.
//
// FUNÇÕES
//   norm(s), spellScrollLevel(raw): o nível de um Spell Scroll pelo nome.
//   baseItemValueGp(raw, db): o custo do item base (`baseItem`).
//   derivedMagicValue(raw, db): o preço derivado, em cobre, ou null.
//   itemValue(raw, db): o listado, senão o derivado, senão null.
//   isValueDerived(raw): o valor exibido é uma estimativa?
//
// DECISÕES E ARMADILHAS
//   - Artifact não tem custo de criação na tabela: sem derivação.
//   - Scroll de nível reconhecido usa a tabela de scrolls; o resto, a de raridade.
// -----------------------------------------------------------------------------

const SKILLED_HIRELING_GP_PER_DAY = 2;
const DAYS_PER_WORKWEEK = 5;

const CRAFT_BY_RARITY = {
  common: { gp: 50, workweeks: 1 },
  uncommon: { gp: 200, workweeks: 2 },
  rare: { gp: 2000, workweeks: 10 },
  'very rare': { gp: 20000, workweeks: 25 },
  legendary: { gp: 100000, workweeks: 50 },
};

const SCROLL_BY_LEVEL = {
  0: { gp: 15, days: 1 },
  1: { gp: 25, days: 1 },
  2: { gp: 250, days: 3 },
  3: { gp: 500, days: 5 },
  4: { gp: 2500, days: 10 },
  5: { gp: 5000, days: 20 },
  6: { gp: 15000, days: 40 },
  7: { gp: 25000, days: 80 },
  8: { gp: 50000, days: 160 },
  9: { gp: 250000, days: 240 },
};

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** O nível de magia de um Spell Scroll, ou null. */
function spellScrollLevel(raw) {
  const m = /spell scroll \((cantrip|(\d+)(?:st|nd|rd|th) level)\)/i.exec(raw?.name ?? '');
  if (!m) return null;
  return /cantrip/i.test(m[1]) ? 0 : Number(m[2]);
}

/** O custo em gp do item base de um mágico (0 se não houver). */
function baseItemValueGp(raw, db) {
  if (!raw?.baseItem) return 0;
  const [name, source] = String(raw.baseItem).split('|');
  const list = db?.['items-base']?.baseitem ?? [];
  const base =
    (source && list.find((b) => norm(b.name) === norm(name) && norm(b.source) === norm(source))) ||
    list.find((b) => norm(b.name) === norm(name));
  return base?.value != null ? base.value / 100 : 0;
}

/** O preço derivado, em cobre, de um mágico sem preço, ou null. */
export function derivedMagicValue(raw, db) {
  let craft = null;
  const lvl = spellScrollLevel(raw);
  if (lvl != null && SCROLL_BY_LEVEL[lvl]) {
    craft = SCROLL_BY_LEVEL[lvl];
  } else {
    const r = CRAFT_BY_RARITY[norm(raw?.rarity)];
    if (r) craft = { gp: r.gp, days: r.workweeks * DAYS_PER_WORKWEEK };
  }
  if (!craft) return null;
  const totalGp = baseItemValueGp(raw, db) + craft.gp + craft.days * SKILLED_HIRELING_GP_PER_DAY;
  return totalGp * 100;
}

/** O valor em cobre: listado, senão derivado, senão null. */
export function itemValue(raw, db) {
  if (raw?.value != null) return raw.value;
  return derivedMagicValue(raw, db);
}

/** O valor exibido é uma estimativa? */
export function isValueDerived(raw) {
  return raw?.value == null;
}
