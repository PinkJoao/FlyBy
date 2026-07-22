// =============================================================================
// gen-compendium-uuids - gera src/engine/compendiumUuidsData.js
// =============================================================================
// Lê o SOURCE do sistema dnd5e (`DnD Source Material/DnD 5e System Source Code/
// packs/_source`, MIT + SRD/CC-BY, git-ignored) e extrai apenas os IDENTIFICADORES
// dos documentos de compêndio (`_id` + `name`) - nenhum texto de regra é copiado.
//
// Para que servem: o item de classe/subclasse do Foundry precisa de um ItemGrant
// por nível FUTURO cujo `configuration.items[].uuid` aponte para o compêndio, ou
// subir de nível dentro do Foundry não concede nada (ver DDL sobre level-up).
// Um uuid RELATIVO (`.id`) não serve: o item ainda não existe no ator.
//
// Escopo = o que o dnd5e realmente publica (SRD 2024): as 12 classes XPHB com
// todas as suas features, UMA subclasse por classe, e as magias. Fora disso
// (Artificer, subclasses não-SRD) não há uuid e a escada simplesmente não é
// emitida - o comportamento volta a ser o de hoje (re-exportar após subir).
//
// Uso: `npm run gen:uuids` (só precisa rodar quando o sistema dnd5e atualizar).
// A SAÍDA é commitada; o material de referência não é (DDL-0037).
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const OUT = join(ROOT, 'src', 'engine', 'compendiumUuidsData.js');

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/** Todos os .yml de uma pasta (recursivo), ignorando os marcadores `_folder`. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.yml') && e !== '_folder.yml') out.push(p);
  }
  return out;
}

/**
 * Campos de TOPO de um documento do pack. Regex em vez de um parser de YAML: só
 * lemos três chaves não indentadas (`_id`, `name`, `type`), o que é estável no
 * formato do dnd5e e evita uma dependência só para o gerador.
 */
function head(file) {
  const txt = readFileSync(file, 'utf8');
  const pick = (k) => txt.match(new RegExp(`^${k}: *(.+)$`, 'm'))?.[1]?.trim();
  const name = pick('name')?.replace(/^['"]|['"]$/g, '');
  return { id: pick('_id'), name, type: pick('type') };
}

if (!existsSync(PACKS)) {
  console.error(`Pack do dnd5e não encontrado em ${PACKS}\nColoque o "DnD Source Material" na raiz do projeto (DDL-0037).`);
  process.exit(1);
}

const classFeatures = {}; // 'classId|feature'            → _id
const subclasses = {}; //    'classId|subclasse'          → _id
const subclassFeatures = {}; // 'classId|subclasse|feature' → _id
const spells = {}; //         'magia'                     → _id

const CLASSES_DIR = join(PACKS, 'classes24');
for (const classDir of readdirSync(CLASSES_DIR)) {
  const dir = join(CLASSES_DIR, classDir);
  if (!statSync(dir).isDirectory()) continue;
  const classId = norm(classDir);

  // Features de classe.
  for (const f of walk(join(dir, 'class-features'))) {
    const { id, name, type } = head(f);
    if (type !== 'feat' || !id || !name) continue; // 'weapon' (Unarmed Strike) mora no equipment24
    classFeatures[`${classId}|${norm(name)}`] = id;
  }

  // Subclasses do pack (arquivos soltos na raiz da pasta da classe).
  const subs = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (!e.endsWith('.yml') || e === '_folder.yml' || statSync(p).isDirectory()) continue;
    const h = head(p);
    if (h.type !== 'subclass' || !h.id || !h.name) continue;
    subs.push(h);
    subclasses[`${classId}|${norm(h.name)}`] = h.id;
  }

  // Features de subclasse. O nome da PASTA não bate com o da subclasse
  // ('circle-of-land' vs "Circle of the Land"), então enquanto o pack publica
  // UMA subclasse por classe atribuímos todas a ela. Se isso mudar, o gerador
  // avisa em vez de adivinhar.
  const subFeatureFiles = walk(join(dir, 'subclass-features'));
  if (subFeatureFiles.length && subs.length !== 1) {
    console.warn(`AVISO: ${classId} tem ${subs.length} subclasses no pack; features de subclasse ignoradas (o gerador precisa de uma regra de pasta→subclasse).`);
    continue;
  }
  for (const f of subFeatureFiles) {
    const { id, name, type } = head(f);
    if (type !== 'feat' || !id || !name) continue;
    subclassFeatures[`${classId}|${norm(subs[0].name)}|${norm(name)}`] = id;
  }
}

for (const f of walk(join(PACKS, 'spells24'))) {
  const { id, name, type } = head(f);
  if (type !== 'spell' || !id || !name) continue;
  spells[norm(name)] = id;
}

/** Literal de objeto ordenado por chave (diff estável entre regerações). */
function literal(obj, indent = '  ') {
  const keys = Object.keys(obj).sort();
  if (!keys.length) return '{}';
  return `{\n${keys.map((k) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`).join('\n')}\n}`;
}

const out = `// =============================================================================
// compendiumUuidsData - GERADO por \`npm run gen:uuids\`. NÃO EDITE À MÃO.
// =============================================================================
// Identificadores de documentos dos compêndios do sistema dnd5e (SRD 2024, MIT +
// CC-BY-4.0), extraídos de packs/_source. Apenas ids e nomes - nenhum conteúdo de
// jogo é redistribuído aqui. Consumidos por engine/compendiumUuids.js para montar
// os ItemGrant de níveis FUTUROS (ver o módulo irmão para o porquê).
//
// Cobertura: as 12 classes XPHB (${Object.keys(classFeatures).length} features), ${Object.keys(subclasses).length} subclasses SRD
// (${Object.keys(subclassFeatures).length} features) e ${Object.keys(spells).length} magias.
// -----------------------------------------------------------------------------

/** Pacote de compêndio de cada mapa (prefixo do uuid). */
export const PACK_CLASSES = 'Compendium.dnd5e.classes24.Item';
export const PACK_SPELLS = 'Compendium.dnd5e.spells24.Item';

/** \`classId|nomeDaFeature\` → _id (pacote classes24). */
export const CLASS_FEATURE_IDS = ${literal(classFeatures)};

/** \`classId|nomeDaSubclasse\` → _id (pacote classes24). */
export const SUBCLASS_IDS = ${literal(subclasses)};

/** \`classId|nomeDaSubclasse|nomeDaFeature\` → _id (pacote classes24). */
export const SUBCLASS_FEATURE_IDS = ${literal(subclassFeatures)};

/** \`nomeDaMagia\` → _id (pacote spells24). */
export const SPELL_IDS = ${literal(spells)};
`;

writeFileSync(OUT, out);
console.log(
  `compendiumUuidsData.js gerado: ${Object.keys(classFeatures).length} features de classe, `
  + `${Object.keys(subclasses).length} subclasses, ${Object.keys(subclassFeatures).length} features de subclasse, `
  + `${Object.keys(spells).length} magias.`,
);
