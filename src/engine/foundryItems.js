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

import { latestOnly } from '../selector/reprints';
import { classGrantChoices, classGrantGroups } from './classFeatureGrants';
import { parseClass, parseFeatureRef } from './classData';
import { classLevelChoices, classToolChoices, subclassFeatureChoices, optionalFeatureChoices, optionalFeatureCount } from './classFeatureChoices';
import { featureOptionChoices, subclassFeatureOptionChoices } from './featureOptions';
import { buildClassAdvancement } from './foundryAdvancement';
import { effectChangesFor, targetEffectFor } from './foundryEffects';
import {
  overlayRaceEffects,
  overlayRaceTraits,
  overlayRaceAdvancement,
  overlaySubclassAdvancement,
  overlayFeatEntry,
  overlayOptionalFeatureEntry,
  overlayClassFeatureEntry,
  overlaySubclassFeatureEntry,
  overlayMechanics,
} from './foundryOverlay';
import { featureUses } from './foundryFeatureUses';
import { featureActivities, srdFeatureMechanics, classWeaponGrants } from './foundryActivities';
import { naturalArmorFor, naturalArmorChanges } from './naturalArmor';
import { foundrySize, toolId, languageCode, textToHtml } from './foundryExport';
import { effectiveSizeCodes, sizePick, speciesCatalog } from './speciesData';
import { LEGACY_PROSE_SECTIONS } from './legacySubraces';
import { collectChoicePicks, collectAbilityPicks, fixedAbilityBoosts, parseChoices } from './choices';
import { resolveItemObj, itemTypeInfo, attunementInfo } from './items';
import { itemValue } from './magicItemPrice';
import {
  classUuid, classFeatureUuid, subclassUuid, subclassFeatureUuid, spellUuid,
  originUuid, featUuid, equipmentUuid, equipmentFoundryType, subclassIdentifier, srdSpeciesName, srdOriginName,
} from './compendiumUuids';
import { grantedSpells } from './grantedSpells';
import { curatedAdditionalSpells } from './grantedSpellUses';

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

/**
 * Campos do bloco `system` do overlay que NÃO têm casa própria no nosso item
 * (`range`, `duration`…). `uses` sai daqui porque é tratado à parte, com a
 * precedência do registro curado.
 */
function overlaySystemExtras(system) {
  const rest = { ...(system ?? {}) };
  delete rest.uses;
  return rest;
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
 * @param {string} title           ex: 'Class Features' | 'Subclass Features'
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

/** Nível máximo de personagem (a escada de advancement vai até aqui). */
const MAX_LEVEL = 20;

/**
 * Advancements ItemGrant dos níveis FUTUROS - a "receita" que o Foundry desdobra
 * quando o jogador sobe de nível DENTRO dele. Ao contrário dos níveis já
 * alcançados (itens embutidos, uuid relativo), estes precisam apontar para o
 * COMPÊNDIO: o item ainda não existe no ator. Formato copiado dos premades
 * oficiais - `configuration.items` preenchido, `value` vazio.
 *
 * Níveis cujos uuids são todos desconhecidos (conteúdo fora do SRD que o dnd5e
 * publica) simplesmente não geram passo: melhor não ter a escada do que ter um
 * ItemGrant apontando para um documento inexistente.
 * Um nível JÁ alcançado pode vir junto: aí a entrada traz o `_id` do item
 * EMBUTIDO correspondente (`addedId`) e o passo sai com `value.added` preenchido -
 * exatamente o que os premades fazem com as magias de subclasse já concedidas
 * (`configuration.items` aponta pro compêndio, `value.added` diz qual item do ator
 * saiu dali). Sem o passo, o Foundry não sabe que aquele nível já foi resolvido.
 * @param {Array<{level: number, uuid: string, addedId?: string}>} entries
 * @param {string} title
 * @param {object|null} [spell]  bloco `configuration.spell` (grants de MAGIA)
 * @returns {object[]} entradas de advancement (já com `_id`)
 */
function futureItemGrants(entries, title, spell = null) {
  // `value: {}` num nível ainda não alcançado (a forma dos premades); com itens
  // já concedidos, o mapa `added` id-do-item → uuid de origem.
  const added = (map) => {
    const pairs = [...map].filter(([, id]) => id).map(([uuid, id]) => [id, uuid]);
    return pairs.length ? { added: Object.fromEntries(pairs) } : {};
  };
  const byLevel = new Map();
  for (const e of entries) {
    if (!e.uuid) continue;
    if (!byLevel.has(e.level)) byLevel.set(e.level, new Map());
    const map = byLevel.get(e.level);
    if (!map.has(e.uuid)) map.set(e.uuid, e.addedId ?? null); // dedup (a mesma magia em 2 grupos)
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, map]) => ({
      _id: randomFoundryId(),
      type: 'ItemGrant',
      level,
      title,
      configuration: { items: [...map.keys()].map((uuid) => ({ uuid, optional: false })), optional: false, spell },
      value: added(map),
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
 * Progressão de conjuração do 5etools → chave do dnd5e (`CONFIG.DND5E.spellcasting`
 * → `spell.progression` / `pact.progression`). O 5etools escreve as frações
 * `'1/2'`/`'1/3'`, que NÃO existem no sistema: exportadas cruas, o bloco de
 * conjuração é inválido e a classe/subclasse chega ao Foundry sem espaços de magia
 * (TC-0060; hoje isso atinge Eldritch Knight e Arcane Trickster, os únicos
 * `'1/3'` alcançáveis). `artificer` é preservado: o sistema o define exatamente
 * como `half` (divisor 2, roundUp) e é o que o dado diz do Paladino/Ranger 2024.
 * @param {string|null|undefined} code
 * @returns {string|null} chave válida do dnd5e, ou null quando não conjura
 */
export function fvttProgression(code) {
  if (!code) return null;
  return { '1/2': 'half', '1/3': 'third' }[code] ?? code;
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
 *           fightingStyles?: {itemId: string, level: number}[],
 *           futureGrants?: object[] }} [opts]
 *   description: HTML de fluff da classe; traitValues: chosen[] por título de Trait
 *   (buildClassTraitValues); fightingStyles: picks p/ o ItemChoice (buildClassChosenFeats);
 *   futureGrants: escada dos níveis futuros (buildClassFutureGrants).
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
  // Quantos picks de cada título de Trait já foram distribuídos: um mesmo título
  // pode aparecer em VÁRIOS níveis carregando o delta daquele nível (Weapon
  // Mastery 2@1 → +1@4 → +1@10), e cada passo leva só a sua fatia dos escolhidos.
  const traitUsed = {};
  const advancement = buildClassAdvancement(classObj, opts.db).map((a) => {
    const entry = { _id: randomFoundryId(), value: {}, ...a };
    if (entry.type === 'HitPoints') entry.value = hitPointsValue(classEntry);
    if (entry.type === 'AbilityScoreImprovement' && asiByLevel[entry.level]) entry.value = asiByLevel[entry.level];
    if (entry.type === 'Trait') {
      const cfg = entry.configuration ?? {};
      const picks = opts.traitValues?.[entry.title];
      if (cfg.grants?.length && !(cfg.choices ?? []).length) entry.value = { chosen: [...cfg.grants] };
      else if (picks?.length) {
        const from = traitUsed[entry.title] ?? 0;
        const count = (cfg.choices ?? []).reduce((n, c) => n + (c.count ?? 0), 0) || picks.length;
        traitUsed[entry.title] = from + count;
        const slice = picks.slice(from, from + count);
        if (slice.length) entry.value = { chosen: slice };
      }
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

  advancement.push(...itemGrantAdvancements(featureItems, 'Class Features'));
  // Itens de inventário concedidos pela classe (o Unarmed Strike). Como nos
  // premades: `configuration.items` aponta para o COMPÊNDIO e `value.added` liga
  // ao item embutido que saiu dali.
  // O que o SRD publica (Bárbaro/Monge) entra no MESMO passo "Class Features" do
  // premade; o nosso acréscimo universal (ver `classWeaponGrants`) ganha título
  // próprio, para não se passar pela escada oficial.
  const weaponEntry = (i) => ({
    level: i.flags?.builder5e?.level ?? 1,
    uuid: i._stats?.compendiumSource,
    addedId: i._id,
  });
  const weaponItems = opts.weaponItems ?? [];
  advancement.push(
    ...futureItemGrants(weaponItems.filter((i) => i.flags?.builder5e?.srdGranted).map(weaponEntry), 'Class Features'),
    ...futureItemGrants(weaponItems.filter((i) => !i.flags?.builder5e?.srdGranted).map(weaponEntry), 'Unarmed Strike'),
  );
  // Receita dos níveis ainda não alcançados (uuids de compêndio) - é o que faz o
  // level-up DENTRO do Foundry conceder as features novas.
  advancement.push(...(opts.futureGrants ?? []));
  // Escolhas de proficiência/expertise no nível DELAS (Primal Knowledge @3,
  // Expertise @1/@6…) - é o que faz o Foundry perguntar ao subir de nível.
  advancement.push(...(opts.choiceTraits ?? []));
  // Escadas de escolha de feature (Divine Order, Metamagic…) - TC-0063.
  advancement.push(...(opts.itemChoices ?? []).map((a) => ({ _id: randomFoundryId(), value: {}, ...a })));

  const faces = classObj.hd?.faces ?? parsed.hitDieMax ?? 8;
  const caster = fvttProgression(parsed.spellcasting.casterProgression);

  return {
    _id: randomFoundryId(),
    name: parsed.name,
    type: 'class',
    img: classIcon(parsed.id),
    system: {
      identifier: parsed.id,
      levels: classEntry.level || 1,
      hd: { denomination: `d${faces}`, spent: 0, additional: '' },
      // `preparation.formula` aponta para a escala de preparadas do próprio item
      // (é assim que o Foundry sabe quantas magias a classe prepara por nível);
      // o ScaleValue `max-prepared` é emitido pelo advancement (TC-0062).
      spellcasting: caster
        ? {
            progression: caster,
            ability: parsed.spellcasting.ability ?? '',
            preparation: { formula: classObj?.preparedSpellsProgression ? `@scale.${parsed.id}.max-prepared` : '' },
          }
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
    _stats: itemStats(classUuid(parsed.id)),
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

/**
 * É só um CATÁLOGO de optional features ("Metamagic Options", "Eldritch
 * Invocation Options")? O 5etools lista as opções numa "feature" própria, mas ela
 * não concede nada - quem concede é a feature-mãe, e cada opção escolhida já vira
 * item por conta própria. Emiti-la punha na ficha do Foundry uma feature que
 * nenhum ator oficial tem. Derivado da FORMA (um bloco `options` cujas entradas
 * são refs de optional feature), não de uma lista de nomes.
 */
function isOptionCatalog(feature) {
  return (feature?.entries ?? []).some(
    (e) =>
      e?.type === 'options'
      && (e.entries ?? []).length > 0
      && (e.entries ?? []).every((o) => o?.type === 'refOptionalfeature'),
  );
}

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
    if (f && !isOptionCatalog(f)) {
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
  // Overlay (DDL-0031/0057): effects só quando NÃO há curado (regra
  // tudo-ou-nada); `uses`/`activities` entram sempre que o curado não cobrir
  // aquele campo - são blocos independentes, e um deles faltar não é motivo
  // para descartar o outro.
  const overlayRef = {
    name: feature.overlayName ?? feature.name,
    classId: feature.classId,
    source: feature.source,
    level: feature.level,
  };
  const overlayEntry = db
    ? (feature.subclass
      ? overlaySubclassFeatureEntry(db, { ...overlayRef, shortName: feature.subclass.shortName })
      : overlayClassFeatureEntry(db, overlayRef))
    : null;
  const overlay = overlayMechanics(overlayEntry, feature.name);

  const curatedUses = featureUses(feature.name, feature.classId);
  const curatedActivities = featureActivities(feature.name, feature.classId, { targetEffectId });
  // Activities: curado → SRD → overlay (a precedência do `featureUses`, TC-0068).
  const srd = Object.keys(curatedActivities).length ? null : srdFeatureMechanics(feature.name, feature.classId);
  const activities = Object.keys(curatedActivities).length
    ? curatedActivities
    : (srd?.activities ?? overlay.activities);
  // Os effects acompanham QUEM DEU as activities, e a escolha é tudo-ou-nada: os
  // do SRD são referenciados por `_id` pelas activities dele (separá-los deixaria
  // a referência no vazio), e somá-los aos do overlay aplicaria o mesmo efeito
  // duas vezes - foi assim que "Cunning Action: Hiding" saiu em dobro. Um effect
  // CURADO continua vencendo tudo (regra tudo-ou-nada do DDL-0031).
  if (!changes && !targetEffect && db) effects.push(...(srd?.effects.length ? srd.effects : overlay.effects));
  else if (srd?.effects.length) effects.push(...srd.effects.filter((e) => !effects.some((x) => norm(x.name) === norm(e.name))));

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
      uses: curatedUses ?? overlay.system.uses ?? { max: '', spent: 0, recovery: [] },
      prerequisites: { level: null, repeatable: false, items: [] },
      activities,
      advancement: {},
      ...overlaySystemExtras(overlay.system),
      enchant: {},
      crewed: false,
    },
    effects,
    flags: { builder5e: { level: feature.level } },
    _stats: itemStats(
      feature.subclass
        ? subclassFeatureUuid(feature.classId, feature.subclass, feature.name)
        : classFeatureUuid(feature.classId, feature.name),
    ),
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
 * Itens de INVENTÁRIO que a própria CLASSE concede - hoje só o "Unarmed Strike"
 * do Bárbaro e do Monge. É o item que carrega o ATAQUE DESARMADO na ficha do
 * Foundry: sem ele, um Monge criado no FlyBy chega lá sem a arma principal da
 * classe inteira (o comparador não denunciava porque as fichas premade já trazem
 * o item, que entrava pelo import e voltava no export).
 *
 * A ficha do item e o uuid vêm do SRD (`SRD_CLASS_WEAPON_GRANTS`), gerados: nada
 * é inventado, e uma classe futura que conceda um item entra sozinha.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @returns {object[]} itens Foundry (type 'weapon')
 */
export function buildClassWeaponItems(classEntry, classObj) {
  const level = classEntry?.level || 1;
  return classWeaponGrants(norm(classObj?.name))
    .filter((g) => (g.level ?? 1) <= level)
    .map((g) => ({
      _id: randomFoundryId(),
      name: g.name,
      type: 'weapon',
      img: 'icons/svg/sword.svg',
      system: { ...g.system, equipped: false, quantity: 1 },
      effects: [],
      flags: { builder5e: { level: g.level ?? 1, classGranted: true, srdGranted: !!g.srd } },
      _stats: itemStats(g.uuid),
    }));
}

// ---------------------------------------------------------------------------
// Traits de ESCOLHA por nível (perícia / expertise / ferramenta / idioma)
// ---------------------------------------------------------------------------
// Uma feature que concede proficiência num nível > 1 (Primal Knowledge @3,
// Expertise do Rogue @1 e @6, Deft Explorer @2, Bonus Proficiencies do Lore @3)
// é um advancement Trait NO NÍVEL DELA nos premades - é assim que o Foundry sabe
// perguntar ao subir de nível. Antes essas escolhas só viajavam em
// `flags.builder5e.choices` (DDL-0028), que o Foundry ignora: o personagem subia
// e nada era perguntado. A flag CONTINUA sendo a fonte da verdade do re-import
// (ids exatos); estes Traits existem para o lado Foundry.

/** Kinds de escolha que têm um Trait correspondente no dnd5e. */
export const TRAIT_CHOICE_KINDS = new Set(['skill', 'expertise', 'tool', 'language', 'resist']);

/** Título do Trait de um descritor - o NOME DA FEATURE, como nos premades.
 * Exportado porque o IMPORT casa o Trait de volta no descritor por este título
 * (ver choiceTraitBag em foundryImport): uma fonte só para os dois lados. */
export function choiceTraitTitle(desc) {
  return desc.foundryTitle ?? desc.feature?.name ?? desc.label ?? '';
}

/** `configuration` (mode + pool) do Trait de um descritor de escolha. */
function traitChoiceConfig(desc, db) {
  switch (desc.kind) {
    // `mode: 'expertise'` faz o Foundry oferecer as perícias em que você JÁ é
    // proficiente - por isso o pool é aberto mesmo quando o nosso é restrito.
    case 'expertise':
      return { mode: 'expertise', pool: ['skills:*'] };
    case 'skill':
      return { mode: 'default', pool: desc.from?.length ? desc.from.map((c) => `skills:${c}`) : ['skills:*'] };
    case 'language':
      return { mode: 'default', pool: ['languages:standard:*', 'languages:exotic:*'] };
    // Resistência a dano PERMANENTE à escolha (Elemental Affinity). É a forma que
    // o premade usa: um Trait no nível da feature, pool `dr:<tipo>`. Sem ele, o
    // Foundry não sabe que houve escolha e o import não a recupera.
    case 'resist':
      return { mode: 'default', pool: (desc.pool?.options ?? []).map((o) => `dr:${o.value}`) };
    case 'tool': {
      if (desc.pool?.type === 'list') {
        return { mode: 'default', pool: (desc.pool.options ?? []).map((o) => toolTraitKey(db, o.value)) };
      }
      const cats = [desc.pool?.category].flat().filter(Boolean).map((c) => TOOL_TYPE_TO_TRAIT_CAT[c]).filter(Boolean);
      return { mode: 'default', pool: cats.length ? cats.map((c) => `tool:${c}:*`) : ['tool:*'] };
    }
    default:
      return null;
  }
}

/** Picks do choice-bag → chaves de trait do Foundry, conforme o kind. */
function traitChoiceValues(desc, picks, db) {
  switch (desc.kind) {
    case 'skill':
    case 'expertise':
      return picks.map((p) => `skills:${p}`);
    case 'language':
      return picks.map((p) => languageTraitKey(db, p));
    case 'tool':
      return picks.map((p) => toolTraitKey(db, p));
    case 'resist':
      return picks.map((p) => `dr:${String(p).toLowerCase()}`);
    default:
      return [];
  }
}

/**
 * Traits de escolha a partir de descritores + o choice-bag que os responde.
 * O título é o NOME DA FEATURE (como nos premades: "Primal Knowledge", "Deft
 * Explorer", "Bonus Proficiencies"). Um nível ainda não alcançado simplesmente
 * não tem picks e sai sem `chosen` - o Foundry o trata como pendente e pergunta
 * quando o jogador chegar lá.
 * @param {import('./choices').Choice[]} descriptors
 * @param {object} bag  choice-bag da classe (`ClassEntry.choices`)
 * @param {object} db
 * @returns {object[]} entradas de advancement Trait (já com `_id`)
 */
export function buildChoiceTraits(descriptors, bag, db) {
  const out = [];
  for (const desc of descriptors ?? []) {
    if (!TRAIT_CHOICE_KINDS.has(desc.kind)) continue;
    const cfg = traitChoiceConfig(desc, db);
    if (!cfg?.pool?.length) continue;
    const picks = bag?.[desc.id]?.picks ?? [];
    // `fixedGrants` (só o Thieves' Cant hoje): a feature CONCEDE algo e ainda
    // deixa escolher - é a forma do premade (grants + choices no mesmo Trait), e
    // os concedidos entram no `chosen` junto dos escolhidos.
    const grants = traitChoiceValues(desc, desc.fixedGrants ?? [], db).filter(Boolean);
    const chosen = [...grants, ...traitChoiceValues(desc, picks, db).filter(Boolean)];
    out.push({
      _id: randomFoundryId(),
      type: 'Trait',
      level: desc.level ?? 1,
      title: choiceTraitTitle(desc),
      configuration: {
        mode: cfg.mode,
        allowReplacements: false,
        grants,
        choices: [{ count: desc.count ?? 1, pool: cfg.pool }],
      },
      value: chosen.length ? { chosen } : {},
    });
  }
  return out;
}

/**
 * Traits de escolha da CLASSE em TODOS os níveis (1..20): Expertise, os grants
 * curados de feature (Primal Knowledge, Deft Explorer, Scholar) e a escolha de
 * ferramenta inicial. Ver buildChoiceTraits para o porquê.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]}
 */
/** Idiomas CONCEDIDOS (não escolhidos) pelo grupo de grant daquele nível. */
function grantedLanguagesFor(classId, level) {
  return classGrantGroups(classId, level).filter((g) => g.level === level).flatMap((g) => g.languages ?? []);
}

export function buildClassChoiceTraits(classEntry, classObj, db) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  const descriptors = classLevelChoices(parsed, classObj, MAX_LEVEL);
  // Ferramenta inicial só existe na classe original (multiclasse não concede).
  // Título fixo "Tool Proficiencies" (o dos premades) - o descritor não vem de
  // uma feature, então o fallback seria o rótulo da UI ("Musical Instruments").
  if (classEntry.isOriginalClass !== false) {
    descriptors.push(...classToolChoices(classObj).map((d) => ({ ...d, foundryTitle: 'Tool Proficiencies' })));
  }
  // Escolha aberta por um grant em prosa (o idioma extra do Thieves' Cant): o
  // Trait leva o idioma CONCEDIDO em `grants` e o escolhido em `choices`, que é
  // exatamente a forma do premade - e é o que faz o pick voltar no import.
  descriptors.push(...classGrantChoices(classEntry.classId, MAX_LEVEL).map((d) => ({
    ...d,
    fixedGrants: grantedLanguagesFor(classEntry.classId, d.level),
  })));
  return buildChoiceTraits(descriptors, classEntry.choices, db);
}

/**
 * Traits de escolha de uma SUBCLASSE em todos os níveis (Bonus Proficiencies do
 * College of Lore @3, Student of War do Battle Master…). Os picks moram no bag
 * da CLASSE com o prefixo `sub:`, então o bag passado é o da classe.
 * @param {object} subclass
 * @param {string} classId
 * @param {object} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]}
 */
export function buildSubclassChoiceTraits(subclass, classId, classEntry, classObj, db) {
  if (!subclass) return [];
  const classSkills = parseClass(classObj)?.skillChoice?.from ?? [];
  const descriptors = subclassFeatureChoices(db, classId, subclass, MAX_LEVEL, classSkills);
  return buildChoiceTraits(descriptors, classEntry.choices, db);
}

/**
 * Escada de ItemGrant dos níveis ACIMA do nível atual da classe, apontando para
 * o compêndio do dnd5e - sem ela, subir de nível dentro do Foundry não concede
 * feature nenhuma (ver engine/compendiumUuids.js).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]} entradas de advancement ItemGrant
 */
export function buildClassFutureGrants(classEntry, classObj, db) {
  const classId = norm(classObj?.name);
  const level = classEntry.level || 1;
  const entries = resolveClassFeatures(db, classId, classObj, MAX_LEVEL)
    .filter((f) => f.level > level)
    .map((f) => ({ level: f.level, uuid: classFeatureUuid(classId, f.name) }));
  entries.push(...relistedFeatureGrants(classId, classObj, level));
  return [
    ...futureItemGrants(entries, 'Class Features'),
    // Magias que a própria CLASSE concede por nível (o Divine Smite do Paladino
    // no 2, o Find Steed no 5): só os níveis FUTUROS, que é onde a escada faz
    // diferença - sem ela, subir de nível dentro do Foundry não concede a magia.
    // Nos níveis já alcançados o SRD não tem passo (o Paladino é a única classe
    // publicada em que ele existe), e o item de magia já está no ator.
    ...spellGrantLadder(curatedAdditionalSpells(classObj), 'Class Features', null, level + 1),
  ];
}

/**
 * O 5etools RE-LISTA uma feature nos níveis em que ela melhora, e nós dedupamos
 * por nome (um item por feature - a progressão é ScaleValue/uses). Mas em um caso
 * o dnd5e publica um SEGUNDO item para a melhoria, nomeado "<Nome> (2)": o
 * Improved Brutal Strike do Barbarian @13 e @17. Varredura do dataset (2026-07-22):
 * é o ÚNICO; toda outra re-listagem (ASI, Subclass Feature, Expertise, Metamagic,
 * Mystic Arcanum) não tem item próprio e a consulta devolve null, então nada é
 * emitido. Se um dia surgir outro, ele entra sozinho por esta mesma regra.
 */
function relistedFeatureGrants(classId, classObj, level) {
  const out = [];
  const seen = new Map();
  for (const f of parseClass(classObj)?.features ?? []) {
    const key = norm(f.name);
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (nth === 1 || f.level <= level) continue;
    const uuid = classFeatureUuid(classId, `${f.name} (${nth})`);
    if (uuid) out.push({ level: f.level, uuid });
  }
  return out;
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
    : [];
  const featOverlay = overlayMechanics(db ? overlayFeatEntry(db, featData.name, featData.source) : null, featData.name);
  if (!changes) effects.push(...featOverlay.effects);

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
      uses: featOverlay.system.uses ?? { max: '', spent: 0, recovery: [] },
      prerequisites: { level: null, repeatable: !!featData.repeatable, items: [] },
      activities: featOverlay.activities,
      advancement: keyById(advancement),
      ...overlaySystemExtras(featOverlay.system),
      enchant: {},
      crewed: false,
    },
    effects,
    flags: { builder5e: { level, ...(bagHasContent(choices) ? { choices } : {}) } },
    _stats: itemStats(featUuid(featData.name) ?? originUuid(featData.name)),
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
/**
 * Advancements `ItemChoice` de um item de classe/subclasse - a ESCADA de escolhas
 * de feature (Divine Order, Blessed Strikes, Primal Order, Metamagic, Eldritch
 * Invocations, Fighting Style de subclasse…). Sem ela o Foundry não pergunta nada
 * ao subir de nível: só o item já escolhido aparece, sem o passo que o produziu
 * (TC-0063) - é o irmão do ItemGrant de níveis futuros (DDL-0055).
 *
 * Duas metades, como no SRD: `configuration.pool` são os uuids de compêndio de
 * TODAS as opções (é o que o Foundry oferece no prompt) e `value.added` aponta,
 * por nível, para o item EMBUTIDO que o jogador já escolheu (uuid relativo), para
 * o passo não voltar a perguntar o que já foi decidido. Uma opção sem uuid
 * conhecido simplesmente não entra no pool (`allowDrops` deixa arrastar à mão);
 * um descritor cujo pool inteiro fique vazio não vira passo - melhor não ter a
 * escada do que uma escada que não oferece nada.
 *
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj  objeto de classe 5etools
 * @param {object|null} subObj  subclasse resolvida (null p/ o escopo de classe)
 * @param {object} db
 * @param {object[]} optionItems  itens já gerados (buildFeatureOptionItems +
 *   buildOptionalFeatureItems), p/ ligar o `value.added` pelo NOME
 * @param {{ scope?: 'class'|'subclass' }} [opts]
 * @returns {object[]} entradas de advancement ItemChoice (sem `_id`)
 */
export function buildItemChoiceAdvancements(classEntry, classObj, subObj, db, optionItems = [], opts = {}) {
  const classId = classEntry?.classId;
  if (!classObj || !classId) return [];
  const scope = opts.scope ?? 'class';
  const itemByName = new Map(optionItems.map((i) => [norm(i.name), i]));
  const out = [];

  const push = (title, level, count, poolNames, restriction, uuidOf, index = itemByName) => {
    const pool = poolNames.map((n) => uuidOf(n)).filter(Boolean).map((uuid) => ({ uuid }));
    if (!pool.length) return;
    const choices = {};
    for (const [lvl, c] of Object.entries(level)) choices[lvl] = { count: c, replacement: false };
    const added = {};
    for (const [lvl, names] of Object.entries(count)) {
      for (const n of names) {
        const item = index.get(norm(n));
        if (item) added[lvl] = { ...(added[lvl] ?? {}), [item._id]: `.${item._id}` };
      }
    }
    out.push({
      type: 'ItemChoice',
      title,
      configuration: { choices, allowDrops: true, type: 'feat', pool, spell: null, restriction },
      value: { added, replaced: {} },
    });
  };

  // 1) Escolhas de OPÇÃO de feature ("Divine Order: Protector"): um nível, uma
  //    escolha. O item da opção chama-se "<Feature>: <Opção>" nos dois lados.
  const featureDescriptors =
    scope === 'subclass'
      ? subclassFeatureOptionChoices(db, classId, subObj, 20)
      : featureOptionChoices(db, classId, classObj, 20);
  for (const ch of featureDescriptors) {
    const names = (ch.pool?.options ?? []).map((o) => `${ch.label}: ${o.label}`);
    const picked = (classEntry.choices?.[ch.id]?.picks ?? [])
      .map((p) => (ch.pool.options ?? []).find((o) => o.value === p))
      .filter(Boolean)
      .map((o) => `${ch.label}: ${o.label}`);
    push(
      ch.label,
      { [ch.level ?? 1]: ch.count ?? 1 },
      { [ch.level ?? 1]: picked },
      names,
      { type: 'class', subtype: '', list: [] },
      (n) => (scope === 'subclass' ? subclassFeatureUuid(classId, subObj, n) ?? classFeatureUuid(classId, n) : classFeatureUuid(classId, n)),
    );
  }

  // 2) Optional features (Metamagic, Invocations, Maneuvers…): a contagem CRESCE,
  //    e o SRD grava o DELTA de cada nível. Um descritor pertence à SUBCLASSE
  //    quando só aparece com ela (`optionalFeatureChoices` funde as duas listas
  //    sem marcá-las) - sem essa diferença o Warlock emitia as invocações duas
  //    vezes, na classe E na subclasse.
  const classOpt = optionalFeatureChoices(classObj, null, 20);
  const optDescriptors =
    scope === 'subclass'
      ? optionalFeatureChoices(classObj, subObj, 20).filter((ch) => !classOpt.some((c) => c.id === ch.id))
      : classOpt;
  for (const ch of optDescriptors) {
    if (ch.kind !== 'optionalfeature') continue;
    const types = ch.pool?.featureType ?? [];
    const list = latestOnly(db?.optionalfeatures?.optionalfeature ?? []).filter((f) =>
      (f.featureType ?? []).some((t) => types.includes(t)),
    );
    const progression = progressionOf(classObj, subObj, types);
    const byLevel = {};
    let prev = 0;
    for (let lvl = 1; lvl <= 20; lvl += 1) {
      const total = optionalFeatureCount(progression, lvl);
      if (total > prev) byLevel[lvl] = total - prev;
      prev = total;
    }
    if (!Object.keys(byLevel).length) continue;
    // O bag guarda UMA lista de picks para todos os níveis (a UI conta o total),
    // então os escolhidos são FATIADOS entre os níveis na ordem - o mesmo que os
    // Traits de Weapon Mastery fazem (DDL-0055).
    const picked = (classEntry.choices?.[ch.id]?.picks ?? []).map((p) => String(p).split('|')[0]);
    const pickedByLevel = {};
    let from = 0;
    for (const [lvl, count] of Object.entries(byLevel)) {
      const slice = picked.slice(from, from + count);
      if (slice.length) pickedByLevel[lvl] = slice;
      from += count;
    }
    const subtype = types.map((t) => OPTFEAT_SUBTYPE[t]).find(Boolean) ?? '';
    push(ch.label, byLevel, pickedByLevel, list.map((f) => f.name), { type: 'class', subtype, list: [] }, (n) =>
      classFeatureUuid(classId, n),
    );
  }

  // 3) Escolha de TALENTO por uma feature de subclasse - hoje só o "Additional
  //    Fighting Style" do Champion (@7). O pool são TALENTOS (feats24), não
  //    features de classe, então o uuid e a `restriction` são outros; a forma é a
  //    do premade do Randal (ItemChoice sem `level`, o nível vive na chave de
  //    `choices`). Sem este passo o estilo escolhido não voltava ao importar um
  //    ator externo, e o jogador perdia o segundo Fighting Style.
  if (scope === 'subclass') {
    for (const ch of subclassFeatureChoices(db, classId, subObj, MAX_LEVEL, parseClass(classObj)?.skillChoice?.from ?? [])) {
      if (ch.kind !== 'feat') continue;
      const cats = [ch.pool?.category].flat().filter(Boolean);
      const list = latestOnly(db?.feats?.feat ?? []).filter((f) => cats.includes(f.category));
      const picked = (classEntry.choices?.[ch.id]?.picks ?? []).map((p) => String(p).split('|')[0]);
      const subtype = cats.includes('FS') ? 'fightingStyle' : '';
      // O item do talento escolhido vem dos `featItems` (os itens de talento do
      // personagem), não dos `optionItems` - um índice à parte, para um talento
      // homônimo de uma optional feature não se confundir nos casos 1 e 2.
      push(
        ch.feature?.name ?? ch.label,
        { [ch.level ?? 1]: ch.count ?? 1 },
        { [ch.level ?? 1]: picked },
        list.map((f) => f.name),
        { type: 'feat', subtype, list: [] },
        (n) => featUuid(n),
        new Map((opts.featItems ?? []).map((i) => [norm(i.name), i])),
      );
    }
  }
  return out;
}

/** A `progression` de optional feature de um conjunto de featureTypes. */
function progressionOf(classObj, subObj, types) {
  const all = [...(classObj?.optionalfeatureProgression ?? []), ...(subObj?.optionalfeatureProgression ?? [])];
  const match = all.find((ofp) => (ofp.featureType ?? []).some((t) => types.includes(t)));
  return match?.progression ?? null;
}

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
      const ofOverlay = overlayMechanics(overlayOptionalFeatureEntry(db, raw.name, raw.source), raw.name);
      if (!item.effects.length) item.effects.push(...ofOverlay.effects);
      if (!Object.keys(item.system.activities).length) item.system.activities = ofOverlay.activities;
      if (ofOverlay.system.uses && !item.system.uses.max) item.system.uses = ofOverlay.system.uses;
      Object.assign(item.system, overlaySystemExtras(ofOverlay.system));
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
/**
 * O nome é um idioma REAL do compêndio? O 5etools também usa pseudo-entradas
 * ("other" = o idioma próprio do cenário) que não têm chave no dnd5e.
 * @param {object|null} db
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownLanguage(db, name) {
  return (db?.languages?.language ?? []).some((l) => norm(l.name) === norm(name));
}

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
/** Features de subclasse do pool cru, em ordem, dentro de uma faixa de níveis.
 * Compartilhado pelos itens (níveis alcançados) e pela escada futura. */
function resolveSubclassFeatures(subclass, classId, db, { min = 1, max } = {}) {
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
    const lvl = f.level ?? 0;
    if (lvl < min || (max != null && lvl > max)) continue;
    const n = norm(f.name);
    if (umbrella.has(n) || NON_ITEM_FEATURES.has(n)) continue;
    const key = `${n}|${lvl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: f.name, level: lvl, source: f.source ?? subclass.source, entries: f.entries ?? [] });
  }
  return out;
}

export function buildSubclassFeatureItems(subclass, classId, db, level) {
  return resolveSubclassFeatures(subclass, classId, db, { max: level }).map((f) => buildFeatureItem(
    { ...f, classId, subclass: { shortName: subclass.shortName, name: subclass.name } },
    db,
  ));
}

/**
 * Escada de ItemGrant dos níveis FUTUROS de uma SUBCLASSE: as features que ela
 * ainda vai conceder E as magias sempre-preparadas que ela concede por nível
 * (o premade do Paladino traz as duas escadas - "Subclass Features" e "<Juramento>
 * Spells"). Só o conteúdo SRD publicado pelo dnd5e produz passos.
 * @param {object} subclass  objeto de subclasse RESOLVIDO (`_copy`/`_versions`)
 * @param {string} classId
 * @param {object} db
 * @param {number} level  nível ATUAL da classe
 * @returns {object[]} entradas de advancement ItemGrant
 */
export function buildSubclassFutureGrants(subclass, classId, db, level, spellIds = null) {
  if (!subclass) return [];
  const features = resolveSubclassFeatures(subclass, classId, db, { min: level + 1, max: MAX_LEVEL })
    .map((f) => ({ level: f.level, uuid: subclassFeatureUuid(classId, subclass, f.name) }));

  return [
    ...futureItemGrants(features, 'Subclass Features'),
    ...spellGrantLadder(curatedAdditionalSpells(subclass), `${subclass.name} Spells`, spellIds),
  ];
}

/**
 * Escada de ItemGrant das MAGIAS que uma origem concede por nível, do 1 ao 20 -
 * não só os níveis futuros. Um nível JÁ alcançado também tem seu passo, com
 * `value.added` apontando para o item de magia embutido: é assim nos premades, e
 * sem ele o Foundry não registra de onde veio a magia que o personagem já tem
 * (TC-0072). `grantedSpells` devolve o ACUMULADO até o nível, então o delta de
 * cada nível é a diferença para o anterior; passa pelo registro curado
 * (TC-0026/TC-0044) para ver o mesmo que a derivação vê.
 * @param {object[]|null} additional  `additionalSpells` já curado
 * @param {string} title
 * @param {Map<string,string>|null} spellIds  nome normalizado → _id do item embutido
 * @param {number} [from]  primeiro nível a emitir (1 = a escada inteira)
 * @returns {object[]} entradas de advancement ItemGrant
 */
function spellGrantLadder(additional, title, spellIds, from = 1, bag = null) {
  if (!additional) return [];
  // O `bag` faz as magias ESCOLHIDAS entrarem na escada (o cantrip à escolha da
  // linhagem élfica): sem ele, o nível 1 do Elfo não gerava passo nenhum e o
  // Foundry não sabia que a linhagem concedeu aquela magia.
  const namesAt = (l) => new Set(grantedSpells(additional, l, { bag }).spells.map((s) => s.name));
  const entries = [];
  let prev = new Set();
  for (let l = 1; l <= MAX_LEVEL; l += 1) {
    const now = namesAt(l);
    for (const name of now) {
      if (prev.has(name) || l < from) continue;
      entries.push({ level: l, uuid: spellUuid(name), addedId: spellIds?.get(norm(name)) ?? null });
    }
    prev = now;
  }
  // O bloco `spell` marca o passo como concessão de MAGIA (é o que faz o Foundry
  // criar o item como magia, e não como feature).
  return futureItemGrants(entries, title, { ability: [], uses: { max: '', per: '', requireSlot: false }, prepared: 2 });
}

/**
 * Item de SUBCLASSE do Foundry (type 'subclass'), com o classIdentifier e um
 * ItemGrant por nível ligando às suas features.
 * @param {object} subclass  objeto de subclasse (shortName, name, source)
 * @param {string} classId   identifier da classe pai (ex: 'fighter')
 * @param {object[]} [featureItems]
 * @param {{ description?: string, futureGrants?: object[] }} [opts]
 *   futureGrants: escada dos níveis futuros (buildSubclassFutureGrants).
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
/**
 * Itens dos TRAÇOS de espécie que carregam uma AÇÃO ou um RECURSO (Breath
 * Weapon, Draconic Flight, Healing Hands…). É o padrão dos premades: type
 * 'feat' com `system.type.value: 'race'`, ligado ao item de raça por um
 * ItemGrant. Traços que só têm Active Effect continuam sem item - o efeito
 * transferido do item de raça já alcança o ator (DDL-0031).
 * @param {object} raceObj  raça 5etools RESOLVIDA
 * @param {object} db
 * @returns {object[]} itens Foundry (type 'feat', subtype de raça)
 */
/**
 * Traços da espécie EXPRESSOS NATIVAMENTE em outro campo do item de raça, e por
 * isso sem item próprio (é o que os atores oficiais fazem: nenhum deles tem um
 * item "Darkvision"). Não é curadoria de conteúdo - é a lista dos campos que o
 * nosso próprio `buildSpeciesItem` já preenche.
 */
const NATIVE_TRAIT_NAMES = new Set(['darkvision', 'creature type', 'size', 'speed']);

/**
 * O traço é ganho num nível acima do 1? O dado 2024 não tem campo para isso - diz
 * na PROSA, em duas fórmulas fixas ("When you reach character level 5, …" no
 * Draconic Flight, "Starting at character level 5, …" no Large Form). A frase tem
 * de ABRIR o traço: no meio do texto ela costuma gatilhar um benefício SOLTO
 * (a linhagem élfica ganha uma magia no 3, mas o traço em si é do nível 1), e ler
 * a menção solta punha a linhagem inteira num ItemGrant@3. Sem a frase, nível 0.
 */
function traitLevel(entry) {
  const first = (entry?.entries ?? []).find((e) => typeof e === 'string') ?? '';
  const m = first.match(/^(?:when you reach|starting at) (?:character )?level (\d+)/i);
  return m ? Number(m[1]) : 0;
}

/**
 * Entradas de traço da espécie que viram ITEM próprio no Foundry: as entries
 * NOMEADAS da raça resolvida, menos as expressas nativamente em outro campo
 * (`NATIVE_TRAIT_NAMES`) e menos as seções de prosa legada (Age/Alignment/…).
 * @param {object} raceObj  raça 5etools RESOLVIDA
 * @returns {object[]} entries do 5etools
 */
export function speciesTraitEntries(raceObj) {
  // Numa espécie que o dnd5e PUBLICA, o SRD é a resposta sobre quais traços são
  // documentos: o Dragonborn não tem um item "Damage Resistance" nem "Draconic
  // Ancestry" (aquilo vive em passos de advancement), e emiti-los deixaria a
  // ficha do Foundry com features que nenhum ator oficial tem. Fora do SRD não
  // há essa resposta, então vale todo traço.
  const published = !!srdSpeciesName(raceObj);
  const out = [];
  for (const e of raceObj?.entries ?? []) {
    if (!e?.name || NATIVE_TRAIT_NAMES.has(norm(e.name)) || LEGACY_PROSE_SECTIONS.has(e.name)) continue;
    if (published && !srdOriginName(e.name)) continue;
    out.push(e);
    const boon = nestedBoonEntry(e);
    // `_boon` roteia o item para um passo de advancement PRÓPRIO: no SRD ele vem
    // de um `ItemChoice` (a escolha da ancestralidade), não do ItemGrant dos
    // traços, e misturá-lo lá inflaria a contagem do passo oficial.
    if (boon) out.push({ ...boon, _boon: true });
  }
  return out;
}

/**
 * O BENEFÍCIO nomeado que vive DENTRO de um traço-guarda-chuva e que o dnd5e
 * publica como documento à parte: o "Cloud's Jaunt" mora dentro do "Giant
 * Ancestry (Cloud)" do Goliath, e o SRD emite os dois como itens separados.
 *
 * A regra é ESTREITA de propósito: o traço tem de ter EXATAMENTE UM item de lista
 * nomeado, e esse nome tem de existir no `origins24`. A base do Goliath tem os
 * seis boons na mesma lista (e por isso não casa); um traço com vários sub-itens
 * nomeados também não. Sem as duas condições, uma espécie futura ganharia itens
 * que o SRD não tem.
 * @param {object} entry  entry de traço do 5etools
 * @returns {object|null} a entry do benefício, ou null
 */
function nestedBoonEntry(entry) {
  const named = [];
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (!n || typeof n !== 'object') continue;
      if (n.name) named.push(n);
      walk(n.entries);
      walk(n.items);
    }
  };
  walk(entry?.entries);
  if (named.length !== 1) return null;
  return srdOriginName(named[0].name) ? named[0] : null;
}

/**
 * O POOL de benefícios entre os quais a ancestralidade escolhe - os seis boons do
 * Goliath. Sai da espécie BASE: a linhagem resolvida guarda só o benefício
 * escolhido (é o que `nestedBoonEntry` acha), enquanto o traço-guarda-chuva da
 * base lista todos, com o sufixo de qualificação ("Cloud's Jaunt (Cloud Giant)")
 * que o `srdOriginName` remove.
 *
 * Sem o pool o passo vira um ItemGrant (concessão fixa) e o Foundry não sabe que
 * ali houve uma ESCOLHA - não oferece trocá-la. Com ele, vira o `ItemChoice` que
 * os atores oficiais têm (C0/§5.1 do DEFERRED-REVIEW).
 * @param {object} db
 * @param {object} raceObj  raça RESOLVIDA (a linhagem)
 * @returns {string[]} uuids de compêndio, ou vazio
 */
function ancestryBoonPool(db, raceObj) {
  const baseName = raceObj?._baseName;
  if (!db || !baseName || baseName === raceObj.name) return [];
  const base = speciesCatalog(db).find(
    (r) => norm(r.name) === norm(baseName) && norm(r.source) === norm(raceObj._baseSource ?? raceObj.source),
  );
  if (!base) return [];
  for (const entry of base.entries ?? []) {
    const named = [];
    const walk = (nodes) => {
      for (const n of nodes ?? []) {
        if (!n || typeof n !== 'object') continue;
        if (n.name) named.push(n.name);
        walk(n.entries);
        walk(n.items);
      }
    };
    walk(entry?.entries);
    // O guarda-chuva certo é o que lista VÁRIOS benefícios publicados - o mesmo
    // corte do `nestedBoonEntry`, do outro lado (lá é exatamente um, aqui é 2+).
    const uuids = named.map((n) => originUuid(srdOriginName(n) ?? n)).filter(Boolean);
    if (uuids.length >= 2) return [...new Set(uuids)];
  }
  return [];
}

/** Nome do traço no documento exportado: o do dnd5e quando existe (ver
 * `srdOriginName`), senão o do 5etools. */
const traitName = (entry) => srdOriginName(entry?.name) ?? entry?.name;

/**
 * Rótulo da LINHAGEM para o título dos passos que ela concede ("High Elf Traits",
 * "Rock Gnome Traits" - a convenção dos atores oficiais). Sai do parêntese do
 * traço-guarda-chuva da linhagem ("Elven Lineage (High Elf)"); sem linhagem, o
 * nome BASE da espécie.
 */
function lineageLabel(raceObj) {
  const base = raceObj?._baseName ?? raceObj?.name ?? '';
  for (const e of raceObj?.entries ?? []) {
    const paren = e?.name?.match(/\(([^)]+)\)\s*$/)?.[1];
    if (paren) return paren;
  }
  return base;
}

/** `system.identifier` do item de raça (o que uma referência `@scale` do item
 * cita). É o nome BASE, não o da linhagem: um Dragonborn de prata e um de gelo
 * são o mesmo `dragonborn`, como nos atores oficiais. */
const speciesIdentifier = (raceObj) => slugify(raceObj?._baseName ?? raceObj?.name ?? '');

/**
 * Reescreve o dono de toda referência `@scale` do overlay para o identificador do
 * NOSSO item de raça. O overlay veio de um conversor que slugifica o nome inteiro
 * da linhagem (`@scale.dragonborn-silver.breath`), enquanto o nosso item - como o
 * dos atores oficiais - se identifica pela base (`dragonborn`), então a fórmula
 * chegava ao Foundry apontando para uma escala inexistente: o sopro rolava ZERO.
 * Mesma regra que o TC-0068 fixou para as classes - a referência tem de casar com
 * o identificador EXPORTADO, nunca com o slug de quem escreveu a fórmula.
 */
function retargetScaleRefs(value, identifier) {
  if (typeof value === 'string') return value.replace(/@scale\.[\w-]+\./g, `@scale.${identifier}.`);
  if (Array.isArray(value)) return value.map((v) => retargetScaleRefs(v, identifier));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, retargetScaleRefs(v, identifier)]));
  }
  return value;
}

/**
 * Um item de FEATURE por TRAÇO de espécie - a forma dos atores oficiais: type
 * 'feat' com `system.type.value: 'race'`, ligado ao item de raça por um
 * ItemGrant. Antes só os traços com ação/recurso ganhavam item (DDL-0057) e o
 * resto ficava como Active Effect no item de raça: funcionava, mas no Foundry o
 * jogador não VIA "Fey Ancestry"/"Trance"/"Powerful Build" listados entre suas
 * features (TC-0064; decisão do usuário 2026-07-28).
 *
 * A mecânica do overlay (effects, activities, uses) viaja COM o traço, e por
 * isso sai do item de raça - senão um efeito transferido aplicaria em dobro.
 * `flags.builder5e.level` carrega o nível em que o traço é ganho, para o item de
 * raça pendurá-lo no ItemGrant certo (Draconic Flight/Large Form no 5, não no 1).
 * @param {object} raceObj  raça 5etools RESOLVIDA
 * @param {object} db
 * @param {number} [level]  nível TOTAL do personagem: um traço de nível maior
 *   não é embutido (ele vira a receita de compêndio do item de raça).
 * @returns {object[]} itens Foundry (type 'feat', subtype de raça)
 */
export function buildSpeciesTraitItems(raceObj, db, level = MAX_LEVEL) {
  const mechanics = new Map(overlayRaceTraits(db, raceObj).map((t) => [norm(t.name), t]));
  return speciesTraitEntries(raceObj).filter((e) => traitLevel(e) <= level).map((entry) => {
    const m = mechanics.get(norm(entry.name));
    const name = traitName(entry);
    // Curado → SRD → overlay, como nas features de classe (TC-0070). O SRD é
    // quem tem a activity do Breath Weapon, do Draconic Flight, do Healing Hands…
    const srd = srdFeatureMechanics(name);
    return {
      _id: randomFoundryId(),
      name,
      type: 'feat',
      img: 'icons/svg/item-bag.svg',
      system: {
        type: { value: 'race', subtype: '' },
        identifier: slugify(name),
        description: { value: entriesToHtml(entry.entries ?? []), chat: '' },
        source: sourceBlock(raceObj.source),
        requirements: '',
        properties: [],
        // SRD antes do overlay, como nas features de classe (TC-0068).
        uses: featureUses(name) ?? featureUses(entry.name) ?? m?.system?.uses ?? { max: '', spent: 0, recovery: [] },
        prerequisites: { level: null, repeatable: false, items: [] },
        activities: retargetScaleRefs(srd?.activities ?? m?.activities ?? {}, speciesIdentifier(raceObj)),
        advancement: {},
        enchant: {},
        crewed: false,
        ...overlaySystemExtras(m?.system ?? {}),
      },
      effects: srd?.activities && srd.effects.length ? srd.effects : (m?.effects ?? []),
      flags: { builder5e: { level: traitLevel(entry), boon: !!entry._boon } },
      _stats: itemStats(originUuid(name)),
    };
  });
}

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
  const itemized = new Set(speciesTraitEntries(raceObj).map((e) => norm(e.name)));
  const overlay = overlayRaceEffects(db, raceObj, itemized);
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

export function buildSpeciesItem(character, raceObj, db = null, featItems = [], traitItems = [], spellIds = null) {
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
    // ScaleValue do overlay (o dado do Breath Weapon): é o alvo das referências
    // `@scale` das activities dos traços - sem ele o sopro rola zero.
    ...overlayRaceAdvancement(db, raceObj).map((a) => ({ _id: randomFoundryId(), level: 0, hint: '', value: {}, flags: {}, ...a })),
  ];

  // Resistência a dano FIXA da espécie/linhagem (Dragonborn, Dwarven Resilience,
  // a legacy do Tiefling): o dnd5e a modela como um passo Trait no item de raça,
  // e é assim que o Foundry sabe de onde ela veio. Continuamos assando o valor em
  // `traits.dr` do ator (é o que a nossa ficha usa), então o passo é redundante em
  // runtime - mas sem ele o item de raça não explica a resistência que concede.
  const resists = (raceObj.resist ?? []).filter((r) => typeof r === 'string');
  if (resists.length) advancement.push(traitAdv('Damage Resistance', resists.map((r) => `dr:${norm(r)}`)));

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
  // Idiomas: só os que EXISTEM no compêndio viram Trait. O 5etools usa o
  // pseudo-idioma "other" para o idioma próprio do cenário (Simic Hybrid GGR:
  // "Elvish ou Vedalken"), que não tem chave no dnd5e - emiti-lo produziria um
  // `languages:standard:other` inválido, e o import não saberia desfazê-lo. Ele
  // volta pela flag (ver `residual` abaixo), como manda o DDL-0028.
  const languages = shallowPicks(speciesChoices, 'language');
  const knownLanguages = languages.filter((l) => isKnownLanguage(db, l));
  if (knownLanguages.length) advancement.push(traitAdv('Languages', knownLanguages.map((l) => languageTraitKey(db, l))));

  // Talento ESCOLHIDO pela espécie (Human "Versatile"): um ItemChoice, não um
  // ItemGrant - é uma escolha sobre um pool, e é assim que o dnd5e a modela (sem
  // isso o Foundry não sabe que há uma decisão ali, e no level-up não oferece
  // troca). O pool sai da categoria do próprio descritor, restrito ao que o SRD
  // publica; sem pool conhecido continua valendo o ItemGrant.
  const featChoice = (parseChoices(raceObj, { level, bag: speciesChoices }) ?? []).find((c) => c.kind === 'feat');
  const featPool = featChoice
    ? (db?.feats?.feat ?? [])
      .filter((f) => (featChoice.pool?.category ?? []).includes(f.category))
      .map((f) => featUuid(f.name))
      .filter(Boolean)
    : [];
  const featPoolUnique = [...new Set(featPool)];
  if (featItems.length && featPoolUnique.length) {
    advancement.push({
      _id: randomFoundryId(),
      type: 'ItemChoice',
      level: 0,
      title: featChoice.label ?? 'Species Feat',
      configuration: {
        choices: { 0: { count: featChoice.count ?? 1, replacement: false } },
        allowDrops: true,
        type: 'feat',
        pool: featPoolUnique.map((uuid) => ({ uuid })),
        spell: null,
        restriction: { type: 'feat', subtype: 'origin' },
      },
      value: { added: { 0: Object.fromEntries(featItems.map((i) => [i._id, `.${i._id}`])) }, replaced: {} },
    });
  } else if (featItems.length) {
    advancement.push(...itemGrantAdvancements(featItems, 'Species Feat'));
  }
  // ItemGrant dos traços (um item por traço, TC-0064). Os já alcançados apontam
  // para o item EMBUTIDO (uuid relativo); os de nível futuro - Draconic Flight e
  // Large Form, ganhos no 5 - viram a RECEITA do compêndio com `value` vazio, do
  // mesmo jeito que as escadas de classe: assim o traço não fica ativo antes da
  // hora e o Foundry o concede ao chegar no nível.
  const traitsTitle = `${baseName} Traits`;
  const isBoon = (i) => !!i.flags?.builder5e?.boon;
  const plainTraits = traitItems.filter((i) => !isBoon(i));
  const boonItems = traitItems.filter(isBoon);
  if (plainTraits.length) advancement.push(...itemGrantAdvancements(plainTraits, traitsTitle));
  // O benefício da ancestralidade ("Cloud's Jaunt") em passo PRÓPRIO - e como
  // `ItemChoice` quando dá para montar o POOL das alternativas, que é a forma dos
  // atores oficiais: assim o Foundry sabe que houve uma ESCOLHA ali e oferece
  // trocá-la. Sem pool (espécie fora do SRD) cai no ItemGrant, que concede a
  // mesma coisa sem registrar a decisão.
  if (boonItems.length) {
    const pool = ancestryBoonPool(db, raceObj);
    if (pool.length) {
      advancement.push({
        _id: randomFoundryId(),
        type: 'ItemChoice',
        level: 0,
        title: lineageLabel(raceObj),
        configuration: {
          choices: { 0: { count: boonItems.length, replacement: false } },
          allowDrops: false,
          type: 'feat',
          pool: pool.map((uuid) => ({ uuid })),
          spell: null,
          restriction: { type: 'race' },
        },
        value: {
          added: { 0: Object.fromEntries(boonItems.map((i) => [i._id, i._stats?.compendiumSource ?? `.${i._id}`])) },
          replaced: {},
        },
      });
    } else {
      advancement.push(...itemGrantAdvancements(boonItems, lineageLabel(raceObj)));
    }
  }
  const futureTraits = speciesTraitEntries(raceObj)
    .map((e) => ({ level: traitLevel(e), uuid: originUuid(traitName(e)) }))
    .filter((t) => t.level > level);
  advancement.push(...futureItemGrants(futureTraits, traitsTitle));
  // Magias da linhagem (o cantrip da linhagem élfica no 1, Detect Magic no 3,
  // Misty Step no 5): a mesma escada de concessão da subclasse.
  advancement.push(
    ...spellGrantLadder(curatedAdditionalSpells(raceObj), `${lineageLabel(raceObj)} Traits`, spellIds, 1, speciesChoices),
  );

  // Escolhas da espécie SEM casa nativa no Foundry viajam na flag do item de
  // raça (DDL-0028): o atributo de conjuração racial escolhido (TC-0009), o
  // tamanho (antes um waiver do sweep), pools mistos, traços de dano escolhidos
  // (TC-0014) e magias/lista de magias escolhidas (TC-0011).
  const residual = {};
  const RESIDUAL_SPECIES_KINDS = ['spellAbility', 'size', 'mixed', 'resist', 'immune', 'vulnerable', 'spell', 'spellSet'];
  for (const [id, entry] of Object.entries(speciesChoices ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    if ((entry.picks?.length ?? 0) === 0) continue;
    // Idioma sem chave no dnd5e ("other"): o Trait não o carrega, então a flag
    // guarda a escolha INTEIRA (o import dá precedência à flag e a restaura).
    const unmappedLanguage = entry.kind === 'language' && entry.picks.some((p) => !isKnownLanguage(db, p));
    if (!RESIDUAL_SPECIES_KINDS.includes(entry.kind) && !unmappedLanguage) continue;
    residual[id] = entry;
  }

  // Nome do documento do dnd5e quando existe ("Elf, High" no lugar do nosso
  // "Elf; High Elf Lineage"): é a MESMA espécie, e casar o nome é o que dá
  // procedência de compêndio ao item de raça. A ficha do FlyBy segue mostrando o
  // nome do livro - isto vale só para o arquivo exportado.
  const srdName = srdSpeciesName(raceObj);
  // …mas o nome do SRD é o da espécie INTEIRA ("Dragonborn" cobre as dez
  // ancestralidades), então ele sozinho perderia a linhagem escolhida. Ela viaja
  // na flag, que é a regra do DDL-0028 para o que o Foundry não tem onde guardar:
  // um ator externo continua sendo lido pelas marcas que deixa (`inferLineage`),
  // e o NOSSO round-trip volta exato.
  const flags = {};
  if (Object.keys(residual).length) flags.choices = residual;
  if (srdName && norm(srdName) !== norm(raceObj.name)) flags.lineage = raceObj.name;

  return {
    _id: randomFoundryId(),
    name: srdName ?? raceObj.name,
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
    flags: Object.keys(flags).length ? { builder5e: flags } : {},
    _stats: itemStats(originUuid(srdName ?? raceObj?.name)),
  };
}

export function buildSubclassItem(subclass, classId, featureItems = [], opts = {}) {
  if (!subclass) return null;
  // O identificador CANÔNICO do SRD vence o slug: o dnd5e o cita em fórmula
  // (`@subclasses.hand.levels`) e ele não é derivável do nome (TC-0074). Fora do
  // SRD (as outras 123 subclasses) o slug do shortName continua valendo.
  const identifier = subclassIdentifier(classId, subclass) ?? slugify(subclass.shortName ?? subclass.name);
  return {
    _id: randomFoundryId(),
    name: subclass.name,
    type: 'subclass',
    img: subclassIcon(identifier, classId),
    system: {
      identifier,
      classIdentifier: classId,
      description: { value: opts.description ?? '', chat: '' },
      // Subclasse CONJURADORA (Eldritch Knight, Arcane Trickster): a progressão é
      // da subclasse, não da classe, e o dnd5e tem o campo para isso (o
      // SpellcastingField do DataModel de subclass). Sem ele o terço-conjurador
      // chegava no Foundry sem nenhum espaço de magia (TC-0060).
      spellcasting: subclass.casterProgression
        ? {
            progression: fvttProgression(subclass.casterProgression),
            ability: subclass.spellcastingAbility ?? '',
            preparation: { formula: '' },
          }
        : { progression: 'none', ability: '', preparation: { formula: '' } },
      advancement: keyById([
        ...itemGrantAdvancements(featureItems, 'Subclass Features'),
        ...(opts.futureGrants ?? []),
        ...(opts.choiceTraits ?? []),
        // ScaleValues próprios da subclasse (dados de superioridade do Battle
        // Master, etc.) - só o overlay tem; a tabela da CLASSE não os traz.
        ...overlaySubclassAdvancement(opts.db, {
          className: classId, shortName: subclass.shortName, source: subclass.source,
        }).map((a) => ({ _id: randomFoundryId(), value: {}, ...a })),
        // Escolhas de feature da SUBCLASSE (o Fighting Style extra do Champion…).
        ...(opts.itemChoices ?? []).map((a) => ({ _id: randomFoundryId(), value: {}, ...a })),
      ]),
      source: sourceBlock(subclass.source),
    },
    effects: [],
    flags: {},
    _stats: itemStats(subclassUuid(classId, subclass)),
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
    // O SRD do dnd5e é a autoridade sobre equipment × consumable × loot: essa
    // distinção não sai do código de tipo do 5etools (todo "adventuring gear" é
    // `G`, e o SRD reparte item a item), e ela decide se dá para EQUIPAR ou
    // CONSUMIR na ficha do Foundry - antes quase tudo virava `loot`, que não faz
    // nem um nem outro (TC-0066). Só dentro desse trio: arma/armadura/ferramenta
    // continuam com a nossa classificação, que carrega dano/CA/perícia.
    // Exceção: o SRD pode PROMOVER a arma um item que o 5etools classifica como
    // foco de conjuração - o "Staff" (e o "Wooden Staff") tem dano e categoria de
    // arma no dado, é só o `type` que diz SCF. Promovemos só quando o dado tem
    // dano, então a ficha de arma nunca é inventada.
    // `container` entra no trio desde que o comparador passou a olhar contêineres
    // (C4): o SRD classifica assim a Bag of Holding, a Backpack, a Pouch… e sem
    // isso elas saíam como `equipment`, sem poder guardar nada no Foundry.
    const RECLASSIFIABLE = ['equipment', 'consumable', 'loot', 'container'];
    const srd = raw ? equipmentFoundryType(raw.name) : null;
    const useSrd =
      srd
      && ((RECLASSIFIABLE.includes(srd.type) && RECLASSIFIABLE.includes(map.type))
        || (srd.type === 'weapon' && map.type !== 'weapon' && !!raw?.dmg1));
    const fType = useSrd ? srd.type : map.type;
    const typeValue = (useSrd ? srd.subtype : '') || map.typeValue;
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
      // `info` só traz categoria/tipo quando o 5etools classifica o item COMO
      // arma; num item promovido (o Staff, que lá é foco) elas vêm do raw.
      const cat = (info.category ?? raw?.weaponCategory) === 'martial' ? 'martial' : 'simple';
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
      const tv = typeValue ?? info.armorSlot ?? 'trinket';
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
      system.type = { value: typeValue, baseItem: toolId(raw?.name ?? entry.itemId) };
      system.ability = '';
      system.proficient = null;
    } else if (fType === 'container') {
      // Contêiner não tem `type` (não é subtipo de nada) e ganha os campos que o
      // DataModel dele espera: capacidade e a bolsa de moedas.
      system.capacity = { weight: { value: null, units: 'lb' }, volume: { units: 'cubicFoot' } };
      system.currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
      system.identifier = slugify(raw?.name ?? entry.itemId);
      system.equipped = !!entry.equipped;
    } else {
      // consumable / loot
      system.type = { value: typeValue, subtype: '' };
    }

    const name = entry.customName || raw?.name || entry.itemId;
    const img = inventoryImg(entry, info.group);
    const bonusEffect = itemBonusEffect(name, img, raw);
    const item = {
      _id: randomFoundryId(),
      name,
      type: fType,
      img,
      system,
      effects: bonusEffect ? [bonusEffect] : [],
      folder: null,
      sort: 0,
      flags: {},
      _stats: itemStats(entry.customName ? null : equipmentUuid(name)),
    };
    // Um PACK vira contêiner + conteúdo (a forma dos atores oficiais). Se não der
    // para desdobrar, segue como um item só - o comportamento antigo.
    const unpacked = unpackContainer(item, raw, db);
    if (unpacked) out.push(...unpacked);
    else out.push(item);
  }
  return out;
}

/**
 * Desdobra um PACK no par contêiner + conteúdo, que é como os atores oficiais o
 * trazem: o "Priest's Pack" da Akra é um `container` com 6 itens dentro, cada um
 * com `system.container` apontando para ele.
 *
 * Tudo DERIVADO do `packContents` do 5etools (20 packs o têm) - nada inventado:
 *  - a MOCHILA vem de dentro do próprio pack. `packContents` inclui um item que o
 *    SRD classifica como `container` (o Backpack), e é ELE que carrega o peso do
 *    recipiente; o resto vai dentro. Sem isso, o peso do pack (29 lb, o TOTAL)
 *    somaria com o dos conteúdos e o Foundry contaria tudo em dobro.
 *  - o PREÇO fica no contêiner (é o preço do pack), e os conteúdos saem sem preço,
 *    para a soma da ficha não dobrar pelo mesmo motivo.
 *
 * O nosso modelo continua comprando o pack como UMA entrada de inventário
 * (DDL-0013); o desdobramento é só do lado do arquivo exportado, e o import o
 * recolhe de volta (ver `foundryImport`, C4 do DEFERRED-REVIEW).
 * @param {object} item  o item já montado do pack
 * @param {object|null} raw  o item 5etools resolvido
 * @param {object} db
 * @returns {object[]|null} contêiner + conteúdos, ou null se não for um pack
 */
function unpackContainer(item, raw, db) {
  const contents = raw?.packContents;
  if (!Array.isArray(contents) || contents.length === 0) return null;

  const resolved = [];
  for (const c of contents) {
    // Três formas no dado: "uid", {item, quantity} e {special: "texto"} (que não
    // é item nenhum - fica fora, como já ficava).
    const uid = typeof c === 'string' ? c : c?.item;
    if (!uid) continue;
    const [cName, cSource] = String(uid).split('|');
    // O uid do `packContents` traz a fonte em MINÚSCULAS ("backpack|xphb"), e o
    // casamento de fonte do `resolveItemObj` é sensível a caixa - sem o upper,
    // NENHUM conteúdo resolvia e o pack nunca se desdobrava.
    const obj = resolveItemObj(db, cName, (cSource ?? '').toUpperCase());
    if (obj) resolved.push({ obj, quantity: (typeof c === 'object' ? c.quantity : 1) ?? 1 });
  }
  if (!resolved.length) return null;

  // A mochila do pack: o conteúdo que o SRD classifica como `container`.
  const bagIndex = resolved.findIndex((r) => equipmentFoundryType(r.obj.name)?.type === 'container');
  const bag = bagIndex >= 0 ? resolved[bagIndex] : null;
  const inside = resolved.filter((_, i) => i !== bagIndex);

  const container = {
    ...item,
    type: 'container',
    system: {
      ...item.system,
      // Peso do RECIPIENTE, não do pack: os conteúdos carregam o deles.
      weight: { value: bag?.obj?.weight ?? 0, units: 'lb' },
      capacity: { weight: { value: null, units: 'lb' }, volume: { units: 'cubicFoot' } },
      identifier: slugify(item.name),
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      quantity: 1,
    },
  };
  delete container.system.type;

  const children = inside.map(({ obj, quantity }) => {
    const child = buildInventoryItems(
      { inventory: [{ uid: '', itemId: obj.name, source: obj.source, quantity, equipped: false, attuned: false }] },
      db,
    )[0];
    if (!child) return null;
    // Dentro do contêiner, e sem preço (o do pack já está no contêiner).
    child.system.container = container._id;
    child.system.price = foundryPrice(0);
    return child;
  }).filter(Boolean);

  return [container, ...children];
}
