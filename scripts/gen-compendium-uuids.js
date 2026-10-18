// =============================================================================
// gen-compendium-uuids: gera src/engine/compendiumUuidsData.js (npm run gen:uuids)
// =============================================================================
// O QUE FAZ
//   Lê o SOURCE do sistema dnd5e (`DnD Source Material/DnD 5e System Source Code/
//   packs/_source`, MIT + SRD/CC-BY, git-ignored) e extrai só IDENTIFICADORES dos
//   documentos de compêndio (`_id`, `name`, e as poucas chaves internas abaixo);
//   nenhum texto de regra é copiado. Rodar só quando o dnd5e atualizar; a SAÍDA é
//   commitada, o material de referência não (DDL-0037).
//   Para que servem: o item de classe/subclasse do Foundry precisa de um ItemGrant
//   por nível FUTURO cujo uuid aponte para o compêndio, ou subir de nível dentro do
//   Foundry não concede nada (DDL-0055). Um uuid RELATIVO não serve: o item ainda
//   não existe no ator. Os mapas planos (nome -> _id) dão também o
//   `_stats.compendiumSource` dos itens embutidos; os demais registros estão
//   descritos no cabeçalho do arquivo gerado.
//   Escopo = o que o dnd5e publica (SRD 2024): as 12 classes XPHB com todas as
//   features, UMA subclasse por classe, as magias, origens, talentos e
//   equipamento. Fora disso (Artificer, subclasses não-SRD) não há uuid e a escada
//   não é emitida.
//
// FUNÇÕES
//   norm(s): o nome comparável (apóstrofo tipográfico -> reto, a mesma regra do
//     engine/compendiumUuids.js).
//   walk(dir, out): os .yml de uma pasta, recursivo, sem os marcadores `_folder`.
//   head(file): os campos de TOPO de um documento, mais subtype, identifier e a
//     marca de linhagem interna.
//   uses(txt): o bloco `system.uses` ({max, recovery[]}), ou null.
//   container(txt): {weightless, capacity} de um documento container.
//   literal(obj, indent): literal de objeto ordenado por chave (diff estável).
//
// DECISÕES E ARMADILHAS
//   - Regex em vez de parser de YAML: só se leem chaves estáveis no formato do
//     dnd5e. As internas são poucas e de propósito: `subtype` (o
//     `system.type.value`, a classificação de inventário, TC-0066), o
//     `system.identifier` da subclasse (referenciado em FÓRMULA, `@subclasses.hand
//     .levels`, e não derivável por slug, TC-0074), `system.uses` (o pool de recurso,
//     TC-0068; a âncora são os DOIS espaços de `^  uses:`, porque um `uses` dentro
//     de `activities:` fica em 6) e as propriedades de container.
//   - Linhagem interna (SPECIES_SELF_LINEAGE): duas assinaturas, ambas ESTREITAS.
//     Um `ItemChoice` restrito a itens de RAÇA (a Giant Ancestry do Goliath; o
//     Versatile do Humano é ItemChoice de talento de ORIGEM, não linhagem), ou um
//     `Trait` cujo POOL escolhe uma resistência (o Dragonborn). O `dr:` TEM de
//     estar sob `pool:`: aceitando `- dr:` em qualquer lugar, o Dwarf entrava (a
//     resistência do Dwarven Resilience é GRANT fixo) e a linhagem que NÓS criamos
//     para ele herdava a procedência do documento, o near-match que o DDL-0056
//     proíbe. Foi o SEGUNDO falso positivo de assinatura larga aqui.
//   - container: `weightless` é a propriedade `weightlessContents` do dnd5e (10
//     documentos: Bag of Holding/Devouring, Handy Haversack e as 3 bolsas dele,
//     Efficient Quiver e os 3 compartimentos). Sem capacidade declarada devolve
//     null: não inventamos limite.
//   - Optional features (`metamagic-options`, `eldritch-invocation-options`) são
//     documentos de classe como qualquer feature; é de lá que saem o pool dos
//     ItemChoice e o `compendiumSource` delas (TC-0063/TC-0069). O Unarmed Strike
//     ('weapon') mora no equipment24.
//   - O nome da PASTA de subclasse não bate com o da subclasse ('circle-of-land' x
//     "Circle of the Land"); enquanto o pack publica UMA por classe, todas as
//     features vão para ela. Se mudar, o gerador avisa em vez de adivinhar. Feature
//     de subclasse rastreia recurso pela classe dona.
//   - SOURCE_GAPS: documentos que o compêndio COMPILADO tem e a árvore de fontes não
//     publica como arquivo. Os premades os referenciam por uuid, então NÃO é o caso
//     "o SRD não publica" (DDL-0056): o uuid é real e preencher é fidelidade. Sem
//     isso o Monge exportado abaixo do 10 e subido no Foundry não recebia
//     Self-Restoration. `npm run check:uuids` é a rede; quando o dnd5e publicar o
//     arquivo, a entrada vira redundante e o gerador avisa.
//   - O tipo de um item de aventura não é derivável do 5etools (o `G` vira loot,
//     equipment OU consumable, item a item). ORIGIN_NAMES permite renomear "Elven
//     Lineage (High Elf)" para o "Elven Lineage, High Elf" publicado e saber que
//     "Damage Resistance" não é documento nenhum.
//   - Homônimos no mesmo pacote: fica o PRIMEIRO (ordem alfabética de arquivo),
//     determinístico entre regerações.
//   - O cabeçalho do arquivo gerado já segue o modelo de comentários (DDL-0090).
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const OUT = join(ROOT, 'src', 'engine', 'compendiumUuidsData.js');

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

/** Os .yml de uma pasta, recursivo. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.yml') && e !== '_folder.yml') out.push(p);
  }
  return out;
}

/** Os campos de TOPO de um documento do pack. */
function head(file) {
  const txt = readFileSync(file, 'utf8');
  const pick = (k) => txt.match(new RegExp(`^${k}: *(.+)$`, 'm'))?.[1]?.trim();
  const unquote = (s) => s?.replace(/^['"]|['"]$/g, '');
  const subtype = unquote(txt.match(/^ +type:\n +value: *(.*)$/m)?.[1]?.trim());
  const identifier = unquote(txt.match(/^ {2}identifier: *(.*)$/m)?.[1]?.trim());
  return {
    id: pick('_id'), name: unquote(pick('name')), type: pick('type'),
    subtype: subtype || '', identifier: identifier || '', uses: uses(txt),
    // ATENÇÃO: assinaturas ESTREITAS: o dr: só vale sob pool: (aceito em qualquer lugar, o Dwarf entrava).
    selfLineage:
      /^ +restriction:\n +type: race$/m.test(txt)
      || /^ +pool:\n +- dr:/m.test(txt),
  };
}

/** O bloco `system.uses` de um documento, ou null. */
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

/** As propriedades de um documento `container`. */
function container(txt) {
  const weightless = /^ +- weightlessContents$/m.test(txt);
  const block = txt.match(/^ {2}capacity:\n((?: {4,}[^\n]*\n)*)/m)?.[1] ?? '';
  const type = block.match(/^ {4}type: *(.*)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '');
  const value = Number(block.match(/^ {4}value: *(.*)$/m)?.[1]?.trim());
  const capacity = type && Number.isFinite(value) && value > 0 ? { type, value } : null;
  return { weightless, capacity };
}

if (!existsSync(PACKS)) {
  console.error(`Pack do dnd5e não encontrado em ${PACKS}\nColoque o "DnD Source Material" na raiz do projeto (DDL-0037).`);
  process.exit(1);
}

const classes = {};
const classFeatures = {};
const subclasses = {};
const subclassIdentifiers = {};
const subclassFeatures = {};
const spells = {};
const usesByClass = {};
const usesFlat = {};

const CLASSES_DIR = join(PACKS, 'classes24');
for (const classDir of readdirSync(CLASSES_DIR)) {
  const dir = join(CLASSES_DIR, classDir);
  if (!statSync(dir).isDirectory()) continue;
  const classId = norm(classDir);

  for (const sub of readdirSync(dir)) {
    if (sub === 'subclass-features' || !statSync(join(dir, sub)).isDirectory()) continue;
    for (const f of walk(join(dir, sub))) {
      const h = head(f);
      if (h.type !== 'feat' || !h.id || !h.name) continue;
      classFeatures[`${classId}|${norm(h.name)}`] = h.id;
      if (h.uses) usesByClass[`${classId}|${norm(h.name)}`] = h.uses;
    }
  }

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

  const subFeatureFiles = walk(join(dir, 'subclass-features'));
  if (subFeatureFiles.length && subs.length !== 1) {
    console.warn(`AVISO: ${classId} tem ${subs.length} subclasses no pack; features de subclasse ignoradas (o gerador precisa de uma regra de pasta→subclasse).`);
    continue;
  }
  for (const f of subFeatureFiles) {
    const h = head(f);
    if (h.type !== 'feat' || !h.id || !h.name) continue;
    subclassFeatures[`${classId}|${norm(subs[0].name)}|${norm(h.name)}`] = h.id;
    if (h.uses) usesByClass[`${classId}|${norm(h.name)}`] ??= h.uses;
  }
}

const SOURCE_GAPS = {
  'monk|self-restoration': 'phbmnkSelfrestor',
};
for (const [key, id] of Object.entries(SOURCE_GAPS)) {
  if (classFeatures[key]) {
    console.warn(`AVISO: '${key}' agora É publicado no _source - remova a entrada de SOURCE_GAPS.`);
    continue;
  }
  classFeatures[key] = id;
}

for (const f of walk(join(PACKS, 'spells24'))) {
  const { id, name, type } = head(f);
  if (type !== 'spell' || !id || !name) continue;
  spells[norm(name)] = id;
}

const flat = { origins: {}, feats: {}, equipment: {} };
const equipmentTypes = {};
const containerProps = {};
const speciesNames = [];
const speciesSelfLineage = [];
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
    if (!flat[key][norm(name)]) flat[key][norm(name)] = id;
    if (key === 'origins' && type === 'race' && !speciesNames.includes(name)) speciesNames.push(name);
    if (key === 'equipment' && !equipmentTypes[norm(name)]) equipmentTypes[norm(name)] = `${type}/${subtype}`;
    if (key === 'equipment' && type === 'container' && !containerProps[norm(name)]) {
      containerProps[norm(name)] = container(readFileSync(f, 'utf8'));
    }
    if (key !== 'equipment' && u) usesFlat[norm(name)] ??= u;
  }
}

/** Literal de objeto ordenado por chave. */
function literal(obj, indent = '  ') {
  const keys = Object.keys(obj).sort();
  if (!keys.length) return '{}';
  return `{\n${keys.map((k) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`).join('\n')}\n}`;
}

const out = `// =============================================================================
// compendiumUuidsData: GERADO por npm run gen:uuids; não edite à mão
// =============================================================================
// O QUE FAZ
//   Identificadores de documentos dos compêndios do sistema dnd5e (SRD 2024, MIT
//   + CC-BY-4.0), extraídos de packs/_source. Apenas ids e nomes; nenhum conteúdo
//   de jogo é redistribuído aqui. Consumidos por engine/compendiumUuids.js para
//   montar os ItemGrant de níveis FUTUROS (o porquê está no módulo irmão).
//   Cobertura: as 12 classes XPHB (${Object.keys(classFeatures).length} features), ${Object.keys(subclasses).length} subclasses SRD
//   (${Object.keys(subclassFeatures).length} features), ${Object.keys(spells).length} magias, ${Object.keys(flat.origins).length} origens,
//   ${Object.keys(flat.feats).length} talentos e ${Object.keys(flat.equipment).length} itens de equipamento.
//
//   PACK_CLASSES, PACK_SPELLS, PACK_ORIGINS, PACK_FEATS, PACK_EQUIPMENT: o pacote
//     de compêndio de cada mapa (prefixo do uuid).
//   CLASS_IDS: classId -> _id do documento da CLASSE (classes24).
//   CLASS_FEATURE_IDS: "classId|feature" -> _id (classes24).
//   SUBCLASS_IDS: "classId|subclasse" -> _id (classes24).
//   SUBCLASS_IDENTIFIERS: "classId|subclasse" -> system.identifier do SRD.
//   SUBCLASS_FEATURE_IDS: "classId|subclasse|feature" -> _id (classes24).
//   SPELL_IDS: magia -> _id (spells24).
//   ORIGIN_IDS: nome -> _id (origins24: espécies, seus traços e backgrounds).
//   SPECIES_NAMES: as ESPÉCIES publicadas, na grafia do dnd5e ("Elf, High" onde
//     o 5etools diz "Elf; High Elf Lineage"); ver srdSpeciesName.
//   SPECIES_SELF_LINEAGE: espécies cujo documento do SRD guarda a LINHAGEM dentro
//     de si (um ItemChoice, ou um Trait com pool de escolha).
//   ORIGIN_NAMES: todo documento do origins24, na grafia do dnd5e; ver
//     srdOriginName.
//   FEAT_IDS: talento -> _id (feats24).
//   EQUIPMENT_IDS: item -> _id (equipment24).
//   EQUIPMENT_TYPES: item -> "tipo/subtipo" do Item do Foundry
//     ("consumable/food"): decide se o item pode ser equipado ou consumido.
//   CONTAINER_PROPS: item -> {weightless, capacity} dos itens container; ver
//     engine/containers.js.
//   FEATURE_USES_BY_CLASS: "classId|feature" -> system.uses ({max, recovery}).
//   FEATURE_USES_FLAT: traço de espécie ou talento -> system.uses (origins24 e
//     feats24, onde o nome não colide com o de uma classe).
//
// DECISÕES E ARMADILHAS
//   - SUBCLASS_IDENTIFIERS não é derivável do nome ("Warrior of the Open Hand" ->
//     hand) e o dnd5e o usa em FÓRMULA (@subclasses.hand.levels), então vale mais
//     que um rótulo (TC-0074).
//   - SPECIES_SELF_LINEAGE: ali "Dragonborn" é a espécie INTEIRA, ancestralidade
//     inclusa, então uma linhagem nossa pode herdar o nome e a procedência do
//     documento. Onde o SRD não faz isso, as nossas linhagens são acréscimo curado
//     (o guarda-chuva do Halfling, DDL-0063) e apontar para o documento publicado
//     seria um near-match: o Foundry ofereceria "atualizar do compêndio" e
//     trocaria a linhagem escolhida pela base.
//   - CONTAINER_PROPS: nenhum dos dois campos é derivável do 5etools; que a Bag of
//     Holding pesa o mesmo "regardless of its contents" está só na PROSA. O peso
//     carregado segue o RAW: o conteúdo de um container weightless não conta.
//   - FEATURE_USES_*: o POOL de um recurso não é derivável do texto do 5etools;
//     sem ele a ficha do Foundry não tem o que gastar (TC-0068). Por classe porque
//     o nome colide ("Channel Divinity" tem escala própria no Clérigo e no
//     Paladino).
// -----------------------------------------------------------------------------

export const PACK_CLASSES = 'Compendium.dnd5e.classes24.Item';
export const PACK_SPELLS = 'Compendium.dnd5e.spells24.Item';
export const PACK_ORIGINS = 'Compendium.dnd5e.origins24.Item';
export const PACK_FEATS = 'Compendium.dnd5e.feats24.Item';
export const PACK_EQUIPMENT = 'Compendium.dnd5e.equipment24.Item';

export const CLASS_IDS = ${literal(classes)};

export const CLASS_FEATURE_IDS = ${literal(classFeatures)};

export const SUBCLASS_IDS = ${literal(subclasses)};

export const SUBCLASS_IDENTIFIERS = ${literal(subclassIdentifiers)};

export const SUBCLASS_FEATURE_IDS = ${literal(subclassFeatures)};

export const SPELL_IDS = ${literal(spells)};

export const ORIGIN_IDS = ${literal(flat.origins)};

export const SPECIES_NAMES = ${JSON.stringify([...speciesNames].sort(), null, 2)};

export const SPECIES_SELF_LINEAGE = ${JSON.stringify([...speciesSelfLineage].sort(), null, 2)};

export const ORIGIN_NAMES = ${JSON.stringify([...originNames].sort(), null, 2)};

export const FEAT_IDS = ${literal(flat.feats)};

export const EQUIPMENT_IDS = ${literal(flat.equipment)};

export const EQUIPMENT_TYPES = ${literal(equipmentTypes)};

export const CONTAINER_PROPS = ${literal(containerProps)};

export const FEATURE_USES_BY_CLASS = ${literal(usesByClass)};

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
