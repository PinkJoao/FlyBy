// =============================================================================
// foundrySpellMechanics: as activities e os effects de cada magia no Foundry
// =============================================================================
// O QUE FAZ
//   Uma magia só ROLA no Foundry se o item tiver activities (o ataque do Guiding
//   Bolt, o save do Sacred Flame, a cura do Cure Wounds). Este módulo escolhe a
//   mecânica de uma magia na precedência de sempre: o SRD (o pack spells24 do
//   dnd5e, gerado em srdSpellActivitiesData), depois o overlay do 5etools
//   (`spells/foundry.json`), e por último a activity montada do dado ESTRUTURADO
//   do 5etools (ataque ou save, com o dano e a escala). Sem nada disso (as
//   invocações de criatura fora do compêndio) a magia sai sem activity, e o
//   Foundry põe o "Use" dele.
//
// FUNÇÕES
//   EMPTY(): a mecânica vazia.
//   isEdition2024(raw): a magia é da edição 2024 (a do SRD 5.2)?
//   srdSpellMechanics(raw): { activities, effects } do SRD, ou null.
//   damageDice(raw), upcastDice(raw): o primeiro {@damage} e os dados por círculo.
//   derivedSpellMechanics(raw): a activity de ataque ou save do dado do 5etools.
//   spellMechanics(raw, db): { activities, effects }, cópias novas, ou vazio.
//   fid(): id de activity.
//   withFreeCasting(mech, opts): o lançamento pelo uso do ITEM (Mystic Arcanum,
//     magia concedida com uso grátis), no formato dos premades.
//
// DECISÕES E ARMADILHAS
//   - O SRD só vale para a magia de 2024 (XPHB, ou a marcada `srd52`): a de 2014
//     tem outra mecânica com o mesmo nome. O overlay casa nome E fonte.
//   - O nome do SRD tira o nome próprio do mago ("Hideous Laughter"); a busca
//     passa pelo srdSpellNames.
//   - Activity e effect saem JUNTOS (o SRD e o overlay citam o effect por `_id`).
//   - derivedSpellMechanics só lê CAMPOS do 5etools (`spellAttack`, `savingThrow`,
//     `damageInflict`, o primeiro `{@damage}` e o `{@scaledamage}`), no formato das
//     activities do SRD (Fire Bolt, Sacred Flame, Fireball). Nada de prosa
//     inventada: sem ataque nem save não sai activity.
//   - withFreeCasting copia os premades oficiais: no Mystic Arcanum (`atwill`), toda
//     activity que gastaria espaço gasta 1 uso do item (Sefris L17); na magia
//     concedida com uso grátis, uma activity `forward` "(free casting)" gasta o uso e
//     aciona a principal, e lançar pelo espaço continua possível (Akra, TC-0067).
//   - O registro do SRD vem pelo foundryMechanics (carregado sob demanda pelo
//     export): sem ele, a magia cai no overlay e no dado do 5etools.
//   - Sempre CÓPIA (structuredClone): o registro gerado é compartilhado por todo
//     ator, e o export muda activities depois (o linkConsumptionTargets; a lição
//     do T2d, DDL-0166).
// -----------------------------------------------------------------------------

import { foundryMechanics } from './foundryMechanicsData';
import { overlayMechanics, overlaySpellEntry } from './foundryOverlay';
import { srdSpellNames } from './spells';

const EMPTY = () => ({ activities: {}, effects: [] });

/** A magia é da edição 2024 (a do SRD 5.2)? */
export function isEdition2024(raw) {
  return raw?.source === 'XPHB' || !!raw?.srd52;
}

/** A mecânica do SRD de uma magia, ou null. */
export function srdSpellMechanics(raw) {
  if (!raw?.name || !isEdition2024(raw)) return null;
  for (const name of srdSpellNames(raw.name)) {
    const entry = foundryMechanics()?.spells?.[name];
    if (entry) return { activities: entry.activities ?? {}, effects: entry.effects ?? [] };
  }
  return null;
}

/**
 * As activities e os effects de uma magia no Foundry, em cópias novas.
 * @param {object} raw  a magia do 5etools
 * @param {object} [db]
 * @returns {{activities: object, effects: object[]}}
 */
export function spellMechanics(raw, db) {
  const srd = srdSpellMechanics(raw);
  if (srd && Object.keys(srd.activities).length) return structuredClone(srd);
  const overlay = db ? overlayMechanics(overlaySpellEntry(db, raw?.name, raw?.source), raw?.name) : null;
  if (overlay && Object.keys(overlay.activities).length) {
    return structuredClone({ activities: overlay.activities, effects: overlay.effects });
  }
  return derivedSpellMechanics(raw) ?? EMPTY();
}

const ABILITY = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

/** O primeiro `{@damage XdY}` do texto da magia, ou null. */
export function damageDice(raw) {
  const m = JSON.stringify(raw?.entries ?? []).match(/[{]@damage ([0-9]+)d([0-9]+)/);
  return m ? { number: Number(m[1]), denomination: m[2] } : null;
}

/** Quantos dados a mais por círculo acima, pelo `{@scaledamage}`, ou 0. */
export function upcastDice(raw) {
  const m = JSON.stringify(raw?.entriesHigherLevel ?? []).match(/[{]@scaledamage [^|}]*[|][^|}]*[|]([0-9]+)d[0-9]+/);
  return m ? Number(m[1]) : 0;
}

/** A activity de ataque ou save montada dos campos do 5etools, ou null. */
export function derivedSpellMechanics(raw) {
  const attack = raw?.spellAttack?.[0];
  const save = ABILITY[String(raw?.savingThrow?.[0] ?? '').toLowerCase()];
  if (!attack && !save) return null;
  const dice = damageDice(raw);
  const level = raw.level ?? 0;
  const per = upcastDice(raw);
  const parts = dice
    ? [{
      number: dice.number,
      denomination: dice.denomination,
      types: [...(raw.damageInflict ?? [])],
      custom: { enabled: false },
      scaling: level === 0 ? { mode: 'whole' } : per ? { mode: 'whole', number: per } : {},
    }]
    : [];
  const _id = fid();
  const base = {
    _id,
    sort: 0,
    activation: { type: 'action', override: false },
    consumption: { scaling: { allowed: false }, spellSlot: true },
    duration: { units: 'inst', override: false },
    range: { override: false },
    target: { prompt: true, template: { contiguous: false, units: 'ft' }, affects: { choice: false }, override: false },
    uses: { spent: 0 },
  };
  const act = attack
    ? { ...base, type: 'attack', attack: { flat: false, type: { value: attack === 'M' ? 'melee' : 'ranged', classification: 'spell' } }, damage: { includeBase: true, parts } }
    : { ...base, type: 'save', save: { ability: save, dc: { calculation: 'spellcasting' } }, damage: { onSave: /half as much damage/i.test(JSON.stringify(raw.entries ?? [])) ? 'half' : 'none', parts } };
  return { activities: { [_id]: act }, effects: [] };
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function fid() {
  let out = '';
  for (let i = 0; i < 16; i += 1) out += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return out;
}

/**
 * Liga o lançamento ao uso do item, como os premades.
 * @param {{activities: object, effects: object[]}} mech
 * @param {{hasUses: boolean, isArcanum: boolean}} opts
 * @returns {{activities: object, effects: object[]}}
 */
export function withFreeCasting(mech, { hasUses, isArcanum }) {
  const acts = mech.activities ?? {};
  const keys = Object.keys(acts);
  if (!hasUses || !keys.length) return mech;
  const useItem = { type: 'itemUses', target: '', value: '1', scaling: {} };
  if (isArcanum) {
    for (const k of keys) {
      const a = acts[k];
      if (a?.consumption?.spellSlot === false) continue;
      a.consumption = { scaling: { allowed: false }, spellSlot: true, ...(a.consumption ?? {}), targets: [...(a.consumption?.targets ?? []), useItem] };
    }
    return mech;
  }
  const main = acts[keys[0]];
  const _id = fid();
  acts[_id] = {
    _id,
    type: 'forward',
    name: `${main.name || 'Cast'} (free casting)`,
    sort: 1,
    activity: { id: main._id ?? keys[0] },
    activation: { type: main.activation?.type ?? 'action', override: false },
    consumption: { targets: [useItem], scaling: { allowed: false }, spellSlot: true },
  };
  return mech;
}
