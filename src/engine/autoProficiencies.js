// =============================================================================
// autoProficiencies: as proficiências automáticas (não escolhidas)
// =============================================================================
// O QUE FAZ
//   Deriva as proficiências que vêm de graça da CLASSE (startingProficiencies:
//   armaduras, armas, ferramentas) e da ESPÉCIE (skill e tool FIXOS, `{ nome:
//   true }`), além das escolhas do jogador. Precisa do compêndio, então roda na
//   derivação (deriveFromDb) e é injetada no contexto. Proficiência concedida por
//   TEXTO de feature é outra camada (featureEffects, classFeatureGrants).
//
// FUNÇÕES
//   stripTag(s), cap(s), capWords(s), labelFrom(map, raw): limpeza e rótulos.
//   conditionalWeaponNames(classObj, db): as armas individuais de uma regra
//     condicional de proficiência.
//   deriveGrantedProficiencies(character, db): { armor, weapons, weaponNames,
//     grantedSkills, grantedTools }.
//
// DECISÕES E ARMADILHAS
//   - Regra CONDICIONAL de arma (TC-0078): o Monge 2024 é proficiente em "Martial
//     weapons that have the Light property", o Ladino em "Finesse or Light". A
//     ficha mostra a FRASE; o Foundry só entende códigos de arma, então
//     `weaponNames` as enumera uma a uma. Sem curadoria: sai do
//     `weaponProficiencies[].all.fromFilter` (o insumo do weaponFilterAllows,
//     DDL-0033), com as propriedades como ALTERNATIVAS. FILTER_PROPERTY traduz o
//     nome da propriedade (que o filtro guarda) no código (que o dado guarda).
//   - Ferramentas da classe: prefere o campo ESTRUTURADO; tokens `any*` são
//     escolhas e viram seletores. Sem ele, a prosa `tools`, pulando "...of your
//     choice".
//   - Armas e armaduras FIXAS de raça (Dwarven Combat Training, Elf Weapon
//     Training, Joraga de Zendikar) chegam como 'battleaxe|phb' ou 'light'.
//   - Rótulos são deduplicados por forma normalizada, preservando a ordem.
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveRaceObj } from './resolve';
import { skillCode } from './classData';

const ARMOR_LABEL = { light: 'Light Armor', medium: 'Medium Armor', heavy: 'Heavy Armor', shield: 'Shields' };
const WEAPON_LABEL = { simple: 'Simple Weapons', martial: 'Martial Weapons' };

/** Remove as tags do 5etools, deixando o texto legível. */
function stripTag(s) {
  return String(s)
    .replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1')
    .trim();
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Title-case por palavra ("thieves' tools" vira "Thieves' Tools"). */
function capWords(s) {
  return String(s).split(' ').map(cap).join(' ');
}

/** Rótulo de uma entrada de armadura ou arma. */
function labelFrom(map, raw) {
  const s = String(raw).toLowerCase();
  return map[s] ?? cap(stripTag(raw));
}

const FILTER_PROPERTY = { light: 'L', finesse: 'F', heavy: 'H', thrown: 'T', versatile: 'V', reach: 'R' };

/**
 * As armas que uma regra condicional de proficiência concede (TC-0078).
 * @param {object} classObj
 * @param {object} db
 * @returns {string[]}
 */
export function conditionalWeaponNames(classObj, db) {
  const out = [];
  for (const entry of classObj?.startingProficiencies?.weaponProficiencies ?? []) {
    const filter = entry?.all?.fromFilter;
    if (typeof filter !== 'string' || !filter) continue;
    const parts = Object.fromEntries(
      filter.split('|').map((p) => {
        const [k, v] = p.split('=');
        return [k.trim().toLowerCase(), (v ?? '').split(';').map((s) => s.trim().toLowerCase())];
      }),
    );
    const wantCategory = parts.type?.find((t) => /simple|martial/.test(t))?.split(' ')[0] ?? null;
    const wantProps = (parts.property ?? []).map((p) => FILTER_PROPERTY[p]).filter(Boolean);
    for (const raw of db?.['items-base']?.baseitem ?? []) {
      if (!raw?.weaponCategory) continue;
      if (wantCategory && String(raw.weaponCategory).toLowerCase() !== wantCategory) continue;
      const props = (raw.property ?? []).map((p) => String(p?.uid ?? p).split('|')[0]);
      if (wantProps.length && !wantProps.some((c) => props.includes(c))) continue;
      out.push(raw.name);
    }
  }
  return [...new Set(out)];
}

/**
 * As proficiências fixas concedidas por classe e espécie.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{armor:string[], weapons:string[], weaponNames:string[], grantedSkills:string[], grantedTools:string[]}}
 */
export function deriveGrantedProficiencies(character, db) {
  const armor = new Map();
  const weapons = new Map();
  const weaponNames = new Map();
  const tools = new Map();
  const skills = new Set();

  const addTo = (map, label) => {
    const key = label.toLowerCase();
    if (!map.has(key)) map.set(key, label);
  };

  for (const cls of character?.classes ?? []) {
    if (!cls.classId) continue;
    const obj = resolveClassObj(db, cls.classId, cls.source);
    const sp = obj?.startingProficiencies;
    if (!sp) continue;
    for (const a of sp.armor ?? []) addTo(armor, labelFrom(ARMOR_LABEL, a));
    for (const w of sp.weapons ?? []) addTo(weapons, labelFrom(WEAPON_LABEL, w));
    for (const n of conditionalWeaponNames(obj, db)) addTo(weaponNames, n);
    const tp = sp.toolProficiencies;
    if (Array.isArray(tp) && tp.length) {
      for (const entry of tp) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [k, v] of Object.entries(entry)) {
          if (v === true && k !== 'choose' && k !== 'any') addTo(tools, capWords(k));
        }
      }
    } else {
      for (const t of sp.tools ?? []) {
        const label = cap(stripTag(t));
        if (!/\bchoose\b|of your choice/i.test(label)) addTo(tools, label);
      }
    }
  }

  const race = character?.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  for (const entry of race?.skillProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) {
      if (v === true && k !== 'choose' && k !== 'any') skills.add(skillCode(k));
    }
  }
  for (const entry of race?.toolProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) {
      if (v === true && k !== 'choose' && k !== 'any') addTo(tools, cap(k));
    }
  }
  for (const entry of race?.weaponProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) {
      if (v === true && k !== 'choose' && k !== 'any') addTo(weapons, capWords(String(k).split('|')[0]));
    }
  }
  for (const entry of race?.armorProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    for (const [k, v] of Object.entries(entry)) {
      if (v === true && k !== 'choose' && k !== 'any') addTo(armor, labelFrom(ARMOR_LABEL, k));
    }
  }

  return {
    armor: [...armor.values()],
    weapons: [...weapons.values()],
    weaponNames: [...weaponNames.values()],
    grantedSkills: [...skills],
    grantedTools: [...tools.values()],
  };
}
