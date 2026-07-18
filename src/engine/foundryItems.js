// =============================================================================
// foundryItems - monta os documentos de ITEM do ator Foundry (dnd5e)
// =============================================================================
// Fase A do export (ver CLAUDE.md §4). Começa pelo item de CLASSE: junta o bloco
// `system` da classe + o `advancement[]` gerado (foundryAdvancement) + o valor de
// HP do personagem, com `_id`s no formato Foundry.
//
// Ainda NÃO preenche: os valores ESCOLHIDOS dos Trait/ASI (perícias/atributos do
// personagem) nem ItemGrant/ItemChoice/ScaleValue - próximos incrementos.
// -----------------------------------------------------------------------------

import { parseClass, parseFeatureRef } from './classData';
import { featureOptionChoices, subclassFeatureOptionChoices } from './featureOptions';
import { buildClassAdvancement } from './foundryAdvancement';
import { effectChangesFor, targetEffectFor } from './foundryEffects';
import {
  overlayFeatEffects,
  overlayOptionalFeatureEffects,
  overlayClassFeatureEffects,
  overlaySubclassFeatureEffects,
  overlayRaceEffects,
} from './foundryOverlay';
import { featureUses } from './foundryFeatureUses';
import { featureActivities } from './foundryActivities';
import { naturalArmorFor, naturalArmorChanges } from './naturalArmor';
import { foundrySize, toolId, languageCode, textToHtml } from './foundryExport';
import { effectiveSizeCodes, sizePick } from './speciesData';
import { collectChoicePicks, collectAbilityPicks, fixedAbilityBoosts } from './choices';
import { resolveItemObj, itemTypeInfo, attunementInfo } from './items';
import { itemValue } from './magicItemPrice';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// Categoria 5etools do talento → subtipo de feat do Foundry (system.type.subtype).
const FEAT_CATEGORY_SUBTYPE = {
  G: 'general',
  O: 'origin',
  FS: 'fightingStyle',
  'FS:P': 'fightingStyle',
  'FS:R': 'fightingStyle',
  'FS:B': 'fightingStyle',
  EB: 'epicBoon',
};

/** Identifier do talento especial "Ability Score Improvement" (ASI cru, não um talento). */
const ASI_FEAT_NAME = 'ability score improvement';

// ---------------------------------------------------------------------------
// flags.builder5e.choices - decisões SEM casa nativa no Foundry (TC-0002/4/5/9)
// ---------------------------------------------------------------------------
// Política (DDL-0028): o export fica Foundry-nativo em tudo que o Foundry sabe
// representar (Traits aplicados, ASI, ItemChoice, itens de feature); decisões
// sem slot nativo viajam numa flag namespaced no Item DONO delas - sub-bags de
// talento no item do talento, spellAbility/size no item de raça, escolhas
// residuais de classe (tool@start/expertise/grants curados/optional features)
// no item de classe. O Foundry ignora a flag; só o NOSSO import a lê.

/** O choice-bag tem algum conteúdo (pick ou sub-bag)? */
function bagHasContent(bag) {
  return Object.values(bag ?? {}).some(
    (e) => e && typeof e === 'object' && ((e.picks?.length ?? 0) > 0 || bagHasContent(e.sub)),
  );
}

/** Picks RASOS de um kind (só entradas de topo - sem recursar em sub-bags de
 * talento, que pertencem ao ITEM do talento; ver TC-0010). */
function shallowPicks(bag, kind) {
  return Object.values(bag ?? {})
    .filter((e) => e?.kind === kind)
    .flatMap((e) => e.picks ?? []);
}

/** Ids de escolha de classe que têm representação NATIVA no item de classe /
 * itens próprios (não vão para a flag): perícias iniciais, weapon mastery,
 * feats de nível (ASI/estilo, viram advancement) e featureoptions (viram itens
 * "<Feature>: <Opção>"). Todo o resto viaja em flags.builder5e.choices. */
const NATIVE_CLASS_CHOICE_ID = /^(skill|weaponMastery|feat@\d+|(sub:)?featopt@.+)$/;

/** Entradas do choice-bag da CLASSE sem casa nativa (ver NATIVE_CLASS_CHOICE_ID). */
export function residualClassChoices(bag) {
  const out = {};
  for (const [id, entry] of Object.entries(bag ?? {})) {
    if (NATIVE_CLASS_CHOICE_ID.test(id)) continue;
    if (!entry || typeof entry !== 'object') continue;
    if ((entry.picks?.length ?? 0) === 0 && !bagHasContent(entry.sub)) continue;
    out[id] = entry;
  }
  return out;
}

// Ícones oficiais do sistema dnd5e (packs/_source/classes24): as 12 classes têm
// `systems/dnd5e/icons/classes/<id>.webp`; subclasses SÓ as SRD - as demais usam
// o ícone da classe-mãe (caminho garantido, sem 404 no Foundry).
const SRD_SUBCLASS_ICONS = new Set([
  'berserker', 'champion', 'devotion', 'draconic', 'evoker', 'fiend',
  'hunter', 'land', 'life', 'lore', 'open-hand', 'thief',
]);

/** Caminho do ícone oficial de uma classe dnd5e. */
function classIcon(classId) {
  return `systems/dnd5e/icons/classes/${classId}.webp`;
}

/** Ícone de subclasse: o próprio (SRD) ou o da classe-mãe. */
function subclassIcon(subclassId, classId) {
  return classIcon(SRD_SUBCLASS_ICONS.has(subclassId) ? subclassId : classId);
}

/** Localiza um talento no db pelo id "Nome|Fonte" (lookup local p/ evitar ciclo com resolve). */
function findFeat(db, id) {
  const [name, source] = String(id).split('|');
  const list = db?.feats?.feat;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f.name === name && f.source === source) ?? null;
}

/** Bloco `fixed` zerado das seis habilidades (base do AbilityScoreImprovement). */
function zeroFixed() {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

/** Advancement Trait (grant fixo de proficiências) para itens de origem/background. */
function traitAdv(title, grants) {
  return {
    _id: randomFoundryId(),
    type: 'Trait',
    level: 0,
    title,
    configuration: { mode: 'default', allowReplacements: false, grants, choices: [] },
    value: { chosen: grants },
  };
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/** Id no formato Foundry (16 chars alfanuméricos, como foundry.utils.randomID). */
export function randomFoundryId() {
  let s = '';
  for (let i = 0; i < 16; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

// Versões-alvo (informativas; o Foundry sobrescreve o _stats no import). Batem com
// os exports reais analisados.
const CORE_VERSION = '13.351';
const SYSTEM_VERSION = '5.3.3';

/**
 * `advancement` no formato do Foundry: um OBJETO indexado pelo `_id` de cada passo
 * (MappingField), não um array. Ex: `{ [id]: { _id, type, ... } }`.
 * @param {object[]} list  advancements (cada um já com `_id`)
 * @returns {Record<string, object>}
 */
function keyById(list) {
  return Object.fromEntries((list ?? []).map((a) => [a._id, a]));
}

/** Bloco `_stats` padrão do Foundry (o import preenche datas/usuário). */
export function itemStats(compendiumSource = null) {
  return {
    compendiumSource,
    duplicateSource: null,
    exportSource: null,
    coreVersion: CORE_VERSION,
    systemId: 'dnd5e',
    systemVersion: SYSTEM_VERSION,
    lastModifiedBy: null,
  };
}

/** Bloco `source` padronizado (livro + regras 2024). */
export function sourceBlock(book) {
  return { book: book ?? '', rules: '2024', revision: 1 };
}

/** Slug de identificador Foundry (ex: "Second Wind" → "second-wind"). */
export function slugify(name) {
  return String(name).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Remove tags 5etools ({@x ...}) deixando o texto legível. */
function stripTags(s) {
  return String(s).replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1');
}

/** Renderiza `entries` do 5etools num HTML simples (parágrafos + subtítulos). */
export function entriesToHtml(entries) {
  const out = [];
  const walk = (e) => {
    if (typeof e === 'string') out.push(`<p>${stripTags(e)}</p>`);
    else if (Array.isArray(e)) e.forEach(walk);
    else if (e && typeof e === 'object') {
      if (e.name) out.push(`<p><strong>${e.name}.</strong></p>`);
      if (e.entries) walk(e.entries);
      if (e.items) walk(e.items);
    }
  };
  walk(entries ?? []);
  return out.join('');
}

/** Escolhe a entrada de fluff que casa com a fonte (ou a última = mais recente). */
function pickFluff(list, source) {
  if (!Array.isArray(list) || !list.length) return null;
  return (source && list.find((e) => norm(e.source) === norm(source))) || list[list.length - 1];
}

/**
 * HTML de descrição da CLASSE a partir do fluff cacheado (`fluff-class-<id>`).
 * @param {object} db
 * @param {string} classId  ex: 'fighter'
 * @param {string} [source]
 * @returns {string} HTML (vazio se não houver fluff)
 */
export function classFluffHtml(db, classId, source) {
  const entry = pickFluff(db?.[`fluff-class-${classId}`]?.classFluff, source);
  return entry ? entriesToHtml(entry.entries) : '';
}

/**
 * HTML de descrição da SUBCLASSE a partir do fluff cacheado (`subclassFluff`),
 * casando pelo nome curto/completo da subclasse.
 * @param {object} db
 * @param {string} classId
 * @param {object} subclass  objeto de subclasse (name/shortName/source)
 * @returns {string} HTML (vazio se não houver fluff)
 */
export function subclassFluffHtml(db, classId, subclass) {
  const list = db?.[`fluff-class-${classId}`]?.subclassFluff;
  if (!Array.isArray(list) || !subclass) return '';
  const names = new Set([norm(subclass.name), norm(subclass.shortName)]);
  const matches = list.filter((e) => names.has(norm(e.name)));
  const entry = pickFluff(matches, subclass.source);
  return entry ? entriesToHtml(entry.entries) : '';
}

/**
 * Advancements ItemGrant (um por nível) ligando um item pai (classe/subclasse) aos
 * seus itens de feature. Como as features são EMBUTIDAS no próprio ator, usamos o
 * UUID RELATIVO `.${_id}` (o `.` = "neste documento"), tanto em `configuration.items`
 * quanto em `value.added` - o mesmo formato de um ator funcional exportado.
 * @param {object[]} featureItems  itens com flags.builder5e.level
 * @param {string} title           ex: 'Features' | 'Subclass Features'
 */
function itemGrantAdvancements(featureItems, title) {
  const byLevel = new Map();
  for (const fi of featureItems) {
    const lvl = fi.flags?.builder5e?.level ?? 1;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(fi);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, items]) => ({
      _id: randomFoundryId(),
      type: 'ItemGrant',
      level: lvl,
      title,
      configuration: { items: items.map((i) => ({ uuid: `.${i._id}`, optional: false })), optional: false, spell: null },
      value: { added: Object.fromEntries(items.map((i) => [i._id, `.${i._id}`])) },
    }));
}

/**
 * Valor de HP por nível para o advancement HitPoints. Usa as rolagens/escolhas do
 * personagem (`classEntry.hitPoints`), com defaults: nv1 "max", demais "avg".
 * @param {import('../schema/character').ClassEntry} classEntry
 * @returns {Record<string, number|'max'|'avg'>}
 */
export function hitPointsValue(classEntry) {
  const out = {};
  const hp = classEntry.hitPoints ?? {};
  for (let l = 1; l <= (classEntry.level || 1); l++) {
    out[l] = hp[l] ?? (l === 1 ? 'max' : 'avg');
  }
  return out;
}

/**
 * Constrói o documento de ITEM de classe do Foundry. Se receber os `featureItems`
 * (de buildClassFeatureItems), adiciona um advancement ItemGrant por nível ligando
 * a classe às suas features (via `value.added` mapeando o _id do item).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj  objeto de classe 5etools
 * @param {object[]} [featureItems]  itens de feature já gerados (p/ o ItemGrant)
 * @param {Record<number, object>} [asiByLevel]  valor do advancement ASI por nível
 *   (talento escolhido ou ASI cru) - ver buildClassChosenFeats.
 * @param {{ description?: string, traitValues?: Record<string, string[]>,
 *           fightingStyles?: {itemId: string, level: number}[] }} [opts]
 *   description: HTML de fluff da classe; traitValues: chosen[] por título de Trait
 *   (buildClassTraitValues); fightingStyles: picks p/ o ItemChoice (buildClassChosenFeats).
 * @returns {object} item Foundry (type 'class')
 */
export function buildClassItem(classEntry, classObj, featureItems = [], asiByLevel = {}, opts = {}) {
  const parsed = parseClass(classObj);
  if (!parsed) return null;

  // Advancement: cada entrada recebe _id; o HitPoints recebe o value do personagem;
  // cada AbilityScoreImprovement recebe o talento/ASI escolhido naquele nível; cada
  // Trait recebe `value.chosen` (o formato APLICADO dos premades - sem ele o Foundry
  // trata o advancement como pendente): grants fixos copiam os grants, escolhas
  // (perícias/mastery) vêm de opts.traitValues.
  const advancement = buildClassAdvancement(classObj).map((a) => {
    const entry = { _id: randomFoundryId(), value: {}, ...a };
    if (entry.type === 'HitPoints') entry.value = hitPointsValue(classEntry);
    if (entry.type === 'AbilityScoreImprovement' && asiByLevel[entry.level]) entry.value = asiByLevel[entry.level];
    if (entry.type === 'Trait') {
      const cfg = entry.configuration ?? {};
      if (cfg.grants?.length && !(cfg.choices ?? []).length) entry.value = { chosen: [...cfg.grants] };
      else if (opts.traitValues?.[entry.title]?.length) entry.value = { chosen: [...opts.traitValues[entry.title]] };
    }
    // ItemChoice do Fighting Style (gerado no buildClassAdvancement): o value.added
    // aponta por nível pro item de feat EMBUTIDO escolhido (uuid relativo).
    if (entry.type === 'ItemChoice' && entry.title === 'Fighting Style') {
      const added = {};
      for (const fs of opts.fightingStyles ?? []) {
        added[fs.level] = { ...(added[fs.level] ?? {}), [fs.itemId]: `.${fs.itemId}` };
      }
      entry.value = { added, replaced: {} };
    }
    return entry;
  });

  advancement.push(...itemGrantAdvancements(featureItems, 'Features'));

  const faces = classObj.hd?.faces ?? parsed.hitDieMax ?? 8;
  const caster = parsed.spellcasting.casterProgression;

  return {
    _id: randomFoundryId(),
    name: parsed.name,
    type: 'class',
    img: classIcon(parsed.id),
    system: {
      identifier: parsed.id,
      levels: classEntry.level || 1,
      hd: { denomination: `d${faces}`, spent: 0, additional: '' },
      spellcasting: caster
        ? { progression: caster, ability: parsed.spellcasting.ability ?? '', preparation: { formula: '' } }
        : { progression: 'none', ability: '', preparation: { formula: '' } },
      advancement: keyById(advancement),
      description: { value: opts.description ?? '', chat: '' },
      source: sourceBlock(parsed.source),
      startingEquipment: [],
      wealth: '',
      primaryAbility: primaryAbilityBlock(classObj),
      properties: [],
    },
    effects: [],
    flags: {},
    _stats: itemStats(),
  };
}

/** Bloco primaryAbility do Foundry a partir do campo 5etools ([{str:true},{dex:true}]
 * = str OU dex → all:false; uma entrada com 2+ habilidades = todas → all:true). */
function primaryAbilityBlock(classObj) {
  const pa = classObj?.primaryAbility;
  if (!Array.isArray(pa) || pa.length === 0) return { value: [], all: false };
  const value = [];
  for (const entry of pa) {
    for (const [k, v] of Object.entries(entry ?? {})) {
      if (v && ABILITIES.includes(k) && !value.includes(k)) value.push(k);
    }
  }
  return { value, all: pa.length === 1 && value.length > 1 };
}

// Features que NÃO viram item (são passos de advancement na própria classe).
const NON_ITEM_FEATURES = new Set(['ability score improvement', 'epic boon']);

/** Resolve os refs de classFeatures até o nível em objetos {name, level, source, entries}.
 * DEDUPA por nome (mantém a 1ª/mais baixa ocorrência): o 5etools re-lista a mesma
 * feature nos níveis em que ela MELHORA (ex: Indomitable 9/13/17), mas o Foundry
 * quer UM item por feature (a progressão é ScaleValue/uses), como nos premades. */
function resolveClassFeatures(db, classId, classObj, level) {
  const pool = db?.[`class-${classId}`]?.classFeature ?? [];
  const idx = new Map();
  for (const f of pool) idx.set(`${norm(f.name)}|${f.level}`, f);

  const out = [];
  const seen = new Set();
  for (const ref of classObj?.classFeatures ?? []) {
    const r = parseFeatureRef(ref);
    if (r.level > level) continue;
    if (r.gainsSubclass) continue; // vira advancement Subclass, não item
    if (NON_ITEM_FEATURES.has(norm(r.name))) continue; // ASI/Epic Boon = advancement
    if (seen.has(norm(r.name))) continue; // já emitida num nível anterior
    const f = idx.get(`${norm(r.name)}|${r.level}`);
    if (f) {
      seen.add(norm(r.name));
      out.push({ name: f.name, level: f.level, source: f.source ?? classObj.source, entries: f.entries ?? [], classId });
    }
  }
  return out;
}

/**
 * Constrói um item de FEATURE de classe (type 'feat', subtype 'class'), com os
 * Active Effects curados (foundryEffects) quando houver mecânica em prosa - e,
 * SEM entrada curada, os do overlay foundry-*.json (DDL-0009/0031; regra
 * tudo-ou-nada: curado presente = overlay ignorado, resultado previsível).
 * `feature.subclass` ({shortName}) roteia o lookup p/ o índice de subclassFeature;
 * `feature.overlayName` troca o nome de lookup (opções de featureoption, cujo
 * item se chama "Feature: Opção" mas o overlay indexa só a opção).
 * @param {{name:string, level:number, source:string, entries:Array,
 *          classId?:string, subclass?:{shortName:string}, overlayName?:string}} feature
 * @param {object} [db]  compêndio (habilita o overlay; opcional p/ uso puro)
 * @returns {object} item Foundry (type 'feat')
 */
export function buildFeatureItem(feature, db = null) {
  const changes = effectChangesFor(feature.name, feature.classId);
  const targetEffect = targetEffectFor(feature.name, feature.classId);
  const effects = [];
  if (changes) {
    effects.push({
      _id: randomFoundryId(),
      name: feature.name,
      changes: changes.map((c) => ({ priority: null, ...c })),
      disabled: false,
      transfer: true,
      img: 'icons/svg/aura.svg',
      origin: '',
      duration: {},
      description: '',
      flags: {},
    });
  }
  let targetEffectId = null;
  if (targetEffect) {
    targetEffectId = randomFoundryId();
    effects.push({
      _id: targetEffectId,
      name: targetEffect.name,
      changes: [],
      disabled: false,
      transfer: false, // aplicado ao ALVO pela activity, não ao dono do item
      statuses: targetEffect.statuses,
      img: 'icons/svg/aura.svg',
      origin: '',
      duration: { seconds: targetEffect.seconds },
      description: '',
      flags: {},
    });
  }
  if (!changes && !targetEffect && db) {
    const ref = {
      name: feature.overlayName ?? feature.name,
      classId: feature.classId,
      source: feature.source,
      level: feature.level,
    };
    effects.push(
      ...(feature.subclass
        ? overlaySubclassFeatureEffects(db, { ...ref, shortName: feature.subclass.shortName })
        : overlayClassFeatureEffects(db, ref)),
    );
  }

  return {
    _id: randomFoundryId(),
    name: feature.name,
    type: 'feat',
    img: 'icons/svg/item-bag.svg',
    system: {
      type: { value: 'class', subtype: '' },
      identifier: slugify(feature.name),
      description: { value: entriesToHtml(feature.entries), chat: '' },
      source: sourceBlock(feature.source),
      requirements: '',
      properties: [],
      uses: featureUses(feature.name, feature.classId) ?? { max: '', spent: 0, recovery: [] },
      prerequisites: { level: null, repeatable: false, items: [] },
      activities: featureActivities(feature.name, feature.classId, { targetEffectId }),
      advancement: {},
      enchant: {},
      crewed: false,
    },
    effects,
    flags: { builder5e: { level: feature.level } },
    _stats: itemStats(),
  };
}

/**
 * Itens de feature de uma classe até o nível do personagem (exclui ASI/Epic Boon
 * e a feature de subclasse, que são passos de advancement).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildClassFeatureItems(classEntry, classObj, db) {
  const classId = norm(classObj?.name);
  return resolveClassFeatures(db, classId, classObj, classEntry.level || 1).map((f) => buildFeatureItem(f, db));
}

/**
 * Constrói o item de um TALENTO escolhido (type 'feat'), a partir do objeto 5etools
 * do talento. O subtipo (general/origin/fightingStyle/epicBoon) vem da categoria do
 * talento (ou é forçado via `subtype`). Se o talento concede um aumento de atributo
 * FIXO (ex: Great Weapon Master → +1 Str), embute um advancement AbilityScoreImprovement
 * `fixed` - a forma canônica do dnd5e (validada contra um export real). Aumentos por
 * ESCOLHA já entram assados no `abilities` do ator (via deriveFeatAbilityBoosts).
 * As SUB-ESCOLHAS do talento (`choices` - o sub-bag salvo no personagem) viajam em
 * `flags.builder5e.choices` (TC-0002): o Foundry as ignora; nosso import as restaura.
 * @param {object} featData  objeto de talento 5etools
 * @param {{ level?: number|null, subtype?: string, choices?: object, db?: object }} [opts]
 *   db: habilita os Active Effects do overlay foundry-feats (DDL-0031) quando
 *   não há entrada curada p/ o talento.
 * @returns {object|null} item Foundry (type 'feat')
 */
export function buildFeatItem(featData, { level = null, subtype, choices = null, db = null } = {}) {
  if (!featData) return null;
  const st = subtype ?? FEAT_CATEGORY_SUBTYPE[featData.category] ?? '';

  // Active Effect curado do talento/estilo de luta (ex: Archery → +2 ataque à
  // distância; Defense → +1 CA). Feats são class-agnósticos (sem classId).
  // Sem entrada curada, o overlay (nome+fonte exatos) preenche - ex: Alert.
  const changes = effectChangesFor(featData.name);
  const effects = changes
    ? [{
        _id: randomFoundryId(),
        name: featData.name,
        changes: changes.map((c) => ({ priority: null, ...c })),
        disabled: false,
        transfer: true,
        img: 'icons/svg/aura.svg',
        origin: '',
        duration: {},
        description: '',
        flags: {},
      }]
    : overlayFeatEffects(db, featData.name, featData.source);

  const advancement = [];
  const fixed = fixedAbilityBoosts(featData.ability);
  if (fixed.length) {
    const configuration = { points: 0, fixed: zeroFixed(), cap: 1, locked: [], recommendation: null };
    for (const b of fixed) {
      configuration.fixed[b.ability] += b.amount;
      configuration.points += b.amount;
      configuration.cap = Math.max(configuration.cap, b.amount);
    }
    advancement.push({
      _id: randomFoundryId(),
      type: 'AbilityScoreImprovement',
      configuration,
      value: { type: 'asi' },
      level: 0,
      title: '',
      hint: '',
      flags: {},
    });
  }

  return {
    _id: randomFoundryId(),
    name: featData.name,
    type: 'feat',
    img: 'icons/svg/item-bag.svg',
    system: {
      type: { value: 'feat', subtype: st },
      identifier: slugify(featData.name),
      description: { value: entriesToHtml(featData.entries), chat: '' },
      source: sourceBlock(featData.source),
      requirements: '',
      properties: [],
      uses: { max: '', spent: 0, recovery: [] },
      prerequisites: { level: null, repeatable: !!featData.repeatable, items: [] },
      activities: {},
      advancement: keyById(advancement),
      enchant: {},
      crewed: false,
    },
    effects,
    flags: { builder5e: { level, ...(bagHasContent(choices) ? { choices } : {}) } },
    _stats: itemStats(),
  };
}

/**
 * Talentos escolhidos no choice-bag de UMA classe (slots de ASI/Epic Boon/Fighting
 * Style), virando itens de feat + os valores de advancement da classe:
 *   - talento normal (GWM, Alert…) → item + ASI `value:{type:'feat', feat:{id:uuid}}`;
 *   - "Ability Score Improvement" (ASI cru) → SEM item, `value:{type:'asi', assignments}`
 *     com os aumentos escolhidos (lidos do sub-bag do talento);
 *   - talento de FIGHTING STYLE (categoria FS*) → item + entrada em `fightingStyles`
 *     (vira um advancement ItemChoice na classe, como nos premades - não um ASI).
 * O nível vem do id da escolha (`feat@<n>`); ids sem nível numérico (fighting styles
 * de optionalfeatureProgression, ex: Bard) viram itens soltos por enquanto.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {{ items: object[], asiByLevel: Record<number, object>,
 *             fightingStyles: {itemId: string, level: number}[] }}
 */
export function buildClassChosenFeats(classEntry, db) {
  const items = [];
  /** @type {Record<number, object>} */
  const asiByLevel = {};
  /** @type {{itemId: string, level: number}[]} */
  const fightingStyles = [];
  for (const [choiceId, entry] of Object.entries(classEntry.choices ?? {})) {
    if (!entry || entry.kind !== 'feat' || !Array.isArray(entry.picks)) continue;
    const at = choiceId.lastIndexOf('@');
    const lvl = at >= 0 ? Number(choiceId.slice(at + 1)) : NaN;
    // Só os slots PRÓPRIOS da classe ('feat@<nível>') entram no advancement do
    // item de classe. Grants de subclasse ('sub:feat@…', ex: Champion Additional
    // Fighting Style) e estilos via optionalfeatureProgression ('feat@fs@…')
    // viram itens soltos + entrada na flag residual da classe - senão o import
    // os re-mapearia para chaves feat@<nível> que o builder não tem (TC-0006).
    const ownSlot = /^feat@\d+$/.test(choiceId);
    for (const pick of entry.picks) {
      const featData = findFeat(db, pick);
      if (!featData) continue;
      if (norm(featData.name) === ASI_FEAT_NAME) {
        // ASI cru: os aumentos escolhidos ficam no sub-bag do talento.
        const assignments = {};
        for (const b of collectAbilityPicks(entry.sub?.[pick])) {
          assignments[b.ability] = (assignments[b.ability] ?? 0) + b.amount;
        }
        if (ownSlot) asiByLevel[lvl] = { type: 'asi', assignments };
        continue;
      }
      const item = buildFeatItem(featData, {
        level: Number.isFinite(lvl) ? lvl : classEntry.level || 1,
        choices: entry.sub?.[pick] ?? null,
        db,
      });
      items.push(item);
      if (!ownSlot) continue;
      if (String(featData.category ?? '').startsWith('FS')) {
        fightingStyles.push({ itemId: item._id, level: lvl });
      } else {
        asiByLevel[lvl] = { type: 'feat', feat: { [item._id]: `.${item._id}` } };
      }
    }
  }
  return { items, asiByLevel, fightingStyles };
}

/**
 * Itens "<Feature>: <Opção>" das escolhas de SUB-FEATURE (featureoption) - a
 * codificação dos premades reais (ex: "Divine Order: Thaumaturge"), que o import
 * (featureOptionChoiceBag) já sabe reverter por nome/identifier (TC-0007). A
 * descrição é o texto da própria opção (o pool do descritor a carrega).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object|null} subObj
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildFeatureOptionItems(classEntry, classObj, subObj, db) {
  if (!classObj) return [];
  const descriptors = [
    ...featureOptionChoices(db, classEntry.classId, classObj, classEntry.level || 1),
    ...subclassFeatureOptionChoices(db, classEntry.classId, subObj, classEntry.level || 1),
  ];
  const out = [];
  for (const ch of descriptors) {
    const entry = classEntry.choices?.[ch.id];
    for (const pick of entry?.picks ?? []) {
      const opt = (ch.pool?.options ?? []).find((o) => o.value === pick);
      if (!opt) continue;
      out.push(
        buildFeatureItem(
          {
            name: `${ch.label}: ${opt.label}`,
            level: ch.level ?? 1,
            source: classEntry.source,
            entries: opt.entries ?? [],
            classId: classEntry.classId,
            // O overlay indexa a OPÇÃO pelo nome dela ("Thaumaturge"), não pelo
            // composto; descritores 'sub:' vêm da subclasse → índice de subclasse.
            overlayName: opt.label,
            ...(ch.id.startsWith('sub:') && subObj ? { subclass: { shortName: subObj.shortName } } : {}),
          },
          db,
        ),
      );
    }
  }
  return out;
}

// featureType do 5etools → subtipo de feature de classe do dnd5e.
const OPTFEAT_SUBTYPE = {
  EI: 'eldritchInvocation',
  MM: 'metamagic',
  'MV:B': 'maneuver',
  AI: 'artificerInfusion',
  AS: 'arcaneShot',
  RN: 'rune',
  PB: 'pactBoon',
  ED: 'elementalDiscipline',
};

/**
 * Itens das OPTIONAL FEATURES escolhidas (invocations, metamagic, maneuvers,
 * infusions, arcane shots, runes, pact boons…) - antes elas não exportavam
 * NADA (TC-0004): nem apareciam na ficha do Foundry. Um item de feat por pick,
 * resolvido no db pelo id "Nome|Fonte".
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildOptionalFeatureItems(classEntry, db) {
  const list = db?.optionalfeatures?.optionalfeature ?? [];
  const out = [];
  for (const [choiceId, entry] of Object.entries(classEntry.choices ?? {})) {
    if (entry?.kind !== 'optionalfeature') continue;
    for (const pick of entry.picks ?? []) {
      const [name, source] = String(pick).split('|');
      const raw = list.find((f) => f.name === name && f.source === source) ??
        list.find((f) => norm(f.name) === norm(name));
      if (!raw) continue;
      const item = buildFeatureItem({
        name: raw.name,
        level: classEntry.level || 1,
        source: raw.source,
        entries: raw.entries ?? [],
        classId: classEntry.classId,
      });
      // Optional features têm índice próprio no overlay (foundry-optionalfeatures,
      // nome+fonte) - o lookup por classe do buildFeatureItem não as encontraria.
      if (!item.effects.length) item.effects.push(...overlayOptionalFeatureEffects(db, raw.name, raw.source));
      const subtype = (raw.featureType ?? []).map((t) => OPTFEAT_SUBTYPE[t]).find(Boolean);
      if (subtype) item.system.type.subtype = subtype;
      item.flags.builder5e.choiceId = choiceId;
      out.push(item);
    }
  }
  return out;
}

/** Chave de trait de arma do Foundry (`weapon:<sim|mar>:<slug>`) p/ um pick de
 * Weapon Mastery ('Greatsword|XPHB'), com a categoria vinda do items-base. */
function weaponTraitKey(db, pick) {
  const name = String(pick).split('|')[0];
  const item = (db?.['items-base']?.baseitem ?? []).find((b) => norm(b.name) === norm(name));
  const cat = { simple: 'sim', martial: 'mar' }[norm(item?.weaponCategory)];
  return cat ? `weapon:${cat}:${norm(name).replace(/\s+/g, '')}` : null;
}

/**
 * Valores ESCOLHIDOS dos advancements Trait da classe, por título - o formato
 * aplicado dos premades (`value.chosen`): perícias iniciais (bag id 'skill', em
 * código → `skills:<code>`) e Weapon Mastery (bag 'weaponMastery' → chave completa
 * `weapon:<cat>:<slug>`). Grants fixos são preenchidos direto no buildClassItem.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {Record<string, string[]>} título do Trait → chosen[]
 */
export function buildClassTraitValues(classEntry, db) {
  const out = {};
  const skills = classEntry.choices?.skill?.picks ?? [];
  if (skills.length) out['Skill Proficiencies'] = skills.map((s) => `skills:${s}`);
  const mastery = (classEntry.choices?.weaponMastery?.picks ?? [])
    .map((p) => weaponTraitKey(db, p))
    .filter(Boolean);
  if (mastery.length) out['Weapon Mastery'] = mastery;
  return out;
}

/**
 * Item do TALENTO DE ORIGEM (background feat), subtipo 'origin'. Ligado ao item de
 * background por um ItemGrant (ver buildBackgroundItem).
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object|null}
 */
export function buildOriginFeatItem(character, db) {
  const of = character?.origin?.originFeat;
  if (!of?.id) return null;
  const featData = findFeat(db, `${of.id}|${of.source}`);
  // As sub-escolhas do talento de origem (ex: as magias do Magic Initiate)
  // viajam na flag do próprio item (TC-0002).
  return featData ? buildFeatItem(featData, { level: 1, subtype: 'origin', choices: of.choices ?? null, db }) : null;
}

// Categoria de ferramenta do 5etools (baseitem.type) → segmento da chave de trait
// do Foundry (`tool:<cat>:<id>`). Ferramentas sem categoria usam `tool:<id>`.
const TOOL_TYPE_TO_TRAIT_CAT = { AT: 'art', GS: 'game', INS: 'music' };

/** Chave de trait de FERRAMENTA do Foundry p/ um nome nosso ('Dice Set' →
 * 'tool:game:dice'), com a categoria vinda do items-base. */
export function toolTraitKey(db, name) {
  const id = toolId(name);
  const item = (db?.['items-base']?.baseitem ?? []).find((b) => norm(b.name) === norm(name));
  const cat = TOOL_TYPE_TO_TRAIT_CAT[String(item?.type ?? '').split('|')[0]];
  return cat ? `tool:${cat}:${id}` : `tool:${id}`;
}

/** Chave de trait de IDIOMA do Foundry ('Common' → 'languages:standard:common'),
 * com o tipo (standard/exotic) vindo do languages.json do 5etools. */
export function languageTraitKey(db, name) {
  const entry = (db?.languages?.language ?? []).find((l) => norm(l.name) === norm(name));
  const type = norm(entry?.type) === 'exotic' || norm(entry?.type) === 'rare' ? 'exotic' : 'standard';
  return `languages:${type}:${languageCode(name)}`;
}

/**
 * Item de ORIGEM/BACKGROUND do Foundry (type 'background') a partir da origem
 * custom do personagem: AbilityScoreImprovement (os boosts de origem) + Traits das
 * proficiências concedidas (perícias, ferramentas e idiomas - fixas + escolhidas)
 * + ItemGrant do talento de origem (quando o item do talento é fornecido).
 * @param {import('../schema/character').Character} character
 * @param {object} [originFeatItem]  item do talento de origem (buildOriginFeatItem)
 * @param {object} [db]  compêndio (categorias de ferramenta / tipos de idioma)
 * @returns {object|null} item Foundry (type 'background')
 */
export function buildBackgroundItem(character, originFeatItem = null, db = null) {
  const origin = character?.origin;
  if (!origin) return null;
  const advancement = [];

  // AbilityScoreImprovement - os boosts de origem (2024: +2/+1 ou +1/+1/+1).
  const boosts = origin.abilityBoosts ?? [];
  if (boosts.length) {
    const assignments = {};
    for (const b of boosts) if (ABILITIES.includes(b.ability)) assignments[b.ability] = (assignments[b.ability] ?? 0) + (b.amount ?? 0);
    const points = boosts.reduce((s, b) => s + (b.amount ?? 0), 0);
    advancement.push({
      _id: randomFoundryId(),
      type: 'AbilityScoreImprovement',
      configuration: { points, cap: 2, fixed: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, locked: [] },
      value: { type: 'asi', assignments },
      title: '',
    });
  }

  // Trait de perícias: fixas (origin.skillProficiencies) + escolhidas (choice-bag).
  const skills = [...new Set([...(origin.skillProficiencies ?? []), ...collectChoicePicks(origin.choices, 'skill')])];
  if (skills.length) advancement.push(traitAdv('Skill Proficiencies', skills.map((s) => `skills:${s}`)));

  // Traits de ferramentas e idiomas (fixos + escolhidos), como no premade Soldier
  // ('tool:game:dice', 'languages:standard:common').
  const tools = [...new Set([...(origin.toolProficiencies ?? []), ...collectChoicePicks(origin.choices, 'tool')])];
  if (tools.length) advancement.push(traitAdv('Tool Proficiencies', tools.map((t) => toolTraitKey(db, t))));
  const languages = [...new Set([...(origin.languages ?? []), ...collectChoicePicks(origin.choices, 'language')])];
  if (languages.length) advancement.push(traitAdv('Languages', languages.map((l) => languageTraitKey(db, l))));

  // ItemGrant do talento de origem (uuid relativo `.${_id}` ao item embutido).
  if (originFeatItem) {
    advancement.push({
      _id: randomFoundryId(),
      type: 'ItemGrant',
      level: 0,
      title: 'Origin Feat',
      configuration: { items: [{ uuid: `.${originFeatItem._id}`, optional: false }], optional: false, spell: null },
      value: { added: { [originFeatItem._id]: `.${originFeatItem._id}` } },
    });
  }

  return {
    _id: randomFoundryId(),
    name: 'Custom Background',
    type: 'background',
    img: 'icons/svg/item-bag.svg',
    system: {
      identifier: 'custom-background',
      advancement: keyById(advancement),
      // A história escrita na aba Background é a descrição deste item - e também
      // vai para `details.biography` do ator (foundryExport). Nossa origem é
      // custom, então não há texto oficial competindo com o do jogador.
      description: { value: textToHtml(character.identity?.backstory), chat: '' },
      source: sourceBlock(''),
      startingEquipment: [],
      wealth: '',
    },
    effects: [],
    flags: {},
    _stats: itemStats(),
  };
}

/**
 * Itens de feature de uma SUBCLASSE até o nível. Itera o pool cru de
 * subclassFeature (filtrado pelo shortName), pulando a feature "guarda-chuva"
 * (nome = nome/shortName da subclasse - só um container que inlina as reais) e os
 * passos de advancement (ASI/Epic Boon).
 * @param {object} subclass  objeto de subclasse (shortName, name, source)
 * @param {string} classId
 * @param {object} db
 * @param {number} level
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildSubclassFeatureItems(subclass, classId, db, level) {
  if (!subclass) return [];
  const short = norm(subclass.shortName);
  const src = norm(subclass.source);
  const umbrella = new Set([short, norm(subclass.name)]);
  const seen = new Set();
  const out = [];
  for (const f of db?.[`class-${classId}`]?.subclassFeature ?? []) {
    if (norm(f.subclassShortName) !== short) continue;
    // Filtra pela FONTE da subclasse - o pool cru mistura edições (PHB + XPHB),
    // o que geraria features duplicadas.
    if (src && norm(f.subclassSource ?? f.source) !== src) continue;
    if ((f.level ?? 0) > level) continue;
    const n = norm(f.name);
    if (umbrella.has(n) || NON_ITEM_FEATURES.has(n)) continue;
    const key = `${n}|${f.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(buildFeatureItem(
      { name: f.name, level: f.level, source: f.source ?? subclass.source, entries: f.entries ?? [], classId, subclass: { shortName: subclass.shortName } },
      db,
    ));
  }
  return out;
}

/**
 * Item de SUBCLASSE do Foundry (type 'subclass'), com o classIdentifier e um
 * ItemGrant por nível ligando às suas features.
 * @param {object} subclass  objeto de subclasse (shortName, name, source)
 * @param {string} classId   identifier da classe pai (ex: 'fighter')
 * @param {object[]} [featureItems]
 * @returns {object|null}
 */
/** Bloco `movement` do Foundry a partir do speed 5etools (número ou objeto). */
function movementBlock(speed) {
  const s = typeof speed === 'number' ? { walk: speed } : (speed ?? {});
  const out = { walk: String(s.walk ?? 30), units: null, hover: false, ignoredDifficultTerrain: [] };
  for (const k of ['fly', 'swim', 'climb', 'burrow']) if (s[k]) out[k] = String(s[k] === true ? out.walk : s[k]);
  return out;
}

/**
 * Talentos escolhidos no choice-bag da ESPÉCIE (ex: o talento de origem do Human
 * "Versatile"), virando itens de feat - ligados ao item de espécie por um ItemGrant
 * (ver buildSpeciesItem). Nível sempre 1 (escolha de criação do personagem).
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat')
 */
export function buildSpeciesFeatItems(character, db) {
  // RASO de propósito: só entradas de topo do bag da espécie (um feat escolhido
  // dentro de outro feat pertence ao item do feat pai). O sub-bag de cada pick
  // viaja na flag do item (TC-0002).
  const out = [];
  for (const entry of Object.values(character?.species?.choices ?? {})) {
    if (entry?.kind !== 'feat') continue;
    for (const pick of entry.picks ?? []) {
      const item = buildFeatItem(findFeat(db, pick), { level: 1, choices: entry.sub?.[pick] ?? null, db });
      if (item) out.push(item);
    }
  }
  return out;
}

/**
 * Item de ESPÉCIE do Foundry (type 'race'), a partir de um objeto de raça 5etools
 * - já resolvido (`_copy`/`_versions`), então uma linhagem (ex: Elf; Drow Lineage)
 * exporta com os traços da linhagem. Inclui movimento, sentidos (darkvision),
 * advancement Size + descrição, e as SUB-ESCOLHAS da espécie (choice-bag, como
 * Elf "Keen Senses" ou Human "Skillful"/"Versatile"): AbilityScoreImprovement
 * (legado - 2024 normalmente não concede boost via espécie), Traits de perícia/
 * ferramenta/idioma escolhidos, e o ItemGrant do talento de origem escolhido pelo
 * Human (quando os itens já construídos vêm em `featItems`, ver buildSpeciesFeatItems).
 * @param {import('../schema/character').Character} character
 * @param {object} raceObj
 * @param {object} [db]  compêndio (categorias de ferramenta / tipos de idioma)
 * @param {object[]} [featItems]  itens de talento já construídos (buildSpeciesFeatItems)
 * @returns {object|null} item Foundry (type 'race')
 */
/**
 * Active Effects do item de raça: os do overlay foundry-races + o efeito CURADO
 * de armadura natural (Tortle/Autognome/Warforged). Quando a raça tem armadura
 * natural curada, os changes de CA do overlay são REMOVIDOS (o Autognome AAG é
 * o único coberto pelos dois; sem isso a CA somaria em dobro). O overlay que
 * NÃO mexe em CA (outros traços da raça) é preservado.
 * @param {object} db
 * @param {object} raceObj  raça 5etools RESOLVIDA
 * @returns {object[]}
 */
function speciesEffects(db, raceObj) {
  const nat = naturalArmorFor(raceObj);
  const overlay = overlayRaceEffects(db, raceObj);
  if (!nat) return overlay;
  // Descarta effects do overlay que tocam a CA (a armadura natural curada os cobre)
  // e os que ficarem vazios; mantém os demais changes de um mesmo effect.
  const pruned = [];
  for (const eff of overlay) {
    const changes = (eff.changes ?? []).filter((c) => !String(c.key ?? '').startsWith('system.attributes.ac'));
    if (changes.length || (eff.statuses ?? []).length) pruned.push({ ...eff, changes });
  }
  const natEffect = {
    _id: randomFoundryId(),
    name: nat.label,
    changes: naturalArmorChanges(nat).map((c) => ({ priority: null, ...c })),
    disabled: false,
    transfer: true,
    img: 'icons/svg/aura.svg',
    origin: '',
    duration: {},
    description: '',
    flags: {},
  };
  return [natEffect, ...pruned];
}

export function buildSpeciesItem(character, raceObj, db = null, featItems = []) {
  if (!raceObj) return null;
  // Tamanho EFETIVO: escolha do jogador (raças Small/Medium) e nível (Verdan).
  const level = (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0) || 1;
  const sizeCode = foundrySize(
    effectiveSizeCodes(raceObj, { chosen: sizePick(character?.species?.choices), level }),
  );
  const ctypeRaw = raceObj.creatureTypes?.[0];
  const ctype = typeof ctypeRaw === 'string' ? ctypeRaw : 'humanoid';
  const baseName = raceObj._baseName ?? raceObj.name; // identifier estável entre linhagens

  const advancement = [
    { _id: randomFoundryId(), type: 'Size', configuration: { sizes: [sizeCode] }, level: 0, title: '', hint: '', value: { size: sizeCode }, flags: {} },
  ];

  const speciesChoices = character?.species?.choices;

  // AbilityScoreImprovement - boosts de espécie (legado; 2024 não usa via espécie).
  // RASO: os boosts escolhidos DENTRO de um feat da espécie (ex: o +1 livre de um
  // legacy) pertencem ao item do feat (flag), não ao ASI da raça (TC-0010).
  const boosts = shallowPicks(speciesChoices, 'ability').filter((p) => p && typeof p === 'object');
  if (boosts.length) {
    const assignments = {};
    for (const b of boosts) if (ABILITIES.includes(b.ability)) assignments[b.ability] = (assignments[b.ability] ?? 0) + (b.amount ?? 0);
    const points = boosts.reduce((s, b) => s + (b.amount ?? 0), 0);
    advancement.push({
      _id: randomFoundryId(),
      type: 'AbilityScoreImprovement',
      configuration: { points, cap: 2, fixed: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, locked: [] },
      value: { type: 'asi', assignments },
      title: '',
    });
  }

  // Traits de perícia/ferramenta/idioma ESCOLHIDOS (ex: Elf Keen Senses, Human
  // Skillful). RASOS: as proficiências escolhidas dentro de um feat da espécie
  // (Human Versatile → Crafter → 3 ferramentas) pertencem ao item do FEAT - se
  // entrassem aqui, o import as devolveria como escolha da raça (TC-0010).
  const skills = shallowPicks(speciesChoices, 'skill');
  if (skills.length) advancement.push(traitAdv('Skill Proficiencies', skills.map((s) => `skills:${s}`)));
  const tools = shallowPicks(speciesChoices, 'tool');
  if (tools.length) advancement.push(traitAdv('Tool Proficiencies', tools.map((t) => toolTraitKey(db, t))));
  const languages = shallowPicks(speciesChoices, 'language');
  if (languages.length) advancement.push(traitAdv('Languages', languages.map((l) => languageTraitKey(db, l))));

  // ItemGrant do(s) talento(s) escolhido(s) pela espécie (ex: Human "Versatile").
  if (featItems.length) advancement.push(...itemGrantAdvancements(featItems, 'Species Feat'));

  // Escolhas da espécie SEM casa nativa no Foundry viajam na flag do item de
  // raça (DDL-0028): o atributo de conjuração racial escolhido (TC-0009), o
  // tamanho (antes um waiver do sweep), pools mistos, traços de dano escolhidos
  // (TC-0014) e magias/lista de magias escolhidas (TC-0011).
  const residual = {};
  const RESIDUAL_SPECIES_KINDS = ['spellAbility', 'size', 'mixed', 'resist', 'immune', 'vulnerable', 'spell', 'spellSet'];
  for (const [id, entry] of Object.entries(speciesChoices ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    if (!RESIDUAL_SPECIES_KINDS.includes(entry.kind)) continue;
    if ((entry.picks?.length ?? 0) === 0) continue;
    residual[id] = entry;
  }

  return {
    _id: randomFoundryId(),
    name: raceObj.name,
    type: 'race',
    img: 'icons/svg/item-bag.svg',
    system: {
      identifier: slugify(baseName),
      type: { value: ctype, custom: '', subtype: baseName },
      movement: movementBlock(raceObj.speed),
      senses: {
        units: null,
        special: '',
        ranges: { darkvision: raceObj.darkvision ?? null, blindsight: null, tremorsense: null, truesight: null },
      },
      advancement: keyById(advancement),
      description: { value: entriesToHtml(raceObj.entries), chat: '' },
      source: sourceBlock(raceObj.source),
    },
    // Traços com mecânica no overlay foundry-races (Halfling Luck, Goliath
    // Powerful Build…) viram effects do PRÓPRIO item de raça - não emitimos
    // itens por traço, e um transfer effect aplica ao ator de qualquer item.
    // A armadura natural (Tortle/Autognome/Warforged) vem do registro curado
    // (fonte única, sheet + export); suprimimos o efeito de CA do overlay para
    // essa raça, senão o Autognome AAG (coberto pelo overlay) somaria em dobro.
    effects: speciesEffects(db, raceObj),
    flags: Object.keys(residual).length ? { builder5e: { choices: residual } } : {},
    _stats: itemStats(),
  };
}

export function buildSubclassItem(subclass, classId, featureItems = [], opts = {}) {
  if (!subclass) return null;
  const identifier = slugify(subclass.shortName ?? subclass.name);
  return {
    _id: randomFoundryId(),
    name: subclass.name,
    type: 'subclass',
    img: subclassIcon(identifier, classId),
    system: {
      identifier,
      classIdentifier: classId,
      description: { value: opts.description ?? '', chat: '' },
      spellcasting: { progression: 'none', ability: '', preparation: { formula: '' } },
      advancement: keyById(itemGrantAdvancements(featureItems, 'Subclass Features')),
      source: sourceBlock(subclass.source),
    },
    effects: [],
    flags: {},
    _stats: itemStats(),
  };
}

// =============================================================================
// Inventário → Items físicos do Foundry (weapon / equipment / tool / consumable
// / loot). Fase B1 export: cada entrada do character.inventory vira um Item com
// os campos estruturados do dnd5e (dano de arma, CA de armadura, quantidade,
// equipado/atunado, preço, peso, raridade). `customImg` do usuário → `img`;
// sem custom, um ícone genérico do Foundry (NÃO a arte do 5e.tools, que é http
// e o re-import confundiria com uma imagem custom do usuário).
// =============================================================================

/** group do engine → tipo Foundry (+ type.value quando fixo). */
const GROUP_FOUNDRY = {
  weapon: { type: 'weapon' },
  armor: { type: 'equipment' }, // type.value = armorSlot (light/medium/heavy/shield)
  spellcastingFocus: { type: 'equipment', typeValue: 'trinket' },
  tool: { type: 'tool', typeValue: 'art' },
  instrument: { type: 'tool', typeValue: 'music' },
  ammunition: { type: 'consumable', typeValue: 'ammo' },
  gear: { type: 'loot', typeValue: 'gear' },
  food: { type: 'consumable', typeValue: 'food' },
  wondrous: { type: 'equipment', typeValue: 'wondrous' },
  ring: { type: 'equipment', typeValue: 'ring' },
  wand: { type: 'equipment', typeValue: 'wand' },
  rod: { type: 'equipment', typeValue: 'rod' },
  potion: { type: 'consumable', typeValue: 'potion' },
  scroll: { type: 'consumable', typeValue: 'scroll' },
  treasure: { type: 'loot', typeValue: 'treasure' },
  other: { type: 'loot', typeValue: 'gear' },
};

// Código de propriedade de arma 5etools → código do dnd5e.
const WEAPON_PROP_CODE = {
  A: 'amm', AF: 'amm', F: 'fin', H: 'hvy', L: 'lgt', LD: 'lod',
  R: 'rch', RLD: 'rel', S: 'spc', T: 'thr', V: 'ver', '2H': 'two',
};

// Código de tipo de dano 5etools → palavra do dnd5e.
const DMG_TYPE_WORD = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning',
  N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

const FOUNDRY_RARITY = {
  common: 'common', uncommon: 'uncommon', rare: 'rare',
  'very rare': 'veryRare', legendary: 'legendary', artifact: 'artifact',
};

// Teto de Destreza (armor.dex): leve ilimitado (null), média +2, pesada 0.
const ARMOR_DEX = { light: null, medium: 2, heavy: 0, shield: null };

// Ícones genéricos do Foundry por grupo (fallback quando não há imagem custom nem fluff).
const GROUP_ICON = {
  weapon: 'icons/weapons/swords/sword-broad-steel.webp',
  armor: 'icons/equipment/chest/breastplate-banded-steel.webp',
  tool: 'icons/tools/smithing/crucible-steel-grey.webp',
  instrument: 'icons/tools/instruments/lute-gold-brown.webp',
  potion: 'icons/consumables/potions/potion-tinted-blue.webp',
  scroll: 'icons/sundries/scrolls/scroll-bound-brown.webp',
  ammunition: 'icons/weapons/ammunition/arrow-broadhead-glowing-white.webp',
  ring: 'icons/equipment/finger/ring-band-engraved-gold.webp',
  wand: 'icons/weapons/wands/wand-gem-violet.webp',
  rod: 'icons/weapons/staves/staff-simple.webp',
};

/** Valor em cobre (5etools) → { value, denomination } do Foundry (maior denom. inteira). */
function foundryPrice(copper) {
  if (copper == null) return { value: 0, denomination: 'gp' };
  if (copper % 100 === 0) return { value: copper / 100, denomination: 'gp' };
  if (copper % 10 === 0) return { value: copper / 10, denomination: 'sp' };
  return { value: copper, denomination: 'cp' };
}

function foundryRarity(rarity) {
  return FOUNDRY_RARITY[rarity] ?? '';
}

/** "1d8" → { number:1, denomination:8 } (ou null). */
function parseDie(s) {
  const m = /^(\d+)d(\d+)$/.exec(String(s ?? ''));
  return m ? { number: Number(m[1]), denomination: Number(m[2]) } : null;
}

/** "80/320" → { value:80, long:320, units:'ft', reach:null }. */
function parseRange(s) {
  if (!s) return { value: null, long: null, units: 'ft', reach: null };
  const [v, l] = String(s).split('/');
  return { value: Number(v) || null, long: l ? Number(l) || null : null, units: 'ft', reach: null };
}

function weaponDamageBase(raw) {
  const die = parseDie(raw?.dmg1);
  const type = DMG_TYPE_WORD[raw?.dmgType];
  return {
    number: die?.number ?? null,
    denomination: die?.denomination ?? null,
    types: type ? [type] : [],
    bonus: '',
    custom: { enabled: false, formula: '' },
    scaling: { number: 1 },
  };
}

function weaponDamageVersatile(raw) {
  const die = raw?.dmg2 ? parseDie(raw.dmg2) : null;
  const type = DMG_TYPE_WORD[raw?.dmgType];
  return {
    number: die?.number ?? null,
    denomination: die?.denomination ?? null,
    types: die && type ? [type] : [],
    bonus: '',
    custom: { enabled: false, formula: '' },
    scaling: { mode: '', number: null, formula: '' },
  };
}

function mapWeaponProps(props) {
  const out = [];
  for (const p of props ?? []) {
    const code = (typeof p === 'string' ? p : p?.uid)?.split('|')[0];
    const f = WEAPON_PROP_CODE[code];
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

/** Entries de fluff do item (lore) p/ compor a descrição. */
function itemFluffEntries(db, raw) {
  const f = (db?.['fluff-items']?.itemFluff ?? []).find((x) => x.name === raw.name && x.source === raw.source);
  return f?.entries ?? null;
}

function inventoryImg(entry, group) {
  if (entry.customImg) return entry.customImg;
  return GROUP_ICON[group] ?? 'icons/svg/item-bag.svg';
}

/** "+1"/1 → número (0 se vazio). */
function bonusNum(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Activity de ATAQUE de uma arma. `includeBase:true` + `attack.ability:''` deixa
 * o Foundry calcular acerto/dano a partir da arma + atributos (str/dex, finesse,
 * proficiência) - não guardamos a aritmética, só a config (como o export real).
 */
function weaponAttackActivity(info, raw) {
  const id = randomFoundryId();
  const ranged = info.kind === 'ranged';
  const range = ranged
    ? parseRange(raw?.range)
    : { value: '5', long: null, units: 'ft', reach: null };
  return {
    [id]: {
      type: 'attack',
      _id: id,
      name: '',
      sort: 0,
      activation: { type: 'action', value: 1, condition: '', override: false },
      consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: true },
      description: { chatFlavor: '' },
      duration: { concentration: false, value: '', units: 'inst', special: '', override: false },
      effects: [],
      range: { value: range.value != null ? String(range.value) : '', units: 'ft', special: '', override: false },
      target: {
        template: { count: '', contiguous: false, type: '', size: '', width: '', height: '', units: 'ft', stationary: false },
        affects: { count: '', type: '', choice: false, special: '' },
        prompt: false,
        override: false,
      },
      attack: {
        ability: '',
        bonus: '',
        critical: { threshold: null },
        flat: false,
        type: { value: ranged ? 'ranged' : 'melee', classification: 'weapon' },
      },
      damage: { critical: { bonus: '' }, includeBase: true, parts: [] },
      uses: { spent: 0, recovery: [], max: '' },
      flags: {},
    },
  };
}

// Campo de traço de dano do item → data path do dnd5e (Armor of Resistance…).
const ITEM_DAMAGE_TRAIT_KEY = {
  resist: 'system.traits.dr.value',
  immune: 'system.traits.di.value',
  vulnerable: 'system.traits.dv.value',
};

/**
 * Active Effect (transfer:true) de um item com bônus planos (Ring/Cloak of
 * Protection, escudo/armadura mágicos): +CA e/ou +saves; e/ou traços de dano
 * estruturados (Armor of Resistance → dr). O dnd5e SUPRIME o efeito sozinho
 * quando o item não está equipado/atunado (isSuppressed), então basta
 * `transfer:true` - mesma forma do Ring of Protection oficial.
 */
function itemBonusEffect(name, img, raw) {
  const changes = [];
  if (bonusNum(raw?.bonusAc)) {
    changes.push({ key: 'system.attributes.ac.bonus', mode: 2, value: String(raw.bonusAc), priority: null });
  }
  if (bonusNum(raw?.bonusSavingThrow)) {
    changes.push({ key: 'system.bonuses.abilities.save', mode: 2, value: String(raw.bonusSavingThrow), priority: null });
  }
  // Resistências/imunidades/vulnerabilidades do item (só entradas string - os
  // condicionais em prosa ficam na descrição). mode 2 (ADD) acrescenta ao set.
  for (const [field, key] of Object.entries(ITEM_DAMAGE_TRAIT_KEY)) {
    for (const t of raw?.[field] ?? []) {
      if (typeof t === 'string') changes.push({ key, mode: 2, value: t.toLowerCase(), priority: null });
    }
  }
  if (!changes.length) return null;
  return {
    _id: randomFoundryId(),
    name,
    img,
    changes,
    disabled: false,
    duration: { startTime: null, seconds: null, combat: null, rounds: null, turns: null, startRound: null, startTurn: null },
    origin: null,
    tint: '#ffffff',
    transfer: true,
    flags: {},
  };
}

/** Item CUSTOM (snapshot importado) → Item do Foundry, fiel ao que entrou. Os
 * campos voláteis (quantidade/equipado/atunado) vêm da entrada ATUAL da ficha. */
function customToFoundryItem(entry) {
  const c = entry.custom;
  const equippable = c.fType === 'weapon' || c.fType === 'equipment';
  const system = {
    description: { value: c.description ?? '', chat: '' },
    price: c.price ?? { value: 0, denomination: 'gp' },
    source: sourceBlock(entry.source),
    identified: true,
    unidentified: { description: '' },
    container: null,
    quantity: entry.quantity ?? 1,
    weight: { value: c.weight ?? 0, units: 'lb' },
    rarity: c.rarity ?? '',
    attunement: c.attunement ?? '',
    type: { value: c.typeValue ?? '', subtype: c.typeSubtype ?? '' },
    properties: [],
  };
  if (equippable) {
    system.equipped = !!entry.equipped;
    system.attuned = !!entry.attuned;
  }
  return {
    _id: randomFoundryId(),
    name: entry.customName || entry.itemId,
    type: c.fType ?? 'loot',
    img: entry.customImg || c.img || 'icons/svg/item-bag.svg',
    system,
    effects: [],
    folder: null,
    sort: 0,
    flags: {},
    _stats: itemStats(),
  };
}

/**
 * Itens de inventário do personagem → Items físicos do Foundry.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object[]}
 */
export function buildInventoryItems(character, db) {
  const out = [];
  for (const entry of character?.inventory ?? []) {
    const raw = resolveItemObj(db, entry.itemId, entry.source);
    // Item CUSTOM (sem entrada no catálogo): re-emite o Item do Foundry a partir
    // do snapshot guardado no import, com quantidade/equipado atuais da ficha.
    if (!raw && entry.custom) {
      out.push(customToFoundryItem(entry));
      continue;
    }
    const info = raw
      ? itemTypeInfo(raw)
      : { group: 'other', groupLabel: 'Other', armorSlot: null, category: null, kind: null };
    const map = GROUP_FOUNDRY[info.group] ?? GROUP_FOUNDRY.other;
    const fType = map.type;
    const attune = raw ? attunementInfo(raw) : { required: false };

    const description = raw
      ? entriesToHtml([...(raw.entries ?? []), ...(itemFluffEntries(db, raw) ?? [])])
      : '';

    const system = {
      description: { value: description, chat: '' },
      // Preço listado OU derivado (crafting de item mágico) - p/ o item ter valor no Foundry.
      price: foundryPrice(itemValue(raw, db)),
      source: sourceBlock(raw?.source ?? entry.source),
      identified: true,
      unidentified: { description: '' },
      container: null,
      quantity: entry.quantity ?? 1,
      weight: { value: raw?.weight ?? 0, units: 'lb' },
      rarity: foundryRarity(raw?.rarity),
      attunement: attune.required ? 'required' : '',
      properties: [],
    };

    if (fType === 'weapon') {
      const cat = info.category === 'martial' ? 'martial' : 'simple';
      const km = info.kind === 'ranged' ? 'R' : 'M';
      system.type = { value: cat + km, baseItem: slugify(raw?.name ?? entry.itemId) };
      system.damage = { base: weaponDamageBase(raw), versatile: weaponDamageVersatile(raw) };
      system.range = parseRange(raw?.range);
      system.properties = mapWeaponProps(raw?.property);
      system.armor = { value: null };
      system.proficient = null;
      system.equipped = !!entry.equipped;
      system.attuned = !!entry.attuned;
      // Arma mágica: +X em ataque E dano (o Foundry aplica sozinho a partir daqui).
      const magic = bonusNum(raw?.bonusWeapon);
      if (magic) system.magicalBonus = String(magic);
      // Activity de ataque → tap-to-roll no Foundry (dano/acerto derivados).
      system.activities = weaponAttackActivity(info, raw);
    } else if (fType === 'equipment') {
      const tv = map.typeValue ?? info.armorSlot ?? 'trinket';
      system.type = { value: tv, baseItem: slugify(raw?.name ?? entry.itemId) };
      const isArmor = ['light', 'medium', 'heavy', 'shield'].includes(tv);
      system.armor = { value: isArmor ? (raw?.ac ?? null) : null, dex: isArmor ? (ARMOR_DEX[tv] ?? null) : null };
      system.strength = raw?.strength ? Number(raw.strength) : null;
      const props = [];
      if (raw?.stealth) props.push('stealthDisadvantage');
      if (raw?.rarity && raw.rarity !== 'none') props.push('mgc');
      system.properties = props;
      system.equipped = !!entry.equipped;
      system.attuned = !!entry.attuned;
    } else if (fType === 'tool') {
      system.type = { value: map.typeValue, baseItem: toolId(raw?.name ?? entry.itemId) };
      system.ability = '';
      system.proficient = null;
    } else {
      // consumable / loot
      system.type = { value: map.typeValue, subtype: '' };
    }

    const name = entry.customName || raw?.name || entry.itemId;
    const img = inventoryImg(entry, info.group);
    const bonusEffect = itemBonusEffect(name, img, raw);
    out.push({
      _id: randomFoundryId(),
      name,
      type: fType,
      img,
      system,
      effects: bonusEffect ? [bonusEffect] : [],
      folder: null,
      sort: 0,
      flags: {},
      _stats: itemStats(),
    });
  }
  return out;
}
