// =============================================================================
// foundryInterop: marcas de procedência que importadores de terceiros leem
// =============================================================================
// O QUE FAZ
//   Importadores do 5etools para o Foundry reconhecem um item pela página, pela
//   fonte e pelo hash de URL do 5etools gravados em `flags.plutonium` (medido nas
//   fichas feitas por um deles, em `DnD Source Material`). Com a marca, um módulo
//   desses consegue SUBIR DE NÍVEL dentro do Foundry uma classe ou subclasse que
//   o SRD não publica, onde o nosso export não tem uuid de compêndio (DDL-0167).
//   Aqui só se monta a marca; cada construtor do foundryItems a grava no item.
//
// FUNÇÕES
//   hashPart(s), toolsHash(...parts): o hash de URL do 5etools.
//   interopFlags(kind, ref): `{ plutonium: {...} }` para gravar em `item.flags`, ou {}.
//
// DECISÕES E ARMADILHAS
//   - É interoperar com um FORMATO DE DADO observado nas fichas, como os flags do
//     próprio dnd5e: nenhum código de terceiro é copiado, embutido ou buscado
//     (§6.2 do manual segue valendo). O Foundry e o dnd5e ignoram a marca.
//   - O hash é o do 5etools: cada parte em minúsculas e `encodeURIComponent`
//     (o apóstrofo fica, `;` vira `%3b`, `+` vira `%2b`), unidas por `_`. A
//     subclasse é o hash da classe mais `,state:sub_<nome curto>_<fonte>=b1`.
//   - O README não cita a marca (decisão do dono): o aviso só diz que o level up
//     no Foundry pede módulos adicionais.
// -----------------------------------------------------------------------------

/** Uma parte do hash, como o 5etools a escreve. */
function hashPart(s) {
  return encodeURIComponent(String(s ?? '')).toLowerCase();
}

/** O hash de URL do 5etools para as partes dadas. */
export function toolsHash(...parts) {
  return parts.map(hashPart).join('_');
}

const PAGES = {
  class: 'classes.html',
  subclass: 'classes.html',
  classFeature: 'classFeature',
  subclassFeature: 'subclassFeature',
  spell: 'spells.html',
  item: 'items.html',
  feat: 'feats.html',
  optionalfeature: 'optionalfeatures.html',
  race: 'races.html',
  background: 'backgrounds.html',
};

/**
 * A marca de procedência de um item, para `item.flags`.
 * @param {string} kind  class, subclass, classFeature, subclassFeature, spell, item, feat, optionalfeature, race, background
 * @param {object} ref  nome, fonte e o que o hash pede (className, classSource, shortName, subclassSource, level)
 * @returns {object}
 */
export function interopFlags(kind, ref) {
  const page = PAGES[kind];
  if (!page || !ref?.name || !ref?.source) return {};
  let hash;
  if (kind === 'subclass') {
    if (!ref.className || !ref.classSource || !ref.shortName) return {};
    hash = `${toolsHash(ref.className, ref.classSource)},state:sub_${toolsHash(ref.shortName, ref.source)}=b1`;
  } else if (kind === 'classFeature') {
    if (!ref.className || !ref.classSource || ref.level == null) return {};
    hash = toolsHash(ref.name, ref.className, ref.classSource, ref.level, ref.source);
  } else if (kind === 'subclassFeature') {
    if (!ref.className || !ref.classSource || !ref.shortName || !ref.subclassSource || ref.level == null) return {};
    hash = toolsHash(ref.name, ref.className, ref.classSource, ref.shortName, ref.subclassSource, ref.level, ref.source);
  } else {
    hash = toolsHash(ref.name, ref.source);
  }
  const droppable = ['class', 'subclass', 'spell', 'race', 'background'].includes(kind) ? { propDroppable: kind } : {};
  return { plutonium: { page, source: ref.source, hash, ...droppable } };
}
