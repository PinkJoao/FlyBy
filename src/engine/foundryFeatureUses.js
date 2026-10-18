// =============================================================================
// foundryFeatureUses: o pool de recurso (uses) de cada feature
// =============================================================================
// O QUE FAZ
//   Dá a uma feature de RECURSO o `system.uses` do Foundry (máximo e
//   recuperação), para a ficha rastrear Second Wind, Rages, Channel Divinity,
//   pontos de feitiçaria. O `max` costuma citar um ScaleValue da própria classe
//   (`@scale.<classId>.<id>`); sem escala, uma fórmula literal. Valores dos 12
//   premades oficiais. As activities são outro módulo.
//
// FUNÇÕES
//   slug(s): o slug de um título.
//   featureUses(name, classId): o bloco `uses`, ou null (o chamador cai no
//     overlay). O classId escolhe a linha quando o nome colide entre classes e
//     monta a referência; sem ele, só a tabela plana (traços, talentos).
//
// DECISÕES E ARMADILHAS
//   - Precedência (TC-0068): este registro, depois a tabela GERADA do SRD
//     (FEATURE_USES_BY_CLASS e FEATURE_USES_FLAT, por `npm run gen:uuids`), depois
//     o overlay. O SRD vem antes por ser o próprio sistema de destino.
//   - `scale` usa o título; `id`, um identificador literal. Onde o SRD tem
//     identificador curto próprio (TC-0062), o slug do título NÃO serve. O Wild
//     Shape é o exemplo: `wild-shape` é a escala de CR, os USOS moram em "Wild
//     Shape Uses".
//   - Recuperação comum: descanso longo recupera tudo; curto recupera 1.
// -----------------------------------------------------------------------------

import { FEATURE_USES_BY_CLASS, FEATURE_USES_FLAT } from './compendiumUuidsData';

const SR_FULL = [{ period: 'sr', type: 'recoverAll' }];
const LR_FULL = [{ period: 'lr', type: 'recoverAll' }];
const LR_FULL_SR_ONE = [
  { period: 'lr', type: 'recoverAll' },
  { period: 'sr', type: 'formula', formula: '1' },
];

const slug = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ATENÇÃO: cite o IDENTIFICADOR exportado, não o título; use id onde o SRD é curto (TC-0068).
const FEATURE_USES = {
  'second wind': { scale: 'Second Wind', recovery: LR_FULL_SR_ONE },
  'action surge': { scale: 'Action Surge', recovery: SR_FULL },
  indomitable: { scale: 'Indomitable', recovery: LR_FULL },
  rage: { scale: 'Rages', recovery: LR_FULL_SR_ONE },
  'channel divinity': { scale: 'Channel Divinity', recovery: LR_FULL_SR_ONE },
  'wild shape': { id: 'wild-shape-uses', recovery: LR_FULL_SR_ONE },
  'favored enemy': { scale: 'Favored Enemy', recovery: LR_FULL },
  "monk's focus": { id: 'focus', recovery: SR_FULL },
  'font of magic': { id: 'points', recovery: LR_FULL },
  'bardic inspiration': { max: 'max(1, @abilities.cha.mod)', recovery: SR_FULL },
  'innate sorcery': { max: '2', recovery: LR_FULL },
  'lay on hands': { max: '5 * @classes.paladin.levels', recovery: LR_FULL },
  'arcane recovery': { max: '1', recovery: LR_FULL },
  'magical cunning': { max: '1', recovery: LR_FULL },
};

/**
 * O bloco `system.uses` de uma feature de recurso, ou null.
 * @param {string} name
 * @param {string} [classId]
 * @returns {{max:string, spent:number, recovery:object[]}|null}
 */
export function featureUses(name, classId) {
  const key = String(name ?? '').trim().toLowerCase();
  const entry = FEATURE_USES[key];
  if (entry) {
    const max = entry.max ?? `@scale.${classId}.${entry.id ?? slug(entry.scale)}`;
    return { max, spent: 0, recovery: entry.recovery.map((r) => ({ ...r })) };
  }
  const srd = (classId ? FEATURE_USES_BY_CLASS[`${String(classId).toLowerCase()}|${key}`] : null)
    ?? FEATURE_USES_FLAT[key];
  if (!srd) return null;
  return { max: srd.max, spent: 0, recovery: srd.recovery.map((r) => ({ ...r })) };
}
