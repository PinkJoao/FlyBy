// =============================================================================
// foundryActivities: as activities (tap-to-roll) das features
// =============================================================================
// O QUE FAZ
//   Uma ACTIVITY é o botão de ativar ou rolar na ficha do Foundry: consome um uso
//   do recurso e faz a ação do tipo (heal rola cura, utility só ativa, save pede o
//   teste, transform muda de forma). Três fontes, na precedência curado, SRD,
//   overlay (TC-0068, a mesma do featureUses): este registro curado, a mecânica
//   GERADA do SRD (srdActivitiesData) e o overlay do 5etools.
//
// FUNÇÕES
//   fid(): id de activity.
//   consumeUses(value, scaling, target): o alvo de consumo (1 uso do item, ou de
//     outro item via `feat:<identifier>`).
//   baseActivity(type, opts), heal(opts), utility(opts), save(opts),
//     transform(opts): as fábricas de activity.
//   featureActivities(name, classId, opts): o `system.activities` curado de uma
//     feature, ou {}.
//   classWeaponGrants(classId): os itens de inventário que a classe concede.
//   srdFeatureMechanics(name, classId): { activities, effects } do SRD, ou null.
//
// DECISÕES E ARMADILHAS
//   - Estruturas copiadas 1:1 dos premades oficiais (um por classe). Destaques:
//     Lay on Hands cura por POOL (consome N usos, `@scaling`) mais o Remove Poison
//     a 5; Channel Divinity varia por classe (Divine Sense do Paladino; Divine
//     Spark e Turn Undead do Clérigo, este com o efeito no ALVO via
//     `opts.targetEffectId`); Sear Undead e Preserve Life gastam o pool da Channel
//     Divinity, não o próprio; Wild Shape usa o preset nativo `wildshape` com
//     perfis por faixa de nível; Font of Magic converte pontos e espaços; Monk's
//     Focus gasta 1 Focus Point, e o Patient Defense tem a versão grátis.
//   - War Bond (Eldritch Knight, TC-0094): o overlay faz o "Bond with Weapon"
//     gastar um uso do próprio item, e o XPHB não dá limite nenhum (um ritual de 1
//     hora, que cabe num descanso curto). As duas activities saem curadas, SEM
//     consumo: no Foundry, um consumo de item sem `uses` falha ao usar.
//   - srdFeatureMechanics devolve activities e effects JUNTOS: a activity cita os
//     effects do próprio item por `_id`, e separá-los deixa a referência no vazio
//     (TC-0068, DDL-0074). Activity é mecânica do SISTEMA DE DESTINO: o SRD é a
//     fonte (TC-0070).
//   - classWeaponGrants diverge do SRD DE PROPÓSITO (DDL-0080): o SRD dá o Unarmed
//     Strike só ao Bárbaro e ao Monge, mas toda criatura pode atacar desarmada, e
//     um Mago sem o cajado chegaria ao Foundry sem botão de ataque. O SRD é
//     referência, não autoridade; a divergência é NOMEADA. `srd` marca a origem:
//     o do Bárbaro e do Monge entra no ItemGrant "Class Features" do SRD; o
//     acréscimo universal ganha título próprio.
// -----------------------------------------------------------------------------

import { SRD_ACTIVITIES_BY_CLASS, SRD_ACTIVITIES_FLAT, SRD_CLASS_WEAPON_GRANTS, SRD_COMMON_WEAPON_GRANTS } from './srdActivitiesData';

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function fid() {
  let s = '';
  for (let i = 0; i < 16; i += 1) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/** O alvo de consumo: 1 uso do próprio item, ou de outro via `target`. */
function consumeUses(value = '1', scaling = {}, target = '') {
  return { type: 'itemUses', value, target, scaling };
}

/** O esqueleto comum de uma activity. */
function baseActivity(type, { activation = {}, name = '', duration, consumption, target, range } = {}) {
  return {
    _id: fid(),
    type,
    name,
    activation: { type: activation.type ?? '', value: activation.value ?? null, condition: '', override: false },
    consumption: {
      targets: consumption?.targets ?? [consumeUses()],
      scaling: consumption?.scaling ?? { allowed: false },
      spellSlot: true,
    },
    description: { chatFlavor: '' },
    duration: duration ?? { units: 'inst', concentration: false, override: false },
    effects: [],
    range: range ?? { units: 'self', special: '', override: false },
    target: {
      affects: { count: '', type: 'self', choice: false, special: '', ...(target?.affects ?? {}) },
      template: { contiguous: false, units: 'ft', type: '', stationary: false },
      override: false,
      prompt: false,
    },
    uses: { spent: 0, recovery: [], max: '' },
    sort: 0,
    flags: {},
    visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false },
    img: null,
  };
}

/** Activity de cura (dado fixo ou fórmula). */
function heal({ activation, name, number, denomination, bonus, customFormula, consumption, target, range }) {
  return {
    ...baseActivity('heal', { activation, name, consumption, target, range }),
    healing: {
      number: number ?? null,
      denomination: denomination ?? 0,
      types: ['healing'],
      custom: customFormula ? { enabled: true, formula: customFormula } : { enabled: false },
      scaling: { number: 1 },
      bonus: bonus ?? '',
    },
  };
}

/** Activity utilitária (só ativa). */
function utility({ activation, name, duration, consumption } = {}) {
  return {
    ...baseActivity('utility', { activation, name, duration, consumption }),
    roll: { formula: '', name: '', prompt: false, visible: false },
  };
}

/** Activity de teste de resistência, com dano e efeito no alvo opcionais. */
function save({ activation, name, range, target, consumption, ability, damageFormula, damageTypes, onSave = 'none', effectId }) {
  return {
    ...baseActivity('save', { activation, name, consumption, target, range }),
    effects: effectId ? [{ _id: effectId }] : [],
    damage: {
      onSave,
      parts: damageFormula
        ? [{ number: null, denomination: null, bonus: '', types: damageTypes ?? [], custom: { enabled: true, formula: damageFormula } }]
        : [],
    },
    save: { ability: Array.isArray(ability) ? ability : [ability], dc: { calculation: 'spellcasting', formula: '' } },
  };
}

/** Activity de transformação (Wild Shape), com o preset nativo. */
function transform({ activation, name, identifier, profiles }) {
  const base = baseActivity('transform', { activation, name, target: { affects: { type: 'self', special: '' } } });
  return {
    ...base,
    target: { ...base.target, prompt: true },
    profiles: profiles.map((p) => ({ _id: fid(), uuid: '', sizes: [], name: '', ...p })),
    transform: { customize: false, identifier, preset: 'wildshape' },
  };
}

const MIN10 = { value: '10', units: 'minute', concentration: false, override: false };
const HOUR1 = { value: '1', units: 'hour', concentration: false, override: false };
const BONUS = { type: 'bonus' };
const ACTION = { type: 'action' };
const RANGE_30FT = { units: 'ft', value: '30', special: '', override: false };
const CHANNEL_DIVINITY_POOL = 'feat:channel-divinity';

const FEATURE_ACTIVITIES = {
  'second wind': (classId) => [
    heal({ activation: BONUS, number: 1, denomination: 10, bonus: `@classes.${classId}.levels` }),
  ],
  'action surge': () => [utility({ activation: { type: 'special' } })],
  'war bond': () => [
    utility({ activation: { type: 'bonus' }, name: 'Summon Weapon', consumption: { targets: [] } }),
    utility({ activation: { type: 'special' }, name: 'Bond with Weapon', consumption: { targets: [] } }),
  ],
  indomitable: () => [utility({ activation: { type: 'action' } })],
  rage: () => [utility({ activation: { type: 'bonus', value: 1 }, name: 'Expend Rage', duration: MIN10 })],
  'bardic inspiration': () => [utility({ activation: { type: 'bonus', value: 1 }, name: 'Inspire', duration: HOUR1 })],
  'innate sorcery': () => [utility({ activation: BONUS, name: 'Innate Sorcery' })],
  'arcane recovery': () => [utility({ activation: { type: 'shortRest' }, name: 'Recover' })],
  'lay on hands': (classId) => [
    heal({
      activation: BONUS,
      customFormula: '@scaling',
      consumption: {
        targets: [consumeUses('1', { mode: 'amount', formula: '' })],
        scaling: { allowed: true, max: `5 * @classes.${classId}.levels - @item.uses.spent` },
      },
      target: { affects: { count: '1', type: 'creature' } },
    }),
    utility({ activation: BONUS, name: 'Remove Poison', consumption: { targets: [consumeUses('5')] } }),
  ],
  'channel divinity': (classId, opts = {}) => {
    if (classId === 'paladin') return [utility({ activation: BONUS, name: 'Divine Sense' })];
    if (classId === 'cleric') {
      const sparkFormula = '(@scale.cleric.divine-spark)d8 + @abilities.wis.mod';
      return [
        heal({
          activation: ACTION,
          name: 'Divine Spark: Heal',
          range: RANGE_30FT,
          target: { affects: { type: 'creature', count: '1' } },
          customFormula: sparkFormula,
        }),
        save({
          activation: ACTION,
          name: 'Divine Spark: Save',
          range: RANGE_30FT,
          target: { affects: { type: 'creature', count: '1' } },
          ability: 'con',
          damageFormula: sparkFormula,
          damageTypes: ['necrotic', 'radiant'],
          onSave: 'half',
        }),
        save({
          activation: ACTION,
          name: 'Turn Undead',
          range: RANGE_30FT,
          target: { affects: { type: 'creature', special: 'Undead of your choice' } },
          ability: 'wis',
          effectId: opts.targetEffectId,
        }),
      ];
    }
    return [];
  },
  'sear undead': () => [
    save({
      activation: ACTION,
      name: 'Channel Divinity: Turn Undead',
      range: { units: 'self', special: '', override: false },
      target: { affects: { type: 'creature', special: 'Undead' } },
      consumption: { targets: [consumeUses('1', {}, CHANNEL_DIVINITY_POOL)] },
      ability: 'wis',
      damageFormula: '(@abilities.wis.mod)d8',
      damageTypes: ['radiant'],
      onSave: 'none',
    }),
  ],
  'preserve life': (classId) => [
    heal({
      activation: ACTION,
      name: 'Channel Divinity: Preserve Life',
      range: { units: 'ft', value: '30', special: '', override: false },
      target: { affects: { type: 'creature', choice: true, special: 'Bloodied creatures' } },
      consumption: { targets: [consumeUses('1', {}, CHANNEL_DIVINITY_POOL)] },
      customFormula: `5 * @classes.${classId}.levels`,
    }),
  ],
  'wild shape': (classId) => [
    transform({
      activation: BONUS,
      identifier: classId,
      profiles: [
        { cr: '0.25', name: 'CR ¼', types: ['beast'], movement: ['fly'], level: { min: null, max: 3 } },
        { cr: '0.5', name: 'CR ½', types: ['beast'], movement: ['fly'], level: { min: 4, max: 7 } },
        { cr: '1', name: 'CR 1', types: ['beast'], movement: [], level: { min: 8, max: null } },
      ],
    }),
  ],
  'font of magic': () => [
    utility({
      activation: BONUS,
      name: 'Regain Spell Slot',
      consumption: {
        targets: [
          { type: 'itemUses', value: '1 + @scaling + floor(@scaling / 3)', target: '', scaling: { mode: '' } },
          { type: 'spellSlots', value: '-1', target: '', scaling: { mode: 'level', formula: '' } },
        ],
        scaling: { allowed: true, max: '5' },
      },
    }),
    utility({
      name: 'Regain Sorcery Points',
      consumption: {
        targets: [
          { type: 'spellSlots', value: '1', target: '', scaling: { mode: 'level', formula: '' } },
          { type: 'itemUses', value: '0 - @scaling', target: '', scaling: { mode: 'amount', formula: '' } },
        ],
        scaling: { allowed: true, max: '9' },
      },
    }),
  ],
  "monk's focus": () => [
    utility({ activation: BONUS, name: 'Flurry of Blows' }),
    utility({ activation: BONUS, name: 'Patient Defense (Focus Point)' }),
    utility({ activation: BONUS, name: 'Patient Defense', consumption: { targets: [] } }),
    utility({ activation: BONUS, name: 'Step of the Wind' }),
  ],
};

/**
 * O bloco `system.activities` curado de uma feature, ou {}.
 * @param {string} name
 * @param {string} classId
 * @param {{targetEffectId?: string}} [opts]
 * @returns {Record<string, object>}
 */
export function featureActivities(name, classId, opts) {
  const make = FEATURE_ACTIVITIES[String(name ?? '').trim().toLowerCase()];
  if (!make) return {};
  return Object.fromEntries(make(classId, opts).map((a) => [a._id, a]));
}

/**
 * Os itens de inventário que a classe concede (o Unarmed Strike).
 * @param {string} classId
 * @returns {Array<{name: string, uuid: string, level: number, system: object}>}
 */
export function classWeaponGrants(classId) {
  const own = SRD_CLASS_WEAPON_GRANTS[String(classId ?? '').trim().toLowerCase()];
  if (own) return own.map((g) => ({ ...g, srd: true }));
  return SRD_COMMON_WEAPON_GRANTS.map((g) => ({ ...g, srd: false }));
}

/**
 * A mecânica de rolagem que o SRD publica para uma feature, ou null.
 * @param {string} name
 * @param {string} [classId]
 * @returns {{activities: Record<string, object>, effects: object[]}|null}
 */
export function srdFeatureMechanics(name, classId) {
  const key = String(name ?? '').trim().toLowerCase().replace(/’/g, "'");
  if (!key) return null;
  const entry =
    (classId ? SRD_ACTIVITIES_BY_CLASS[`${String(classId).trim().toLowerCase()}|${key}`] : null)
    ?? SRD_ACTIVITIES_FLAT[key];
  if (!entry) return null;
  return { activities: entry.activities ?? {}, effects: entry.effects ?? [] };
}
