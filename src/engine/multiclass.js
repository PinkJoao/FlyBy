// =============================================================================
// multiclass - requisitos de atributo para multiclasse (2024)
// =============================================================================
// Para ter mais de uma classe, o personagem precisa cumprir o requisito de
// atributo de TODAS as classes que possui (o da que entra E o das que já tem -
// "para entrar e para sair"). Os requisitos vivem no dado da classe (PHB); a
// versão XPHB resolvida vem com `requirements: null`, então varremos o arquivo.
//
// Formato 5etools do `requirements`:
//   { str:13, cha:13 }              → AND (paladino: Str 13 E Cha 13)
//   { or:[{ str:13, dex:13 }] }     → OR  (guerreiro: Str 13 OU Dex 13)
// -----------------------------------------------------------------------------

import { finalScores } from './abilities';

const ABILITY_ABBR = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** Requisitos de multiclasse de uma classe (varre as fontes até achar). */
export function multiclassRequirements(db, classId) {
  const list = db?.[`class-${classId}`]?.class ?? [];
  for (const c of list) {
    if (c.multiclassing?.requirements) return c.multiclassing.requirements;
  }
  return null;
}

/** O personagem cumpre um requisito? (chaves simples = AND; `or` = OR.) */
export function meetsRequirement(req, scores) {
  if (!req) return true;
  for (const [key, value] of Object.entries(req)) {
    if (key === 'or') {
      const anyOk = (value ?? []).some((group) =>
        Object.entries(group).some(([a, min]) => (scores[a] ?? 0) >= min)
      );
      if (!anyOk) return false;
    } else if ((scores[key] ?? 0) < value) {
      return false;
    }
  }
  return true;
}

/** Texto do requisito, ex: "Str 13 & Cha 13" ou "Str 13 or Dex 13". */
export function requirementText(req) {
  if (!req) return '';
  const parts = [];
  for (const [key, value] of Object.entries(req)) {
    if (key === 'or') {
      const alts = (value ?? []).flatMap((group) =>
        Object.entries(group).map(([a, min]) => `${ABILITY_ABBR[a] ?? a} ${min}`)
      );
      parts.push(alts.join(' or '));
    } else {
      parts.push(`${ABILITY_ABBR[key] ?? key} ${value}`);
    }
  }
  return parts.join(' & ');
}

/**
 * Requisitos NÃO cumpridos se a classe do slot `editingIndex` virar `newClassId`.
 * Checa a classe nova + as OUTRAS que o personagem já tem (multiclasse exige
 * todas - "para entrar e para sair"). A classe do PRÓPRIO slot editado é
 * ignorada: TROCAR a classe única (ou começar com uma classe) não é multiclasse
 * e não tem requisito de atributo.
 * Devolve [] quando a build resultante seria de uma só classe.
 * @param {number} [editingIndex]  índice do slot sendo alterado (-1 = nenhum)
 * @returns {{classId:string, text:string}[]}
 */
export function unmetMulticlassReqs(db, character, newClassId, editingIndex = -1) {
  const others = (character.classes ?? [])
    .filter((_, i) => i !== editingIndex)
    .map((c) => c.classId)
    .filter((id) => id && id !== newClassId);
  const classIds = [...new Set([newClassId, ...others])];
  if (classIds.length < 2) return []; // build de classe única: sem requisito

  const scores = finalScores(character);
  const unmet = [];
  for (const id of classIds) {
    const req = multiclassRequirements(db, id);
    if (req && !meetsRequirement(req, scores)) {
      unmet.push({ classId: id, text: requirementText(req) });
    }
  }
  return unmet;
}
