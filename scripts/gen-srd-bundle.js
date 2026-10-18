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
//   srdCorpus(): o texto oficial do SRD 5.2, dos packs `*24` do dnd5e, já
//     normalizado para comparação, e o nome de cada documento.
//   renamesModule(map): o src/engine/srdRenamesData.js gerado (nome antigo ->
//     nome do SRD), para resolver fichas entre os dois modos.
//   main(): gera, varre, grava e falha se sobrar nome protegido.
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

/** O texto do SRD 5.2 (packs `*24`) e os nomes dos seus documentos. */
function srdCorpus() {
  const dirs = readdirSync(PACKS).filter((d) => d.endsWith('24'));
  const files = dirs.flatMap((d) => walk(join(PACKS, d)))
    .filter((f) => !/premades|legal-information|disclaimer/.test(f));
  const texts = files.map((f) => readFileSync(f, 'utf8'));
  const docNames = new Set();
  for (const t of texts) {
    const m = t.match(/^name: (.*)$/m);
    if (m) docNames.add(normalizeCorpus(m[1].replace(/^['"]|['"]$/g, '')));
  }
  return { corpus: normalizeCorpus(texts.map((t) => t.replace(/\s*\n\s*/g, ' ')).join(' ')), docNames };
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
  const { bundle, report } = buildSrdBundle(full, { textFixes: TEXT_FIXES, extraRenames: EXTRA_RENAMES });
  const { corpus, docNames } = srdCorpus();
  const hits = scanProtected(bundle, PROTECTED_TERMS, corpus, { docNames });

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
