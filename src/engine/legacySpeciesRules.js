// =============================================================================
// legacySpeciesRules: as regras 2024 aplicadas a uma espécie legada (2014)
// =============================================================================
// O QUE FAZ
//   Várias espécies alcançáveis vêm de livros 2014 (Custom Lineage TCE, Aetherborn
//   PSK, Simic Hybrid GGR) com campos que 2024 mudou de lugar e que dariam o que
//   nenhuma espécie 2024 dá. Duas regras:
//     1. GERAL: o `ability` de ESPÉCIE é sempre descartado; em 2024 o aumento vem
//        da origem (a regra do DDL-0058, estendida às bases). Não mexe no `ability`
//        de TALENTO, que é legítimo.
//     2. CURADA: `feats` livre vira talento de ORIGEM. O "one feat of your choice"
//        do Custom Lineage era o conjunto inteiro em 2014; o equivalente 2024 é a
//        categoria O, como no Human XPHB. Sem isso a espécie oferecia General e
//        Fighting Style no nível 1.
//
// FUNÇÕES
//   withFeatCategory(feats, category): [{any:N}] vira [{anyFromCategory}].
//   normalizeLegacySpecies(race): as regras aplicadas.
//
// DECISÕES E ARMADILHAS
//   - Memoizado por objeto de origem (WeakMap), e sem nada a mudar volta a MESMA
//     referência: memo e caches que comparam identidade não veem churn. É
//     idempotente.
//   - FEAT_CATEGORY_OVERRIDES é keyed pela espécie BASE: a variante de linhagem
//     tem o sufixo no `name`, mas não no `_baseName`.
// -----------------------------------------------------------------------------

const FEAT_CATEGORY_OVERRIDES = Object.freeze({
  'Custom Lineage|TCE': ['O'],
});

const cache = new WeakMap();

/** Reescreve [{any:N}] como [{anyFromCategory:{category, count}}]. */
function withFeatCategory(feats, category) {
  return (feats ?? []).map((entry) => {
    if (!entry || typeof entry !== 'object' || entry.any == null) return entry;
    return { anyFromCategory: { category: [...category], count: entry.any } };
  });
}

/**
 * Aplica as regras 2024 a uma espécie; a mesma referência se nada muda.
 * @param {object|null} race
 * @returns {object|null}
 */
export function normalizeLegacySpecies(race) {
  if (!race || typeof race !== 'object') return race;
  const cached = cache.get(race);
  if (cached) return cached;

  const key = `${race._baseName ?? race.name}|${race.source}`;
  const featCategory = FEAT_CATEGORY_OVERRIDES[key];
  const needsFeats = featCategory && (race.feats ?? []).some((e) => e?.any != null);
  if (race.ability == null && !needsFeats) return race;

  const out = { ...race };
  delete out.ability;
  if (needsFeats) out.feats = withFeatCategory(race.feats, featCategory);
  cache.set(race, out);
  cache.set(out, out);
  return out;
}
