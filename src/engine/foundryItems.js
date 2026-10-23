// =============================================================================
// foundryItems: os documentos de ITEM do ator Foundry (dnd5e)
// =============================================================================
// O QUE FAZ
//   Transforma o personagem (as decisões dele mais o db do 5etools) nos itens
//   embutidos de um ator dnd5e: classe, subclasse, features, talentos, background,
//   espécie, traços de espécie e inventário. É o miolo do export (Fases A e B1):
//   o foundryExport monta o ator em volta destes itens e o foundryImport faz o
//   caminho inverso.
//
//   Cada item segue a forma dos atores premade oficiais: um advancement com os
//   passos (HitPoints, Trait, AbilityScoreImprovement, ItemGrant, ItemChoice,
//   ScaleValue), mais Active Effects e activities. Nível já alcançado aponta para
//   o item EMBUTIDO (uuid relativo `.${_id}`, o ponto quer dizer "neste
//   documento"); nível futuro aponta para o COMPÊNDIO do dnd5e, para o level-up
//   dentro do Foundry conceder o que falta.
//
// FUNÇÕES
//   Utilitários
//   bagHasContent(bag): o choice-bag tem algum pick ou sub-bag?
//   shallowPicks(bag, kind): picks de topo de um kind, sem descer em sub-bags.
//   residualClassChoices(bag): escolhas de classe sem casa nativa (vão na flag).
//   classIcon(classId), subclassIcon(subclassId, classId): ícones oficiais.
//   findFeat(db, id): talento pelo id "Nome|Fonte".
//   zeroFixed(): o bloco `fixed` zerado das seis habilidades.
//   traitAdv(title, grants): passo Trait de grant fixo, já aplicado.
//   norm(s): string normalizada para comparação.
//   randomFoundryId(): id de 16 caracteres no formato do Foundry.
//   keyById(list): advancement como objeto indexado por `_id`.
//   itemStats(compendiumSource), sourceBlock(book): blocos padrão do item.
//   overlaySystemExtras(system): campos de `system` do overlay, sem `uses`.
//   slugify(name), stripTags(s), entriesToHtml(entries): texto para o Foundry.
//   pickFluff(list, source): a entrada de fluff da fonte, ou a mais recente.
//   classFluffHtml(db, classId, source), subclassFluffHtml(db, classId, subclass):
//     a descrição em HTML a partir do fluff.
//
//   Classe e features
//   itemGrantAdvancements(featureItems, title): ItemGrant por nível, embutidos.
//   futureItemGrants(entries, title, spell): ItemGrant dos níveis futuros.
//   hitPointsValue(classEntry): o valor do passo HitPoints.
//   fvttProgression(code): progressão de conjuração no vocabulário do dnd5e.
//   buildClassItem(classEntry, classObj, featureItems, asiByLevel, opts): o item
//     de classe com todo o advancement preenchido.
//   primaryAbilityBlock(classObj): o bloco primaryAbility.
//   isOptionCatalog(feature): a feature é só um catálogo de opções?
//   resolveClassFeatures(db, classId, classObj, level): features até o nível.
//   buildFeatureItem(feature, db): o item de uma feature, com a mecânica.
//   buildClassFeatureItems(classEntry, classObj, db): as features da classe.
//   buildClassWeaponItems(classEntry, classObj): armas concedidas pela classe.
//   buildClassFutureGrants(classEntry, classObj, db): a escada futura da classe.
//   relistedFeatureGrants(classId, classObj, level): as re-listagens "(2)".
//
//   Traits de escolha
//   choiceTraitTitle(desc): o título do Trait (o nome da feature).
//   traitChoiceConfig(desc, db), traitChoiceValues(desc, picks, db): pool e
//     valores do Trait.
//   buildChoiceTraits(descriptors, bag, db): os Traits de um conjunto de escolhas.
//   grantedLanguagesFor(classId, level): idiomas concedidos por um grant curado.
//   buildClassChoiceTraits(classEntry, classObj, db): os Traits da classe.
//   buildSubclassChoiceTraits(subclass, classId, classEntry, classObj, db): os da
//     subclasse.
//   buildClassTraitValues(classEntry, db): perícias e Weapon Mastery escolhidas.
//   weaponTraitKey(db, pick), toolTraitKey(db, name), languageTraitKey(db, name):
//     as chaves de trait do Foundry.
//   isKnownLanguage(db, name): o idioma existe no compêndio?
//
//   Talentos e escolhas de feature
//   buildFeatItem(featData, opts): o item de um talento.
//   buildClassChosenFeats(classEntry, db): talentos da classe e o valor dos ASIs.
//   buildItemChoiceAdvancements(classEntry, classObj, subObj, db, optionItems,
//     opts): a escada de ItemChoice das escolhas de feature.
//   progressionOf(classObj, subObj, types): a progressão de optional features.
//   buildFeatureOptionItems(classEntry, classObj, subObj, db): itens "Feature:
//     Opção".
//   buildOptionalFeatureItems(classEntry, db): invocations, metamagic e afins.
//
//   Background
//   buildOriginFeatItem(character, db): o talento de origem.
//   buildBackgroundItem(character, originFeatItem, db): o item de background.
//
//   Subclasse
//   resolveSubclassFeatures(subclass, classId, db, range): features numa faixa.
//   buildSubclassFeatureItems(subclass, classId, db, level): os itens delas.
//   buildSubclassFutureGrants(subclass, classId, db, level, spellIds): a escada
//     futura de features e de magias.
//   spellGrantLadder(additional, title, spellIds, from, bag): a escada de magias
//     concedidas, do 1 ao 20.
//   buildSubclassItem(subclass, classId, featureItems, opts): o item de subclasse.
//
//   Espécie
//   movementBlock(speed): o bloco `movement`.
//   traitLevel(entry): o nível em que um traço é ganho.
//   speciesTraitEntries(raceObj): os traços que viram item.
//   nestedBoonEntry(entry), ancestryBoonPool(db, raceObj): o benefício de
//     ancestralidade e o pool dele.
//   traitName(entry), lineageLabel(raceObj), speciesIdentifier(raceObj): nomes.
//   retargetScaleRefs(value, identifier): conserta as referências `@scale`.
//   buildSpeciesTraitItems(raceObj, db, level): um item por traço.
//   buildSpeciesFeatItems(character, db): talentos escolhidos pela espécie.
//   speciesEffects(db, raceObj): os Active Effects do item de raça.
//   buildSpeciesItem(character, raceObj, db, featItems, traitItems, spellIds): o
//     item de raça.
//
//   Inventário
//   foundryPrice(copper), foundryRarity(rarity): preço e raridade.
//   parseDie(s), parseRange(s): dado e alcance no formato do Foundry.
//   weaponDamageBase(raw), weaponDamageVersatile(raw), mapWeaponProps(props): os
//     campos de arma.
//   itemFluffEntries(db, raw), inventoryImg(entry, group): descrição e imagem.
//   bonusNum(s): "+1" vira 1.
//   weaponAttackActivity(info, raw): a activity de ataque de uma arma.
//   itemBonusEffect(name, img, raw): o effect dos bônus planos do item.
//   customToFoundryItem(entry): o item custom, a partir do snapshot.
//   buildInventoryItems(character, db): todo o inventário.
//   unpackContainer(item, raw, db): um pack desdobrado em contêiner e conteúdo.
//
// DECISÕES E ARMADILHAS
//   Geral
//   - O formato é o APLICADO dos premades (`value.chosen`, `value.added`): sem
//     ele o Foundry trata o passo como pendente e pergunta de novo.
//   - `advancement` é um OBJETO indexado pelo `_id` (MappingField), não array.
//   - Decisões sem casa nativa no Foundry viajam em `flags.builder5e.choices` no
//     item DONO delas (DDL-0028): sub-bag de talento no item do talento,
//     spellAbility e tamanho no item de raça, o resto da classe (ferramenta
//     inicial, expertise, grants curados, optional features) no item de classe.
//     O Foundry ignora a flag; só o nosso import a lê. Têm casa nativa, e por isso
//     ficam fora da flag: perícias iniciais, weapon mastery, talentos de nível e
//     featureoptions (NATIVE_CLASS_CHOICE_ID).
//   - Os picks são RASOS: o que foi escolhido dentro de um talento pertence ao
//     item do talento, nunca ao da classe ou da raça (TC-0010).
//   - Ícones: as 12 classes têm ícone oficial; subclasse só tem o próprio no SRD,
//     as outras usam o da classe-mãe (caminho garantido, sem 404).
//   - `_stats` traz as versões dos exports reais (core 13.351, dnd5e 5.3.3); o
//     Foundry as sobrescreve no import.
//   - Mecânica de feature: curado, depois SRD, depois overlay (TC-0068/0070).
//     Effects são tudo-ou-nada: com effect curado o overlay é ignorado
//     (DDL-0031); os do SRD andam com as activities do SRD, que os citam por
//     `_id`, e somar os do overlay aplicava o efeito em dobro (foi assim que
//     "Cunning Action: Hiding" saiu duplicado). `uses` e `activities` do overlay
//     entram sempre que o curado não cobrir aquele campo. Sem `uses` em nenhum dos
//     três (curado, SRD, overlay), vale o pool que só a PROSA declara
//     (proseUses, DDL-0106), em feature, traço de espécie e talento.
//
//   Classe e features
//   - fvttProgression: as frações '1/2' e '1/3' do 5etools não existem no dnd5e;
//     exportadas cruas, a classe chegava sem espaços de magia (TC-0060).
//     `artificer` fica: o sistema o define igual a `half`.
//   - `preparation.formula` aponta para a escala `max-prepared` do próprio item,
//     que o advancement emite (TC-0062).
//   - Um título de Trait pode aparecer em vários níveis com o delta de cada um
//     (Weapon Mastery 2@1, +1@4, +1@10): cada passo leva só a sua fatia dos
//     escolhidos. As optional features fatiam do mesmo jeito (DDL-0055).
//   - resolveClassFeatures DEDUPA as re-listagens (Indomitable 9/13/17): um item
//     por feature, a progressão fica em ScaleValue e uses. A exceção é estreita
//     (TC-0088): quando o dnd5e publica "<Nome> (2)", a re-listagem é regra nova
//     e vira item próprio, com o nome publicado. Hoje só o Improved Brutal Strike
//     do Bárbaro casa; relistedFeatureGrants usa o mesmo predicado na escada
//     futura, e um caso novo entra sozinho quando o dnd5e o publicar.
//   - isOptionCatalog: a "feature" que só lista opções (Metamagic Options) não
//     vira item; quem concede é a feature-mãe. Derivado da FORMA do dado.
//   - Escada futura: ItemGrant apontando para o compêndio, com `value` vazio.
//     Nível sem uuid conhecido não gera passo: melhor nenhuma escada do que uma
//     que aponta para um documento inexistente. Um nível alcançado pode vir junto,
//     com `value.added` (é o que os premades fazem com as magias de subclasse).
//   - Magias da própria classe (Divine Smite e Find Steed do Paladino) só ganham
//     escada nos níveis FUTUROS; nos alcançados o SRD não tem passo.
//   - buildClassWeaponItems: o Unarmed Strike (Bárbaro, Monge) vem do SRD e é o
//     que dá o ataque desarmado na ficha. O acréscimo universal
//     (`classWeaponGrants`) ganha título próprio para não se passar pela escada
//     oficial.
//
//   Traits de escolha
//   - Escolha de proficiência acima do nível 1 (Primal Knowledge @3, Expertise
//     @1/@6, Deft Explorer @2) é um Trait NO NÍVEL DELA, com o NOME DA FEATURE
//     como título: é o que faz o Foundry perguntar no level-up. A flag continua
//     sendo a verdade do re-import. choiceTraitTitle é exportado porque o import
//     casa o Trait de volta por este título.
//   - `mode: 'expertise'` só oferece perícias já proficientes, por isso o pool é
//     aberto. Resistência à escolha (Elemental Affinity) é um Trait `dr:<tipo>`.
//   - Grant fixo e escolha no mesmo Trait (Thieves' Cant: idioma concedido em
//     `grants`, o escolhido em `choices`) é a forma do premade, e é o que faz o
//     pick voltar no import.
//   - A ferramenta inicial só existe na classe original e usa o título fixo
//     "Tool Proficiencies" dos premades.
//
//   Talentos e escolhas de feature
//   - Talento com aumento FIXO embute um ASI `fixed`; aumento por escolha já
//     entra assado no `abilities` do ator.
//   - buildClassChosenFeats: só os slots 'feat@<nível>' entram no ASI da classe.
//     Grant de subclasse ('sub:feat@') e estilo de optionalfeatureProgression
//     ('feat@fs@') viram item solto mais flag, senão o import os re-mapearia para
//     chaves que o builder não tem (TC-0006).
//   - buildItemChoiceAdvancements tem três casos. (1) Opção de feature ("Divine
//     Order: Protector"), um nível e uma escolha. (2) Optional features, cuja
//     contagem cresce: o passo grava o delta do nível, e um descritor é da
//     SUBCLASSE quando só aparece com ela (senão o Warlock emitia as invocações
//     duas vezes). (3) Talento escolhido por feature de subclasse (Additional
//     Fighting Style do Champion): pool de feats24, forma do premade do Randal.
//     O item do talento vem de `featItems`, não de `optionItems`, para um
//     homônimo não se confundir. Pool vazio não vira passo (TC-0063).
//   - O overlay indexa a OPÇÃO pelo nome dela ("Thaumaturge"), não pelo nome
//     composto; optional features têm índice próprio no overlay.
//
//   Background
//   - A história escrita na aba Background é a descrição do item (e a biografia
//     do ator). A origem é custom, então nenhum texto oficial compete com ela.
//
//   Subclasse
//   - resolveSubclassFeatures pula a feature guarda-chuva (com o nome da própria
//     subclasse) e os passos de advancement.
//   - O identificador canônico do SRD vence o slug: o dnd5e o cita em fórmula
//     (`@subclasses.hand.levels`, TC-0074).
//   - Subclasse conjuradora (Eldritch Knight, Arcane Trickster) leva a progressão
//     no próprio item (TC-0060). ScaleValues próprios da subclasse (dados do
//     Battle Master) só o overlay tem.
//
//   Espécie
//   - Um item por TRAÇO (TC-0064, decisão do usuário em 2026-07-28), com a
//     mecânica do overlay viajando junto; no item de raça ela aplicaria em dobro.
//     Traços expressos em outro campo (NATIVE_TRAIT_NAMES, como Darkvision) não
//     viram item. Numa espécie do SRD, o SRD decide quais traços são documentos.
//   - traitLevel lê o nível na PROSA, e só quando a frase ABRE o traço; no meio do
//     texto ela costuma ser um benefício solto (a magia élfica do nível 3).
//   - Benefício de ancestralidade (Cloud's Jaunt do Goliath): regra estreita, um
//     único item nomeado que exista no origins24. O pool vem da espécie BASE e
//     vira ItemChoice (DDL-0080); sem pool, ItemGrant.
//   - retargetScaleRefs: o overlay cita `@scale.dragonborn-silver.breath`, mas o
//     item se identifica pela base (`dragonborn`); sem reescrever, o sopro rolava
//     zero.
//   - Resistência fixa vira passo Trait (explica de onde vem), mesmo com o valor
//     já em `traits.dr`. Idioma "other" não tem chave no dnd5e: não vira Trait e
//     volta pela flag. Talento escolhido pela espécie (Human Versatile) é
//     ItemChoice com o pool do SRD.
//   - O item de raça usa o nome do dnd5e quando existe ("Elf, High"), o que dá
//     procedência de compêndio; a linhagem escolhida viaja na flag.
//   - speciesEffects tira os changes de CA do overlay quando há armadura natural
//     curada; senão o Autognome somava a CA em dobro.
//   - spellGrantLadder emite do 1 ao 20, com `value.added` nos níveis alcançados
//     (TC-0072), e passa pelo registro curado (TC-0026/0044). O bag faz as magias
//     ESCOLHIDAS entrarem (o cantrip élfico).
//
//   Inventário
//   - Sem imagem custom, ícone genérico do Foundry: a arte do 5e.tools é http e o
//     re-import a confundiria com uma imagem do usuário.
//   - O SRD decide entre equipment, consumable, loot e container (TC-0066); arma,
//     armadura e ferramenta seguem a nossa classificação. O SRD pode promover a
//     arma um foco que tem dano no dado (o Staff).
//   - Arma: `includeBase:true` com `attack.ability:''` deixa o Foundry calcular
//     acerto e dano. Bônus de item é um effect `transfer:true`, que o dnd5e
//     suprime sozinho quando o item não está equipado.
//   - Item custom re-emite o snapshot do import com os campos voláteis atuais.
//   - Pack vira contêiner mais conteúdo, derivado do `packContents` (DDL-0080). A
//     mochila de dentro do pack carrega o peso do recipiente e o contêiner leva o
//     preço; os conteúdos saem sem preço, senão peso e preço dobravam. O vínculo
//     pai-filho é uma segunda passada, e contêiner órfão fica solto.
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
import { featureUses, proseUses, firstUses } from './foundryFeatureUses';
import { featureActivities, srdFeatureMechanics, classWeaponGrants } from './foundryActivities';
import { naturalArmorFor, naturalArmorChanges } from './naturalArmor';
import { foundrySize, toolId, languageCode, textToHtml } from './foundryExport';
import { effectiveSizeCodes, sizePick, speciesCatalog } from './speciesData';
import { LEGACY_PROSE_SECTIONS } from './legacySubraces';
import { collectChoicePicks, collectAbilityPicks, fixedAbilityBoosts, parseChoices } from './choices';
import { resolveItemObj, itemTypeInfo, attunementInfo } from './items';
import { containerProps } from './containers';
import { itemValue } from './magicItemPrice';
import {
  classUuid, classFeatureUuid, subclassUuid, subclassFeatureUuid, spellUuid,
  originUuid, featUuid, equipmentUuid, equipmentFoundryType, subclassIdentifier, srdSpeciesName, srdOriginName,
} from './compendiumUuids';
import { grantedSpells } from './grantedSpells';
import { curatedAdditionalSpells } from './grantedSpellUses';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const FEAT_CATEGORY_SUBTYPE = {
  G: 'general',
  O: 'origin',
  FS: 'fightingStyle',
  'FS:P': 'fightingStyle',
  'FS:R': 'fightingStyle',
  'FS:B': 'fightingStyle',
  EB: 'epicBoon',
};

const ASI_FEAT_NAME = 'ability score improvement';

/** O choice-bag tem algum pick ou sub-bag? */
function bagHasContent(bag) {
  return Object.values(bag ?? {}).some(
    (e) => e && typeof e === 'object' && ((e.picks?.length ?? 0) > 0 || bagHasContent(e.sub)),
  );
}

/** Picks de topo de um kind, sem descer nos sub-bags de talento. */
function shallowPicks(bag, kind) {
  return Object.values(bag ?? {})
    .filter((e) => e?.kind === kind)
    .flatMap((e) => e.picks ?? []);
}

const NATIVE_CLASS_CHOICE_ID = /^(skill|weaponMastery|feat@\d+|(sub:)?featopt@.+)$/;

/** Entradas do bag da classe sem casa nativa no Foundry. */
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

const SRD_SUBCLASS_ICONS = new Set([
  'berserker', 'champion', 'devotion', 'draconic', 'evoker', 'fiend',
  'hunter', 'land', 'life', 'lore', 'open-hand', 'thief',
]);

/** Caminho do ícone oficial de uma classe. */
function classIcon(classId) {
  return `systems/dnd5e/icons/classes/${classId}.webp`;
}

/** Ícone da subclasse (SRD) ou o da classe-mãe. */
function subclassIcon(subclassId, classId) {
  return classIcon(SRD_SUBCLASS_ICONS.has(subclassId) ? subclassId : classId);
}

/** Talento pelo id "Nome|Fonte" (lookup local, evita ciclo com resolve). */
function findFeat(db, id) {
  const [name, source] = String(id).split('|');
  const list = db?.feats?.feat;
  if (!Array.isArray(list)) return null;
  return list.find((f) => f.name === name && f.source === source) ?? null;
}

/** Bloco `fixed` zerado das seis habilidades. */
function zeroFixed() {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

/** Passo Trait de grant fixo, já aplicado. */
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

/** Id de 16 caracteres alfanuméricos, como o randomID do Foundry. */
export function randomFoundryId() {
  let s = '';
  for (let i = 0; i < 16; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

const CORE_VERSION = '13.351';
const SYSTEM_VERSION = '5.3.3';

/**
 * Advancement no formato do Foundry: objeto indexado por `_id`.
 * @param {object[]} list
 * @returns {Record<string, object>}
 */
function keyById(list) {
  return Object.fromEntries((list ?? []).map((a) => [a._id, a]));
}

/** Bloco `_stats` padrão. */
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

/** Bloco `source` (livro e regras 2024). */
export function sourceBlock(book) {
  return { book: book ?? '', rules: '2024', revision: 1 };
}

/** Campos de `system` do overlay sem casa própria, menos `uses`. */
function overlaySystemExtras(system) {
  const rest = { ...(system ?? {}) };
  delete rest.uses;
  return rest;
}

/** Slug de identificador ("Second Wind" vira "second-wind"). */
export function slugify(name) {
  return String(name).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Remove as tags {@x ...} do 5etools. */
function stripTags(s) {
  return String(s).replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1');
}

/** Entries do 5etools em HTML simples. */
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

/** Entrada de fluff da fonte, ou a mais recente. */
function pickFluff(list, source) {
  if (!Array.isArray(list) || !list.length) return null;
  return (source && list.find((e) => norm(e.source) === norm(source))) || list[list.length - 1];
}

/**
 * Descrição da classe em HTML, vazia sem fluff.
 * @param {object} db
 * @param {string} classId
 * @param {string} [source]
 * @returns {string}
 */
export function classFluffHtml(db, classId, source) {
  const entry = pickFluff(db?.[`fluff-class-${classId}`]?.classFluff, source);
  return entry ? entriesToHtml(entry.entries) : '';
}

/**
 * Descrição da subclasse em HTML, vazia sem fluff.
 * @param {object} db
 * @param {string} classId
 * @param {object} subclass
 * @returns {string}
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
 * ItemGrant por nível ligando o item pai às features embutidas.
 * @param {object[]} featureItems
 * @param {string} title
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

const MAX_LEVEL = 20;

/**
 * ItemGrant dos níveis futuros, apontando para o compêndio.
 * @param {Array<{level: number, uuid: string, addedId?: string}>} entries
 * @param {string} title
 * @param {object|null} [spell]
 * @returns {object[]}
 */
function futureItemGrants(entries, title, spell = null) {
  const added = (map) => {
    const pairs = [...map].filter(([, id]) => id).map(([uuid, id]) => [id, uuid]);
    return pairs.length ? { added: Object.fromEntries(pairs) } : {};
  };
  const byLevel = new Map();
  for (const e of entries) {
    if (!e.uuid) continue;
    if (!byLevel.has(e.level)) byLevel.set(e.level, new Map());
    const map = byLevel.get(e.level);
    if (!map.has(e.uuid)) map.set(e.uuid, e.addedId ?? null);
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
 * Valor do passo HitPoints (padrão: "max" no 1, "avg" depois).
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
 * Progressão de conjuração do 5etools na chave do dnd5e, ou null.
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
export function fvttProgression(code) {
  if (!code) return null;
  return { '1/2': 'half', '1/3': 'third' }[code] ?? code;
}

/**
 * O item de classe, com todo o advancement preenchido.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object[]} [featureItems]
 * @param {Record<number, object>} [asiByLevel]
 * @param {{ description?: string, traitValues?: Record<string, string[]>, fightingStyles?: {itemId: string, level: number}[], futureGrants?: object[] }} [opts]
 * @returns {object}
 */
export function buildClassItem(classEntry, classObj, featureItems = [], asiByLevel = {}, opts = {}) {
  const parsed = parseClass(classObj);
  if (!parsed) return null;

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
  advancement.push(...(opts.futureGrants ?? []));
  advancement.push(...(opts.choiceTraits ?? []));
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

/** Bloco primaryAbility a partir do campo do 5etools. */
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

const NON_ITEM_FEATURES = new Set(['ability score improvement', 'epic boon']);

/** A feature é só um catálogo de optional features? */
function isOptionCatalog(feature) {
  return (feature?.entries ?? []).some(
    (e) =>
      e?.type === 'options'
      && (e.entries ?? []).length > 0
      && (e.entries ?? []).every((o) => o?.type === 'refOptionalfeature'),
  );
}

/** Features da classe até o nível, dedupadas por nome. */
export function resolveClassFeatures(db, classId, classObj, level) {
  const pool = db?.[`class-${classId}`]?.classFeature ?? [];
  const idx = new Map();
  for (const f of pool) idx.set(`${norm(f.name)}|${f.level}`, f);

  const out = [];
  const seen = new Map();
  for (const ref of classObj?.classFeatures ?? []) {
    const r = parseFeatureRef(ref);
    if (r.level > level) continue;
    if (r.gainsSubclass) continue;
    if (NON_ITEM_FEATURES.has(norm(r.name))) continue;
    const f = idx.get(`${norm(r.name)}|${r.level}`);
    if (!f || isOptionCatalog(f)) continue;

    const nth = (seen.get(norm(r.name)) ?? 0) + 1;
    seen.set(norm(r.name), nth);
    const entry = { level: f.level, source: f.source ?? classObj.source, entries: f.entries ?? [], classId };
    if (nth === 1) {
      out.push({ name: f.name, ...entry });
      continue;
    }
    // ATENÇÃO: só emite se o dnd5e publica o documento numerado, e com o nome dele.
    const numbered = `${f.name} (${nth})`;
    if (classFeatureUuid(classId, numbered)) out.push({ name: numbered, ...entry });
  }
  return out;
}

/**
 * Item de uma feature de classe, com effects, uses e activities.
 * @param {{name:string, level:number, source:string, entries:Array, classId?:string, subclass?:{shortName:string}, overlayName?:string}} feature
 * @param {object} [db]
 * @returns {object}
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
      transfer: false,
      statuses: targetEffect.statuses,
      img: 'icons/svg/aura.svg',
      origin: '',
      duration: { seconds: targetEffect.seconds },
      description: '',
      flags: {},
    });
  }
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
  const srd = Object.keys(curatedActivities).length ? null : srdFeatureMechanics(feature.name, feature.classId);
  const activities = Object.keys(curatedActivities).length
    ? curatedActivities
    : (srd?.activities ?? overlay.activities);
  // ATENÇÃO: SRD e overlay são tudo-ou-nada; somá-los aplica o efeito em dobro.
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
      uses: firstUses(curatedUses, overlay.system.uses, proseUses(feature.name, feature.classId, activities)),
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
 * Itens de feature da classe até o nível do personagem.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]}
 */
export function buildClassFeatureItems(classEntry, classObj, db) {
  const classId = norm(classObj?.name);
  return resolveClassFeatures(db, classId, classObj, classEntry.level || 1).map((f) => buildFeatureItem(f, db));
}

/**
 * Itens de inventário concedidos pela classe (o Unarmed Strike).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @returns {object[]}
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

export const TRAIT_CHOICE_KINDS = new Set(['skill', 'expertise', 'tool', 'language', 'resist']);

/** Título do Trait de um descritor: o nome da feature. */
export function choiceTraitTitle(desc) {
  return desc.foundryTitle ?? desc.feature?.name ?? desc.label ?? '';
}

/** `configuration` (mode e pool) do Trait de uma escolha. */
function traitChoiceConfig(desc, db) {
  switch (desc.kind) {
    case 'expertise':
      return { mode: 'expertise', pool: ['skills:*'] };
    case 'skill':
      return { mode: 'default', pool: desc.from?.length ? desc.from.map((c) => `skills:${c}`) : ['skills:*'] };
    case 'language':
      return { mode: 'default', pool: ['languages:standard:*', 'languages:exotic:*'] };
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

/** Picks do bag como chaves de trait do Foundry. */
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
 * Traits de escolha de um conjunto de descritores.
 * @param {import('./choices').Choice[]} descriptors
 * @param {object} bag
 * @param {object} db
 * @returns {object[]}
 */
export function buildChoiceTraits(descriptors, bag, db) {
  const out = [];
  for (const desc of descriptors ?? []) {
    if (!TRAIT_CHOICE_KINDS.has(desc.kind)) continue;
    const cfg = traitChoiceConfig(desc, db);
    if (!cfg?.pool?.length) continue;
    const picks = bag?.[desc.id]?.picks ?? [];
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

/** Idiomas concedidos pelo grant curado daquele nível. */
function grantedLanguagesFor(classId, level) {
  return classGrantGroups(classId, level).filter((g) => g.level === level).flatMap((g) => g.languages ?? []);
}

/**
 * Traits de escolha da classe em todos os níveis.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]}
 */
export function buildClassChoiceTraits(classEntry, classObj, db) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  const descriptors = classLevelChoices(parsed, classObj, MAX_LEVEL);
  if (classEntry.isOriginalClass !== false) {
    descriptors.push(...classToolChoices(classObj).map((d) => ({ ...d, foundryTitle: 'Tool Proficiencies' })));
  }
  descriptors.push(...classGrantChoices(classEntry.classId, MAX_LEVEL).map((d) => ({
    ...d,
    fixedGrants: grantedLanguagesFor(classEntry.classId, d.level),
  })));
  return buildChoiceTraits(descriptors, classEntry.choices, db);
}

/**
 * Traits de escolha da subclasse (picks no bag da classe, com `sub:`).
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
 * Escada de ItemGrant dos níveis acima do atual.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object} db
 * @returns {object[]}
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
    ...spellGrantLadder(curatedAdditionalSpells(classObj), 'Class Features', null, level + 1),
  ];
}

/** Escada das re-listagens que o dnd5e publica como "<Nome> (2)". */
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
 * Item de um talento escolhido, com o ASI fixo e a flag das sub-escolhas.
 * @param {object} featData
 * @param {{ level?: number|null, subtype?: string, choices?: object, db?: object }} [opts]
 * @returns {object|null}
 */
export function buildFeatItem(featData, { level = null, subtype, choices = null, db = null } = {}) {
  if (!featData) return null;
  const st = subtype ?? FEAT_CATEGORY_SUBTYPE[featData.category] ?? '';

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
      uses: firstUses(featOverlay.system.uses, proseUses(featData.name, null, featOverlay.activities)),
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
 * Itens dos talentos da classe e o valor dos ASIs por nível.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {{ items: object[], asiByLevel: Record<number, object>, fightingStyles: {itemId: string, level: number}[] }}
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
    const ownSlot = /^feat@\d+$/.test(choiceId);
    for (const pick of entry.picks) {
      const featData = findFeat(db, pick);
      if (!featData) continue;
      if (norm(featData.name) === ASI_FEAT_NAME) {
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
 * Escada de ItemChoice das escolhas de feature (sem `_id`).
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object|null} subObj
 * @param {object} db
 * @param {object[]} optionItems
 * @param {{ scope?: 'class'|'subclass' }} [opts]
 * @returns {object[]}
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

  if (scope === 'subclass') {
    for (const ch of subclassFeatureChoices(db, classId, subObj, MAX_LEVEL, parseClass(classObj)?.skillChoice?.from ?? [])) {
      if (ch.kind !== 'feat') continue;
      const cats = [ch.pool?.category].flat().filter(Boolean);
      const list = latestOnly(db?.feats?.feat ?? []).filter((f) => cats.includes(f.category));
      const picked = (classEntry.choices?.[ch.id]?.picks ?? []).map((p) => String(p).split('|')[0]);
      const subtype = cats.includes('FS') ? 'fightingStyle' : '';
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

/** Progressão de optional feature de um conjunto de featureTypes. */
function progressionOf(classObj, subObj, types) {
  const all = [...(classObj?.optionalfeatureProgression ?? []), ...(subObj?.optionalfeatureProgression ?? [])];
  const match = all.find((ofp) => (ofp.featureType ?? []).some((t) => types.includes(t)));
  return match?.progression ?? null;
}

/**
 * Itens "<Feature>: <Opção>" das escolhas de featureoption.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} classObj
 * @param {object|null} subObj
 * @param {object} db
 * @returns {object[]}
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
 * Itens das optional features escolhidas.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {object[]}
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

/** Chave `weapon:<cat>:<slug>` de um pick de Weapon Mastery. */
function weaponTraitKey(db, pick) {
  const name = String(pick).split('|')[0];
  const item = (db?.['items-base']?.baseitem ?? []).find((b) => norm(b.name) === norm(name));
  const cat = { simple: 'sim', martial: 'mar' }[norm(item?.weaponCategory)];
  return cat ? `weapon:${cat}:${norm(name).replace(/\s+/g, '')}` : null;
}

/**
 * Valores escolhidos dos Traits da classe, por título.
 * @param {import('../schema/character').ClassEntry} classEntry
 * @param {object} db
 * @returns {Record<string, string[]>}
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
 * Item do talento de origem.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object|null}
 */
export function buildOriginFeatItem(character, db) {
  const of = character?.origin?.originFeat;
  if (!of?.id) return null;
  const featData = findFeat(db, `${of.id}|${of.source}`);
  return featData ? buildFeatItem(featData, { level: 1, subtype: 'origin', choices: of.choices ?? null, db }) : null;
}

const TOOL_TYPE_TO_TRAIT_CAT = { AT: 'art', GS: 'game', INS: 'music' };

/** Chave de trait de ferramenta ("Dice Set" vira "tool:game:dice"). */
export function toolTraitKey(db, name) {
  const id = toolId(name);
  const item = (db?.['items-base']?.baseitem ?? []).find((b) => norm(b.name) === norm(name));
  const cat = TOOL_TYPE_TO_TRAIT_CAT[String(item?.type ?? '').split('|')[0]];
  return cat ? `tool:${cat}:${id}` : `tool:${id}`;
}

/**
 * O nome é um idioma real do compêndio?
 * @param {object|null} db
 * @param {string} name
 * @returns {boolean}
 */
export function isKnownLanguage(db, name) {
  return (db?.languages?.language ?? []).some((l) => norm(l.name) === norm(name));
}

/** Chave de trait de idioma ("Common" vira "languages:standard:common"). */
export function languageTraitKey(db, name) {
  const entry = (db?.languages?.language ?? []).find((l) => norm(l.name) === norm(name));
  const type = norm(entry?.type) === 'exotic' || norm(entry?.type) === 'rare' ? 'exotic' : 'standard';
  return `languages:${type}:${languageCode(name)}`;
}

/**
 * Item de background: ASI de origem, Traits e o grant do talento.
 * @param {import('../schema/character').Character} character
 * @param {object} [originFeatItem]
 * @param {object} [db]
 * @returns {object|null}
 */
export function buildBackgroundItem(character, originFeatItem = null, db = null) {
  const origin = character?.origin;
  if (!origin) return null;
  const advancement = [];

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

  const skills = [...new Set([...(origin.skillProficiencies ?? []), ...collectChoicePicks(origin.choices, 'skill')])];
  if (skills.length) advancement.push(traitAdv('Skill Proficiencies', skills.map((s) => `skills:${s}`)));

  const tools = [...new Set([...(origin.toolProficiencies ?? []), ...collectChoicePicks(origin.choices, 'tool')])];
  if (tools.length) advancement.push(traitAdv('Tool Proficiencies', tools.map((t) => toolTraitKey(db, t))));
  const languages = [...new Set([...(origin.languages ?? []), ...collectChoicePicks(origin.choices, 'language')])];
  if (languages.length) advancement.push(traitAdv('Languages', languages.map((l) => languageTraitKey(db, l))));

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

/** Features de subclasse do pool cru, numa faixa de níveis. */
export function resolveSubclassFeatures(subclass, classId, db, { min = 1, max } = {}) {
  if (!subclass) return [];
  const short = norm(subclass.shortName);
  const src = norm(subclass.source);
  const umbrella = new Set([short, norm(subclass.name)]);
  const seen = new Set();
  const out = [];
  for (const f of db?.[`class-${classId}`]?.subclassFeature ?? []) {
    if (norm(f.subclassShortName) !== short) continue;
    // ATENÇÃO: o pool mistura PHB e XPHB; sem este filtro as features duplicam.
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

/**
 * Itens de feature da subclasse até o nível.
 * @param {object} subclass
 * @param {string} classId
 * @param {object} db
 * @param {number} level
 * @returns {object[]}
 */
export function buildSubclassFeatureItems(subclass, classId, db, level) {
  return resolveSubclassFeatures(subclass, classId, db, { max: level }).map((f) => buildFeatureItem(
    { ...f, classId, subclass: { shortName: subclass.shortName, name: subclass.name } },
    db,
  ));
}

/**
 * Escada futura da subclasse: features e magias.
 * @param {object} subclass
 * @param {string} classId
 * @param {object} db
 * @param {number} level
 * @returns {object[]}
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
 * Escada de ItemGrant das magias concedidas, do nível 1 ao 20.
 * @param {object[]|null} additional
 * @param {string} title
 * @param {Map<string,string>|null} spellIds
 * @param {number} [from]
 * @returns {object[]}
 */
function spellGrantLadder(additional, title, spellIds, from = 1, bag = null) {
  if (!additional) return [];
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
  return futureItemGrants(entries, title, { ability: [], uses: { max: '', per: '', requireSlot: false }, prepared: 2 });
}

/** Bloco `movement` a partir do speed do 5etools. */
function movementBlock(speed) {
  const s = typeof speed === 'number' ? { walk: speed } : (speed ?? {});
  const out = { walk: String(s.walk ?? 30), units: null, hover: false, ignoredDifficultTerrain: [] };
  for (const k of ['fly', 'swim', 'climb', 'burrow']) if (s[k]) out[k] = String(s[k] === true ? out.walk : s[k]);
  return out;
}

const NATIVE_TRAIT_NAMES = new Set(['darkvision', 'creature type', 'size', 'speed']);

/** Nível em que o traço é ganho, lido na prosa (0 se não houver). */
function traitLevel(entry) {
  const first = (entry?.entries ?? []).find((e) => typeof e === 'string') ?? '';
  const m = first.match(/^(?:when you reach|starting at) (?:character )?level (\d+)/i);
  return m ? Number(m[1]) : 0;
}

/**
 * Entries de traço que viram item próprio.
 * @param {object} raceObj
 * @returns {object[]}
 */
export function speciesTraitEntries(raceObj) {
  const published = !!srdSpeciesName(raceObj);
  const out = [];
  for (const e of raceObj?.entries ?? []) {
    if (!e?.name || NATIVE_TRAIT_NAMES.has(norm(e.name)) || LEGACY_PROSE_SECTIONS.has(e.name)) continue;
    if (published && !srdOriginName(e.name)) continue;
    out.push(e);
    const boon = nestedBoonEntry(e);
    if (boon) out.push({ ...boon, _boon: true });
  }
  return out;
}

/**
 * O benefício nomeado dentro de um traço guarda-chuva, ou null.
 * @param {object} entry
 * @returns {object|null}
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
 * Uuids dos benefícios entre os quais a ancestralidade escolhe.
 * @param {object} db
 * @param {object} raceObj
 * @returns {string[]}
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
    const uuids = named.map((n) => originUuid(srdOriginName(n) ?? n)).filter(Boolean);
    if (uuids.length >= 2) return [...new Set(uuids)];
  }
  return [];
}

/** Nome do traço no export: o do dnd5e, senão o do 5etools. */
const traitName = (entry) => srdOriginName(entry?.name) ?? entry?.name;

/** Rótulo da linhagem para os títulos ("High Elf Traits"). */
function lineageLabel(raceObj) {
  const base = raceObj?._baseName ?? raceObj?.name ?? '';
  for (const e of raceObj?.entries ?? []) {
    const paren = e?.name?.match(/\(([^)]+)\)\s*$/)?.[1];
    if (paren) return paren;
  }
  return base;
}

/** `system.identifier` do item de raça: o nome BASE. */
const speciesIdentifier = (raceObj) => slugify(raceObj?._baseName ?? raceObj?.name ?? '');

/** Reescreve as referências `@scale` para o identificador exportado. */
function retargetScaleRefs(value, identifier) {
  if (typeof value === 'string') return value.replace(/@scale\.[\w-]+\./g, `@scale.${identifier}.`);
  if (Array.isArray(value)) return value.map((v) => retargetScaleRefs(v, identifier));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, retargetScaleRefs(v, identifier)]));
  }
  return value;
}

/**
 * Um item de feature por traço de espécie.
 * @param {object} raceObj
 * @param {object} db
 * @param {number} [level]
 * @returns {object[]}
 */
export function buildSpeciesTraitItems(raceObj, db, level = MAX_LEVEL) {
  const mechanics = new Map(overlayRaceTraits(db, raceObj).map((t) => [norm(t.name), t]));
  return speciesTraitEntries(raceObj).filter((e) => traitLevel(e) <= level).map((entry) => {
    const m = mechanics.get(norm(entry.name));
    const name = traitName(entry);
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
        uses: firstUses(
          featureUses(name), featureUses(entry.name), m?.system?.uses,
          proseUses(name, null, srd?.activities ?? m?.activities), proseUses(entry.name, null, srd?.activities ?? m?.activities),
        ),
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

/**
 * Itens dos talentos escolhidos pela espécie.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object[]}
 */
export function buildSpeciesFeatItems(character, db) {
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
 * Active Effects do item de raça (overlay e armadura natural).
 * @param {object} db
 * @param {object} raceObj
 * @returns {object[]}
 */
function speciesEffects(db, raceObj) {
  const nat = naturalArmorFor(raceObj);
  const itemized = new Set(speciesTraitEntries(raceObj).map((e) => norm(e.name)));
  const overlay = overlayRaceEffects(db, raceObj, itemized);
  if (!nat) return overlay;
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

/**
 * Item de espécie, com movimento, sentidos, advancement e flag.
 * @param {import('../schema/character').Character} character
 * @param {object} raceObj
 * @param {object} [db]
 * @param {object[]} [featItems]
 * @returns {object|null}
 */
export function buildSpeciesItem(character, raceObj, db = null, featItems = [], traitItems = [], spellIds = null) {
  if (!raceObj) return null;
  const level = (character?.classes ?? []).reduce((sum, c) => sum + (c.level || 0), 0) || 1;
  const sizeCode = foundrySize(
    effectiveSizeCodes(raceObj, { chosen: sizePick(character?.species?.choices), level }),
  );
  const ctypeRaw = raceObj.creatureTypes?.[0];
  const ctype = typeof ctypeRaw === 'string' ? ctypeRaw : 'humanoid';
  const baseName = raceObj._baseName ?? raceObj.name;

  const advancement = [
    { _id: randomFoundryId(), type: 'Size', configuration: { sizes: [sizeCode] }, level: 0, title: '', hint: '', value: { size: sizeCode }, flags: {} },
    ...overlayRaceAdvancement(db, raceObj).map((a) => ({ _id: randomFoundryId(), level: 0, hint: '', value: {}, flags: {}, ...a })),
  ];

  const resists = (raceObj.resist ?? []).filter((r) => typeof r === 'string');
  if (resists.length) advancement.push(traitAdv('Damage Resistance', resists.map((r) => `dr:${norm(r)}`)));

  const speciesChoices = character?.species?.choices;

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

  const skills = shallowPicks(speciesChoices, 'skill');
  if (skills.length) advancement.push(traitAdv('Skill Proficiencies', skills.map((s) => `skills:${s}`)));
  const tools = shallowPicks(speciesChoices, 'tool');
  if (tools.length) advancement.push(traitAdv('Tool Proficiencies', tools.map((t) => toolTraitKey(db, t))));
  const languages = shallowPicks(speciesChoices, 'language');
  const knownLanguages = languages.filter((l) => isKnownLanguage(db, l));
  if (knownLanguages.length) advancement.push(traitAdv('Languages', knownLanguages.map((l) => languageTraitKey(db, l))));

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
  const traitsTitle = `${baseName} Traits`;
  const isBoon = (i) => !!i.flags?.builder5e?.boon;
  const plainTraits = traitItems.filter((i) => !isBoon(i));
  const boonItems = traitItems.filter(isBoon);
  if (plainTraits.length) advancement.push(...itemGrantAdvancements(plainTraits, traitsTitle));
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
  advancement.push(
    ...spellGrantLadder(curatedAdditionalSpells(raceObj), `${lineageLabel(raceObj)} Traits`, spellIds, 1, speciesChoices),
  );

  const residual = {};
  const RESIDUAL_SPECIES_KINDS = ['spellAbility', 'size', 'mixed', 'resist', 'immune', 'vulnerable', 'spell', 'spellSet'];
  for (const [id, entry] of Object.entries(speciesChoices ?? {})) {
    if (!entry || typeof entry !== 'object') continue;
    if ((entry.picks?.length ?? 0) === 0) continue;
    const unmappedLanguage = entry.kind === 'language' && entry.picks.some((p) => !isKnownLanguage(db, p));
    if (!RESIDUAL_SPECIES_KINDS.includes(entry.kind) && !unmappedLanguage) continue;
    residual[id] = entry;
  }

  const srdName = srdSpeciesName(raceObj);
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
    effects: speciesEffects(db, raceObj),
    flags: Object.keys(flags).length ? { builder5e: flags } : {},
    _stats: itemStats(originUuid(srdName ?? raceObj?.name)),
  };
}

/**
 * Item de subclasse, com o ItemGrant das features.
 * @param {object} subclass
 * @param {string} classId
 * @param {object[]} [featureItems]
 * @param {{ description?: string, futureGrants?: object[] }} [opts]
 * @returns {object|null}
 */
export function buildSubclassItem(subclass, classId, featureItems = [], opts = {}) {
  if (!subclass) return null;
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
        ...overlaySubclassAdvancement(opts.db, {
          className: classId, shortName: subclass.shortName, source: subclass.source,
        }).map((a) => ({ _id: randomFoundryId(), value: {}, ...a })),
        ...(opts.itemChoices ?? []).map((a) => ({ _id: randomFoundryId(), value: {}, ...a })),
      ]),
      source: sourceBlock(subclass.source),
    },
    effects: [],
    flags: {},
    _stats: itemStats(subclassUuid(classId, subclass)),
  };
}

const GROUP_FOUNDRY = {
  weapon: { type: 'weapon' },
  armor: { type: 'equipment' },
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

const WEAPON_PROP_CODE = {
  A: 'amm', AF: 'amm', F: 'fin', H: 'hvy', L: 'lgt', LD: 'lod',
  R: 'rch', RLD: 'rel', S: 'spc', T: 'thr', V: 'ver', '2H': 'two',
};

const DMG_TYPE_WORD = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning',
  N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

const FOUNDRY_RARITY = {
  common: 'common', uncommon: 'uncommon', rare: 'rare',
  'very rare': 'veryRare', legendary: 'legendary', artifact: 'artifact',
};

const ARMOR_DEX = { light: null, medium: 2, heavy: 0, shield: null };

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

/** Preço em cobre como { value, denomination }. */
function foundryPrice(copper) {
  if (copper == null) return { value: 0, denomination: 'gp' };
  if (copper % 100 === 0) return { value: copper / 100, denomination: 'gp' };
  if (copper % 10 === 0) return { value: copper / 10, denomination: 'sp' };
  return { value: copper, denomination: 'cp' };
}

function foundryRarity(rarity) {
  return FOUNDRY_RARITY[rarity] ?? '';
}

/** "1d8" vira { number, denomination }, ou null. */
function parseDie(s) {
  const m = /^(\d+)d(\d+)$/.exec(String(s ?? ''));
  return m ? { number: Number(m[1]), denomination: Number(m[2]) } : null;
}

/** "80/320" vira { value, long, units, reach }. */
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

/** Entries de lore do item. */
function itemFluffEntries(db, raw) {
  const f = (db?.['fluff-items']?.itemFluff ?? []).find((x) => x.name === raw.name && x.source === raw.source);
  return f?.entries ?? null;
}

function inventoryImg(entry, group) {
  if (entry.customImg) return entry.customImg;
  return GROUP_ICON[group] ?? 'icons/svg/item-bag.svg';
}

/** "+1" ou 1 vira número (0 se vazio). */
function bonusNum(s) {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Activity de ataque de uma arma. */
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

const ITEM_DAMAGE_TRAIT_KEY = {
  resist: 'system.traits.dr.value',
  immune: 'system.traits.di.value',
  vulnerable: 'system.traits.dv.value',
};

/** Active Effect dos bônus planos e traços de dano do item. */
function itemBonusEffect(name, img, raw) {
  const changes = [];
  if (bonusNum(raw?.bonusAc)) {
    changes.push({ key: 'system.attributes.ac.bonus', mode: 2, value: String(raw.bonusAc), priority: null });
  }
  if (bonusNum(raw?.bonusSavingThrow)) {
    changes.push({ key: 'system.bonuses.abilities.save', mode: 2, value: String(raw.bonusSavingThrow), priority: null });
  }
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

/** Item custom de volta ao formato do Foundry. */
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
 * Itens de inventário do personagem.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @returns {object[]}
 */
export function buildInventoryItems(character, db) {
  const out = [];
  const itemIdByUid = new Map();
  for (const entry of character?.inventory ?? []) {
    const raw = resolveItemObj(db, entry.itemId, entry.source);
    if (!raw && entry.custom) {
      out.push(customToFoundryItem(entry));
      continue;
    }
    const info = raw
      ? itemTypeInfo(raw)
      : { group: 'other', groupLabel: 'Other', armorSlot: null, category: null, kind: null };
    const map = GROUP_FOUNDRY[info.group] ?? GROUP_FOUNDRY.other;
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
      const magic = bonusNum(raw?.bonusWeapon);
      if (magic) system.magicalBonus = String(magic);
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
      const props = containerProps(raw?.name ?? entry.itemId);
      system.capacity = props?.capacity?.type === 'weight'
        ? { weight: { value: props.capacity.value, units: 'lb' }, volume: { units: 'cubicFoot' } }
        : { weight: { value: null, units: 'lb' }, volume: { units: 'cubicFoot' } };
      if (props?.capacity?.type === 'items') system.capacity.count = props.capacity.value;
      if (props?.weightless) system.properties = ['weightlessContents'];
      system.currency = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
      system.identifier = slugify(raw?.name ?? entry.itemId);
      system.equipped = !!entry.equipped;
    } else {
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
    const unpacked = unpackContainer(item, raw, db);
    if (unpacked) out.push(...unpacked);
    else out.push(item);
    if (entry.uid) itemIdByUid.set(entry.uid, (unpacked ? unpacked[0] : item)._id);
  }

  for (const entry of character?.inventory ?? []) {
    if (!entry.container || !entry.uid) continue;
    const childId = itemIdByUid.get(entry.uid);
    const parentId = itemIdByUid.get(entry.container);
    if (!childId || !parentId) continue;
    const child = out.find((i) => i._id === childId);
    if (child) child.system.container = parentId;
  }
  return out;
}

/**
 * Desdobra um pack em contêiner e conteúdo, ou null.
 * @param {object} item
 * @param {object|null} raw
 * @param {object} db
 * @returns {object[]|null}
 */
function unpackContainer(item, raw, db) {
  const contents = raw?.packContents;
  if (!Array.isArray(contents) || contents.length === 0) return null;

  const resolved = [];
  for (const c of contents) {
    const uid = typeof c === 'string' ? c : c?.item;
    if (!uid) continue;
    const [cName, cSource] = String(uid).split('|');
    // ATENÇÃO: o packContents traz a fonte em minúsculas; sem o upper nada resolve.
    const obj = resolveItemObj(db, cName, (cSource ?? '').toUpperCase());
    if (obj) resolved.push({ obj, quantity: (typeof c === 'object' ? c.quantity : 1) ?? 1 });
  }
  if (!resolved.length) return null;

  const bagIndex = resolved.findIndex((r) => equipmentFoundryType(r.obj.name)?.type === 'container');
  const bag = bagIndex >= 0 ? resolved[bagIndex] : null;
  const inside = resolved.filter((_, i) => i !== bagIndex);

  const container = {
    ...item,
    type: 'container',
    system: {
      ...item.system,
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
    child.system.container = container._id;
    child.system.price = foundryPrice(0);
    return child;
  }).filter(Boolean);

  return [container, ...children];
}
