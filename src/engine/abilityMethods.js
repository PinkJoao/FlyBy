// =============================================================================
// abilityMethods - regras dos métodos de geração de atributos (PURO)
// =============================================================================
// Point Buy e Standard Array são apenas RESTRIÇÕES de entrada sobre os scores
// base - a derivação (scores + boosts → total/mod) não muda. Este módulo isola a
// aritmética (custo do point buy, orçamento, o array padrão) para o wizard e
// qualquer futura UI, sem tocar no engine de derivação.
// -----------------------------------------------------------------------------

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

// Custo 5e (2014/2024) de cada score no point buy.
export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

// O array padrão, do maior para o menor.
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/**
 * Distribuição RECOMENDADA do array padrão por classe (tabela "Standard Array by
 * Class" do Player's Handbook 2024). Cada linha é uma PERMUTAÇÃO de STANDARD_ARRAY
 * - portanto válida também no point buy (custa exatamente os 27 pontos) e como
 * padrão do modo manual. Serve de ponto de partida em TODOS os métodos.
 * O Artificer não consta no PHB; valores definidos pelo usuário.
 */
export const RECOMMENDED_SCORES = {
  barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  bard: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
  cleric: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 },
  druid: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
  fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  monk: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
  paladin: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
  ranger: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
  rogue: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
  sorcerer: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 },
  warlock: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
  artificer: { str: 14, dex: 12, con: 13, int: 15, wis: 10, cha: 8 },
};

/** A recomendação de uma classe (cópia), ou null se não houver. */
export function recommendedScores(classId) {
  const rec = RECOMMENDED_SCORES[classId];
  return rec ? { ...rec } : null;
}

/** Os scores ainda são o padrão intocado do personagem novo (tudo 10)? */
export function isDefaultScores(scores, abilities) {
  return abilities.every((a) => scores[a] === 10);
}

/**
 * Os scores batem EXATAMENTE com a recomendação de alguma classe? (i.e., foram
 * auto-semeados, não digitados à mão). Permite re-semear ao trocar de classe sem
 * sobrescrever um spread personalizado - só um spread reconhecidamente automático.
 */
export function matchesAnyRecommendation(scores, abilities) {
  return Object.values(RECOMMENDED_SCORES).some((rec) => abilities.every((a) => scores[a] === rec[a]));
}

/** Custo em pontos de um score (fora da faixa: 0 abaixo do mínimo, Infinity acima). */
export function pointCost(score) {
  if (score in POINT_BUY_COST) return POINT_BUY_COST[score];
  return score < POINT_BUY_MIN ? 0 : Infinity;
}

/** Pontos gastos por um conjunto de scores. */
export function pointsSpent(scores, abilities) {
  return abilities.reduce((sum, a) => sum + pointCost(scores[a]), 0);
}

/** Pontos restantes do orçamento. */
export function pointsRemaining(scores, abilities) {
  return POINT_BUY_BUDGET - pointsSpent(scores, abilities);
}

/** Pode mover `ability` em `delta` sob o point buy? (faixa 8–15 e orçamento). */
export function canPointBuyStep(scores, abilities, ability, delta) {
  const next = scores[ability] + delta;
  if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return false;
  return pointsSpent({ ...scores, [ability]: next }, abilities) <= POINT_BUY_BUDGET;
}

/**
 * Scores iniciais de um método (para quando o jogador troca de método). Se a
 * classe tem recomendação, TODOS os métodos partem dela (é uma permutação do
 * standard array - válida no point buy e boa como padrão manual). Sem classe/
 * recomendação, cai no padrão genérico de cada método.
 * @param {string} method
 * @param {string[]} abilities
 * @param {string|null} [classId]
 */
export function initialScores(method, abilities, classId = null) {
  const rec = classId ? RECOMMENDED_SCORES[classId] : null;
  if (rec) return Object.fromEntries(abilities.map((a) => [a, rec[a]]));
  if (method === 'point-buy') return Object.fromEntries(abilities.map((a) => [a, POINT_BUY_MIN]));
  if (method === 'standard-array') return Object.fromEntries(abilities.map((a, i) => [a, STANDARD_ARRAY[i]]));
  return Object.fromEntries(abilities.map((a) => [a, 10])); // manual → base 10
}

/**
 * Atribui o valor `value` do array padrão à `ability`, TROCANDO com quem já o
 * tinha (mantém uma permutação do array - que é exatamente o standard array).
 * @returns novos scores
 */
export function assignStandardArray(scores, abilities, ability, value) {
  const prev = scores[ability];
  const other = abilities.find((a) => a !== ability && scores[a] === value);
  const next = { ...scores, [ability]: value };
  if (other) next[other] = prev; // swap
  return next;
}
