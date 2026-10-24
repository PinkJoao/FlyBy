// =============================================================================
// gen-srd-bundle: gera src/data/srdBundle.json (npm run gen:srd-bundle)
// =============================================================================
// O QUE FAZ
//   O pacote SRD 5.2 que o app embute (DDL-0091): o subconjunto `srd52` do
//   snapshot local do 5etools, com os nomes do SRD, sem fluff e sem referência a
//   conteúdo de fora. A lógica pura está em scripts/lib/srdBundle.js; aqui ficam
//   a leitura, as correções curadas, a lista de nomes protegidos e a gravação.
//   Rodar quando o snapshot do 5etools atualizar; a SAÍDA é commitada, o
//   material de referência não. Licença do conteúdo: CC-BY-4.0 (SRD 5.2, Wizards
//   of the Coast); estrutura JSON: MIT (5etools). Ver NOTICE.
//
// FUNÇÕES
//   walk(dir, out): os .yml de uma pasta, recursivo.
//   srdCorpus(edition): o texto oficial do SRD 5.2 (packs `*24` do dnd5e) ou do
//     SRD 5.1 (SRD51_PACKS, os sem sufixo), já normalizado para comparação, o
//     nome de cada documento e, à parte, o de cada página do texto de regras.
//   renamesModule(map): o src/engine/srdRenamesData.js gerado (nome antigo ->
//     nome do SRD), para resolver fichas entre os dois modos.
//   main(): gera, varre, grava e falha se sobrar nome protegido, ou se uma
//     entrada das listas fechadas não existir no dado ou no SRD.
//
// DECISÕES E ARMADILHAS
//   - PROTECTED_TERMS: nomes próprios de magos e deuses, cenários, livros e
//     monstros exclusivos. Um termo só passa se o mesmo trecho existe no SRD;
//     o que não passa precisa de uma entrada em TEXT_FIXES, senão a geração
//     FALHA. Termo novo entra aqui, nunca uma exceção silenciosa.
//   - TEXT_FIXES segue a redação do próprio SRD 5.2 (packs do dnd5e): o Deck of
//     Illusions do SRD troca o Beholder pelo Basilisk; o Bedroll do SRD não cita
//     o Dungeon Master's Guide; o Dragon Orb do SRD não tem a lore de Dragonlance.
//     Chave: "Nome|Fonte" ORIGINAIS do 5etools. A tabela do Deck of Illusions é
//     o único caso em que o SRD TROCA o conteúdo (Beholder -> Basilisk, mesma
//     faixa 13-15); nos outros ele só não cita o livro.
//   - EXTRA_RENAMES: nomes que o SRD troca e o 5etools não marca com `srd52`
//     string: o grupo "Quaal's Feather Token" (as variantes já vêm marcadas) e
//     "Lolth's Sting", que o SRD publica como "Spider's Sting" (o 5etools marca
//     `srd52: true`, e o corpo do item no próprio SRD ainda diz "Lolth's").
//   - O corpus exclui os premades (actors24/premades) e as páginas de licença:
//     um nome citado ali não é texto de regra.
//   - SRD51_EXTRAS (DDL-0107): o que o SRD 5.1 (2014, também CC-BY-4.0) tem e o
//     5.2 não, e serve a uma ficha 2024: Half-Elf e Half-Orc (com as sub-raças
//     sem nome, que só carregam a flag), as 13 invocações que o 2024 cortou e 25
//     itens mundanos que o PHB 2024 tirou (o Spellbook entre eles). Lista
//     FECHADA, levantada em 2026-10-23: magias, o talento, o background, os
//     itens mágicos e as subclasses do 5.1 já estão no 5.2, e as features das
//     classes de 2014 não servem a um app 2024. Um extra só passa com a flag
//     `srd` do 5etools, e a varredura dele usa o texto do SRD 5.1.
//   - SRD52_UNFLAGGED (TC-0098, DDL-0109): o que o SRD 5.2 publica e o 5etools não marca
//     com `srd52`, por isso o filtro deixava de fora. Chave "Nome|Fonte" do
//     5etools -> nome do documento (ou da página do glossário) no SRD 5.2 do
//     dnd5e; a geração FALHA se a entrada não existir no dado ou se o nome não
//     for documento nem página do SRD. Lista FECHADA, levantada em 2026-10-24
//     varrendo as entradas 2024 sem a flag contra os packs `*24` e contra o PDF
//     do SRD 5.2.1: as ações Influence e Study, Map, String, Airship e dois
//     jogos (o SRD os lista entre as variantes do Gaming Set), os três focos de
//     conjuração, as duas Fighting Styles de classe (Blessed Warrior, Druidic
//     Warrior), 7 invocações, 2 metamagias e o Weapon of Warning. Arcane Vigor
//     fica FORA de propósito: o pack `spells24` do dnd5e tem o documento, mas o
//     texto do SRD 5.2.1 não tem a magia. Improvising an Action também (só
//     Basic Rules). Um pack `*24` não basta como prova sozinho.
//   - Saída sem espaços nem timestamp: o diff entre duas gerações é só conteúdo.
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { buildSrdBundle, normalizeCorpus, scanProtected } from './lib/srdBundle';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const OUT = join(ROOT, 'src', 'data', 'srdBundle.json');
const OUT_RENAMES = join(ROOT, 'src', 'engine', 'srdRenamesData.js');

const PROTECTED_TERMS = [
  'Tasha', 'Mordenkainen', 'Bigby', 'Melf', 'Otiluke', 'Otto', 'Evard', 'Leomund', 'Rary',
  'Drawmij', 'Nystul', 'Tenser', 'Heward', 'Daern', 'Nolzur', 'Quaal', 'Keoghtom', 'Bilarro',
  'Kwalish', 'Ehlonna', 'Abi-Dalzim', 'Snilloc', 'Tiamat', 'Bahamut', 'Lolth', 'Vecna',
  'Asmodeus', 'Strahd', 'Acererak', 'Elminster', 'Drizzt', 'Zariel', 'Mephistopheles',
  'Orcus', 'Demogorgon', 'Tharizdun', 'Gruumsh', 'Corellon', 'Moradin', 'Kelemvor', 'Mystra',
  'Lathander', 'Tymora', 'Forgotten Realms', 'Faerun', 'Faerûn', 'Greyhawk', 'Eberron',
  'Ravenloft', 'Dragonlance', 'Krynn', 'Spelljammer', 'Planescape', 'Sigil', 'Waterdeep',
  "Baldur's Gate", 'Netheril', 'Beholder', 'Mind Flayer', 'Illithid', 'Githyanki', 'Githzerai',
  'Yuan-ti', 'Displacer Beast', 'Carrion Crawler', 'Umber Hulk', 'Kuo-toa', 'Slaad',
  'Thri-kreen', 'Xanathar', 'Volo', "Player's Handbook", 'Monster Manual',
  "Dungeon Master's Guide", 'Dungeons & Dragons', 'Dungeons and Dragons', 'D&D',
  'Wizards of the Coast', 'Feywild', 'Shadowfell',
];

const DROP_MM_BAG = { replace: [" See the {@book Monster Manual|XMM} for the creature's stat block.", ''] };
const DROP_DMG_COLD = { replace: [" (see the {@book Dungeon Master's Guide|XDMG})", ''] };

const TEXT_FIXES = {
  'Bag of Tricks, Gray|XDMG': [DROP_MM_BAG],
  'Bag of Tricks, Rust|XDMG': [DROP_MM_BAG],
  'Bag of Tricks, Tan|XDMG': [DROP_MM_BAG],
  'Iron Flask|XDMG': [{ replace: [" (see the {@book Monster Manual|XMM} for the creature's stat block)", ''] }],
  'Bedroll|XPHB': [DROP_DMG_COLD],
  'Blanket|XPHB': [DROP_DMG_COLD],
  'Deck of Many Things|XDMG': [{ replace: [" (see the {@book Dungeon Master's Guide|XDMG|7})", ''] }],
  'Folding Boat|XDMG': [{ replace: ["Statistics for the {@item Rowboat|XPHB} and {@item Keelboat|XPHB} appear in the {@book Player's Handbook|XPHB}. ", ''] }],
  'Challenge Rating|XPHB': [{ replace: [" The {@book Dungeon Master's Guide|XDMG} provides guidance to the DM on using CR while planning potential combat {@variantrule Encounter|XPHB|encounters}.", ''] }],
  'Experience Points|XPHB': [{ replace: [" The {@book Dungeon Master's Guide|XDMG} provides guidance on awarding XP.", ''] }],
  'Orb of Dragonkind|XDMG': [{ dropString: 'Dragonlance setting' }],
  'Deck of Illusions|XDMG': [{ replace: ['{@creature Beholder|XMM}', '{@creature Basilisk|XMM}'] }],
};

const EXTRA_RENAMES = {
  "Quaal's Feather Token": 'Feather Token',
  "Lolth's Sting": "Spider's Sting",
};

const SRD51_EXTRAS = {
  'races.race': ['Half-Elf|PHB', 'Half-Orc|PHB'],
  'races.subrace': ['|PHB|Half-Elf', '|PHB|Half-Orc'],
  'optionalfeatures.optionalfeature': [
    'Beast Speech|PHB', 'Beguiling Influence|PHB', 'Bewitching Whispers|PHB', 'Chains of Carceri|PHB',
    'Dreadful Word|PHB', 'Eldritch Sight|PHB', 'Eyes of the Rune Keeper|PHB', 'Minions of Chaos|PHB',
    'Mire the Mind|PHB', 'Sculptor of Flesh|PHB', 'Sign of Ill Omen|PHB', 'Thief of Five Fates|PHB',
    'Voice of the Chain Master|PHB',
  ],
  'items.item': [
    'Abacus|PHB', 'Ale (gallon)|PHB', 'Bit and bridle|PHB', 'Chalk (1 piece)|PHB', 'Chunk of Meat|PHB',
    'Donkey|PHB', 'Fishing Tackle|PHB', 'Hammer|PHB', 'Hourglass|PHB', "Merchant's Scale|PHB", 'Mess Kit|PHB',
    "Miner's Pick|PHB", 'Pack Saddle|PHB', 'Pitcher|PHB', 'Piton|PHB', 'Saddlebags|PHB', 'Sealing Wax|PHB',
    'Signet Ring|PHB', 'Silk Rope (50 feet)|PHB', 'Sledgehammer|PHB', 'Soap|PHB', 'Spellbook|PHB',
    'Tankard|PHB', 'Totem|PHB', 'Whetstone|PHB',
  ],
};

const SRD52_UNFLAGGED = {
  'actions.action': { 'Influence|XPHB': 'Influence', 'Study|XPHB': 'Study' },
  'items.item': {
    'Map|XPHB': 'Map', 'String|XPHB': 'String', 'Airship|XPHB': 'Airship',
    'Dragonchess Set|XPHB': 'Dragonchess', 'Three-Dragon Ante Set|XPHB': 'Three-dragon ante',
  },
  'items.itemGroup': {
    'Arcane Focus|XPHB': 'Arcane Focus (Varies)', 'Druidic Focus|XPHB': 'Druidic Focus (Varies)',
    'Holy Symbol|XPHB': 'Holy Symbol (Varies)',
  },
  'feats.feat': { 'Blessed Warrior|XPHB': 'Blessed Warrior', 'Druidic Warrior|XPHB': 'Druidic Warrior' },
  'optionalfeatures.optionalfeature': {
    'Devouring Blade|XPHB': 'Devouring Blade', 'Eldritch Mind|XPHB': 'Eldritch Mind',
    'Eldritch Smite|XPHB': 'Eldritch Smite', 'Gift of the Depths|XPHB': 'Gift of the Depths',
    'Gift of the Protectors|XPHB': 'Gift of the Protectors',
    'Investment of the Chain Master|XPHB': 'Investment of the Chain Master',
    'Lessons of the First Ones|XPHB': 'Lessons of the First Ones',
    'Seeking Spell|XPHB': 'Seeking Spell', 'Transmuted Spell|XPHB': 'Transmuted Spell',
  },
  'magicvariants.magicvariant': { 'Weapon of Warning|XDMG': 'Weapon of Warning' },
};

/** Os .yml de uma pasta, recursivo. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.yml')) out.push(p);
  }
  return out;
}

const SRD51_PACKS = ['backgrounds', 'classes', 'classfeatures', 'items', 'races', 'rules', 'spells', 'subclasses', 'tables', 'tradegoods'];

/** O texto de um SRD (5.2: packs `*24`; 5.1: os de SRD51_PACKS) e os nomes dos seus documentos. */
function srdCorpus(edition = '5.2') {
  const dirs = edition === '5.1' ? SRD51_PACKS : readdirSync(PACKS).filter((d) => d.endsWith('24'));
  const files = dirs.flatMap((d) => walk(join(PACKS, d)))
    .filter((f) => !/premades|legal-information|disclaimer/.test(f));
  const texts = files.map((f) => readFileSync(f, 'utf8'));
  const clean = (s) => normalizeCorpus(s.replace(/^['"]|['"]$/g, ''));
  const docNames = new Set();
  const pageNames = new Set();
  texts.forEach((t, i) => {
    const m = t.match(/^name: (.*)$/m);
    if (m) docNames.add(clean(m[1]));
    if (/content24/.test(files[i])) for (const p of t.matchAll(/^ {4}name: (.*)$/gm)) pageNames.add(clean(p[1]));
  });
  return { corpus: normalizeCorpus(texts.map((t) => t.replace(/\s*\n\s*/g, ' ')).join(' ')), docNames, pageNames };
}

/** O módulo gerado com as trocas de nome (antigo minúsculo -> nome do SRD). */
function renamesModule(map) {
  const rule = '='.repeat(77);
  const dash = '-'.repeat(77);
  const lines = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([old, to]) => `  ${JSON.stringify(old)}: ${JSON.stringify(to)},`);
  return [
    `// ${rule}`,
    '// srdRenamesData: GERADO por npm run gen:srd-bundle; não edite à mão',
    `// ${rule}`,
    '// O QUE FAZ',
    '//   SRD_RENAMES: nome do 5etools (minúsculo) -> nome com que o SRD 5.2 publica',
    '//   a mesma entrada (`srd52` string no dado, mais as trocas curadas do gerador).',
    '//   Consumido por engine/srdNames.js para uma ficha feita com o compêndio',
    '//   completo abrir no modo SRD e vice-versa (DDL-0091). Só nomes, como chave de',
    '//   busca; o pacote SRD em si não contém os nomes antigos.',
    `// ${dash}`,
    '',
    '/** @type {Readonly<Record<string, string>>} */',
    'export const SRD_RENAMES = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

function main() {
  if (!existsSync(PACKS)) throw new Error('Packs do dnd5e não encontrados (./DnD Source Material).');
  const full = loadDb();
  const { bundle, report } = buildSrdBundle(full, {
    textFixes: TEXT_FIXES, extraRenames: EXTRA_RENAMES, legacy: SRD51_EXTRAS, unflagged: SRD52_UNFLAGGED,
  });
  const { corpus, docNames, pageNames } = srdCorpus('5.2');
  const notInSrd = Object.entries(SRD52_UNFLAGGED)
    .flatMap(([where, map]) => Object.entries(map).map(([k, srdName]) => [`${where}:${k}`, normalizeCorpus(srdName)]))
    .filter(([, n]) => !docNames.has(n) && !pageNames.has(n))
    .map(([k]) => k);
  if (report.unflaggedMissing.length || notInSrd.length) {
    if (report.unflaggedMissing.length) console.error(`SRD 5.2 sem a flag pedidas e não achadas no dado: ${report.unflaggedMissing.join(', ')}`);
    if (notInSrd.length) console.error(`SRD 5.2 sem a flag cujo nome não é documento nem página do SRD: ${notInSrd.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`SRD 5.2 sem a flag srd52 (lista fechada): ${report.unflagged}`);
  if (report.unflaggedFlagged.length) console.log(`  já marcadas pelo 5etools, tirar da lista: ${report.unflaggedFlagged.join(', ')}`);
  const old = srdCorpus('5.1');
  const hits = scanProtected(bundle, PROTECTED_TERMS, corpus, { docNames, legacyCorpus: old.corpus, legacyDocNames: old.docNames });
  if (report.legacyMissing.length) {
    console.error(`Extras do SRD 5.1 pedidos e não achados (com a flag srd): ${report.legacyMissing.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Extras do SRD 5.1: ${report.legacy}`);

  for (const [k, [kept, total]] of Object.entries(report.counts)) {
    if (kept) console.log(`  ${k}: ${kept}/${total}`);
  }
  console.log(`Renomeadas para o nome do SRD: ${report.renames}`);
  if (report.unusedFixes.length) console.log(`TEXT_FIXES sem entrada correspondente: ${report.unusedFixes.join(', ')}`);

  if (hits.length) {
    console.error(`\n${hits.length} nome(s) protegido(s) sem o mesmo trecho no SRD:`);
    for (const h of hits) console.error(`  ${h.where}  [${h.term}]  "${h.text}"`);
    process.exitCode = 1;
    return;
  }
  const json = JSON.stringify(bundle);
  writeFileSync(OUT, json);
  writeFileSync(OUT_RENAMES, renamesModule(report.renameMap));
  console.log(`\nVarredura limpa. ${OUT} (${(json.length / 1e6).toFixed(2)} MB)`);
  console.log(`${OUT_RENAMES} (${Object.keys(report.renameMap).length} nomes)`);
}

main();
