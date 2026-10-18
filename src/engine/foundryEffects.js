// =============================================================================
// foundryEffects: os Active Effects curados (mecânicas em prosa)
// =============================================================================
// O QUE FAZ
//   Features que guardam a mecânica só em TEXTO viram changes de Active Effect
//   { key, mode, value }, com as chaves PÚBLICAS do dnd5e (DDL-0003). `mode`:
//   1 MULTIPLY, 2 ADD, 3 DOWNGRADE, 4 UPGRADE, 5 OVERRIDE. O registro é keyed pelo
//   nome da feature e cresce sob demanda. Vence o overlay (tudo-ou-nada, DDL-0031).
//
// FUNÇÕES
//   effectChangesFor(featureName, classId): os changes de uma feature, ou null
//     (tenta `nome|classId` antes do nome).
//   targetEffectFor(featureName, classId): o effect aplicado ao ALVO, ou null.
//
// DECISÕES E ARMADILHAS
//   - Fighting Styles: só os de bônus PLANO (Archery, Defense); os condicionais o
//     Foundry trata por rider, não por AE fixo.
//   - Unarmored Defense define o MODO de cálculo da CA, por classe (`nome|classId`).
//     A Draconic Resilience XPHB é custom (10 + Dex + Cha); o calc `draconic` do
//     dnd5e é o 13 + Dex de 2014. O Foundry só aceita UM ac.calc: numa multiclasse
//     com duas Defesas sem Armadura, a ficha ao vivo escolhe a maior.
//   - FEATURE_TARGET_EFFECTS são `transfer:false`, aplicados no save falho pela
//     activity (o Turn Undead amedronta e incapacita por 1 minuto, como no
//     premade).
// -----------------------------------------------------------------------------

export const AE_MODE = { MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 };

/** @type {Record<string, {key:string, mode:number, value:string}[]>} */
export const FEATURE_ACTIVE_EFFECTS = {
  'fast movement': [{ key: 'system.attributes.movement.walk', mode: AE_MODE.ADD, value: '10' }],
  'unarmored movement': [{ key: 'system.attributes.movement.walk', mode: AE_MODE.ADD, value: '10' }],
  'remarkable athlete': [{ key: 'flags.dnd5e.initiativeAdv', mode: AE_MODE.OVERRIDE, value: 'true' }],

  archery: [{ key: 'system.bonuses.rwak.attack', mode: AE_MODE.ADD, value: '2' }],
  defense: [{ key: 'system.attributes.ac.bonus', mode: AE_MODE.ADD, value: '1' }],

  'unarmored defense|barbarian': [{ key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'unarmoredBarb' }],
  'unarmored defense|monk': [{ key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'unarmoredMonk' }],
  'draconic resilience': [
    { key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'custom' },
    { key: 'system.attributes.ac.formula', mode: AE_MODE.OVERRIDE, value: '10 + @abilities.dex.mod + @abilities.cha.mod' },
  ],
};

/**
 * Os changes de Active Effect de uma feature, ou null.
 * @param {string} featureName
 * @param {string} [classId]
 * @returns {{key:string, mode:number, value:string}[]|null}
 */
export function effectChangesFor(featureName, classId) {
  const name = String(featureName).trim().toLowerCase();
  if (classId) {
    const scoped = FEATURE_ACTIVE_EFFECTS[`${name}|${String(classId).trim().toLowerCase()}`];
    if (scoped) return scoped;
  }
  return FEATURE_ACTIVE_EFFECTS[name] ?? null;
}

/** @type {Record<string, {name:string, statuses:string[], seconds:number}>} */
export const FEATURE_TARGET_EFFECTS = {
  'channel divinity|cleric': { name: 'Turn Undead', statuses: ['frightened', 'incapacitated'], seconds: 60 },
};

/**
 * O Active Effect aplicado ao alvo por uma feature, ou null.
 * @param {string} featureName
 * @param {string} [classId]
 * @returns {{name:string, statuses:string[], seconds:number}|null}
 */
export function targetEffectFor(featureName, classId) {
  const key = `${String(featureName).trim().toLowerCase()}|${String(classId ?? '').trim().toLowerCase()}`;
  return FEATURE_TARGET_EFFECTS[key] ?? null;
}
