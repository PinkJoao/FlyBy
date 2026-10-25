// =============================================================================
// portraitSuggestions: extração de tags da ficha e ranqueamento de retratos
// =============================================================================
// O QUE FAZ
//   Converte as decisões da ficha do personagem (espécie, linhagem, classes,
//   subclasses, armadura, armas, focos de conjuração e identidade) em tags do
//   catálogo (`src/data/portraitsIndex.json`) e ranqueia os retratos em memória.
//
// FUNÇÕES
//   portraitUrlFromHash(hash, size): reconstrói a URL da CDN i.pinimg.com a
//     partir do hash hexadecimal de 32 caracteres.
//   speciesTagsOf(species): extrai as tags de espécie e linhagem da ficha.
//   classTagsOf(classes): extrai as tags de classe e subclasse da ficha.
//   equipmentTagsOf(inventory, classes): extrai as tags de armadura, armas e
//     focos de conjuração a partir do inventário e das classes.
//   identityTagsOf(identity): extrai tags explícitas de idade ou gênero nos
//     campos livres de identidade.
//   characterPortraitTags(character): devolve a lista sem duplicatas de tags
//     sugeridas pela ficha.
//   tagCategoryOf(tag): classifica uma tag em gender, age, armor, lineage,
//     species, subclass, class ou weapon.
//   tagLabelOf(tag): formata o rótulo legível em inglês de uma tag.
//   hashTieBreaker(hash, seed): gera um inteiro determinístico em [0..999] para
//     embaralhar empates de pontuação conforme a semente.
//   rankPortraits(indexData, activeTags, opts): pontua e ordena o catálogo de
//     retratos para as tags ativas.
//
// DECISÕES E ARMADILHAS
//   - Espécie e gênero são traços anatômicos excludentes: quando há uma espécie
//     ativa na busca, retratos que casam a espécie recebem peso alto (+30, mais
//     +18 na linhagem específica), e retratos marcados apenas com outra espécie
//     incompatível são penalizados (-35) para que um Guerreiro Humano cheio de
//     armas iguais nunca passe à frente de um Tiefling ou Dragonborn.
//   - Quando o usuário filtra um único gênero (male ou female), retratos marcados
//     apenas com o gênero oposto recebem penalidade (-45).
//   - O desempate usa hashTieBreaker(hash, seed): abrir o modal sorteia uma semente
//     inicial, renovando a vitrine dentro do mesmo degrau de relevância.
// -----------------------------------------------------------------------------

const GENDERS = new Set(['male', 'female']);
const AGES = new Set(['young', 'mature']);
const ARMORS = new Set(['heavy-armor', 'medium-armor', 'light-armor', 'robes']);

const CLASSES = new Set([
  'artificer',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
]);

const WEAPONS_AND_FOCUSES = new Set([
  'greatsword',
  'longsword',
  'shield',
  'dual-wield',
  'dagger',
  'rapier',
  'axe',
  'hammer',
  'mace',
  'polearm',
  'bow',
  'crossbow',
  'quarterstaff',
  'unarmed',
  'firearm',
  'whip',
  'staff',
  'wand',
  'orb',
  'spellbook',
  'holy-symbol',
  'instrument',
  'druidic-focus',
]);

const LINEAGE_PARENTS = {
  'high-elf': 'elf',
  'wood-elf': 'elf',
  drow: 'elf',
  'half-elf': 'elf',
  eladrin: 'elf',
  'shadar-kai': 'elf',
  'astral-elf': 'elf',
  'sea-elf': 'elf',
  'pallid-elf': 'elf',
  duergar: 'dwarf',
  'mountain-dwarf': 'dwarf',
  'hill-dwarf': 'dwarf',
  'deep-gnome': 'gnome',
  'forest-gnome': 'gnome',
  'rock-gnome': 'gnome',
  autognome: 'gnome',
  'half-orc': 'orc',
  'red-dragonborn': 'dragonborn',
  'blue-dragonborn': 'dragonborn',
  'black-dragonborn': 'dragonborn',
  'green-dragonborn': 'dragonborn',
  'white-dragonborn': 'dragonborn',
  'gold-dragonborn': 'dragonborn',
  'silver-dragonborn': 'dragonborn',
  'bronze-dragonborn': 'dragonborn',
  'brass-dragonborn': 'dragonborn',
  'copper-dragonborn': 'dragonborn',
  'gem-dragonborn': 'dragonborn',
  'fire-genasi': 'genasi',
  'water-genasi': 'genasi',
  'air-genasi': 'genasi',
  'earth-genasi': 'genasi',
  flamekin: 'fire-genasi',
  rimekin: 'water-genasi',
  'winged-tiefling': 'tiefling',
  kender: 'halfling',
  kithkin: 'halfling',
  triton: 'merfolk',
  verdan: 'goblin',
  lupin: 'shifter',
  aven: 'aarakocra',
};

const BASE_SPECIES = new Set([
  'human',
  'elf',
  'dwarf',
  'tiefling',
  'dragonborn',
  'halfling',
  'gnome',
  'orc',
  'goliath',
  'aasimar',
  'tabaxi',
  'warforged',
  'genasi',
  'aarakocra',
  'bugbear',
  'centaur',
  'changeling',
  'dhampir',
  'fairy',
  'firbolg',
  'giff',
  'githyanki',
  'githzerai',
  'goblin',
  'grung',
  'hadozee',
  'harengon',
  'hexblood',
  'hobgoblin',
  'kalashtar',
  'kenku',
  'kobold',
  'leonin',
  'lizardfolk',
  'locathah',
  'loxodon',
  'merfolk',
  'minotaur',
  'owlin',
  'plasmoid',
  'reborn',
  'satyr',
  'shifter',
  'simic-hybrid',
  'vedalken',
  'thri-kreen',
  'tortle',
  'yuan-ti',
  'aetherborn',
  'siren',
  'kor',
]);

const SUBCLASS_MAP = {
  'artificer:alchemist': 'alchemist',
  'artificer:armorer': 'armorer',
  'artificer:artillerist': 'artillerist',
  'artificer:battle smith': 'battle-smith',
  'artificer:cartographer': 'cartographer',
  'artificer:reanimator': 'reanimator',
  'barbarian:berserker': 'berserker',
  'barbarian:wild heart': 'wild-heart',
  'barbarian:totem warrior': 'wild-heart',
  'barbarian:world tree': 'world-tree',
  'barbarian:zealot': 'zealot',
  'barbarian:ancestral guardian': 'ancestral-guardian',
  'barbarian:beast': 'beast-barbarian',
  'barbarian:storm herald': 'storm-herald',
  'barbarian:giant': 'giant-barbarian',
  'barbarian:battlerager': 'battlerager',
  'barbarian:wild magic': 'wild-magic-barbarian',
  'bard:lore': 'lore-bard',
  'bard:dance': 'dance-bard',
  'bard:glamour': 'glamour-bard',
  'bard:valor': 'valor-bard',
  'bard:swords': 'swords-bard',
  'bard:whispers': 'whispers-bard',
  'bard:spirits': 'spirits-bard',
  'bard:eloquence': 'eloquence-bard',
  'bard:creation': 'creation-bard',
  'bard:moon': 'moon-bard',
  'cleric:life': 'life-cleric',
  'cleric:light': 'light-cleric',
  'cleric:trickery': 'trickery-cleric',
  'cleric:war': 'war-cleric',
  'cleric:tempest': 'tempest-cleric',
  'cleric:forge': 'forge-cleric',
  'cleric:grave': 'grave-cleric',
  'cleric:death': 'death-cleric',
  'cleric:twilight': 'twilight-cleric',
  'cleric:peace': 'peace-cleric',
  'cleric:order': 'order-cleric',
  'cleric:knowledge': 'knowledge-cleric',
  'cleric:knowledge (psa)': 'knowledge-cleric',
  'cleric:nature': 'nature-cleric',
  'cleric:arcana': 'arcana-cleric',
  'cleric:ambition (psa)': 'ambition-cleric',
  'cleric:solidarity (psa)': 'solidarity-cleric',
  'cleric:strength (psa)': 'strength-cleric',
  'cleric:zeal (psa)': 'zeal-cleric',
  'druid:land': 'land-druid',
  'druid:moon': 'moon-druid',
  'druid:sea': 'sea-druid',
  'druid:stars': 'stars-druid',
  'druid:spores': 'spores-druid',
  'druid:wildfire': 'wildfire-druid',
  'druid:dreams': 'dreams-druid',
  'druid:shepherd': 'shepherd-druid',
  'fighter:battle master': 'battle-master',
  'fighter:champion': 'champion',
  'fighter:eldritch knight': 'eldritch-knight',
  'fighter:psi warrior': 'psi-warrior',
  'fighter:echo knight': 'echo-knight',
  'fighter:rune knight': 'rune-knight',
  'fighter:samurai': 'samurai',
  'fighter:arcane archer': 'arcane-archer',
  'fighter:cavalier': 'cavalier',
  'fighter:banneret': 'banneret',
  'monk:open hand': 'open-hand',
  'monk:shadow': 'shadow-monk',
  'monk:elements': 'elements-monk',
  'monk:mercy': 'mercy-monk',
  'monk:astral self': 'astral-self',
  'monk:kensei': 'kensei',
  'monk:drunken master': 'drunken-master',
  'monk:sun soul': 'sun-soul',
  'monk:ascendant dragon': 'ascendant-dragon',
  'monk:long death': 'long-death',
  'paladin:devotion': 'devotion-paladin',
  'paladin:glory': 'glory-paladin',
  'paladin:ancients': 'ancients-paladin',
  'paladin:vengeance': 'vengeance-paladin',
  'paladin:conquest': 'conquest-paladin',
  'paladin:oathbreaker': 'oathbreaker',
  'paladin:redemption': 'redemption-paladin',
  'paladin:crown': 'crown-paladin',
  'paladin:watchers': 'watchers-paladin',
  'paladin:noble genies': 'noble-genies',
  'ranger:beast master': 'beast-master',
  'ranger:fey wanderer': 'fey-wanderer',
  'ranger:gloom stalker': 'gloom-stalker',
  'ranger:hunter': 'hunter-ranger',
  'ranger:drakewarden': 'drakewarden',
  'ranger:horizon walker': 'horizon-walker',
  'ranger:swarmkeeper': 'swarmkeeper',
  'ranger:monster slayer': 'monster-slayer',
  'ranger:winter walker': 'winter-walker',
  'ranger:hollow warden': 'hollow-warden',
  'rogue:arcane trickster': 'arcane-trickster',
  'rogue:assassin': 'assassin',
  'rogue:soulknife': 'soulknife',
  'rogue:thief': 'thief',
  'rogue:swashbuckler': 'swashbuckler',
  'rogue:phantom': 'phantom-rogue',
  'rogue:inquisitive': 'inquisitive-rogue',
  'rogue:mastermind': 'mastermind-rogue',
  'rogue:scout': 'scout-rogue',
  'rogue:scion of the three': 'scion-rogue',
  'sorcerer:aberrant': 'aberrant-sorcerer',
  'sorcerer:clockwork': 'clockwork-sorcerer',
  'sorcerer:draconic': 'draconic-sorcerer',
  'sorcerer:wild magic': 'wild-magic-sorcerer',
  'sorcerer:shadow': 'shadow-sorcerer',
  'sorcerer:storm': 'storm-sorcerer',
  'sorcerer:divine soul': 'divine-soul',
  'sorcerer:lunar': 'lunar-sorcerer',
  'sorcerer:pyromancer (psk)': 'pyromancer',
  'sorcerer:spellfire': 'spellfire-sorcerer',
  'warlock:archfey': 'archfey-warlock',
  'warlock:celestial': 'celestial-warlock',
  'warlock:fiend': 'fiend-warlock',
  'warlock:great old one': 'great-old-one',
  'warlock:hexblade': 'hexblade',
  'warlock:fathomless': 'fathomless-warlock',
  'warlock:genie': 'genie-warlock',
  'warlock:undead': 'undead-warlock',
  'warlock:undying': 'undead-warlock',
  'wizard:abjurer': 'abjurer',
  'wizard:bladesinger': 'bladesinger',
  'wizard:diviner': 'diviner',
  'wizard:evoker': 'evoker',
  'wizard:illusionist': 'illusionist',
  'wizard:necromancy': 'necromancer',
  'wizard:necromancer': 'necromancer',
  'wizard:chronurgy': 'chronurgist',
  'wizard:graviturgy': 'graviturgist',
  'wizard:scribes': 'scribes-wizard',
  'wizard:war': 'war-mage',
  'wizard:conjuration': 'conjurer',
  'wizard:enchantment': 'enchanter',
  'wizard:transmutation': 'transmuter',
};

const ALL_SUBCLASS_TAGS = new Set(Object.values(SUBCLASS_MAP));

/**
 * Reconstrói a URL da CDN do Pinterest a partir do hash hexadecimal de 32 caracteres.
 * @param {string} hash
 * @param {string} [size]
 */
export function portraitUrlFromHash(hash, size = '736x') {
  const h = String(hash || '').trim().toLowerCase();
  if (h.length !== 32) return '';
  return `https://i.pinimg.com/${size}/${h.slice(0, 2)}/${h.slice(2, 4)}/${h.slice(4, 6)}/${h}.jpg`;
}

/**
 * Extrai as tags de espécie e linhagem a partir do `character.species`.
 * @param {object|null|undefined} species
 * @returns {string[]}
 */
export function speciesTagsOf(species) {
  if (!species?.id) return [];
  const rawId = String(species.id).toLowerCase().trim();
  const rawLin = String(species.lineage || '').toLowerCase().trim();
  const combined = `${rawId} ${rawLin}`;
  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };

  if (/\bdrow\b/.test(combined)) add('drow');
  else if (/\bhigh elf\b/.test(combined)) add('high-elf');
  else if (/\bwood elf\b/.test(combined)) add('wood-elf');
  else if (/\bpallid\b/.test(combined)) add('pallid-elf');
  else if (/\bsea elf\b/.test(combined)) add('sea-elf');
  else if (/\bastral elf\b/.test(combined)) add('astral-elf');
  else if (/\bshadar[-\s]?kai\b/.test(combined)) add('shadar-kai');
  else if (/\beladrin\b/.test(combined)) add('eladrin');

  if (/\bmountain\b/.test(combined) && /\bdwarf\b/.test(combined)) add('mountain-dwarf');
  else if (/\bhill\b/.test(combined) && /\bdwarf\b/.test(combined)) add('hill-dwarf');
  else if (/\bduergar\b/.test(combined)) add('duergar');

  if (/\bdeep gnome\b|\bsvirfneblin\b/.test(combined)) add('deep-gnome');
  else if (/\bforest gnome\b/.test(combined)) add('forest-gnome');
  else if (/\brock gnome\b/.test(combined)) add('rock-gnome');
  else if (/\bautognome\b/.test(combined)) add('autognome');

  if (/\bgem\b/.test(combined) && /\bdragonborn\b/.test(combined)) add('gem-dragonborn');
  else {
    const colorMatch = combined.match(/\b(red|blue|black|green|white|gold|silver|bronze|brass|copper)\b/);
    if (colorMatch && /\bdragonborn\b/.test(combined)) {
      add(`${colorMatch[1]}-dragonborn`);
    }
  }

  if (/\bgenasi\b/.test(combined)) {
    if (/\bfire\b/.test(combined)) add('fire-genasi');
    else if (/\bwater\b/.test(combined)) add('water-genasi');
    else if (/\bair\b/.test(combined)) add('air-genasi');
    else if (/\bearth\b/.test(combined)) add('earth-genasi');
  }

  if (/\bwinged\b/.test(combined) && /\btiefling\b/.test(combined)) add('winged-tiefling');
  if (/\bkhoravar\b|\bhalf[-\s]?elf\b/.test(combined)) add('half-elf');
  if (/\bhalf[-\s]?orc\b/.test(combined)) add('half-orc');

  const cleanBase = rawId
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+/g, '-')
    .trim();

  if (cleanBase === 'khoravar') add('half-elf');
  else if (cleanBase === 'lorwyn-changeling') add('changeling');
  else if (cleanBase === 'boggart') add('goblin');
  else if (cleanBase === 'naga') add('yuan-ti');
  else if (cleanBase === 'khenra') add('shifter');
  else if (cleanBase === 'vampire') add('dhampir');
  else if (BASE_SPECIES.has(cleanBase) || cleanBase in LINEAGE_PARENTS) {
    add(cleanBase);
  }

  for (const t of [...out]) {
    const parent = LINEAGE_PARENTS[t];
    if (parent) add(parent);
  }

  return out;
}

/**
 * Extrai as tags de classe e subclasse a partir de `character.classes`.
 * @param {Array<object>|null|undefined} classes
 * @returns {string[]}
 */
export function classTagsOf(classes) {
  if (!Array.isArray(classes)) return [];
  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };

  for (const c of classes) {
    const cid = String(c?.classId || '').toLowerCase().trim();
    if (!CLASSES.has(cid)) continue;
    if (c?.subclassId) {
      const sid = String(c.subclassId).toLowerCase().trim();
      const subTag = SUBCLASS_MAP[`${cid}:${sid}`];
      if (subTag) add(subTag);
    }
    add(cid);
  }
  return out;
}

/**
 * Extrai as tags de armadura, armas e focos de conjuração do inventário.
 * @param {Array<object>|null|undefined} inventory
 * @param {Array<object>|null|undefined} [classes]
 * @returns {string[]}
 */
export function equipmentTagsOf(inventory, classes = []) {
  const items = Array.isArray(inventory) ? inventory : [];
  const equipped = items.filter((i) => i?.equipped);
  const pool = equipped.length > 0 ? equipped : items;

  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };

  let hasArmor = false;
  let lightMeleeCount = 0;

  for (const entry of pool) {
    const name = String(entry?.itemId || entry?.customName || '').toLowerCase();
    if (!name) continue;

    if (
      /\b(half[-\s]?plate|breastplate|scale[-\s]?mail|scalemail|chain[-\s]?shirt|hide armor|brigandine)\b|^hide$/.test(
        name,
      )
    ) {
      add('medium-armor');
      hasArmor = true;
    } else if (/\b(plate|chain[-\s]?mail|splint|ring[-\s]?mail)\b/.test(name)) {
      add('heavy-armor');
      hasArmor = true;
    } else if (/\b(leather|studded leather|padded)\b/.test(name)) {
      add('light-armor');
      hasArmor = true;
    } else if (/\b(robe|vestments|clothes)\b/.test(name)) {
      add('robes');
      hasArmor = true;
    }

    if (/\bgreatsword\b/.test(name)) add('greatsword');
    else if (/\b(longsword|broadsword)\b/.test(name)) add('longsword');
    if (/\bshield\b/.test(name)) add('shield');
    if (/\b(scimitar|shortsword)\b/.test(name)) {
      lightMeleeCount += Number(entry?.quantity) || 1;
      add('dual-wield');
    }
    if (/\b(dagger|sickle)\b/.test(name)) {
      lightMeleeCount += Number(entry?.quantity) || 1;
      add('dagger');
    }
    if (/\brapier\b/.test(name)) add('rapier');
    if (/\b(greataxe|battleaxe|handaxe)\b/.test(name)) add('axe');
    if (/\b(warhammer|maul|light hammer)\b/.test(name)) add('hammer');
    if (/\b(mace|flail|morningstar|club|greatclub)\b/.test(name)) add('mace');
    if (/\b(halberd|glaive|pike|spear|trident|lance|javelin)\b/.test(name)) add('polearm');
    if (/\b(longbow|shortbow)\b/.test(name)) add('bow');
    if (/\bcrossbow\b/.test(name)) add('crossbow');
    if (/\bquarterstaff\b/.test(name)) add('quarterstaff');
    if (/\b(pistol|musket|rifle|firearm)\b/.test(name)) add('firearm');
    if (/\bwhip\b/.test(name)) add('whip');
    if (/\b(staff|arcane focus)\b/.test(name) && !/\bquarterstaff\b/.test(name)) add('staff');
    if (/\b(wand|rod)\b/.test(name) && !/\byew wand\b/.test(name)) add('wand');
    if (/\b(orb|crystal)\b/.test(name)) add('orb');
    if (/\bspellbook\b/.test(name)) add('spellbook');
    if (/\b(holy symbol|amulet|emblem|reliquary)\b/.test(name)) add('holy-symbol');
    if (/\b(lute|flute|lyre|horn|viol|drum|bagpipes|shawm|dulcimer|pan flute|instrument)\b/.test(name)) {
      add('instrument');
    }
    if (/\b(druidic focus|totem|yew wand|wooden staff|mistletoe)\b/.test(name)) {
      add('druidic-focus');
    }
  }

  if (lightMeleeCount >= 2) add('dual-wield');

  if (!hasArmor && Array.isArray(classes)) {
    const cids = classes.map((c) => String(c?.classId || '').toLowerCase());
    if (cids.some((id) => id === 'wizard' || id === 'sorcerer' || id === 'monk')) {
      add('robes');
    }
    if (cids.includes('monk') && out.length === 1 && out[0] === 'robes') {
      add('unarmed');
    }
  }

  return out;
}

/**
 * Extrai tags explícitas de idade ou gênero nos campos livres de identidade.
 * @param {object|null|undefined} identity
 * @returns {string[]}
 */
export function identityTagsOf(identity) {
  if (!identity) return [];
  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };

  const ageText = String(identity.age || '').toLowerCase().trim();
  const appText = String(identity.appearance || '').toLowerCase().trim();
  const combined = `${ageText} ${appText}`;

  const ageNum = parseInt(ageText, 10);
  if (!Number.isNaN(ageNum)) {
    if (ageNum > 0 && ageNum <= 22) add('young');
    else if (ageNum >= 55) add('mature');
  }
  if (/\b(young|youth|teen|adolescent|boy|girl)\b/.test(combined)) add('young');
  else if (/\b(old|elder|elderly|mature|veteran|aged|grizzled|gray hair|grey hair|white beard)\b/.test(combined)) {
    add('mature');
  }

  if (/\b(female|woman|girl|she|her)\b/.test(appText) && !/\b(male|man|boy|he|his)\b/.test(appText)) {
    add('female');
  } else if (/\b(male|man|boy|he|his|bearded)\b/.test(appText) && !/\b(female|woman|girl|she|her)\b/.test(appText)) {
    add('male');
  }

  return out;
}

/**
 * Reúne todas as tags iniciais recomendadas para a ficha do personagem.
 * @param {object|null|undefined} character
 * @returns {string[]}
 */
export function characterPortraitTags(character) {
  if (!character) return [];
  const out = [];
  const addAll = (list) => {
    for (const t of list) {
      if (t && !out.includes(t)) out.push(t);
    }
  };
  addAll(identityTagsOf(character.identity));
  addAll(speciesTagsOf(character.species));
  addAll(classTagsOf(character.classes));
  addAll(equipmentTagsOf(character.inventory, character.classes));
  return out;
}

/**
 * Classifica uma tag do catálogo em sua categoria semântica.
 * @param {string} tag
 * @returns {'gender'|'age'|'armor'|'lineage'|'species'|'subclass'|'class'|'weapon'}
 */
export function tagCategoryOf(tag) {
  if (GENDERS.has(tag)) return 'gender';
  if (AGES.has(tag)) return 'age';
  if (ARMORS.has(tag)) return 'armor';
  if (tag in LINEAGE_PARENTS) return 'lineage';
  if (BASE_SPECIES.has(tag)) return 'species';
  if (CLASSES.has(tag)) return 'class';
  if (ALL_SUBCLASS_TAGS.has(tag)) return 'subclass';
  if (WEAPONS_AND_FOCUSES.has(tag)) return 'weapon';
  return 'species';
}

/**
 * Formata o rótulo legível em inglês de uma tag.
 * @param {string} tag
 * @returns {string}
 */
export function tagLabelOf(tag) {
  const special = {
    drow: 'Drow',
    'half-elf': 'Half-Elf',
    'half-orc': 'Half-Orc',
    'yuan-ti': 'Yuan-Ti',
    'thri-kreen': 'Thri-Kreen',
    'shadar-kai': 'Shadar-Kai',
    'psi-warrior': 'Psi Warrior',
    'great-old-one': 'Great Old One',
  };
  if (special[tag]) return special[tag];
  return String(tag || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Desempate determinístico leve entre retratos de mesma pontuação.
 * @param {string} hash
 * @param {number} [seed]
 * @returns {number}
 */
export function hashTieBreaker(hash, seed = 0) {
  let h = (2166136261 ^ (seed * 16777619)) >>> 0;
  const len = Math.min(12, hash.length);
  for (let i = 0; i < len; i++) {
    h ^= hash.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 1000;
}

/**
 * Pontua e ordena os retratos do catálogo com base nas tags ativas.
 * @param {{ tags: string[], items: Array<[string, number[]]> }} indexData
 * @param {string[]} activeTags
 * @param {{ seed?: number, limit?: number }} [opts]
 * @returns {{ totalMatched: number, items: Array<{ hash: string, url: string, score: number, matchedTags: string[] }> }}
 */
export function rankPortraits(indexData, activeTags = [], opts = {}) {
  const tagsDict = indexData?.tags ?? [];
  const rawItems = indexData?.items ?? [];
  const seed = Number(opts.seed) || 0;
  const limit = Number(opts.limit) || 240;

  const tagToIdx = new Map();
  for (let i = 0; i < tagsDict.length; i++) {
    tagToIdx.set(tagsDict[i], i);
  }

  const expandedInput = [];
  for (const t of activeTags) {
    if (t === 'medium-armor' && !tagToIdx.has('medium-armor')) {
      expandedInput.push('light-armor', 'heavy-armor');
    } else {
      expandedInput.push(t);
    }
  }
  const cleanActive = [...new Set(expandedInput.filter((t) => tagToIdx.has(t)))];
  if (cleanActive.length === 0) {
    const sample = rawItems.slice(0, Math.min(rawItems.length, limit * 3)).map(([hash, idxs]) => ({
      hash,
      url: portraitUrlFromHash(hash),
      score: 1,
      tie: hashTieBreaker(hash, seed),
      matchedTags: idxs.slice(0, 4).map((i) => tagsDict[i]).filter(Boolean),
    }));
    sample.sort((a, b) => b.tie - a.tie);
    return { totalMatched: rawItems.length, items: sample.slice(0, limit) };
  }

  const activeSet = new Set(cleanActive);
  const wantMale = activeSet.has('male') && !activeSet.has('female');
  const wantFemale = activeSet.has('female') && !activeSet.has('male');
  const maleIdx = tagToIdx.get('male');
  const femaleIdx = tagToIdx.get('female');

  const activeSpecies = cleanActive.filter((t) => {
    const cat = tagCategoryOf(t);
    return cat === 'species' || cat === 'lineage';
  });
  const allowedSpeciesIndices = new Set();
  for (const sp of activeSpecies) {
    const idx = tagToIdx.get(sp);
    if (idx !== undefined) allowedSpeciesIndices.add(idx);
    const parent = LINEAGE_PARENTS[sp];
    if (parent && tagToIdx.has(parent)) allowedSpeciesIndices.add(tagToIdx.get(parent));
  }

  const allSpeciesIndices = new Set();
  for (let i = 0; i < tagsDict.length; i++) {
    const cat = tagCategoryOf(tagsDict[i]);
    if (cat === 'species' || cat === 'lineage') allSpeciesIndices.add(i);
  }

  const activeWeights = new Map();
  for (const t of cleanActive) {
    const cat = tagCategoryOf(t);
    if (cat === 'gender') activeWeights.set(tagToIdx.get(t), 25);
    else if (cat === 'lineage') activeWeights.set(tagToIdx.get(t), 22);
    else if (cat === 'species') activeWeights.set(tagToIdx.get(t), 28);
    else if (cat === 'subclass') activeWeights.set(tagToIdx.get(t), 18);
    else if (cat === 'class') activeWeights.set(tagToIdx.get(t), 15);
    else if (cat === 'weapon') activeWeights.set(tagToIdx.get(t), 8);
    else activeWeights.set(tagToIdx.get(t), 6);
  }

  const scored = [];
  for (let r = 0; r < rawItems.length; r++) {
    const [hash, idxs] = rawItems[r];
    let score = 0;
    let hasMale = false;
    let hasFemale = false;
    let matchedAllowedSpecies = false;
    let hasAnySpeciesTag = false;
    const matchedTags = [];

    for (let j = 0; j < idxs.length; j++) {
      const idx = idxs[j];
      if (idx === maleIdx) hasMale = true;
      else if (idx === femaleIdx) hasFemale = true;

      if (allSpeciesIndices.has(idx)) {
        hasAnySpeciesTag = true;
        if (allowedSpeciesIndices.has(idx)) matchedAllowedSpecies = true;
      }

      const w = activeWeights.get(idx);
      if (w !== undefined) {
        score += w;
        matchedTags.push(tagsDict[idx]);
      }
    }

    if (matchedTags.length === 0) continue;

    if (wantMale && hasFemale && !hasMale) score -= 45;
    if (wantFemale && hasMale && !hasFemale) score -= 45;

    if (allowedSpeciesIndices.size > 0 && !matchedAllowedSpecies && hasAnySpeciesTag) {
      score -= 35;
    }

    if (score <= 0) continue;

    scored.push({
      hash,
      score,
      tie: hashTieBreaker(hash, seed),
      matchedTags,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.tie - a.tie);

  const top = scored.slice(0, limit).map((item) => ({
    hash: item.hash,
    url: portraitUrlFromHash(item.hash),
    score: item.score,
    matchedTags: item.matchedTags,
  }));

  return {
    totalMatched: scored.length,
    items: top,
  };
}
