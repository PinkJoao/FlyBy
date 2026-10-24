// =============================================================================
// playCatalog: tudo o que o personagem pode fazer e gastar, estruturado
// =============================================================================
// O QUE FAZ
//   A derivação pura que o play mode lê (docs/PLAY-MODE-PLAN.md 3.4) e que a
//   ficha PDF também usa: uma fonte só para a mesa e para o papel.
//   derivePlayCatalog(character, db) devolve:
//     rollData   os dados das fórmulas (`@abilities.str.mod`, `@prof`,
//                `@classes.x.levels`, `@scale.x.y`), para o engine/dice
//     stats      CA (e as peças dela), HP máximo, PB, nível, iniciativa, deslocamento
//                a pé e todos os deslocamentos da espécie (voo, natação...)
//     checks     atributos, saves, perícias, iniciativa, morte, concentração; cada
//                teste com as PARTES do bônus (atributo, proficiência, item), que
//                o engine/playChecks separa em fixo e condicional
//     defenses   resistências, imunidades e vulnerabilidades a dano (com as de item)
//     features   o nome (minúsculo) de toda feature do ator, para as passivas
//     attacks    armas, ataque desarmado e cantrips de ataque ou salvaguarda
//     actions    as ações básicas e as das features, com custo e consumo
//     resources  dados de vida, slots, pacto, pools de feature, cargas de item
//                (engine/playInventory) e usos de magia
//                concedida, com máximo e recuperação
//     spells     por origem, com DC, ataque, preparo, ritual, concentração e a
//                mecânica (ataque, save, dano, cura, upcast)
//     problems   o que não deu para resolver (o survey cobra zero)
//
// FUNÇÕES
//   Texto e números
//     slug(s), norm(s), propCodes(raw): auxiliares de texto.
//     recoveryText(recovery): "Long Rest, 1 on Short Rest".
//     evalUses(formula, ctx): o número de um `uses.max`, ou null.
//   Ficha
//     initiativeBonus(character, derived): DES, mais o PB com o Alert.
//     hitDiceByFace(derived): os dados de vida agregados por face.
//     weaponProficient(entry, weaponProfs), weaponAttacks(character, derived): as
//       armas do inventário, equipadas primeiro.
//     unarmedStrike(derived): o ataque desarmado.
//     scaledDice(raw, level), textDice(raw), textHealDice(raw), upcastDice(raw),
//       spellMechanics(raw, level): a mecânica de uma magia pelo dado.
//     cantripAttacks(spellcasting, level): os cantrips que atacam ou pedem save.
//   Ator em memória
//     safeActor(character, db): o ator montado, ou null se a montagem falhar.
//     scaleSteps(actor, totalLevel): o degrau de cada ScaleValue no nível do dono.
//     scaleValues(actor, totalLevel): as ScaleValues numéricas (pools).
//     scaleRollData(actor, totalLevel): as ScaleValues para as fórmulas.
//     usesContext(actor, derived): o contexto do evalUses.
//     actorResources(actor, derived, problems): os pools de feature.
//     partFormula(part): a fórmula de uma parte de dano ou cura do Foundry.
//     normActivation(a): o custo normalizado, ou null (passiva).
//     poolOfItemNamed(name, ctx): o pool do item com esse nome.
//     consumptionOf(a, item, ctx): o que uma activity gasta.
//     saveDcOf(a, ctx): a CD de uma activity de save.
//     featureActions(actor, ctx): as ações básicas e das features.
//   Catálogo
//     defensesOf(derived): as defesas a dano, com as de item.
//     speedOf(character, db): o deslocamento a pé da espécie.
//     speedsOf(character, db): todos os deslocamentos da espécie, em pés.
//     spellRollData(spellcasting): os slots como dados de fórmula.
//     buildRollData(character, derived, actor): os dados das fórmulas.
//     checkList(derived, character): os testes.
//     spellResources(spellcasting), spellOrigins(spellcasting, level): magias.
//     derivePlayCatalog(character, db, opts): o catálogo.
//
// DECISÕES E ARMADILHAS
//   Fonte da mecânica (DDL-0108)
//   - As features vêm do ATOR montado em memória (`assembleFoundryActor`), como o
//     PDF já fazia: `system.uses` (máximo e recuperação, do registro curado, do
//     SRD, do overlay e da prosa) e as `activities` (custo, consumo, fórmulas).
//     Nada sai do app. Montagem que falha não derruba o catálogo: sem ator, as
//     features ficam de fora e o problema é registrado.
//   - As magias do ator não trazem activities (o Foundry as tira do compêndio),
//     então a mecânica delas vem do dado do 5etools: `spellAttack`,
//     `savingThrow`, `damageInflict`, o `{@damage}` do texto, a escala do
//     cantrip e o `{@scaledamage}`/`{@scaledice}` do upcast.
//   - As armas vêm do inventário DERIVADO (o mesmo da ficha), com números já
//     resolvidos; o ataque desarmado é 1 + FOR de concussão com o PB (2024).
//   Chaves (as do engine/playState)
//   - `pool:<identifier>` para o pool do item; `pool:<identifier>:<activity>`
//     quando o SRD guarda o pool na ACTIVITY (Natural Recovery, DDL-0106).
//     `hd:d<faces>`, `slot:<círculo>`, `pact`, `granted:<origem>|<magia>`.
//   - Consumo `itemUses`: alvo vazio é o pool do próprio item (ou da activity);
//     `feat:<identifier>` é o pool de outro item (a forma do nosso
//     foundryActivities, CHANNEL_DIVINITY_POOL), e sem pool exato vale o pool cujo
//     identifier é PREFIXO (`channel-divinity-paladin` cai em `channel-divinity`);
//     um uuid de compêndio é o item cujo `_stats.compendiumSource` é ele. O overlay
//     também escreve o alvo como OBJETO (TC-0097): `{ prop, uid }` aponta a feature
//     pelo nome no começo do uid; `{ consumes: { name } }` aponta pelo nome do item
//     ou, quando o nome é o do RECURSO, pelo CONSUMES_BY_NAME ("Sorcery Point" é o
//     pool do Font of Magic). Alvo que não resolve é PROBLEMA.
//   - Consumo de outro tipo vai cru, sem chave, para a fase que o interpreta:
//     `attribute` (o Magical Cunning DEVOLVE slots de pacto), `hitDice` (Durable),
//     `spellSlots` (Font of Magic, Wild Companion).
//   Regras
//   - evalUses mantém a régua do PDF: só troca @scale, @abilities, @prof,
//     @classes e @details.level, e fórmula com o que não resolve dá null (nunca
//     um número inventado). Pool com máximo null é problema; com máximo 0 (mod
//     negativo sem piso) fica de fora em silêncio, como no PDF.
//   - ScaleValue de DADO ("3d6") entra no rollData como fórmula, com `.number`,
//     `.faces` e `.die` ("d6") em chaves planas; o evalUses vê a contagem pela
//     chave nua, como antes, e aceita `.number`/`.faces` (o Psi Warrior conta os
//     dados assim). Sem `identifier`, a chave é o slug do TÍTULO, como no dnd5e
//     (Divine Spark, Cantrips Known), e o explícito ganha do slug quando colidem
//     ("Channel Divinity Uses" e a coluna "Channel Divinity"). Cada escala também
//     responde pelo slug do NOME do item dono: o overlay cita
//     `@scale.college-of-whispers.psychic-blades` e o nosso identifier é
//     `whispers`. O degrau `{ n, die }` do overlay é lido como número e faces.
//     Resolver mais escalas pode fazer o PDF ganhar pools que antes caíam fora.
//   - `@mod` de uma activity de ataque é o modificador do atributo dela (ou o maior
//     de FOR e DES); `@scaling` (quanto se gasta, escolhido na hora: Lay on Hands,
//     Healing Light) vale 1 na conferência e a activity sai marcada `scalable`;
//     `@attributes.hd.largestAvailable` e `smallestAvailable` são o dado de vida de
//     maior e de menor face (o estado de jogo afina isso na C3).
//   - CD de save `spellcasting` de uma feature usa a CD da origem de classe com
//     o maior valor (o Foundry usa o atributo de conjuração do ator); CD por
//     atributo é 8 + PB + mod. Sem origem conjuradora, a CD é null e vira problema.
//   - A activity diz se o alvo é o PRÓPRIO personagem (`selfTarget`): a cura de um
//     Second Wind se aplica sozinha; a de um Lay on Hands, a tela pergunta. A cura
//     de magia soma o modificador quando a prosa diz "spellcasting ability
//     modifier" (`heal.addMod`, Cure Wounds). O rollData traz os slots
//     (`@spells.pact.max`), que o Magical Cunning cita para devolver o pacto.
//   - Activity sem custo (`activation.type` vazio) é PASSIVA ou gatilho de outra
//     coisa (Disciple of Life soma na cura de magia): fica fora das ações.
//   - Recuperação da magia concedida segue o RECOVERY_PERIOD do foundrySpells:
//     `daily` é `day` (o play mode a recupera no descanso longo), `rest` é `sr`,
//     `restLong` é `lr`. `innate` sem frequência não ganha contador (carga).
//     Mystic Arcanum é 1 por descanso longo.
//   - Iniciativa: Destreza, mais o PB com o Alert (o 2024 dá "Initiative
//     Proficiency"); a mesma conta que o PDF fazia.
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { deriveFromDb, resolveRaceObj } from './resolve';
import { parseSpecies } from './speciesData';
import { assembleFoundryActor } from './foundryActor';
import { isBasicActionItem } from './foundryBasicActions';
import { rangeLabel, isRitual, isConcentration } from './spells';
import { SKILL_ABILITY } from './proficiency';
import { validateFormula } from './dice';
import { roundsOf } from './playCombat';
import { chargeResources } from './playInventory';

export const DAMAGE_NAME = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning',
  N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

const PERIOD = {
  lr: 'Long Rest', sr: 'Short Rest', day: 'Dawn', dawn: 'Dawn', dusk: 'Dusk',
  turn: 'Turn', round: 'Round', initiative: 'Initiative',
};

const GRANTED_RECOVERY = { daily: 'day', rest: 'sr', restLong: 'lr' };

// ATENÇÃO: o nome que o overlay põe em `consumes`, para o identifier do pool; confira contra o survey.
const CONSUMES_BY_NAME = {
  'focus point': "Monk's Focus",
  'sorcery point': 'Font of Magic',
  'superiority die': 'Combat Superiority',
};

const slug = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => String(s ?? '').trim().toLowerCase();
const propCodes = (raw) =>
  (raw?.property ?? []).map((p) => String(typeof p === 'string' ? p : p?.uid ?? '').split('|')[0]);

/** A recuperação de um pool ("Long Rest, 1 on Short Rest"). */
export function recoveryText(recovery) {
  const list = recovery ?? [];
  const all = list.filter((r) => r.type === 'recoverAll').map((r) => PERIOD[r.period] ?? r.period);
  const partial = list
    .filter((r) => r.type === 'formula' && r.formula)
    .map((r) => `${r.formula} on ${PERIOD[r.period] ?? r.period}`);
  return [all.join(' or '), ...partial].filter(Boolean).join(', ');
}

/**
 * O número de uma fórmula de `uses.max` do Foundry, ou null se ela citar algo
 * que a ficha não sabe resolver.
 */
export function evalUses(formula, { scales = {}, mods = {}, prof = 0, classLevels = {}, level = 0 } = {}) {
  let unresolved = false;
  const expr = String(formula ?? '')
    .replace(/@scale\.([\w-]+\.[\w-]+(?:\.(?:number|faces)\b)?)/g, (_, k) => (k in scales ? String(scales[k]) : ((unresolved = true), '0')))
    .replace(/@abilities\.(\w+)\.mod/g, (_, a) => (a in mods ? String(mods[a]) : ((unresolved = true), '0')))
    .replace(/@classes\.([\w-]+)\.levels/g, (_, c) => String(classLevels[c] ?? 0))
    .replace(/@details\.level/g, String(level))
    .replace(/@prof/g, String(prof));
  if (unresolved || /@/.test(expr)) return null;
  const bare = expr.replace(/\b(max|min|floor|ceil|round)\b/g, '');
  if (!/^[\d\s+\-*/().,]*$/.test(bare) || !expr.trim()) return null;
  try {
    const value = new Function('max', 'min', 'floor', 'ceil', 'round', `return (${expr});`)(
      Math.max, Math.min, Math.floor, Math.ceil, Math.round,
    );
    return Number.isFinite(value) ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

/** Iniciativa: DES, mais o PB com o Alert. */
export function initiativeBonus(character, derived) {
  const hasAlert = norm(character.origin?.originFeat?.id).startsWith('alert')
    || (character.classes ?? []).some((c) => Object.values(c.choices ?? {}).some((e) => e?.kind === 'feat' && (e.picks ?? []).some((p) => norm(p).startsWith('alert|'))));
  return (derived.modifiers?.dex ?? 0) + (hasAlert ? derived.proficiencyBonus ?? 0 : 0);
}

/** Os dados de vida por face, da maior para a menor ([{ faces: 10, count: 3 }]). */
export function hitDiceByFace(derived) {
  const count = {};
  for (const c of derived.classBreakdown ?? []) {
    if (c.hitDie) count[c.hitDie] = (count[c.hitDie] ?? 0) + c.level;
  }
  return Object.keys(count).map(Number).sort((a, b) => b - a).map((faces) => ({ faces, count: count[faces] }));
}

/** O personagem é proficiente com a arma? */
function weaponProficient(entry, weaponProfs) {
  const profs = (weaponProfs ?? []).map((w) => w.toLowerCase());
  const cat = entry.category ? `${entry.category} weapons`.toLowerCase() : null;
  const name = (entry.raw?.name ?? '').toLowerCase();
  return profs.some((p) => p === cat || p === name || p === `${name}s`);
}

/** As armas do inventário como ataques estruturados, equipadas primeiro. */
export function weaponAttacks(character, derived) {
  const weapons = (derived.inventory ?? []).filter((e) => e.group === 'weapon' && e.raw);
  weapons.sort((a, b) => (b.equipped === true) - (a.equipped === true));

  const masteryPicks = new Set();
  for (const cls of character.classes ?? []) {
    for (const entry of Object.values(cls.choices ?? {})) {
      if (entry?.kind !== 'weapon') continue;
      for (const p of entry.picks ?? []) masteryPicks.add(String(p).split('|')[0].toLowerCase());
    }
  }

  return weapons.map((e) => {
    const raw = e.raw;
    const props = propCodes(raw);
    const finesse = props.includes('F');
    const { str = 0, dex = 0 } = derived.modifiers ?? {};
    const ability = e.kind === 'ranged' ? 'dex' : finesse && dex > str ? 'dex' : 'str';
    const mod = ability === 'dex' ? dex : str;
    const magic = Number(raw.bonusWeapon ?? 0) || 0;
    const proficient = weaponProficient(e, derived.weapons);
    const prof = proficient ? derived.proficiencyBonus : 0;
    const toHitParts = [
      { label: ability === 'dex' ? 'Dexterity' : 'Strength', formula: mod },
      ...(prof ? [{ label: 'Proficiency', formula: prof }] : []),
      ...(magic ? [{ label: 'Magic', formula: magic }] : []),
    ];
    const mastery = masteryPicks.has(raw.name.toLowerCase()) && raw.mastery?.length
      ? String(raw.mastery[0]).split('|')[0]
      : null;
    return {
      key: `weapon:${e.uid ?? slug(raw.name)}`,
      kind: 'weapon',
      name: raw.name,
      uid: e.uid ?? null,
      range: e.kind === 'ranged' ? 'ranged' : 'melee',
      equipped: e.equipped === true,
      ability,
      proficient,
      toHit: { total: mod + magic + prof, parts: toHitParts },
      damage: raw.dmg1
        ? { dice: raw.dmg1, bonus: mod + magic, types: [DAMAGE_NAME[raw.dmgType] ?? raw.dmgType ?? ''].filter(Boolean) }
        : null,
      versatile: raw.dmg2 ?? null,
      properties: props,
      mastery,
      thrown: props.includes('T'),
      ammunition: props.includes('A') || props.includes('AF'),
      ammoType: raw.ammoType ?? null,
      distance: raw.range ?? null,
    };
  });
}

/** O ataque desarmado (2024): 1 + FOR de concussão, com o PB. */
export function unarmedStrike(derived) {
  const str = derived.modifiers?.str ?? 0;
  const prof = derived.proficiencyBonus ?? 0;
  return {
    key: 'unarmed',
    kind: 'unarmed',
    name: 'Unarmed Strike',
    range: 'melee',
    equipped: true,
    ability: 'str',
    proficient: true,
    toHit: { total: str + prof, parts: [{ label: 'Strength', formula: str }, { label: 'Proficiency', formula: prof }] },
    damage: { dice: null, bonus: 1 + str, types: ['bludgeoning'] },
    versatile: null,
    properties: [],
    mastery: null,
    thrown: false,
    ammunition: false,
    distance: null,
  };
}

/** O dado de um cantrip no nível do personagem ("2d10"). */
function scaledDice(raw, level) {
  const list = Array.isArray(raw?.scalingLevelDice) ? raw.scalingLevelDice : raw?.scalingLevelDice ? [raw.scalingLevelDice] : [];
  const scaling = list[0]?.scaling;
  if (!scaling) return null;
  const steps = Object.keys(scaling).map(Number).filter((n) => n <= level).sort((a, b) => b - a);
  return steps.length ? scaling[steps[0]] : null;
}

/** O primeiro dado de dano citado no texto ({@damage 1d10}). */
function textDice(raw) {
  return JSON.stringify(raw?.entries ?? []).match(/\{@damage ([^}|]+)/)?.[1] ?? null;
}

/** O primeiro dado de cura citado no texto ({@dice 2d8}). */
function textHealDice(raw) {
  return JSON.stringify(raw?.entries ?? []).match(/\{@dice ([^}|]+)/)?.[1] ?? null;
}

/** O dado somado por círculo acima do base ({@scaledamage 8d6|3-9|1d6} dá "1d6"). */
function upcastDice(raw) {
  return JSON.stringify(raw?.entriesHigherLevel ?? []).match(/\{@scale(?:damage|dice) [^|}]+\|[^|}]+\|([^|}]+)\}/)?.[1] ?? null;
}

/** A mecânica de uma magia pelo dado do 5etools. */
export function spellMechanics(raw, level) {
  const types = raw?.damageInflict ?? [];
  const dice = raw?.level === 0 ? scaledDice(raw, level) ?? textDice(raw) : textDice(raw);
  const healing = (raw?.miscTags ?? []).includes('HL') ? textHealDice(raw) : null;
  const addMod = /spellcasting ability modifier/i.test(JSON.stringify(raw?.entries ?? []));
  return {
    attack: raw?.spellAttack?.[0] ?? null,
    save: raw?.savingThrow?.[0] ? raw.savingThrow[0].slice(0, 3) : null,
    damage: types.length ? { dice, types } : null,
    heal: healing ? { dice: healing, addMod } : null,
    upcast: raw?.level > 0 ? upcastDice(raw) : null,
  };
}

/** Os cantrips que atacam ou pedem salvaguarda e causam dano. */
export function cantripAttacks(spellcasting, level) {
  const out = [];
  const seen = new Set();
  for (const origin of spellcasting?.origins ?? []) {
    for (const s of [...(origin.cantrips ?? []), ...(origin.alwaysPrepared ?? [])]) {
      const raw = s.raw;
      if (!raw || raw.level !== 0 || seen.has(raw.name)) continue;
      const attack = raw.spellAttack?.length;
      const save = raw.savingThrow?.[0];
      if (!raw.damageInflict?.length || (!attack && !save)) continue;
      seen.add(raw.name);
      const originKey = origin.key ?? origin.uid ?? origin.label;
      out.push({
        key: `spell:${originKey}|${raw.name}`,
        kind: 'cantrip',
        name: raw.name,
        origin: originKey,
        attack: attack ? { bonus: origin.attackBonus ?? null } : null,
        save: attack ? null : { ability: save.slice(0, 3), dc: origin.saveDc ?? null },
        damage: { dice: scaledDice(raw, level) ?? textDice(raw) ?? '', types: raw.damageInflict },
        rangeText: rangeLabel(raw),
      });
    }
  }
  return out;
}

/** O ator montado em memória, ou null se a montagem falhar. */
export function safeActor(character, db) {
  try {
    return assembleFoundryActor(character, db);
  } catch {
    return null;
  }
}

/** O nível de cada classe e dono de ScaleValue no ator. */
function scaleSteps(actor, totalLevel) {
  const items = actor?.items ?? [];
  const classLevel = Object.fromEntries(
    items.filter((i) => i.type === 'class').map((i) => [i.system?.identifier, i.system?.levels ?? 0]),
  );
  const explicit = [];
  const fallback = [];
  for (const it of items) {
    if (!['class', 'subclass', 'race'].includes(it.type)) continue;
    const level = it.type === 'class'
      ? classLevel[it.system?.identifier]
      : it.type === 'subclass' ? classLevel[it.system?.classIdentifier] : totalLevel;
    const owners = [...new Set([it.system?.identifier, slug(it.name)].filter(Boolean))];
    for (const a of Object.values(it.system?.advancement ?? {})) {
      if (a?.type !== 'ScaleValue') continue;
      const id = a.configuration?.identifier || slug(a.title);
      if (!id) continue;
      const steps = Object.keys(a.configuration?.scale ?? {}).map(Number).filter((n) => n <= (level ?? 0)).sort((x, y) => y - x);
      const raw = steps.length ? a.configuration.scale[steps[0]] : null;
      if (!raw) continue;
      const step = raw.die != null && raw.faces == null ? { number: raw.n ?? 1, faces: raw.die } : raw;
      for (const owner of owners) (a.configuration?.identifier ? explicit : fallback).push({ key: `${owner}.${id}`, step });
    }
  }
  const taken = new Set(explicit.map((s) => s.key));
  return [...explicit, ...fallback.filter((s) => !taken.has(s.key))];
}

/** O valor de cada ScaleValue do ator no nível dele ("cleric.channel-divinity"). */
export function scaleValues(actor, totalLevel) {
  const out = {};
  for (const { key, step } of scaleSteps(actor, totalLevel)) {
    if (key in out) continue;
    const value = step.value ?? step.number;
    if (typeof value === 'number') out[key] = value;
    if (typeof step.faces === 'number') {
      out[`${key}.number`] = typeof step.number === 'number' ? step.number : 1;
      out[`${key}.faces`] = step.faces;
    }
  }
  return out;
}

/** As ScaleValues como dados de fórmula: dado vira "3d6", com `.number` e `.faces`. */
export function scaleRollData(actor, totalLevel) {
  const out = {};
  for (const { key, step } of scaleSteps(actor, totalLevel)) {
    if (`scale.${key}` in out) continue;
    if (typeof step.faces === 'number') {
      const number = typeof step.number === 'number' ? step.number : 1;
      out[`scale.${key}`] = `${number}d${step.faces}`;
      out[`scale.${key}.number`] = number;
      out[`scale.${key}.faces`] = step.faces;
      out[`scale.${key}.die`] = `d${step.faces}`;
    } else if (typeof (step.value ?? step.number) === 'number') {
      out[`scale.${key}`] = step.value ?? step.number;
    } else if (typeof step.value === 'string' && step.value.trim()) {
      out[`scale.${key}`] = step.value;
    }
  }
  return out;
}

/** O contexto do evalUses a partir do ator e da derivação. */
function usesContext(actor, derived) {
  return {
    scales: scaleValues(actor, derived.level ?? 0),
    mods: derived.modifiers ?? {},
    prof: derived.proficiencyBonus ?? 0,
    classLevels: Object.fromEntries(
      (actor?.items ?? []).filter((i) => i.type === 'class').map((i) => [i.system?.identifier, i.system?.levels ?? 0]),
    ),
    level: derived.level ?? 0,
  };
}

/**
 * Os pools de feature do ator (o item, ou cada activity com pool próprio).
 * @returns {{ key: string, name: string, max: number, recovery: object[], kind: 'pool' }[]}
 */
export function actorResources(actor, derived, problems = []) {
  const ctx = usesContext(actor, derived);
  const out = [];
  const seen = new Set();
  const add = (key, name, uses, item) => {
    if (seen.has(key)) return;
    seen.add(key);
    const max = evalUses(uses.max, ctx);
    if (max == null) {
      problems.push({ where: name, message: `pool max does not resolve: ${uses.max}` });
      return;
    }
    if (max > 0) out.push({ key, kind: 'pool', name, max, recovery: uses.recovery ?? [], item: item.name });
  };
  for (const it of actor?.items ?? []) {
    if (it.type !== 'feat' || isBasicActionItem(it)) continue;
    const ident = it.system?.identifier || slug(it.name);
    if (it.system?.uses?.max) {
      add(`pool:${ident}`, it.name, it.system.uses, it);
      continue;
    }
    const pooled = Object.values(it.system?.activities ?? {}).filter((a) => a?.uses?.max);
    for (const a of pooled) add(`pool:${ident}:${slug(a.name)}`, pooled.length > 1 ? `${it.name}: ${a.name}` : it.name, a.uses, it);
  }
  return out;
}

/** A fórmula de uma parte de dano ou cura do Foundry. */
function partFormula(part) {
  if (part?.custom?.enabled && part.custom.formula) return String(part.custom.formula).trim();
  const dice = part?.number && part?.denomination ? `${part.number}d${part.denomination}` : '';
  const bonus = String(part?.bonus ?? '').trim();
  return [dice, bonus].filter(Boolean).join(' + ');
}

/** O custo normalizado de uma activity, ou null se ela é passiva. */
function normActivation(a) {
  const type = a?.activation?.type;
  if (!type) return null;
  return {
    type,
    value: a.activation.value ?? null,
    condition: a.activation.condition || '',
  };
}

/** O pool do item do ator com esse nome (sem caixa), ou null. */
function poolOfItemNamed(name, ctx) {
  const item = (ctx.actor?.items ?? []).find((i) => i.type === 'feat' && norm(i.name) === norm(name));
  const key = item ? `pool:${item.system?.identifier || slug(item.name)}` : null;
  return key && ctx.poolKeys.has(key) ? key : null;
}

/** O que uma activity gasta, em chaves de pool. */
function consumptionOf(a, item, ctx) {
  const ident = item.system?.identifier || slug(item.name);
  const ownPool = item.system?.uses?.max ? `pool:${ident}` : a.uses?.max ? `pool:${ident}:${slug(a.name)}` : null;
  const out = [];
  for (const t of a.consumption?.targets ?? []) {
    const amount = Number.parseInt(t.value, 10) || 1;
    let key = null;
    if (t.type === 'attribute') {
      out.push({ attribute: String(t.target ?? ''), formula: String(t.value ?? '') });
      continue;
    }
    if (t.type === 'hitDice' || t.type === 'spellSlots') {
      out.push({ [t.type === 'hitDice' ? 'hitDice' : 'spellSlot']: String(t.target ?? ''), formula: String(t.value ?? '1') });
      continue;
    }
    if (t.type === 'itemUses') {
      const target = t.target ?? '';
      if (target && typeof target === 'object') {
        const name = target.uid ? String(target.uid).split('|')[0] : CONSUMES_BY_NAME[norm(target.consumes?.name)] ?? target.consumes?.name;
        key = poolOfItemNamed(name, ctx);
      } else if (!target) {
        key = ownPool;
      } else if (String(target).startsWith('feat:')) {
        const wanted = String(target).slice(5);
        key = ctx.poolKeys.has(`pool:${wanted}`)
          ? `pool:${wanted}`
          : [...ctx.poolKeys].filter((k) => wanted.startsWith(`${k.slice(5)}-`)).sort((x, y) => y.length - x.length)[0] ?? null;
      } else {
        const other = (ctx.actor?.items ?? []).find((i) => i._stats?.compendiumSource === target);
        if (other) key = `pool:${other.system?.identifier || slug(other.name)}`;
      }
    } else if (t.type === 'activityUses') {
      key = a.uses?.max ? `pool:${ident}:${slug(a.name)}` : null;
    } else {
      ctx.problems.push({ where: item.name, message: `consumption type not handled: ${t.type}` });
      continue;
    }
    if (!key || !ctx.poolKeys.has(key)) {
      const shown = typeof t.target === 'object' ? JSON.stringify(t.target) : t.target ?? '';
      ctx.problems.push({ where: item.name, message: `consumption target does not resolve: ${t.type} ${shown}`.trim() });
      continue;
    }
    out.push({ key, amount });
  }
  return out;
}

/** A CD de uma activity de save. */
function saveDcOf(a, ctx) {
  const calc = a.save?.dc?.calculation;
  if (calc && calc !== 'spellcasting' && ABILITIES.includes(calc)) {
    return 8 + (ctx.derived.proficiencyBonus ?? 0) + (ctx.derived.modifiers?.[calc] ?? 0);
  }
  if (!calc && a.save?.dc?.formula) return Number.parseInt(a.save.dc.formula, 10) || null;
  return ctx.spellDc;
}

/** As ações básicas e das features, com custo, consumo e fórmulas. */
function featureActions(actor, ctx) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== 'feat') continue;
    const basic = isBasicActionItem(item);
    const ident = item.system?.identifier || slug(item.name);
    const activities = [];
    for (const a of Object.values(item.system?.activities ?? {})) {
      const activation = normActivation(a);
      if (!activation) continue;
      const mods = ctx.derived.modifiers ?? {};
      const attackAbility = a.type === 'attack'
        ? a.attack?.ability || ((mods.dex ?? 0) > (mods.str ?? 0) ? 'dex' : 'str')
        : null;
      const entry = {
        id: a._id ?? slug(a.name),
        type: a.type,
        name: a.name || item.name,
        activation,
        consumes: basic ? [] : consumptionOf(a, item, ctx),
        attack: a.type === 'attack' ? { type: a.attack?.type?.value ?? null, ability: attackAbility } : null,
        save: a.type === 'save' ? { abilities: a.save?.ability ?? [], dc: saveDcOf(a, ctx) } : null,
        heal: a.type === 'heal' && partFormula(a.healing) ? { formula: partFormula(a.healing), types: a.healing?.types ?? [] } : null,
        damage: (a.damage?.parts ?? []).map((p) => ({ formula: partFormula(p), types: p.types ?? [] })).filter((p) => p.formula),
        selfTarget: a.target?.affects?.type === 'self',
      };
      entry.scalable = [entry.heal?.formula, ...entry.damage.map((p) => p.formula)].some((f) => /@scaling\b/.test(f ?? ''));
      const data = attackAbility ? { ...ctx.rollData, mod: mods[attackAbility] ?? 0 } : ctx.rollData;
      for (const f of [entry.heal?.formula, ...entry.damage.map((p) => p.formula)].filter(Boolean)) {
        const error = validateFormula(f, data);
        if (error) ctx.problems.push({ where: `${item.name}: ${entry.name}`, message: `formula: ${f} (${error})` });
      }
      if (entry.save && entry.save.dc == null) ctx.problems.push({ where: `${item.name}: ${entry.name}`, message: 'save DC has no spellcasting origin' });
      activities.push(entry);
    }
    if (!activities.length) continue;
    out.push({
      key: `action:${ident}`,
      name: item.name,
      group: basic ? 'basic' : item.system?.type?.value || 'feature',
      subtype: item.system?.type?.subtype || null,
      pool: item.system?.uses?.max && ctx.poolKeys.has(`pool:${ident}`) ? `pool:${ident}` : null,
      activities,
    });
  }
  return out;
}

/** Resistências, imunidades e vulnerabilidades a dano, juntando as de item. */
function defensesOf(derived) {
  const dt = derived.damageTraits ?? {};
  const join = (kind) => [...new Set([...(dt[kind] ?? []), ...(dt.fromItems?.[kind] ?? [])].map((v) => String(v).toLowerCase()))];
  return { resist: join('resist'), immune: join('immune'), vulnerable: join('vulnerable') };
}

/** Todos os deslocamentos da espécie: { walk: { feet }, fly: { feet, note } }. */
function speedsOf(character, db) {
  if (!db || !character.species) return {};
  const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
  const sp = parseSpecies(raceObj)?.speed ?? {};
  const walk = typeof sp.walk === 'number' ? sp.walk : 0;
  const out = {};
  for (const mode of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const v = sp[mode];
    if (v == null || v === false) continue;
    const feet = v === true ? walk : typeof v === 'object' ? Number(v.number) : Number(v);
    if (!Number.isFinite(feet) || feet <= 0) continue;
    const note = typeof v === 'object' && v.condition ? String(v.condition).replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1') : null;
    out[mode] = note ? { feet, note } : { feet };
  }
  return out;
}

/** O deslocamento a pé da espécie, ou null (sem db ou sem espécie). */
function speedOf(character, db) {
  if (!db || !character.species) return null;
  const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
  return parseSpecies(raceObj)?.speed?.walk ?? null;
}

/** Os slots como dados de fórmula (`@spells.pact.max`, `@spells.spell3.max`). */
function spellRollData(spellcasting) {
  const out = {};
  for (const [level, max] of Object.entries(spellcasting?.slots ?? {})) out[`spell${level}`] = { max, level: Number(level) };
  const pact = spellcasting?.pactSlots;
  if (pact?.slots) out.pact = { max: pact.slots, level: pact.level };
  return out;
}

/** Os dados das fórmulas do dice.js. */
function buildRollData(character, derived, actor) {
  const abilities = {};
  for (const a of ABILITIES) {
    abilities[a] = { value: derived.scores?.[a] ?? 10, mod: derived.modifiers?.[a] ?? 0, save: derived.saves?.[a] ?? 0 };
  }
  const classes = {};
  for (const c of character.classes ?? []) if (c.classId) classes[c.classId] = { levels: c.level };
  const faces = hitDiceByFace(derived).map((h) => h.faces);
  return {
    abilities,
    prof: derived.proficiencyBonus ?? 0,
    details: { level: derived.level ?? 0 },
    classes,
    attributes: faces.length
      ? { hd: { largestAvailable: `1d${faces[0]}`, smallestAvailable: `1d${faces[faces.length - 1]}` } }
      : {},
    scaling: 1,
    spells: spellRollData(derived.spellcasting),
    ...scaleRollData(actor, derived.level ?? 0),
  };
}

/** Os testes: atributos, saves, perícias, iniciativa, morte, concentração. */
function checkList(derived, character) {
  return {
    abilities: ABILITIES.map((ability) => {
      const mod = derived.modifiers?.[ability] ?? 0;
      const saveProf = (derived.proficientSaves ?? []).includes(ability);
      const items = (derived.itemSaveBonus?.sources ?? []).map((s) => ({ kind: 'item', label: s.name, value: s.value }));
      return {
        ability,
        score: derived.scores?.[ability] ?? 10,
        mod,
        save: derived.saves?.[ability] ?? 0,
        saveProf,
        checkParts: [{ kind: 'ability', ability, value: mod }],
        saveParts: [
          { kind: 'ability', ability, value: mod },
          ...(saveProf ? [{ kind: 'proficiency', level: 1, value: derived.proficiencyBonus ?? 0 }] : []),
          ...items,
        ],
      };
    }),
    skills: Object.entries(SKILL_ABILITY).map(([skill, ability]) => {
      const mod = derived.modifiers?.[ability] ?? 0;
      const bonus = derived.skills?.[skill]?.bonus ?? 0;
      const prof = derived.skills?.[skill]?.proficiency ?? 0;
      return {
        skill,
        ability,
        bonus,
        prof,
        parts: [{ kind: 'ability', ability, value: mod }, ...(prof ? [{ kind: 'proficiency', level: prof, value: bonus - mod }] : [])],
      };
    }),
    initiative: { bonus: initiativeBonus(character, derived) },
    deathSave: { bonus: 0 },
    concentration: { bonus: derived.saves?.con ?? 0 },
  };
}

/** Os recursos de magia: slots, pacto e usos de magia concedida e arcanum. */
function spellResources(spellcasting) {
  const out = [];
  for (const [level, max] of Object.entries(spellcasting?.slots ?? {})) {
    if (max > 0) out.push({ key: `slot:${level}`, kind: 'slot', name: `Level ${level} slots`, level: Number(level), max, recovery: [{ period: 'lr', type: 'recoverAll' }] });
  }
  const pact = spellcasting?.pactSlots;
  if (pact?.slots > 0) out.push({ key: 'pact', kind: 'pact', name: 'Pact slots', level: pact.level, max: pact.slots, recovery: [{ period: 'sr', type: 'recoverAll' }] });
  for (const origin of spellcasting?.origins ?? []) {
    for (const s of origin.alwaysPrepared ?? []) {
      const period = GRANTED_RECOVERY[s.castType];
      if (!period || !(s.uses > 0) || !s.raw) continue;
      out.push({ key: `granted:${origin.key}|${s.raw.name}`, kind: 'granted', name: s.raw.name, origin: origin.key, max: s.uses, recovery: [{ period, type: 'recoverAll' }] });
    }
    for (const s of origin.arcanumSpells ?? []) {
      if (!s.raw) continue;
      out.push({ key: `granted:${origin.key}|${s.raw.name}`, kind: 'granted', name: s.raw.name, origin: origin.key, max: 1, recovery: [{ period: 'lr', type: 'recoverAll' }] });
    }
  }
  return out;
}

/** As magias por origem, com a mecânica de cada uma. */
function spellOrigins(spellcasting, level) {
  return (spellcasting?.origins ?? []).map((o) => {
    const entry = (s, extra) => ({
      key: `spell:${o.key}|${s.raw.name}`,
      name: s.raw.name,
      source: s.raw.source ?? s.source ?? null,
      level: s.raw.level,
      ritual: isRitual(s.raw),
      concentration: isConcentration(s.raw),
      time: s.raw.time?.[0]?.unit ?? null,
      durationRounds: roundsOf(s.raw.duration),
      mechanics: spellMechanics(s.raw, level),
      ...extra,
    });
    const spells = [
      ...(o.cantrips ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, castType: null, uses: null })),
      ...(o.prepared ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, castType: null, uses: null })),
      ...(o.unprepared ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: false, castType: null, uses: null })),
      ...(o.alwaysPrepared ?? []).filter((s) => s.raw).map((s) => entry(s, {
        prepared: true,
        granted: true,
        castType: s.castType ?? null,
        castLevel: s.castLevel ?? null,
        uses: GRANTED_RECOVERY[s.castType] && s.uses > 0 ? `granted:${o.key}|${s.raw.name}` : null,
      })),
      ...(o.arcanumSpells ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, arcanum: true, castType: null, uses: `granted:${o.key}|${s.raw.name}` })),
    ];
    return {
      key: o.key,
      kind: o.kind,
      label: o.label,
      ability: o.ability ?? null,
      abilityMod: o.abilityMod ?? null,
      saveDc: o.saveDc ?? null,
      attackBonus: o.attackBonus ?? null,
      isPact: !!o.isPact,
      spells,
    };
  });
}

/**
 * O catálogo de jogo do personagem.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {{ derived?: object, actor?: object|null }} [opts] para reaproveitar o que o chamador já tem
 */
export function derivePlayCatalog(character, db, { derived = null, actor } = {}) {
  const d = derived ?? deriveFromDb(character, db);
  const a = actor === undefined ? safeActor(character, db) : actor;
  const problems = [];
  if (!a) problems.push({ where: 'actor', message: 'the in-memory actor could not be assembled; features are missing' });

  const rollData = buildRollData(character, d, a);
  const level = d.level || 1;
  const spellDcs = (d.spellcasting?.origins ?? []).filter((o) => o.kind === 'class' && o.saveDc != null).map((o) => o.saveDc);

  const pools = a ? actorResources(a, d, problems) : [];
  const resources = [
    ...hitDiceByFace(d).map((h) => ({ key: `hd:d${h.faces}`, kind: 'hitDice', name: `d${h.faces} Hit Dice`, faces: h.faces, max: h.count, recovery: [{ period: 'lr', type: 'recoverAll' }] })),
    ...spellResources(d.spellcasting),
    ...pools,
    ...chargeResources(d.inventory),
  ];
  const ctx = {
    actor: a,
    derived: d,
    rollData,
    problems,
    poolKeys: new Set(pools.map((p) => p.key)),
    spellDc: spellDcs.length ? Math.max(...spellDcs) : null,
  };

  const attacks = [
    ...weaponAttacks(character, d),
    unarmedStrike(d),
    ...cantripAttacks(d.spellcasting, level),
  ];
  for (const at of attacks) {
    if (at.kind === 'cantrip' ? !at.damage?.dice : at.kind === 'weapon' && !at.damage) {
      problems.push({ where: at.name, message: 'attack without a damage formula' });
    }
  }

  return {
    rollData,
    stats: {
      ac: d.armorClass?.total ?? null,
      acBreakdown: d.armorClass?.breakdown ?? [],
      hpMax: d.maxHp ?? 0,
      profBonus: d.proficiencyBonus ?? 0,
      level: d.level ?? 0,
      initiative: initiativeBonus(character, d),
      speed: speedOf(character, db),
      speeds: speedsOf(character, db),
    },
    checks: checkList(d, character),
    defenses: defensesOf(d),
    features: [...new Set((a?.items ?? []).filter((i) => i.type === 'feat').map((i) => norm(i.name)))],
    attacks,
    actions: a ? featureActions(a, ctx) : [],
    resources,
    spells: spellOrigins(d.spellcasting, level),
    problems,
  };
}
