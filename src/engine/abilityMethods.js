// =============================================================================
// abilityMethods: as regras dos métodos de geração de atributos
// =============================================================================
// O QUE FAZ
//   Point Buy e Standard Array são só RESTRIÇÕES de entrada sobre os scores base; a
//   derivação não muda. Este módulo isola a aritmética (custo do point buy,
//   orçamento, o array padrão) para o wizard e qualquer outra UI.
//
// FUNÇÕES
//   recommendedScores(classId): a recomendação de uma classe (cópia), ou null.
//   isDefaultScores(scores, abilities): ainda é o padrão intocado (tudo 10)?
//   matchesAnyRecommendation(scores, abilities): bate EXATAMENTE com a
//     recomendação de alguma classe?
//   pointCost(score), pointsSpent(scores, abilities), pointsRemaining(scores,
//     abilities): a conta do point buy.
//   canPointBuyStep(scores, abilities, ability, delta): pode mover (faixa 8 a 15 e
//     orçamento)?
//   initialScores(method, abilities, classId): os scores de partida de um método.
//   assignStandardArray(scores, abilities, ability, value): atribui um valor do
//     array TROCANDO com quem o tinha.
//
// DECISÕES E ARMADILHAS
//   - RECOMMENDED_SCORES é a tabela "Standard Array by Class" do PHB 2024. Cada
//     linha é uma PERMUTAÇÃO do array padrão, então vale também no point buy (custa
//     exatamente 27) e como padrão manual: todos os métodos partem dela. O
//     Artificer não está no PHB; os valores dele foram definidos pelo usuário.
//   - matchesAnyRecommendation existe para re-semear ao trocar de classe só um
//     spread reconhecidamente automático, nunca um digitado à mão.
//   - assignStandardArray troca valores, então o resultado continua sendo uma
//     permutação do array.
// -----------------------------------------------------------------------------

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

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

/** A recomendação de uma classe (cópia), ou null. */
export function recommendedScores(classId) {
  const rec = RECOMMENDED_SCORES[classId];
  return rec ? { ...rec } : null;
}

/** Os scores ainda são o padrão do personagem novo (tudo 10)? */
export function isDefaultScores(scores, abilities) {
  return abilities.every((a) => scores[a] === 10);
}

/** Os scores batem exatamente com a recomendação de alguma classe? */
export function matchesAnyRecommendation(scores, abilities) {
  return Object.values(RECOMMENDED_SCORES).some((rec) => abilities.every((a) => scores[a] === rec[a]));
}

/** Custo de um score (0 abaixo do mínimo, Infinity acima). */
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

/** Pode mover `ability` em `delta` sob o point buy? */
export function canPointBuyStep(scores, abilities, ability, delta) {
  const next = scores[ability] + delta;
  if (next < POINT_BUY_MIN || next > POINT_BUY_MAX) return false;
  return pointsSpent({ ...scores, [ability]: next }, abilities) <= POINT_BUY_BUDGET;
}

/**
 * Scores iniciais de um método, partindo da recomendação da classe.
 * @param {string} method
 * @param {string[]} abilities
 * @param {string|null} [classId]
 */
export function initialScores(method, abilities, classId = null) {
  const rec = classId ? RECOMMENDED_SCORES[classId] : null;
  if (rec) return Object.fromEntries(abilities.map((a) => [a, rec[a]]));
  if (method === 'point-buy') return Object.fromEntries(abilities.map((a) => [a, POINT_BUY_MIN]));
  if (method === 'standard-array') return Object.fromEntries(abilities.map((a, i) => [a, STANDARD_ARRAY[i]]));
  return Object.fromEntries(abilities.map((a) => [a, 10]));
}

/**
 * Atribui um valor do array padrão, trocando com quem já o tinha.
 * @returns
 */
export function assignStandardArray(scores, abilities, ability, value) {
  const prev = scores[ability];
  const other = abilities.find((a) => a !== ability && scores[a] === value);
  const next = { ...scores, [ability]: value };
  if (other) next[other] = prev;
  return next;
}
