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

// Apóstrofo tipográfico → reto (ver engine/compendiumUuids.js: mesma regra).
const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

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
 * `subtype` é o `system.type.value` (INDENTADO) - a única chave interna lida, e
 * só ela: é a classificação de inventário do item (TC-0066), não conteúdo.
 */
function head(file) {
  const txt = readFileSync(file, 'utf8');
  const pick = (k) => txt.match(new RegExp(`^${k}: *(.+)$`, 'm'))?.[1]?.trim();
  const unquote = (s) => s?.replace(/^['"]|['"]$/g, '');
  const subtype = unquote(txt.match(/^ +type:\n +value: *(.*)$/m)?.[1]?.trim());
  // `system.identifier` de uma subclasse: o dnd5e o referencia em FÓRMULA
  // (`@subclasses.hand.levels`), e ele é mais curto que o nome ("Warrior of the
  // Open Hand" → `hand`), então não é derivável por slug (TC-0074).
  const identifier = unquote(txt.match(/^ {2}identifier: *(.*)$/m)?.[1]?.trim());
  return {
    id: pick('_id'), name: unquote(pick('name')), type: pick('type'),
    subtype: subtype || '', identifier: identifier || '', uses: uses(txt),
    // O documento guarda a LINHAGEM dentro de si? Duas assinaturas, e as duas
    // precisam ser ESTREITAS: um `ItemChoice` restrito a itens de RAÇA (a Giant
    // Ancestry do Goliath - o Versatile do Humano também é um ItemChoice, mas
    // restrito a talento de ORIGEM, e não é linhagem), ou um `Trait` cujo pool
    // escolhe uma RESISTÊNCIA (a ancestralidade do Dragonborn). É o que separa
    // uma espécie que é UMA só, com a variante interna, das que têm linhagens só
    // porque NÓS as acrescentamos (DDL-0063) - essas não podem herdar a
    // procedência do documento publicado. Ver SPECIES_SELF_LINEAGE.
    selfLineage: /^ +restriction:\n +type: race$/m.test(txt) || /^ +- dr:/m.test(txt),
  };
}

/**
 * O bloco `system.uses` de um documento: `{max, recovery[]}`, ou null quando a
 * feature não rastreia recurso. É a ÚNICA outra chave interna que lemos (TC-0068)
 * - o pool de um recurso não é derivável do texto do 5etools, e sem ele a ficha
 * do Foundry não tem o que gastar.
 *
 * A âncora são os DOIS espaços de `^  uses:` (ou seja, `system.uses`): um `uses`
 * dentro de `activities:` fica em 6 espaços e não pode ser confundido com este.
 */
function uses(txt) {
  const block = txt.match(/^ {2}uses:\n((?: {4,}[^\n]*\n)*)/m)?.[1];
  if (!block) return null;
  const max = block.match(/^ {4}max: *(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  if (!max) return null;
  const recovery = [];
  for (const line of block.split('\n')) {
    const period = line.match(/^ +- period: *(\w+)/)?.[1];
    if (period) recovery.push({ period });
    else if (recovery.length) {
      const m = line.match(/^ +(type|formula): *(.*)$/);
      if (m) recovery.at(-1)[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return { max, recovery };
}

if (!existsSync(PACKS)) {
  console.error(`Pack do dnd5e não encontrado em ${PACKS}\nColoque o "DnD Source Material" na raiz do projeto (DDL-0037).`);
  process.exit(1);
}

const classes = {}; //        'classId'                    → _id
const classFeatures = {}; // 'classId|feature'            → _id
const subclasses = {}; //    'classId|subclasse'          → _id
const subclassIdentifiers = {}; // 'classId|subclasse'    → system.identifier
const subclassFeatures = {}; // 'classId|subclasse|feature' → _id
const spells = {}; //         'magia'                     → _id
// Pool de recurso (TC-0068). Duas tabelas porque o NOME colide entre classes:
// "Channel Divinity" tem escala própria no Clérigo e no Paladino.
const usesByClass = {}; //   'classId|feature'            → {max, recovery}
const usesFlat = {}; //      'traço ou talento'           → {max, recovery}

const CLASSES_DIR = join(PACKS, 'classes24');
for (const classDir of readdirSync(CLASSES_DIR)) {
  const dir = join(CLASSES_DIR, classDir);
  if (!statSync(dir).isDirectory()) continue;
  const classId = norm(classDir);

  // Features de classe + as pastas de OPÇÕES da classe (`metamagic-options`,
  // `eldritch-invocation-options`): no dnd5e as optional features são documentos
  // de classe como qualquer outra feature, e é de lá que saem tanto o pool dos
  // ItemChoice quanto o `compendiumSource` delas (TC-0063/TC-0069).
  for (const sub of readdirSync(dir)) {
    if (sub === 'subclass-features' || !statSync(join(dir, sub)).isDirectory()) continue;
    for (const f of walk(join(dir, sub))) {
      const h = head(f);
      if (h.type !== 'feat' || !h.id || !h.name) continue; // 'weapon' (Unarmed Strike) mora no equipment24
      classFeatures[`${classId}|${norm(h.name)}`] = h.id;
      if (h.uses) usesByClass[`${classId}|${norm(h.name)}`] = h.uses;
    }
  }

  // Documento da CLASSE e subclasses (arquivos soltos na raiz da pasta).
  const subs = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (!e.endsWith('.yml') || e === '_folder.yml' || statSync(p).isDirectory()) continue;
    const h = head(p);
    if (!h.id || !h.name) continue;
    if (h.type === 'class') classes[classId] = h.id;
    if (h.type !== 'subclass') continue;
    subs.push(h);
    subclasses[`${classId}|${norm(h.name)}`] = h.id;
    if (h.identifier) subclassIdentifiers[`${classId}|${norm(h.name)}`] = h.identifier;
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
    const h = head(f);
    if (h.type !== 'feat' || !h.id || !h.name) continue;
    subclassFeatures[`${classId}|${norm(subs[0].name)}|${norm(h.name)}`] = h.id;
    // Uma feature de SUBCLASSE também rastreia recurso pela classe dona.
    if (h.uses) usesByClass[`${classId}|${norm(h.name)}`] ??= h.uses;
  }
}

for (const f of walk(join(PACKS, 'spells24'))) {
  const { id, name, type } = head(f);
  if (type !== 'spell' || !id || !name) continue;
  spells[norm(name)] = id;
}

// Pacotes de nome plano (`nome` → _id), usados para o `_stats.compendiumSource`
// dos itens embutidos. `origins24` guarda espécies E seus traços (que exportamos
// como feat), então os dois convivem no mesmo mapa - a busca é por nome.
const flat = { origins: {}, feats: {}, equipment: {} };
// Classificação de inventário do dnd5e: `nome` → "tipo/subtipo" (TC-0066). O
// tipo de um item de aventura NÃO é derivável do código do 5etools (o `G` de
// "adventuring gear" vira loot, equipment OU consumable, item a item), e é o
// tipo que decide se dá para equipar/consumir na ficha do Foundry.
const equipmentTypes = {};
// Nomes das ESPÉCIES publicadas (só os documentos `race` do origins24). O dnd5e
// nomeia a linhagem com vírgula ("Elf, High") onde o 5etools funde a frase
// inteira ("Elf; High Elf Lineage"); é o MESMO documento, e casar o nome é o que
// dá procedência à espécie no export.
const speciesNames = [];
const speciesSelfLineage = [];
// Nomes (na grafia do dnd5e) de TODO documento do origins24: espécies, traços de
// espécie e backgrounds. É o que permite renomear "Elven Lineage (High Elf)" para
// o "Elven Lineage, High Elf" publicado - e saber que "Damage Resistance" não é
// documento nenhum lá.
const originNames = [];
const FLAT_PACKS = [
  ['origins', 'origins24', new Set(['race', 'feat', 'background'])],
  ['feats', 'feats24', new Set(['feat'])],
  ['equipment', 'equipment24', new Set(['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'])],
];
for (const [key, dir, types] of FLAT_PACKS) {
  for (const f of walk(join(PACKS, dir))) {
    const { id, name, type, subtype, uses: u, selfLineage } = head(f);
    if (!id || !name || !types.has(type)) continue;
    if (key === 'origins' && type === 'race' && selfLineage && !speciesSelfLineage.includes(name)) speciesSelfLineage.push(name);
    if (key === 'origins' && !originNames.includes(name)) originNames.push(name);
    // Homônimos dentro do mesmo pacote: fica o PRIMEIRO (ordem alfabética de
    // arquivo), determinístico entre regerações.
    if (!flat[key][norm(name)]) flat[key][norm(name)] = id;
    if (key === 'origins' && type === 'race' && !speciesNames.includes(name)) speciesNames.push(name);
    if (key === 'equipment' && !equipmentTypes[norm(name)]) equipmentTypes[norm(name)] = `${type}/${subtype}`;
    if (key !== 'equipment' && u) usesFlat[norm(name)] ??= u;
  }
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
// (${Object.keys(subclassFeatures).length} features), ${Object.keys(spells).length} magias, ${Object.keys(flat.origins).length} origens,
// ${Object.keys(flat.feats).length} talentos e ${Object.keys(flat.equipment).length} itens de equipamento.
// -----------------------------------------------------------------------------

/** Pacote de compêndio de cada mapa (prefixo do uuid). */
export const PACK_CLASSES = 'Compendium.dnd5e.classes24.Item';
export const PACK_SPELLS = 'Compendium.dnd5e.spells24.Item';
export const PACK_ORIGINS = 'Compendium.dnd5e.origins24.Item';
export const PACK_FEATS = 'Compendium.dnd5e.feats24.Item';
export const PACK_EQUIPMENT = 'Compendium.dnd5e.equipment24.Item';

/** \`classId\` → _id do documento da CLASSE (pacote classes24). */
export const CLASS_IDS = ${literal(classes)};

/** \`classId|nomeDaFeature\` → _id (pacote classes24). */
export const CLASS_FEATURE_IDS = ${literal(classFeatures)};

/** \`classId|nomeDaSubclasse\` → _id (pacote classes24). */
export const SUBCLASS_IDS = ${literal(subclasses)};

/** \`classId|nomeDaSubclasse\` → \`system.identifier\` do SRD. Não é derivável do
 *  nome ("Warrior of the Open Hand" → \`hand\`) e é referenciado em FÓRMULA pelo
 *  dnd5e (\`@subclasses.hand.levels\`), então vale mais que um rótulo (TC-0074). */
export const SUBCLASS_IDENTIFIERS = ${literal(subclassIdentifiers)};

/** \`classId|nomeDaSubclasse|nomeDaFeature\` → _id (pacote classes24). */
export const SUBCLASS_FEATURE_IDS = ${literal(subclassFeatures)};

/** \`nomeDaMagia\` → _id (pacote spells24). */
export const SPELL_IDS = ${literal(spells)};

/** \`nome\` → _id (pacote origins24: espécies, seus traços e backgrounds). */
export const ORIGIN_IDS = ${literal(flat.origins)};

/** Nomes das ESPÉCIES publicadas (documentos \`race\` do origins24), na grafia do
 *  dnd5e - "Elf, High" onde o 5etools diz "Elf; High Elf Lineage". Ver
 *  engine/compendiumUuids.js \`srdSpeciesName\`. */
export const SPECIES_NAMES = ${JSON.stringify([...speciesNames].sort(), null, 2)};

/** Espécies cujo documento do SRD guarda a LINHAGEM dentro de si (um passo
 *  \`ItemChoice\`, ou um \`Trait\` com pool de escolha): ali "Dragonborn" é a
 *  espécie INTEIRA, ancestralidade inclusa, então uma linhagem nossa pode herdar
 *  o nome e a procedência do documento. Onde o SRD não faz isso, as nossas
 *  linhagens são acréscimo curado (o guarda-chuva do Halfling, DDL-0063) e
 *  apontar para o documento publicado seria um near-match - o Foundry ofereceria
 *  "atualizar do compêndio" e trocaria a linhagem escolhida pela base. */
export const SPECIES_SELF_LINEAGE = ${JSON.stringify([...speciesSelfLineage].sort(), null, 2)};

/** Nomes de TODO documento do origins24 (espécies, traços de espécie, origens),
 *  na grafia do dnd5e. Ver engine/compendiumUuids.js \`srdOriginName\`. */
export const ORIGIN_NAMES = ${JSON.stringify([...originNames].sort(), null, 2)};

/** \`nomeDoTalento\` → _id (pacote feats24). */
export const FEAT_IDS = ${literal(flat.feats)};

/** \`nomeDoItem\` → _id (pacote equipment24). */
export const EQUIPMENT_IDS = ${literal(flat.equipment)};

/** \`nomeDoItem\` → "tipo/subtipo" do Item do Foundry ("consumable/food"). É a
 *  classificação de inventário do dnd5e - o que decide se o item pode ser
 *  equipado ou consumido na ficha. Ver engine/compendiumUuids.js. */
export const EQUIPMENT_TYPES = ${literal(equipmentTypes)};

/** \`classId|feature\` → \`system.uses\` ({max, recovery}) do SRD. O POOL de um
 *  recurso não é derivável do texto do 5etools; sem ele a ficha do Foundry não
 *  tem o que gastar (TC-0068). Keyed por classe porque o nome colide
 *  ("Channel Divinity" tem escala própria no Clérigo e no Paladino). */
export const FEATURE_USES_BY_CLASS = ${literal(usesByClass)};

/** \`traço de espécie ou talento\` → \`system.uses\` do SRD (pacotes origins24 e
 *  feats24, onde o nome não colide com o de uma classe). */
export const FEATURE_USES_FLAT = ${literal(usesFlat)};
`;

writeFileSync(OUT, out);
console.log(
  `compendiumUuidsData.js gerado: ${Object.keys(classFeatures).length} features de classe, `
  + `${Object.keys(subclasses).length} subclasses, ${Object.keys(subclassFeatures).length} features de subclasse, `
  + `${Object.keys(spells).length} magias, ${Object.keys(flat.origins).length} origens, `
  + `${Object.keys(flat.feats).length} talentos, ${Object.keys(flat.equipment).length} equipamentos, `
  + `${Object.keys(usesByClass).length + Object.keys(usesFlat).length} pools de recurso.`,
);
