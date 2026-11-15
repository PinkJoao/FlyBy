// =============================================================================
// survey-play-coverage: o que o play mode faz com cada feature, por escopo
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/survey-play-coverage.js [--scope=srd52|srd51|srd|all]
//        [--list=<categoria>] [--cue=<pista>] [--text] [--prose]
//   Monta cada classe e subclasse no nível 20, cada espécie no 5 e cada talento num
//   hospedeiro, deriva o catálogo do play mode e classifica cada feature distinta:
//   - `use`: o app faz a conta (activity, pool, registro curado, efeito do ator lido pela
//     ponte de engine/playActorEffects, vantagem, bônus, reroll, piso, cura e temporários
//     da prosa de engine/playProseEffects, as PASSIVES de engine/playEffects);
//   - `log`: o app só registra (custo do turno ou gatilho da prosa, "Use" sem conta);
//   - `passive`: nada a usar.
//   Em `log` e `passive`, procura as PISTAS de mecânica que o app teria de calcular
//   (vantagem condicional, rolar de novo, dado no texto, cura, PV temporários, bônus
//   somado a um teste, piso de dado) e conta por escopo: SRD 5.2, SRD 5.1 e o resto.
//   É o gabarito da campanha de jogabilidade (docs/PLAY-MODE-CERT-PLAN.md). Com
//   `--prose`, lista cada vantagem ou desvantagem que a camada G2 leu da prosa
//   (engine/playProseEffects), ligada ou não, com os alvos e a nota: a conferência à mão.
//
// FUNÇÕES
//   scopeOf(f, unit): o escopo da feature ('srd52', 'srd51' ou 'other').
//   cuesOf(text): as pistas de mecânica que o texto traz.
//   classify(f, action, pools, bridged): 'use', 'log' ou 'passive'.
//   visit(catalog, unit): soma as features de um catálogo.
//   featBuild(row): o personagem hospedeiro de um talento.
//
// DECISÕES E ARMADILHAS
//   - Por PROSA, sem filtrar por fonte (§6.1). Uma pista é um INDÍCIO, não um defeito:
//     "advantage on" numa feature já curada em outro lugar (a Rage) aparece em `use`
//     e não é contada; em `passive` ela diz que o diálogo da rolagem não a oferece.
//   - O escopo vem da UNIDADE (a subclasse, a espécie, o talento) e, para a feature de
//     classe, da flag da própria feature: a do PHB é `srd`, a do XPHB é `srd52`.
//   - O hospedeiro de talento é simples (Fighter no 1 para origem, no 4 para o resto,
//     Wizard se a prosa pede magia): basta o item aparecer no ator, o pré-requisito não
//     importa para o catálogo. O sweep da T3 segue sendo a prova do talento em si.
//   - O que a ficha já deriva (CA, deslocamento, resistência, proficiência) não é pista:
//     o catálogo lê o ator derivado.
//   - A pista `dice` (DDL-0217) entra em `EXPLAINED` pelo SRD: o que sobra fora dele é o
//     trabalho das famílias F1 a F6 do plano; a lista só aparece com `--cue=dice` ou um
//     escopo, para o relatório inteiro não ficar com cem linhas.
//   - Desde o DDL-0215 as sobras ditas OPEN do G3 ganharam caminho, e o motivo diz qual: a CA
//     da ficha, as regras do dado de vida, o modificador de toda cura, o botão do card da
//     magia; o resto (Devouring Plague, Piercer, Arcane Deflection) entrou num registro e
//     conta como `use`.
//   - `EXPLAINED` nomeia, com o motivo, a pista de vantagem ou desvantagem que sobra sem
//     conta de propósito (DDL-0213): o texto a dá a outra criatura, só tira uma desvantagem
//     que o app nunca impõe, é um uso de uma vez (G3) ou fala do Sneak Attack. A pista
//     que sobrar fora dela é trabalho do G2.
//   - O `--prose` guarda cada efeito pela primeira unidade que o trouxe, com o escopo dela
//     na chave: a mesma feature num livro do SRD e em outro aparece nas duas listas.
// -----------------------------------------------------------------------------
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies, featMatrix } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { isActiveFeature, plainText } from '../src/engine/playFeatures.js';
import { featureRollOf } from '../src/engine/playFeatureRolls.js';
import { PASSIVE_FEATURES } from '../src/engine/playEffects.js';
import { REROLL_FEATURES } from '../src/engine/playRerolls.js';
import { resolveSubclassObj } from '../src/engine/resolve.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const SCOPE = args.scope ?? 'all';

const CUES = [
  ['advantage', /\badvantage on\b/],
  ['disadvantage', /\bdisadvantage on\b/],
  ['reroll', /\breroll\b|\broll (?:it |the die |the dice )?again\b/],
  ['dice', /\b\d+d\d+\b|\b(?:bardic inspiration|superiority|psionic energy|martial arts|exertion) die\b/],
  ['heal', /\bregains? (?:a number of )?hit points\b|\bregain hit points\b/],
  ['temp', /\btemporary hit points\b/],
  ['bonus', /\b(?:add|adds) (?:your |a |the |\w+ )?(?:\w+ )?(?:modifier|bonus|die|roll)\b.*?\bto\b|\bbonus to\b|\+\d+ bonus\b/],
  ['floor', /\btreat (?:a|the|any) .{0,30}roll of \d+ or lower as\b|\bcan't be lower than\b/],
];

const OTHER = 'the text gives it to another creature (an ally, an enemy, a summon, the bearer)';
const NEGATES = 'only removes a Disadvantage the app never imposes (range, a nearby enemy, a Hostile attitude)';
const ONCE = 'a use that gives it once, before the roll (G3, with the reroll family)';
const SNEAK = 'about when Sneak Attack works, not a roll mode';
const TWO_WEAPONS = 'the ability modifier of the extra attack of two weapons: the Attack panel says it (DDL-0147)';
const FAMILY = 'in another family of the plan (F1 a new attack, F3 options on Use, F4 a table)';
const TEXT = 'no number for the player: a description of what happens';
const AC = 'the sheet adds it to the AC (AC_BONUS_FEATURES, SUBCLASS_AC_BONUSES, naturalArmor; DDL-0215)';
const HP_CARD = "spends one Hit Point Die outside a rest: the HP card's Hit dice does it at any time (DDL-0120)";
const HIT_DICE = 'changes the Hit Point Die roll: HIT_DIE_RULES and REST_HIT_DICE_BONUS in engine/playRest (DDL-0215)';
const SLOT = 'a button on the cast card, by the slot level (CAST_TRIGGERS in engine/playCast, DDL-0215)';
const HEAL_MOD = 'added to every healing or Temporary Hit Points (healOutcome, tempHpOutcome; Honed Spellfire in the catalog; DDL-0215)';
const EXPLAINED = {
  advantage: {
    'cohort of chaos': OTHER, 'street justice': OTHER, 'team tactics': OTHER, 'adjust density': OTHER, 'potent stone': OTHER,
    'zhentarim ruffian': ONCE, 'vigilant blessing': ONCE, 'tides of chaos': ONCE,
    'insightful fighting': SNEAK, 'rakish audacity': SNEAK,
    'rapid strike': 'trades an Advantage away for an extra attack; nothing to add to the roll',
  },
  disadvantage: {
    'armor model: guardian': OTHER, guardian: OTHER, 'improved brutal strike': OTHER, 'heightened spell': OTHER,
    'boon of the furious storm': OTHER, 'cohort of chaos': OTHER, 'harper teamwork': OTHER, 'illusion adept': OTHER,
    slasher: OTHER, 'magical ambush': OTHER, 'eldritch strike': OTHER, 'adjust density': OTHER, 'eldritch hex': OTHER,
    'defensive tactics': OTHER, 'dread lord': OTHER, 'spiritual protectors': OTHER, 'power of the wilds': OTHER,
    'beasts of ill omen': OTHER, panache: OTHER, 'focused strike': OTHER,
    'boon of communication': NEGATES, bomber: NEGATES, 'crossbow expert': NEGATES, gunner: NEGATES, sharpshooter: NEGATES,
    'spell sniper': NEGATES, 'street justice': NEGATES, hawkeyed: NEGATES, 'firearms mastery': NEGATES,
    'insightful fighting': SNEAK, 'rakish audacity': SNEAK,
    'unpredictable movement': 'a condition of another rule (no Disadvantage on the Initiative roll)',
  },
  bonus: {
    'improved brutal strike': OTHER, "oketra's blessing": OTHER, "rhonas's blessing": OTHER, 'dashing strikes': OTHER, 'health funnel': OTHER,
    'crossbow expert': TWO_WEAPONS, 'dual wielder': TWO_WEAPONS,
    'experimental elixir': FAMILY, 'armor model': FAMILY, 'animal enhancement': FAMILY, 'radiant sun bolt': FAMILY,
    'soul of the forge': AC, 'agile parry': AC, 'awakened astral self': AC, defense: AC, 'tauren lineage (taunka)': AC, 'integrated protection': AC, 'revenant blade': AC,
    'dwarven fortitude': HP_CARD,
    'sharpen the blade': FAMILY,
    'sanctuary vessel': TEXT, "artisan's expertise": 'double proficiency and proficiency, the sheet derives them',
  },
  reroll: {
    'bountiful luck': OTHER, 'second chance': OTHER, 'shared resilience': OTHER,
    'black blood healing': HIT_DICE,
  },
  heal: {
    'guardian spirit': OTHER, 'holy deliverance': OTHER, 'rot and violence': OTHER, 'master of hexes': 'it takes a healing away; nothing to roll',
    'pet specialization': OTHER, 'infusion of light': 'refills a pool by the damage rolled: the pool is adjusted by hand (DDL-0209)',
    'experimental elixir': FAMILY, 'holy bolt': FAMILY, 'mystic brew': FAMILY,
    'dwarven fortitude': HP_CARD, 'healing machine': HP_CARD, 'emergency fail-safe': HP_CARD, 'inner peace': HIT_DICE, 'troll healing': HIT_DICE, 'vigor of the hill giant': HIT_DICE, 'boon of bountiful health': HIT_DICE,
    'boon of fortitude': HEAL_MOD,
    'blessed healer': SLOT,
    'necromancy spellbook': TEXT,
  },
  temp: {
    tundra: OTHER, 'mote of potential': OTHER, 'improved warding flare': OTHER, 'fortifying spell': OTHER, 'luminous barrier': OTHER,
    'durable summons': OTHER, 'create thrall': OTHER, 'health funnel': OTHER, 'semblance of life': OTHER, 'enveloping mist': OTHER,
    'boon of bountiful health': HEAL_MOD, 'honed spellfire': HEAL_MOD,
    'abjuration adept': SLOT,
  },
  floor: {},
  dice: {
    appearance: 'a table for how the tiefling looks (1d4 + 1 features), not a roll in play',
    'improved elemental fury': 'the scale raises the Primal Strike die (FEATURE_ROLLS passive)',
    'improved blessed strikes': 'the scale raises the Divine Strike die; the Use gives the temp HP',
    'supreme healing': 'every spell healing die at its maximum (withDiceMax in spellHealEvent, DDL-0217)',
  },
};

const db = loadDb();
const species = defaultSpecies(db);
const seen = new Map();
const proseSeen = new Map();
const proseUseSeen = new Map();
const classFeatureFlags = new Map();
for (const key of Object.keys(db).filter((k) => k.startsWith('class-'))) {
  for (const f of db[key].classFeature ?? []) classFeatureFlags.set(`${f.name}|${f.source}`.toLowerCase(), f.srd52 ? 'srd52' : f.srd ? 'srd51' : 'other');
}

/** O escopo da feature: 'srd52', 'srd51' ou 'other'. */
function scopeOf(f, unit) {
  if (f.kind === 'class' && unit.kind === 'class') return classFeatureFlags.get(`${f.name}|${f.source}`.toLowerCase()) ?? unit.scope;
  return unit.scope;
}

/** As pistas de mecânica do texto. */
function cuesOf(text) {
  const t = text.toLowerCase();
  return CUES.filter(([, re]) => re.test(t)).map(([c]) => c);
}

/** 'use', 'log' ou 'passive'. */
function classify(f, action, pools, bridged) {
  if ((action?.activities ?? []).length || pools.length || (f.roll && f.roll !== 'passive') || bridged || PASSIVE_FEATURES.includes(f.name.toLowerCase()) || REROLL_FEATURES.includes(f.name.toLowerCase())) return 'use';
  return isActiveFeature(f, action, pools) ? 'log' : 'passive';
}

/** Soma as features de um catálogo ao relatório. */
function visit(catalog, unit) {
  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const bridged = new Set([...(catalog.actorEffects ?? []), ...(catalog.proseEffects ?? [])].map((e) => e.name));
  for (const e of catalog.proseEffects ?? []) {
    const sig = `${e.name}|${e.index}|${e.mode}|${unit.scope}`;
    if (!proseSeen.has(sig)) proseSeen.set(sig, { ...e, scope: unit.scope });
  }
  for (const u of catalog.proseUses ?? []) if (!proseUseSeen.has(`${u.name}|${unit.scope}`)) proseUseSeen.set(`${u.name}|${unit.scope}`, { ...u, scope: unit.scope });
  for (const f of catalog.featureList ?? []) {
    const key = `${f.name}|${f.source}|${f.section}`;
    if (seen.has(key)) continue;
    const action = actions.get(f.actionKey);
    const mine = pools.filter((p) => p.item === f.name);
    const text = plainText(f.entries);
    seen.set(key, { name: f.name, source: f.source, kind: f.kind, section: f.section, unit: unit.id, scope: scopeOf(f, unit), cat: classify(f, action, mine, bridged.has(f.name)), cues: cuesOf(text), registry: !!featureRollOf(f.name), text });
  }
}

const flag = (o) => (o?.srd52 ? 'srd52' : o?.srd ? 'srd51' : 'other');

for (const row of classMatrix(db)) {
  const sub = row.subclassId ? resolveSubclassObj(db, row.classId, row.subclassId, row.subclassSource) : null;
  const built = autoBuild(db, { classId: row.classId, classSource: row.classSource, subclassId: row.subclassId, subclassSource: row.subclassSource, level: 20, ...species, seed: hashSeed(row.id, 1) });
  visit(derivePlayCatalog(built.character, db), { id: row.id, kind: 'class', scope: flag(sub) });
}
for (const row of speciesMatrix(db)) {
  const race = (db.races?.race ?? []).find((r) => r.name === row.speciesName && r.source === row.speciesSource);
  const built = autoBuild(db, { classId: 'fighter', classSource: 'XPHB', level: 5, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, 1) });
  visit(derivePlayCatalog(built.character, db), { id: row.id, kind: 'species', scope: flag(race) });
}

/** O personagem hospedeiro de um talento. */
function featBuild(row) {
  const feat = (db.feats?.feat ?? []).find((x) => x.name === row.name && x.source === row.source);
  const origin = row.category === 'O' || row.category === 'D';
  const caster = /spell/i.test(JSON.stringify(feat?.prerequisite ?? ''));
  const slot = { G: ['feat@4', 4], FS: ['feat@1', 1], 'FS:P': ['feat@2', 2], 'FS:R': ['feat@2', 2], EB: ['feat@19', 19] }[row.category] ?? ['feat@4', 4];
  const classId = row.category === 'FS:P' ? 'paladin' : row.category === 'FS:R' ? 'ranger' : caster ? 'wizard' : 'fighter';
  const id = `${row.name}|${row.source}`;
  return autoBuild(db, {
    classId, classSource: 'XPHB', level: origin ? 1 : slot[1], ...species, seed: 7,
    ...(origin ? { originFeat: { id: row.name, source: row.source } } : {}),
    preset: (c) => { if (!origin) c.classes[0].choices[slot[0]] = { kind: 'feat', picks: [id], sub: {} }; },
  });
}
for (const row of featMatrix(db)) {
  const feat = (db.feats?.feat ?? []).find((x) => x.name === row.name && x.source === row.source);
  let built;
  try { built = featBuild(row); } catch { continue; }
  const catalog = derivePlayCatalog(built.character, db);
  catalog.featureList = (catalog.featureList ?? []).filter((f) => f.kind === 'feat' && f.name === row.name);
  visit(catalog, { id: row.id, kind: 'feat', scope: flag(feat) });
}

const all = [...seen.values()].filter((f) => SCOPE === 'all' || f.scope === SCOPE || (SCOPE === 'srd' && f.scope !== 'other'));
const table = {};
for (const f of all) {
  const row = (table[`${f.kind}`] ??= { use: 0, log: 0, passive: 0 });
  row[f.cat]++;
}
console.log(`features distintas (${SCOPE}): ${all.length}`);
console.table(table);
const cueTable = {};
for (const f of all.filter((x) => x.cat !== 'use')) {
  for (const c of f.cues) {
    const row = (cueTable[c] ??= { log: 0, passive: 0 });
    row[f.cat]++;
  }
}
const withCue = {};
for (const f of all.filter((x) => x.cat !== 'use' && x.cues.length)) {
  const row = (withCue[f.kind] ??= { log: 0, passive: 0 });
  row[f.cat]++;
}
console.log('features sem conta com ao menos uma pista (o trabalho provável):');
console.table(withCue);
console.log('pistas de mecânica sem conta (log e passive):');
console.table(cueTable);
const unexplained = {};
const open = new Map();
for (const [cue, names] of Object.entries(EXPLAINED)) {
  const pending = all.filter((x) => x.cat !== 'use' && x.cues.includes(cue));
  const left = pending.filter((x) => !names[x.name.toLowerCase()]);
  unexplained[cue] = { 'sem explicação': left.length, 'em aberto (OPEN)': pending.filter((x) => /^OPEN/.test(names[x.name.toLowerCase()] ?? '')).length };
  if (cue !== 'dice' || args.cue === 'dice' || SCOPE !== 'all') for (const f of left) console.log(`  sem explicação (${cue}): ${f.name} [${f.source}]`);
  for (const f of pending) {
    const why = names[f.name.toLowerCase()] ?? '';
    if (/^OPEN/.test(why)) open.set(why.match(/^OPEN \(([^)]+)\)/)?.[1] ?? why, new Set([...(open.get(why.match(/^OPEN \(([^)]+)\)/)?.[1] ?? why) ?? []), f.name]));
  }
}
console.log('pistas sem conta: sem explicação (o G2 e o G3 fecham em 0) e em aberto, com nome:');
console.table(unexplained);
console.log('famílias em aberto (features distintas):');
for (const [family, names] of open) console.log(`  ${family}: ${names.size} (${[...names].join(', ')})`);
if (args.prose) {
  const list = [...proseSeen.values()].filter((e) => SCOPE === 'all' || e.scope === SCOPE || (SCOPE === 'srd' && e.scope !== 'other')).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`efeitos da prosa (G2): ${list.length}`);
  for (const e of list) {
    const groups = e.groups.map((g) => `${g.kind}${g.abilities.length ? `:${g.abilities.join('/')}` : ''}${g.skills.length ? `(${g.skills.join('/')})` : ''}`).join(' + ');
    const what = e.mode ?? (e.part ? `+${e.part.formula}` : e.rerollOnes ? 'ro1' : `min${e.d20Min}`);
    console.log(`${e.defaultOn ? 'ON ' : 'off'} ${what} ${e.name}: ${groups}${e.note ? ` | ${e.note}` : ''}`);
  }
  const uses = [...proseUseSeen.values()].filter((u) => SCOPE === 'all' || u.scope === SCOPE || (SCOPE === 'srd' && u.scope !== 'other')).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`usos da prosa (G3, cura e temporários): ${uses.length}`);
  for (const u of uses) console.log(`${u.apply.padEnd(4)} ${u.name}: ${u.formula}${u.note ? ` | ${u.note}` : ''}`);
}
if (args.list || args.cue) {
  const list = all.filter((f) => (!args.list || f.cat === args.list) && (!args.cue || f.cues.includes(args.cue)))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
  for (const f of list) {
    console.log(`${f.cat.padEnd(7)} ${f.scope.padEnd(6)} ${f.name} [${f.source}] (${f.section}) ${f.cues.join(',')}`);
    if (args.text) console.log(`    ${f.text.slice(0, 500)}\n`);
  }
}
