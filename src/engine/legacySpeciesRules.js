// =============================================================================
// Regras 2024 aplicadas a uma espécie LEGADA (2014) que o app ainda oferece
// =============================================================================
// O FlyBy é um builder de regras 2024, mas várias espécies alcançáveis vêm de
// livros 2014 (Custom Lineage TCE, Aetherborn PSK, Simic Hybrid GGR…). Elas
// trazem campos que a edição 2024 moveu de lugar - e que, deixados como estão,
// dariam ao personagem coisas que nenhuma espécie 2024 dá.
//
// Duas regras, uma GERAL e uma CURADA:
//
//  1. `ability` de ESPÉCIE é sempre descartado (GERAL). Em 2024 os aumentos de
//     atributo vêm SEMPRE da origem; uma espécie nunca concede nenhum. É a mesma
//     regra que o DDL-0058 fixou para as sub-raças legadas, aqui estendida às
//     espécies base - as três alcançáveis com o campo são Custom Lineage|TCE,
//     Aetherborn|PSK (+ a variante Gifted) e Simic Hybrid|GGR.
//     Cuidado: isto NÃO mexe no campo `ability` de TALENTO (esse é legítimo e
//     continua sendo lido por resolve.deriveFeatAbilityBoosts).
//
//  2. `feats` livre vira feat de ORIGEM (CURADO, registro fechado abaixo). O
//     Custom Lineage 2014 diz "one feat of your choice for which you qualify" -
//     no nível 1 de 2014 isso era o conjunto inteiro de talentos. O equivalente
//     2024 de "um talento que você pega ao nascer" é a categoria ORIGIN, que é o
//     que o Human XPHB concede (`anyFromCategory: {category:['O']}`). Sem isto,
//     a espécie oferece talentos General/Fighting Style no nível 1.
//
// O objeto normalizado é memoizado por objeto de origem (WeakMap) e, quando não
// há nada a mudar, a MESMA referência volta - consumidores que comparam
// identidade (memo de render, caches) não veem churn.
// -----------------------------------------------------------------------------

/**
 * Espécies cujo `feats` livre é, em 2024, um talento de ORIGEM.
 * Chave: 'Nome|FONTE' da espécie BASE (a variante de linhagem herda pelo
 * `_baseName`). Valor: as categorias do `anyFromCategory` (mesmo vocabulário do
 * 5etools: O = Origin, G = General, FS = Fighting Style, EB = Epic Boon).
 */
const FEAT_CATEGORY_OVERRIDES = Object.freeze({
  'Custom Lineage|TCE': ['O'],
});

const cache = new WeakMap();

/** Reescreve `[{any:N}]` como `[{anyFromCategory:{category,count:N}}]`. */
function withFeatCategory(feats, category) {
  return (feats ?? []).map((entry) => {
    if (!entry || typeof entry !== 'object' || entry.any == null) return entry;
    return { anyFromCategory: { category: [...category], count: entry.any } };
  });
}

/**
 * Aplica as regras 2024 a um objeto de espécie do 5etools (base OU variante de
 * linhagem já resolvida). Devolve a MESMA referência quando nada muda.
 * @param {object|null} race
 * @returns {object|null}
 */
export function normalizeLegacySpecies(race) {
  if (!race || typeof race !== 'object') return race;
  const cached = cache.get(race);
  if (cached) return cached;

  // A chave curada é a da espécie BASE: numa variante de linhagem o `name` já
  // vem com o sufixo ("Custom Lineage; Darkvision"), mas `_baseName` não.
  const key = `${race._baseName ?? race.name}|${race.source}`;
  const featCategory = FEAT_CATEGORY_OVERRIDES[key];
  const needsFeats = featCategory && (race.feats ?? []).some((e) => e?.any != null);
  if (race.ability == null && !needsFeats) return race;

  const out = { ...race };
  delete out.ability;
  if (needsFeats) out.feats = withFeatCategory(race.feats, featCategory);
  cache.set(race, out);
  cache.set(out, out); // normalizar de novo é idempotente e não realoca
  return out;
}
