// =============================================================================
// foundryActivities - `activities` (tap-to-roll) por feature
// =============================================================================
// Registro curado que dá a uma feature uma ACTIVITY do Foundry: o botão de
// ativar/rolar na ficha, que CONSOME um uso do recurso (consumption → itemUses)
// e faz a ação do tipo (heal rola cura, utility só ativa).
//
// Só cobre features cuja activity é simples e "gasta 1 uso" (o pareamento com o
// `uses` do foundryFeatureUses). Casos com pool (Lay on Hands, Font of Magic) ou
// múltiplas activities específicas (Channel Divinity) ficam para depois.
// Estruturas extraídas dos exports premade oficiais.
// -----------------------------------------------------------------------------

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function fid() {
  let s = '';
  for (let i = 0; i < 16; i += 1) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/** Alvo padrão de consumo: 1 uso do próprio item (ou de OUTRO item, via `target`
 * no formato `feat:<identifier>` - ver Sear Undead/Preserve Life, que gastam o pool
 * da feature "Channel Divinity" em vez do próprio). */
function consumeUses(value = '1', scaling = {}, target = '') {
  return { type: 'itemUses', value, target, scaling };
}

/**
 * Esqueleto comum de uma activity. Por padrão consome 1 uso do item (itemUses);
 * `consumption` permite trocar os alvos/scaling (pool, spell slots…), `target` o
 * bloco de alvo (self/creature), e `range` o alcance (padrão self/toque).
 */
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

/** Activity de cura (dado fixo OU fórmula custom, ex: pool `@scaling`). */
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

/** Activity utilitária (só ativa - sem rolagem). */
function utility({ activation, name, duration, consumption } = {}) {
  return {
    ...baseActivity('utility', { activation, name, duration, consumption }),
    roll: { formula: '', name: '', prompt: false, visible: false },
  };
}

/** Activity de TESTE DE RESISTÊNCIA (save DC de conjuração + dano opcional, ex:
 * Divine Spark: Save, Turn Undead - sem dano, só o efeito do teste). `effectId`
 * referencia um Active Effect do PRÓPRIO item (não self-buff - `transfer:false`,
 * aplicado ao ALVO na falha do teste, ex: amedrontado/incapacitado de Turn Undead). */
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

/** Activity de TRANSFORMAÇÃO (Wild Shape): perfis de forma (CR/tipo/movimento) por
 * faixa de nível, usando o preset nativo `wildshape` do dnd5e (concede PV temp =
 * nível de druida, restringe conjuração etc. - comportamento embutido do sistema). */
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
// Gasta o pool da feature-mãe "Channel Divinity" em vez do próprio item (Sear Undead
// e o Preserve Life do domínio da Vida não têm pool próprio nos premades reais).
const CHANNEL_DIVINITY_POOL = 'feat:channel-divinity';

// Nome da feature (minúsculo) → fábrica de activities (recebe o classId p/ fórmulas).
// Estruturas copiadas 1:1 dos premades oficiais (um por classe).
const FEATURE_ACTIVITIES = {
  'second wind': (classId) => [
    heal({ activation: BONUS, number: 1, denomination: 10, bonus: `@classes.${classId}.levels` }),
  ],
  'action surge': () => [utility({ activation: { type: 'special' } })],
  indomitable: () => [utility({ activation: { type: 'action' } })],
  rage: () => [utility({ activation: { type: 'bonus', value: 1 }, name: 'Expend Rage', duration: MIN10 })],
  'bardic inspiration': () => [utility({ activation: { type: 'bonus', value: 1 }, name: 'Inspire', duration: HOUR1 })],
  'innate sorcery': () => [utility({ activation: BONUS, name: 'Innate Sorcery' })],
  'arcane recovery': () => [utility({ activation: { type: 'shortRest' }, name: 'Recover' })],
  // Lay on Hands: cura POR POOL - consome N usos (mode amount, scaling até o que
  // resta no pool) e cura `@scaling`; + Remove Poison a 5 usos fixos.
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
  // Channel Divinity: as activities variam por classe - paladino tem a genérica
  // Divine Sense; o clérigo tem 3: Divine Spark (cura OU dano necrótico/radiante à
  // escolha, ambas por `@scale.cleric.divine-spark` d8 + sab) e Turn Undead (o teste
  // + o efeito de amedrontado/incapacitado no alvo - `opts.targetEffectId`, ligado ao
  // Active Effect que o item carrega, ver foundryEffects.targetEffectFor).
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
  // Sear Undead (Clérigo, feature própria nv5): upgrade de Turn Undead que causa
  // dano radiante - gasta o pool da Channel Divinity, não o próprio (sem uses aqui).
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
  // Preserve Life (Domínio da Vida, opção de Channel Divinity): cura por POOL de PV
  // (5 × nível de clérigo) distribuída entre criaturas - gasta o pool da CD, não um
  // próprio.
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
  // Wild Shape: transformação com perfis de forma por faixa de nível (CR/tipo/
  // movimento), no preset nativo `wildshape` do dnd5e - 1:1 com o premade oficial.
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
  // Font of Magic: converte pontos ⇄ espaços de magia (consumos compostos, do premade).
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
  // Monk's Focus: as três opções gastam 1 Focus Point; Patient Defense também tem
  // a versão grátis (Disengage sem gasto), como no premade.
  "monk's focus": () => [
    utility({ activation: BONUS, name: 'Flurry of Blows' }),
    utility({ activation: BONUS, name: 'Patient Defense (Focus Point)' }),
    utility({ activation: BONUS, name: 'Patient Defense', consumption: { targets: [] } }),
    utility({ activation: BONUS, name: 'Step of the Wind' }),
  ],
};

/**
 * Bloco `system.activities` de uma feature (objeto indexado por _id da activity),
 * ou `{}` se não for curada.
 * @param {string} name     nome da feature
 * @param {string} classId  identifier da classe (p/ fórmulas @classes.<id>…)
 * @param {{targetEffectId?: string}} [opts]  _id de um Active Effect do próprio item
 *   (transfer:false) p/ uma activity referenciar via `effects:[{_id}]` - ver Turn Undead.
 * @returns {Record<string, object>}
 */
export function featureActivities(name, classId, opts) {
  const make = FEATURE_ACTIVITIES[String(name ?? '').trim().toLowerCase()];
  if (!make) return {};
  return Object.fromEntries(make(classId, opts).map((a) => [a._id, a]));
}
