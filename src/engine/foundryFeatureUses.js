// =============================================================================
// foundryFeatureUses - `uses` (pool de recurso + recuperação) por feature
// =============================================================================
// Registro curado que dá a uma feature de RECURSO o bloco `system.uses` do Foundry
// (máximo + recuperação por descanso), para o Foundry RASTREAR o recurso na ficha
// (ex: usos de Second Wind, Rages, Channel Divinity, Pontos de Feitiçaria).
//
// O `max` costuma referenciar um ScaleValue que a própria classe gera
// (`@scale.<classId>.<slug-do-título>`, ver foundryAdvancement.scaleValueAdvancements)
// - por isso guardamos o TÍTULO do ScaleValue e montamos a referência com o classId.
// Casos sem escala usam uma fórmula literal (@prof, mod, nível, número).
//
// Valores extraídos dos 12 exports premade oficiais (um por classe). As ACTIVITIES
// (tap-to-roll) são um passo à parte - aqui é só o rastreio de recurso.
//
// PRECEDÊNCIA (TC-0068): curado aqui → tabela GERADA do SRD do dnd5e
// (`FEATURE_USES_BY_CLASS`/`FEATURE_USES_FLAT`, via `npm run gen:uuids`) → overlay
// do 5etools. A tabela gerada entra na frente do overlay porque é o dado do
// PRÓPRIO sistema de destino, em 2024; o overlay é de terceiros e casa por edição
// estrita (DDL-0057). O registro curado continua sendo o ponto de override.
// -----------------------------------------------------------------------------

import { FEATURE_USES_BY_CLASS, FEATURE_USES_FLAT } from './compendiumUuidsData';

// Perfis de recuperação (recovery) comuns nos premades.
const SR_FULL = [{ period: 'sr', type: 'recoverAll' }];
const LR_FULL = [{ period: 'lr', type: 'recoverAll' }];
// Descanso longo recupera tudo; curto recupera 1 (Second Wind, Rage, Channel Divinity…).
const LR_FULL_SR_ONE = [
  { period: 'lr', type: 'recoverAll' },
  { period: 'sr', type: 'formula', formula: '1' },
];

const slug = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Nome da feature (minúsculo) → { scale?: 'Título do ScaleValue', id?: identificador
// literal, max?: fórmula, recovery }.
// `scale`/`id` montam `@scale.<classId>.<…>`; senão usa `max` literal.
//
// ATENÇÃO: a referência tem de casar com o IDENTIFICADOR que NÓS exportamos no
// ScaleValue, não com o título. Onde o SRD usa um identificador curto próprio
// (TC-0062) o slug do título NÃO serve, e a referência fica órfã em silêncio -
// use `id`. A sonda que pega isso está descrita no TC-0068.
const FEATURE_USES = {
  'second wind': { scale: 'Second Wind', recovery: LR_FULL_SR_ONE },
  'action surge': { scale: 'Action Surge', recovery: SR_FULL },
  indomitable: { scale: 'Indomitable', recovery: LR_FULL },
  rage: { scale: 'Rages', recovery: LR_FULL_SR_ONE },
  'channel divinity': { scale: 'Channel Divinity', recovery: LR_FULL_SR_ONE },
  // `wild-shape` é a escala de CR (é o identificador que o SRD dá a ela); os USOS
  // moram em "Wild Shape Uses". Apontar para o título curto pegava a CR.
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
 * Bloco `system.uses` de uma feature de recurso, ou null quando nem o registro
 * curado nem o SRD conhecem a feature (aí o chamador cai no overlay).
 * @param {string} name     nome da feature (ex: 'Second Wind')
 * @param {string} [classId]  identifier da classe: escolhe a linha certa quando o
 *   nome colide entre classes ("Channel Divinity") e monta a referência `@scale`.
 *   Ausente (traço de espécie, talento) = só a tabela plana.
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
