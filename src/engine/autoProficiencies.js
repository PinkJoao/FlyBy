// =============================================================================
// autoProficiencies - proficiências AUTOMÁTICAS (não escolhidas)
// =============================================================================
// Deriva as proficiências que vêm de graça da CLASSE e da ESPÉCIE, além das
// escolhas do jogador (que collectSkill/Tool/… já reúnem). Precisa do compêndio,
// então roda na camada de derivação (deriveFromDb) e é injetada no contexto.
//
//  - Classe (startingProficiencies): armaduras, armas e ferramentas.
//  - Espécie (skill/toolProficiencies FIXAS - { nome: true }, não `choose`/`any`).
//
// NÃO cobre (ainda) proficiências concedidas por TEXTO de feature (ex: Protector
// dá armas marciais + armadura pesada) - isso vira uma camada curada à parte.
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveRaceObj } from './resolve';
import { skillCode } from './classData';

const ARMOR_LABEL = { light: 'Light Armor', medium: 'Medium Armor', heavy: 'Heavy Armor', shield: 'Shields' };
const WEAPON_LABEL = { simple: 'Simple Weapons', martial: 'Martial Weapons' };

/** Remove tags 5etools ({@item X|src}, {@filter X|…}) deixando o texto legível. */
function stripTag(s) {
  return String(s)
    .replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1')
    .trim();
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Title-case por palavra (ex: "thieves' tools" → "Thieves' Tools"). */
function capWords(s) {
  return String(s).split(' ').map(cap).join(' ');
}

/** Rótulo de uma entrada de armadura/arma (token conhecido → label; senão texto). */
function labelFrom(map, raw) {
  const s = String(raw).toLowerCase();
  return map[s] ?? cap(stripTag(raw));
}

/**
 * Proficiências fixas concedidas por classe + espécie.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {{armor:string[], weapons:string[], grantedSkills:string[], grantedTools:string[]}}
 */
export function deriveGrantedProficiencies(character, db) {
  const armor = new Map(); // label normalizado → label (dedup preservando ordem)
  const weapons = new Map();
  const tools = new Map();
  const skills = new Set();

  const addTo = (map, label) => {
    const key = label.toLowerCase();
    if (!map.has(key)) map.set(key, label);
  };

  // --- Classes: startingProficiencies (união de todas as classes) ---
  for (const cls of character?.classes ?? []) {
    if (!cls.classId) continue;
    const obj = resolveClassObj(db, cls.classId, cls.source);
    const sp = obj?.startingProficiencies;
    if (!sp) continue;
    for (const a of sp.armor ?? []) addTo(armor, labelFrom(ARMOR_LABEL, a));
    for (const w of sp.weapons ?? []) addTo(weapons, labelFrom(WEAPON_LABEL, w));
    // Ferramentas: prefere o campo ESTRUTURADO (`{nome:true}` = grant fixo; tokens
    // `any*` são ESCOLHAS e viram seletores - ignorados aqui). Sem ele, cai na
    // prosa `tools`, pulando entradas de escolha ("...of your choice").
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

  // --- Espécie: skill/tool FIXOS ({ nome: true }) ---
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
  // Armas/armaduras FIXAS de raça (legado/subraces: Dwarven Combat Training,
  // Elf Weapon Training, Joraga/Mul Daya de Zendikar…). As chaves vêm como
  // 'battleaxe|phb' → rótulo do nome; 'light'/'medium'… → rótulo de armadura.
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
    grantedSkills: [...skills],
    grantedTools: [...tools.values()],
  };
}
