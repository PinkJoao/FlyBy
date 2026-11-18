// =============================================================================
// playWeapons: o estado de uma arma no jogo (magias e features que mudam o ataque com ela)
// =============================================================================
// O QUE FAZ
//   O TC-0169 (DDL-0242): as magias e features que mudam uma arma não mudavam nada no jogo. Três formas:
//   - IMBUE: a magia ou a feature marca uma arma, e o ataque com ela muda enquanto durar (Shillelagh,
//     Magic Weapon, Elemental Weapon, Holy Weapon, Sacred Weapon, Blessing of the Forge, Hex Warrior);
//   - CREATE: a magia cria uma arma, um ataque novo enquanto durar (Shadow Blade; o Magic Stone, com o
//     bônus de ataque de magia e o modificador de conjuração do lançador, DDL-0243);
//   - STRIKE: a magia É um ataque com a arma, feito no lançamento (True Strike, Booming Blade,
//     Green-Flame Blade).
//   O estado vive num efeito ativo (`state.modifiers`) com o campo `weapon`: termina pela concentração,
//   pela duração em rodadas ou pelo descanso, como os outros efeitos. A vista `withWeaponStates` aplica o
//   estado aos ataques do catálogo da tela. Também a nota das Weapon Masteries, com os números.
//
// FUNÇÕES
//   norm(s), baseName(attack), byCharLevel(level, steps), isWeapon(a), isMelee(a): utilidades (o nome da
//     arma-base, o degrau pelo nível do personagem, se é arma e se é corpo a corpo).
//   WEAPON_SPELLS, WEAPON_FEATURES: os registros, um por frase do texto (a forma, a arma elegível, o efeito).
//   weaponRuleOf(name): a regra de uma magia ou feature de arma, ou null.
//   eligibleWeapons(rule, catalog): os ataques de arma que a regra aceita.
//   weaponModifier({ rule, attack, catalog, slot, type, abilityKey }): o efeito ativo que marca a arma.
//   applyWeaponState(attack, w, catalog): o ataque com o estado aplicado.
//   withWeaponStates(catalog, modifiers): o catálogo com os ataques mudados e os criados.
//   strikeAttack(attack, rule, catalog, abilityKey): o ataque do lançamento de um STRIKE.
//   armorBlessing(name): o efeito do Blessing of the Forge na armadura (+1 de CA, até o descanso longo).
//   withMasteryAttacks(catalog): a variante do Cleave na lista de ataques (a segunda criatura, sem o
//     modificador positivo no dano, DDL-0243).
//   MASTERY_TEXT, masteryNote(attack, catalog): a nota da Weapon Mastery do ataque, com o dano do Graze e
//     a CD do Topple.
//
// DECISÕES E ARMADILHAS
//   - O atributo trocado (Shillelagh, Hex Warrior) só entra se for MAIOR ("you can use"); o True Strike
//     "uses" o atributo de conjuração sempre (`always`).
//   - Só arma não mágica recebe o Magic Weapon, o Elemental Weapon e o Blessing of the Forge ("a
//     nonmagical weapon"); o Holy Weapon e o Sacred Weapon aceitam qualquer uma.
//   - Lançar de novo, ou usar a feature de novo, troca o estado anterior da mesma fonte ("The spell ends
//     early if you cast it again", "or until you use this feature again"): o evento tira o efeito antigo.
//   - O dano extra (Elemental Weapon, Holy Weapon, os STRIKE) vai em `damage.extra`, com o tipo dele, e
//     `damageParts` o rola; o tipo à escolha (Shillelagh: Force; True Strike e Sacred Weapon: Radiant)
//     entra em `damage.typeOptions`.
//   - O Hex Warrior dura até o descanso LONGO (`duration: 'longRest'`), e o restModifierOps não o tira no
//     curto; o Blessing of the Forge também.
//   - As notas do Booming Blade e do Green-Flame Blade (o dano de mover, o da segunda criatura) vão no
//     diálogo: dependem do que o alvo faz ou de outra criatura.
//   - O Shillelagh do XPHB não torna a arma mágica (o texto não diz; o de 2014 dizia): ela segue elegível
//     para o Magic Weapon e o Elemental Weapon.
//   - O Nick dispensa a ação bônus do ataque extra da propriedade Light quando a arma dele tem Nick (o
//     Two-Weapon Fighting do Play.jsx); o Cleave é uma variante do ataque na lista (DDL-0243).
//   - A mastery é nota (o app não sabe se acertou nem quem está ao lado); os números vêm calculados.
// -----------------------------------------------------------------------------

const norm = (s) => String(s ?? '').trim().toLowerCase();
const ABILITY_LABEL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

/** O nome da arma-base do ataque (sem "+1", sem "(pact weapon)"). */
const baseName = (a) => norm(a?.name).replace(/\s*\(.*\)$/, '').replace(/^\+\d+\s+/, '');

/** O degrau pelo nível do personagem: [[17, '2d6'], [11, 'd12'], [5, 'd10'], [0, 'd8']]. */
const byCharLevel = (level, steps) => steps.find(([min]) => level >= min)?.[1] ?? steps[steps.length - 1][1];

const isWeapon = (a) => a?.kind === 'weapon';
const isMelee = (a) => a?.range === 'melee';

export const WEAPON_SPELLS = {
  shillelagh: {
    kind: 'imbue', rounds: 10, eligible: (a) => isWeapon(a) && /^(club|quarterstaff)$/.test(baseName(a)),
    make: ({ level }) => ({ ability: 'spell', die: byCharLevel(level, [[17, '2d6'], [11, '1d12'], [5, '1d10'], [0, '1d8']]), typeOptions: ['force'] }),
  },
  'magic weapon': {
    kind: 'imbue', rounds: 600, eligible: (a) => isWeapon(a) && !a.magical,
    make: ({ slot }) => ({ bonus: slot >= 6 ? 3 : slot >= 3 ? 2 : 1, magical: true }),
  },
  'elemental weapon': {
    kind: 'imbue', rounds: 600, eligible: (a) => isWeapon(a) && !a.magical, types: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
    make: ({ slot, type }) => {
      const n = slot >= 7 ? 3 : slot >= 5 ? 2 : 1;
      return { attackBonus: n, extra: { label: 'Elemental Weapon', formula: `${n}d4`, type: type ?? 'fire' }, magical: true };
    },
  },
  'holy weapon': {
    kind: 'imbue', rounds: 600, eligible: isWeapon,
    make: () => ({ extra: { label: 'Holy Weapon', formula: '2d8', type: 'radiant' }, magical: true }),
  },
  'shadow blade': {
    kind: 'create', rounds: 10,
    make: ({ slot }) => ({ create: { name: 'Shadow Blade', dice: slot >= 7 ? '5d8' : slot >= 5 ? '4d8' : slot >= 3 ? '3d8' : '2d8', type: 'psychic', properties: ['F', 'L', 'T'], distance: '20/60' } }),
    note: 'Advantage when the target is in Dim Light or Darkness',
  },
  'magic stone': {
    kind: 'create', rounds: 10,
    make: ({ origin }) => ({ create: { name: 'Magic Stone', dice: '1d6', type: 'bludgeoning', distance: '60', ranged: true, spell: { toHit: origin?.attackBonus ?? 0, bonus: origin?.abilityMod ?? 0 } } }),
    note: 'Up to three pebbles; anyone can throw one, with your spell attack bonus',
  },
  'true strike': {
    kind: 'strike', eligible: isWeapon,
    make: ({ level }) => ({ ability: 'spell', always: true, typeOptions: ['radiant'], ...(level >= 5 ? { extra: { label: 'True Strike', formula: byCharLevel(level, [[17, '3d6'], [11, '2d6'], [5, '1d6']]), type: 'radiant' } } : {}) }),
  },
  'booming blade': {
    kind: 'strike', eligible: (a) => isWeapon(a) && isMelee(a),
    make: ({ level }) => (level >= 5 ? { extra: { label: 'Booming Blade', formula: byCharLevel(level, [[17, '3d8'], [11, '2d8'], [5, '1d8']]), type: 'thunder' } } : {}),
    note: ({ level }) => `If the target willingly moves 5 feet or more before your next turn, it takes ${byCharLevel(level, [[17, '4d8'], [11, '3d8'], [5, '2d8'], [0, '1d8']])} Thunder`,
  },
  'green-flame blade': {
    kind: 'strike', eligible: (a) => isWeapon(a) && isMelee(a),
    make: ({ level }) => (level >= 5 ? { extra: { label: 'Green-Flame Blade', formula: byCharLevel(level, [[17, '3d8'], [11, '2d8'], [5, '1d8']]), type: 'fire' } } : {}),
    note: ({ level, mod }) => `A second creature within 5 feet of the target takes ${level >= 5 ? `${byCharLevel(level, [[17, '3d8'], [11, '2d8'], [5, '1d8']])} + ` : ''}${mod} Fire`,
  },
};

export const WEAPON_FEATURES = {
  'sacred weapon': {
    kind: 'imbue', rounds: 100, eligible: (a) => isWeapon(a) && isMelee(a),
    make: ({ catalog }) => ({ attackBonus: Math.max(1, catalog?.rollData?.abilities?.cha?.mod ?? 0), typeOptions: ['radiant'] }),
  },
  'blessing of the forge': {
    kind: 'imbue', lasts: 'longRest', armorOption: true, eligible: (a) => isWeapon(a) && !a.magical,
    make: () => ({ bonus: 1, magical: true }),
  },
  'hex warrior': {
    kind: 'imbue', lasts: 'longRest', eligible: (a) => isWeapon(a) && a.proficient && !(a.properties ?? []).includes('2H'),
    make: () => ({ ability: 'cha' }),
  },
};

/** A regra de uma magia ou feature de arma, ou null. */
export function weaponRuleOf(name) {
  const n = norm(name);
  const spell = WEAPON_SPELLS[n];
  if (spell) return { ...spell, name, source: 'spell' };
  const feature = WEAPON_FEATURES[n];
  return feature ? { ...feature, name, source: 'feature' } : null;
}

/** Os ataques de arma que a regra aceita. */
export function eligibleWeapons(rule, catalog) {
  return (catalog?.attacks ?? []).filter((a) => a.uid && (rule.eligible ? rule.eligible(a) : isWeapon(a)));
}

/** O efeito ativo que marca a arma (ou cria uma), para o evento do lançamento ou do uso. */
export function weaponModifier({ rule, attack = null, catalog, slot = 0, type = null, abilityKey = null, origin = null }) {
  const level = catalog?.stats?.level ?? catalog?.rollData?.details?.level ?? 1;
  const w = rule.make({ level, slot, type, catalog, origin });
  return {
    label: rule.name,
    source: rule.source === 'spell' ? 'spell' : 'feature',
    duration: rule.lasts ?? 'manual',
    ...(rule.rounds ? { maxRounds: rule.rounds } : {}),
    notes: [attack ? `${rule.name}: ${attack.name}` : rule.name],
    effects: [],
    weapon: { ...w, uid: attack?.uid ?? null, ...(w.ability === 'spell' ? { abilityKey } : {}), ...(rule.note ? { note: typeof rule.note === 'function' ? rule.note({ level, mod: 0 }) : rule.note } : {}) },
  };
}

/** O ataque com o estado aplicado (atributo, dado, bônus, dano extra, tipos, mágico). */
export function applyWeaponState(attack, w, catalog, label = null) {
  const mods = catalog?.rollData?.abilities ?? {};
  const want = w.ability === 'spell' ? w.abilityKey : w.ability;
  const own = mods[attack.ability]?.mod ?? 0;
  const next = want ? mods[want]?.mod ?? 0 : own;
  const swap = want && want !== attack.ability && (w.always || next > own);
  const ability = swap ? want : attack.ability;
  const mod = swap ? next : own;
  const parts = (attack.toHit?.parts ?? []).map((p, i) => (i === 0 && swap ? { label: ABILITY_LABEL[ability] ?? ability, formula: mod } : p));
  if (w.bonus) parts.push({ label: label ?? 'Magic', formula: w.bonus });
  if (w.attackBonus) parts.push({ label: label ?? 'Bonus', formula: w.attackBonus });
  const total = parts.reduce((s, p) => s + (Number(p.formula) || 0), 0);
  const d = attack.damage;
  const damage = d ? {
    ...d,
    ...(w.die ? { dice: w.die } : {}),
    bonus: (d.bonus ?? 0) - own + mod + (w.bonus ?? 0),
    ...(w.extra ? { extra: [...(d.extra ?? []), w.extra] } : {}),
    ...(w.typeOptions ? { typeOptions: [...new Set([...(d.typeOptions ?? d.types ?? []), ...w.typeOptions])] } : {}),
  } : null;
  return { ...attack, ability, toHit: { total, parts }, damage, ...(w.magical ? { magical: true } : {}), ...(w.note ? { note: w.note } : {}) };
}

/** O catálogo com os ataques mudados pelos estados de arma e os criados (Shadow Blade). */
export function withWeaponStates(catalog, modifiers) {
  const states = (modifiers ?? []).filter((m) => m.weapon);
  if (!states.length) return catalog;
  let attacks = [...(catalog.attacks ?? [])];
  const prof = catalog?.stats?.profBonus ?? 0;
  const mods = catalog?.rollData?.abilities ?? {};
  for (const m of states) {
    const w = m.weapon;
    if (w.create) {
      const str = mods.str?.mod ?? 0;
      const dex = mods.dex?.mod ?? 0;
      const ability = dex > str ? 'dex' : 'str';
      const mod = Math.max(str, dex);
      const sp = w.create.spell;
      attacks = [{
        key: `created:${norm(w.create.name).replace(/[^a-z0-9]+/g, '-')}`,
        kind: sp ? 'created' : 'weapon', name: w.create.name, uid: null, range: w.create.ranged ? 'ranged' : 'melee', category: 'simple', equipped: true, ability, proficient: true,
        toHit: sp ? { total: sp.toHit, parts: [{ label: 'Spell attack', formula: sp.toHit }] } : { total: mod + prof, parts: [{ label: ABILITY_LABEL[ability], formula: mod }, { label: 'Proficiency', formula: prof }] },
        damage: { dice: w.create.dice, bonus: sp ? sp.bonus : mod, types: [w.create.type] },
        versatile: null, properties: w.create.properties ?? [], mastery: null, thrown: (w.create.properties ?? []).includes('T'), ammunition: false, ammoType: null,
        distance: w.create.distance ?? null, magical: true, ...(w.note ? { note: w.note } : {}),
      }, ...attacks];
      continue;
    }
    attacks = attacks.map((a) => (a.uid && a.uid === w.uid ? { ...applyWeaponState(a, w, catalog, m.label), name: a.name.includes(`(${m.label})`) ? a.name : `${a.name} (${m.label})` } : a));
  }
  return { ...catalog, attacks };
}

/** O ataque do lançamento de um STRIKE (True Strike, Booming Blade, Green-Flame Blade). */
export function strikeAttack(attack, rule, catalog, abilityKey = null) {
  const level = catalog?.stats?.level ?? catalog?.rollData?.details?.level ?? 1;
  const w = rule.make({ level, catalog });
  const mod = abilityKey ? catalog?.rollData?.abilities?.[abilityKey]?.mod ?? 0 : 0;
  const note = typeof rule.note === 'function' ? rule.note({ level, mod }) : rule.note ?? null;
  const out = applyWeaponState(attack, { ...w, ...(w.ability === 'spell' ? { abilityKey } : {}), ...(note ? { note } : {}) }, catalog, rule.name);
  return { ...out, key: `${attack.key}#${norm(rule.name).replace(/[^a-z0-9]+/g, '-')}`, name: `${rule.name}: ${attack.name}`, strike: rule.name };
}

/** O efeito do Blessing of the Forge na armadura: +1 de CA até o descanso longo. */
export function armorBlessing(name) {
  return { label: name, source: 'feature', duration: 'longRest', ac: 1, notes: [`${name}: +1 AC from the blessed armor (nonmagical, until your next Long Rest)`], effects: [] };
}

/** A lista de ataques com a variante do Cleave: a segunda criatura, sem o modificador positivo no dano. */
export function withMasteryAttacks(catalog) {
  const mods = catalog?.rollData?.abilities ?? {};
  const out = [];
  for (const a of catalog?.attacks ?? []) {
    out.push(a);
    if (norm(a.mastery) !== 'cleave' || !a.damage) continue;
    const mod = mods[a.ability]?.mod ?? 0;
    out.push({ ...a, key: `${a.key}#cleave`, name: `${a.name} (Cleave)`, mastery: null, cleave: true, damage: { ...a.damage, bonus: (a.damage.bonus ?? 0) - Math.max(0, mod) }, note: 'Cleave: a second creature within 5 feet of the first and within your reach; the same attack roll is not reused, roll again; once per turn' });
  }
  return { ...catalog, attacks: out };
}

export const MASTERY_TEXT = {
  cleave: () => 'Cleave: hit a second creature within 5 feet of the first and within your reach with the same roll; no ability modifier on its damage (once per turn)',
  graze: ({ mod, type }) => `Graze: on a miss, the target takes ${Math.max(0, mod)} ${type} damage`,
  nick: () => 'Nick: the extra attack of the Light property is part of the Attack action, not a Bonus Action (once per turn)',
  push: () => 'Push: on a hit, push a Large or smaller creature up to 10 feet away',
  sap: () => 'Sap: on a hit, the target has Disadvantage on its next attack roll before your next turn',
  slow: () => 'Slow: on a hit with damage, the target\'s Speed drops by 10 feet until your next turn',
  topple: ({ dc }) => `Topple: on a hit, the target makes a DC ${dc} Constitution save or has the Prone condition`,
  vex: () => 'Vex: on a hit with damage, you have Advantage on your next attack roll against that creature before the end of your next turn',
};

/** A nota da Weapon Mastery do ataque, com o dano do Graze e a CD do Topple, ou null. */
export function masteryNote(attack, catalog) {
  const key = norm(attack?.mastery);
  const text = MASTERY_TEXT[key];
  if (!text) return null;
  const mod = catalog?.rollData?.abilities?.[attack.ability]?.mod ?? 0;
  const prof = catalog?.stats?.profBonus ?? 0;
  return text({ mod, dc: 8 + mod + prof, type: (attack.damage?.types ?? [])[0] ?? 'weapon' });
}
