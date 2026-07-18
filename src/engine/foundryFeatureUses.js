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
// -----------------------------------------------------------------------------

// Perfis de recuperação (recovery) comuns nos premades.
const SR_FULL = [{ period: 'sr', type: 'recoverAll' }];
const LR_FULL = [{ period: 'lr', type: 'recoverAll' }];
// Descanso longo recupera tudo; curto recupera 1 (Second Wind, Rage, Channel Divinity…).
const LR_FULL_SR_ONE = [
  { period: 'lr', type: 'recoverAll' },
  { period: 'sr', type: 'formula', formula: '1' },
];

const slug = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Nome da feature (minúsculo) → { scale?: 'Título do ScaleValue', max?: fórmula, recovery }.
// `scale` monta `@scale.<classId>.<slug>`; senão usa `max` literal.
const FEATURE_USES = {
  'second wind': { scale: 'Second Wind', recovery: LR_FULL_SR_ONE },
  'action surge': { scale: 'Action Surge', recovery: SR_FULL },
  indomitable: { scale: 'Indomitable', recovery: LR_FULL },
  rage: { scale: 'Rages', recovery: LR_FULL_SR_ONE },
  'channel divinity': { scale: 'Channel Divinity', recovery: LR_FULL_SR_ONE },
  'wild shape': { scale: 'Wild Shape', recovery: LR_FULL_SR_ONE },
  'favored enemy': { scale: 'Favored Enemy', recovery: LR_FULL },
  "monk's focus": { scale: 'Focus Points', recovery: SR_FULL },
  'font of magic': { scale: 'Sorcery Points', recovery: LR_FULL },
  'bardic inspiration': { max: 'max(1, @abilities.cha.mod)', recovery: SR_FULL },
  'innate sorcery': { max: '2', recovery: LR_FULL },
  'lay on hands': { max: '5 * @classes.paladin.levels', recovery: LR_FULL },
  'arcane recovery': { max: '1', recovery: LR_FULL },
  'magical cunning': { max: '1', recovery: LR_FULL },
};

/**
 * Bloco `system.uses` de uma feature de recurso, ou null se não for curada.
 * @param {string} name     nome da feature (ex: 'Second Wind')
 * @param {string} classId  identifier da classe (p/ a referência `@scale`)
 * @returns {{max:string, spent:number, recovery:object[]}|null}
 */
export function featureUses(name, classId) {
  const entry = FEATURE_USES[String(name ?? '').trim().toLowerCase()];
  if (!entry) return null;
  const max = entry.max ?? `@scale.${classId}.${slug(entry.scale)}`;
  return { max, spent: 0, recovery: entry.recovery.map((r) => ({ ...r })) };
}
