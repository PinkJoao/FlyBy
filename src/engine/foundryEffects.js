// =============================================================================
// foundryEffects - registro curado de Active Effects (mecânicas em prosa)
// =============================================================================
// Muitas features guardam a mecânica só como TEXTO no 5etools. Para o export
// Foundry (DDL-0001, Opção B), traduzimos essas mecânicas em **Active Effect
// changes** `{key, mode, value}`, usando as chaves PÚBLICAS do sistema dnd5e
// (DDL-0003 - NÃO copiamos o Plutonium; usamos a API documentada do sistema).
//
// `mode`: 1=MULTIPLY 2=ADD 3=DOWNGRADE 4=UPGRADE 5=OVERRIDE (constantes do Foundry).
// O registro é keyed por NOME de feature (minúsculo) e cresce incrementalmente -
// só features com mecânica que o Foundry aplica em runtime precisam de entrada.
// -----------------------------------------------------------------------------

// Modos de Active Effect (CONST.ACTIVE_EFFECT_MODES do Foundry).
export const AE_MODE = { MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 };

/**
 * Nome da feature (minúsculo) → lista de `changes` de Active Effect.
 * @type {Record<string, {key:string, mode:number, value:string}[]>}
 */
export const FEATURE_ACTIVE_EFFECTS = {
  // Barbarian - Fast Movement (nv5): +10 ft de deslocamento sem armadura pesada.
  'fast movement': [{ key: 'system.attributes.movement.walk', mode: AE_MODE.ADD, value: '10' }],
  // Monk - Unarmored Movement (nv2): +10 ft (escala por nível na tabela; base aqui).
  'unarmored movement': [{ key: 'system.attributes.movement.walk', mode: AE_MODE.ADD, value: '10' }],
  // Fighter/Champion - Remarkable Athlete (nv3): +vantagem em iniciativa.
  'remarkable athlete': [{ key: 'flags.dnd5e.initiativeAdv', mode: AE_MODE.OVERRIDE, value: 'true' }],

  // --- Fighting Styles (chaves exatas do dnd5e SRD 2024) ---
  // Só os de bônus PLANO (Archery/Defense); Dueling/GWF/TWF/Protection são
  // condicionais e o Foundry trata via rider/enchant, não um AE fixo.
  archery: [{ key: 'system.bonuses.rwak.attack', mode: AE_MODE.ADD, value: '2' }],
  defense: [{ key: 'system.attributes.ac.bonus', mode: AE_MODE.ADD, value: '1' }],

  // --- Unarmored Defense: define o MODO de cálculo de CA do ator (por classe) ---
  // Barbarian: 10 + Dex + Con; Monk: 10 + Dex + Wis. Mesmo nome de feature nas
  // duas classes com efeitos diferentes → chave `nome|classId`.
  'unarmored defense|barbarian': [{ key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'unarmoredBarb' }],
  'unarmored defense|monk': [{ key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'unarmoredMonk' }],
  // Sorcerer/Draconic - Draconic Resilience (XPHB nv3): 10 + Dex + Cha sem armadura.
  // O calc `draconic` nativo do dnd5e é o 13 + Dex de 2014; a fórmula 2024 é custom.
  // (Multiclasse com outra Defesa sem Armadura só pode ter UM ac.calc no Foundry -
  //  limitação da engine, igual a barbarian+monk; o sheet ao vivo escolhe a maior.)
  'draconic resilience': [
    { key: 'system.attributes.ac.calc', mode: AE_MODE.OVERRIDE, value: 'custom' },
    { key: 'system.attributes.ac.formula', mode: AE_MODE.OVERRIDE, value: '10 + @abilities.dex.mod + @abilities.cha.mod' },
  ],
};

/**
 * Changes de Active Effect de uma feature (ou null se não há mecânica curada).
 * Tenta primeiro a chave específica de classe (`nome|classId`), depois só o nome.
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

/**
 * Effects aplicados ao ALVO por uma activity de save falha (`transfer:false` - ao
 * contrário do registro acima, que são self-buffs sempre ativos no dono do item).
 * Referenciados pela activity via `effects:[{_id}]` (ver foundryActivities.save()).
 * Chave = "nome da feature|classId" (algumas features, ex. Channel Divinity, têm
 * nome igual em classes diferentes mas só uma delas usa este efeito).
 * @type {Record<string, {name:string, statuses:string[], seconds:number}>}
 */
export const FEATURE_TARGET_EFFECTS = {
  // Cleric - Channel Divinity: Turn Undead (falha no teste) amedronta e incapacita
  // o morto-vivo por 1 minuto (premade oficial: statuses frightened+incapacitated).
  'channel divinity|cleric': { name: 'Turn Undead', statuses: ['frightened', 'incapacitated'], seconds: 60 },
};

/**
 * Active Effect (transfer:false) aplicado ao alvo por uma feature, ou null.
 * @param {string} featureName
 * @param {string} [classId]
 * @returns {{name:string, statuses:string[], seconds:number}|null}
 */
export function targetEffectFor(featureName, classId) {
  const key = `${String(featureName).trim().toLowerCase()}|${String(classId ?? '').trim().toLowerCase()}`;
  return FEATURE_TARGET_EFFECTS[key] ?? null;
}
