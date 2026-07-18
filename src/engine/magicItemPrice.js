// =============================================================================
// magicItemPrice - preço DERIVADO de itens mágicos (loja/inventário)
// =============================================================================
// A maioria esmagadora dos itens mágicos do 5e.tools NÃO tem preço listado
// (`value`). Derivamos um a partir de três tabelas FIXAS do 5e.tools, embutidas
// aqui como constantes (não vale re-ler o compêndio pra dados que não mudam):
//
//   • "Magic Item Crafting Time and Cost" - custo/tempo por RARIDADE.
//   • "Spell Scroll Costs"                - custo/tempo por NÍVEL de magia (scrolls).
//   • "Hirelings"                         - profissional HÁBIL = 2 gp/dia.
//
// Fórmula:  preço = (custo do item base, se houver) + (custo da tabela)
//                   + (custo do hireling hábil × dias de criação).
//   Workweek = 5 dias. Ex.: Cast-Off Plate Armor (Common, base = Plate 1500 gp):
//   1500 + 50 + 5×2 = 1560 gp.
//
// Puro: recebe o item cru + db (p/ resolver o item base); devolve COBRE ou null.
// -----------------------------------------------------------------------------

const SKILLED_HIRELING_GP_PER_DAY = 2; // Hirelings: profissional hábil.
const DAYS_PER_WORKWEEK = 5;

// Magic Item Crafting Time and Cost (por raridade): { gp, workweeks }.
const CRAFT_BY_RARITY = {
  common: { gp: 50, workweeks: 1 },
  uncommon: { gp: 200, workweeks: 2 },
  rare: { gp: 2000, workweeks: 10 },
  'very rare': { gp: 20000, workweeks: 25 },
  legendary: { gp: 100000, workweeks: 50 },
  // 'artifact' não tem custo de criação na tabela → sem derivação.
};

// Spell Scroll Costs (por nível de magia): { gp, days }.
const SCROLL_BY_LEVEL = {
  0: { gp: 15, days: 1 },
  1: { gp: 25, days: 1 },
  2: { gp: 250, days: 3 },
  3: { gp: 500, days: 5 }, // 1 workweek
  4: { gp: 2500, days: 10 }, // 2 workweeks
  5: { gp: 5000, days: 20 }, // 4 workweeks
  6: { gp: 15000, days: 40 }, // 8 workweeks
  7: { gp: 25000, days: 80 }, // 16 workweeks
  8: { gp: 50000, days: 160 }, // 32 workweeks
  9: { gp: 250000, days: 240 }, // 48 workweeks
};

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Nível de magia de um Spell Scroll pelo nome ("Spell Scroll (2nd Level)" → 2,
 * "…(Cantrip)" → 0), ou null se não for um scroll de nível reconhecível. */
function spellScrollLevel(raw) {
  const m = /spell scroll \((cantrip|(\d+)(?:st|nd|rd|th) level)\)/i.exec(raw?.name ?? '');
  if (!m) return null;
  return /cantrip/i.test(m[1]) ? 0 : Number(m[2]);
}

/** Custo (gp) do ITEM BASE de um mágico, via campo `baseItem` ("dagger|phb"). 0 se não houver. */
function baseItemValueGp(raw, db) {
  if (!raw?.baseItem) return 0;
  const [name, source] = String(raw.baseItem).split('|');
  const list = db?.['items-base']?.baseitem ?? [];
  const base =
    (source && list.find((b) => norm(b.name) === norm(name) && norm(b.source) === norm(source))) ||
    list.find((b) => norm(b.name) === norm(name));
  return base?.value != null ? base.value / 100 : 0;
}

/** Preço DERIVADO (em cobre) de um item mágico sem preço listado, ou null. */
export function derivedMagicValue(raw, db) {
  // Scroll de nível conhecido usa a tabela de scrolls; senão a de raridade.
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

/** Valor do item em COBRE: o preço listado (`value`), senão o derivado, senão null. */
export function itemValue(raw, db) {
  if (raw?.value != null) return raw.value;
  return derivedMagicValue(raw, db);
}

/** O valor exibido é uma ESTIMATIVA (derivada), não um preço listado? */
export function isValueDerived(raw) {
  return raw?.value == null;
}
