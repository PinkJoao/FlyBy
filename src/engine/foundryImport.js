// =============================================================================
// foundryImport - ATOR do Foundry (dnd5e) → personagem do builder (DECISÕES)
// =============================================================================
// O caminho INVERSO do foundryExport/foundryActor. Como o builder guarda DECISÕES
// (não estado computado), reconstruímos as escolhas a partir dos itens e dos
// valores APLICADOS dos advancements do ator:
//   race item        → species (id/lineage)
//   background item  → origin (ability boosts, perícias, talento de origem)
//   class item(s)    → classes[] (classId, level, subclasse, HP, choice-bag)
//   abilities.value  → scores BASE (final − todos os boosts reconstruídos)
//
// É o ÚNICO formato de import do app (DDL-0005): serve tanto p/ reimportar os
// nossos próprios exports quanto p/ carregar os premades do dnd5e (comparação/teste).
// Puro: recebe o ator + o `db` (compêndio) e devolve um Character; sem rede/DOM.
// -----------------------------------------------------------------------------

import { createCharacter, makeId, ABILITIES } from '../schema/character';
import { toolId, languageCode } from './foundryExport';
import { raceLineages } from './speciesData';
import { latestOnly } from '../selector/reprints';
import { specificVariants } from './magicVariants';
import { resolveClassObj, resolveSubclassObj, resolveRaceObj } from './resolve';
import { featureOptionChoices, subclassFeatureOptionChoices } from './featureOptions';
import { optionalFeatureChoices } from './classFeatureChoices';
import { parseChoices, collectAbilityPicks } from './choices';
import { deriveHpBonus } from './hpBonuses';

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/** É um ator do Foundry (e não um personagem do builder)? */
export function isFoundryActor(raw) {
  return !!raw && typeof raw === 'object' && raw.type === 'character' && !!raw.system && Array.isArray(raw.items);
}

/**
 * Normaliza a preparação de um Item `spell` nas DUAS formas do dnd5e: a atual
 * (`system.method` + `system.prepared` 0/1/2) e a depreciada, que os exports
 * antigos do Plutonium ainda usam (`system.preparation: {mode, prepared}`).
 * @returns {{ method: string, prepared: number }}
 */
export function spellPreparation(item) {
  const sys = item?.system ?? {};
  if (typeof sys.method === 'string' && sys.method) {
    return { method: sys.method, prepared: Number(sys.prepared ?? 0) };
  }
  const mode = sys.preparation?.mode ?? '';
  if (mode === 'always') return { method: 'spell', prepared: 2 };
  if (mode === 'prepared') return { method: 'spell', prepared: sys.preparation?.prepared ? 1 : 0 };
  return { method: mode, prepared: sys.preparation?.prepared ? 1 : 0 };
}

/** Identificador da classe dona da magia ("class:warlock" → "warlock"), ou null. */
export function spellSourceClass(item) {
  const src = item?.system?.sourceItem ?? item?.system?.sourceClass ?? '';
  if (typeof src !== 'string' || !src) return null;
  return norm(src.startsWith('class:') ? src.slice('class:'.length) : src);
}

/**
 * A magia é uma ESCOLHA do jogador (vai para `ClassEntry.spells`) ou uma
 * concessão derivável da raça/subclasse/talento (que NÃO se armazena)?
 *
 * - `prepared: 2` = sempre preparada → concedida.
 * - `prepared: 0` numa magia de círculo = está na lista mas NÃO preparada → não
 *   é uma preparação do jogador e não deve contar contra o limite. (Cantrips
 *   ficam: são sempre "preparados", e às vezes vêm com `prepared: 0`/`1`.)
 * - `innate`/`ritual` = conjuração grátis concedida por um traço.
 * - `atwill` é ambíguo: é o que o premade oficial usa para o **Mystic Arcanum**
 *   (com `uses` 1/descanso longo) e também para magias raciais à vontade. Só o
 *   primeiro é uma escolha, e ele se distingue por ter `uses.max`.
 */
export function isPlayerChosenSpell(item) {
  const { method, prepared } = spellPreparation(item);
  if (prepared === 2) return false;
  if (method === 'innate' || method === 'ritual') return false;
  if (method === 'atwill') return !!item?.system?.uses?.max; // arcanum
  if (method !== 'spell' && method !== 'pact' && method !== '') return false;
  const level = Number(item?.system?.level ?? 0);
  if (level > 0 && prepared === 0) return false; // círculo conhecido, não preparado
  return true;
}

/**
 * Magias escolhidas pelo jogador, agrupadas por identificador de classe. Uma
 * magia sem `sourceItem` (exports antigos) cai na chave `null` e o chamador a
 * atribui à classe original.
 * @param {object[]} items
 * @returns {Map<string|null, Array<{id: string, source: string}>>}
 */
export function importSpellsByClass(items) {
  const out = new Map();
  for (const item of items) {
    if (item.type !== 'spell' || !isPlayerChosenSpell(item)) continue;
    const key = spellSourceClass(item);
    const list = out.get(key) ?? [];
    list.push({ id: item.name, source: itemSource(item) });
    out.set(key, list);
  }
  return out;
}

/**
 * `subclassId` do builder é o **shortName** do 5etools ("Archfey"), enquanto o
 * Item do Foundry carrega o nome completo ("Archfey Patron"). Sem traduzir, o
 * `resolveSubclassObj` não encontra a subclasse no reimport e todas as magias e
 * features concedidas por ela somem. Coincidem em poucos casos (Champion), o que
 * mascarava o problema.
 * @returns {string} shortName quando o db permite resolvê-lo; senão o nome cru.
 */
function subclassShortName(db, classId, subclassItem) {
  const name = subclassItem?.name;
  if (!name) return name;
  const list = db?.[`class-${classId}`]?.subclass;
  if (!Array.isArray(list)) return name;
  const hit =
    list.find((s) => norm(s.name) === norm(name)) ??
    list.find((s) => norm(s.shortName) === norm(name));
  return hit?.shortName ?? name;
}

/** HTML do Foundry → texto simples (parágrafos viram linhas em branco). */
export function htmlToText(html) {
  if (typeof html !== 'string' || !html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/** Alinhamento do Foundry (texto livre) → o código do builder. */
export function alignmentCode(text) {
  const n = (text ?? '').trim().toLowerCase();
  if (!n) return '';
  const hit = Object.entries({
    LG: 'lawful good', NG: 'neutral good', CG: 'chaotic good',
    LN: 'lawful neutral', N: 'true neutral', CN: 'chaotic neutral',
    LE: 'lawful evil', NE: 'neutral evil', CE: 'chaotic evil',
  }).find(([, label]) => label === n);
  if (hit) return hit[0];
  return n === 'neutral' ? 'N' : '';
}

/** Lista os advancements de um item (o Foundry guarda como objeto indexado por _id). */
function advList(item) {
  const adv = item?.system?.advancement;
  return adv ? Object.values(adv) : [];
}

/** Fonte (livro) de um item. */
function itemSource(item) {
  return item?.system?.source?.book ?? '';
}

/** Tipos de Item físico do Foundry que viram entradas de inventário do builder. */
const PHYSICAL_ITEM_TYPES = new Set(['weapon', 'equipment', 'tool', 'consumable', 'loot']);

/** Snapshot dos dados do próprio Item do Foundry, p/ um item que NÃO existe no
 * catálogo 5etools (componente de magia, homebrew, scroll nomeado). Guarda só o
 * essencial p/ exibir (peso/tipo/raridade/descrição) e reverter no export. */
function customSnapshot(item) {
  const sys = item?.system ?? {};
  return {
    fType: item?.type ?? 'loot',
    typeValue: sys.type?.value ?? '',
    typeSubtype: sys.type?.subtype ?? '',
    weight: sys.weight?.value ?? 0,
    price: sys.price ?? { value: 0, denomination: 'gp' },
    rarity: sys.rarity ?? '',
    attunement: sys.attunement ?? '',
    description: sys.description?.value ?? '',
    img: item?.img ?? null,
  };
}

/** Fonte 5etools de um item de inventário pelo NOME (p/ re-resolver a arte/stats).
 * Usa `latestOnly` - a fonte tem de ser a da versão ATUAL (ex: XPHB, não a reprint
 * PHB clássica), senão `resolveItemObj` (que também filtra reprints) não a acha.
 * As variantes específicas GERADAS ("+1 Longsword") também contam como catálogo. */
function resolveInventorySource(db, name) {
  const n = norm(name);
  const base = latestOnly(db?.['items-base']?.baseitem ?? []).find((i) => norm(i.name) === n);
  if (base) return base.source;
  const it = latestOnly(db?.items?.item ?? []).find((i) => norm(i.name) === n);
  if (it) return it.source;
  const sv = specificVariants(db).find((i) => norm(i.name) === n);
  return sv?.source ?? null;
}

/** "Nome|Fonte" de um item (formato dos picks de talento/optional feature). Se o
 * item veio SEM fonte (Plutonium/homebrew), tenta re-resolver pelo nome no db -
 * senão o pick não re-resolveria num export posterior. */
function itemRef(item, db) {
  let source = itemSource(item);
  if (!source && db) {
    const feat = (db.feats?.feat ?? []).find((f) => norm(f.name) === norm(item.name));
    if (feat) source = feat.source;
  }
  return `${item.name}|${source}`;
}

/** Reverte uma chave de trait de FERRAMENTA ('tool:game:dice') no nome do 5etools
 * ('Dice Set'), casando o id contra o toolId de cada item. Varre items-base E
 * items.json: gaming sets e vários kits (Thieves' Tools, Disguise Kit…) vivem
 * SÓ no segundo (o mesmo achado do toolEntity - ver selector/entities/tool). */
function toolKeyToName(key, db) {
  const id = String(key).split(':').pop();
  const item =
    (db?.['items-base']?.baseitem ?? []).find((b) => toolId(b.name) === id) ??
    (db?.items?.item ?? []).find((b) => toolId(b.name) === id);
  return item?.name ?? null;
}

/** Reverte uma chave de trait de IDIOMA ('languages:standard:common') no nome do
 * 5etools ('Common'), casando o código contra o languageCode de cada idioma. */
function languageKeyToName(key, db) {
  const code = String(key).split(':').pop();
  const entry = (db?.languages?.language ?? []).find((l) => languageCode(l.name) === code);
  return entry?.name ?? null;
}

/** Acha a raça BASE no compêndio pelo nome (case-insensitive), preferindo a fonte dada. */
function findBaseRace(db, baseName, source) {
  const list = db?.races?.race;
  if (!Array.isArray(list)) return null;
  const matches = list.filter((r) => norm(r.name) === norm(baseName));
  if (!matches.length) return null;
  return (source && matches.find((r) => r.source === source)) || matches[matches.length - 1];
}

/** Reverte o nome de linhagem de um item de raça pro nome CANÔNICO do 5etools
 * ("Elf; High Elf Lineage"), que é o que `resolveRaceObj` casa via `v.name === lineage`.
 * Nosso próprio export já usa esse nome ao pé da letra, mas os premades OFICIAIS do
 * Foundry usam uma forma abreviada com vírgula ("Elf, High", "Gnome, Rock", "Tiefling,
 * Infernal") que não bate 1:1 - casa por PALAVRA-CHAVE (a parte após o separador)
 * contra os `_versions` reais da raça base. Sem casamento (raça sem versões
 * conhecidas, ou fonte não no compêndio) cai pro nome "Base; Resto" - nosso formato.
 */
function resolveLineageName(db, baseName, source, rawLineagePart) {
  const full = `${baseName}; ${rawLineagePart}`.trim();
  const base = findBaseRace(db, baseName, source);
  if (!base) return full;
  // Linhagens = `_versions` + sub-raças fundidas (Genasi Air, Stensia…).
  const versions = raceLineages(db, base);
  if (!versions.length) return full;
  if (versions.some((v) => v.name === full)) return full;
  const key = norm(rawLineagePart);
  const match = versions.find((v) => norm(v.name).includes(key));
  return match ? match.name : full;
}

/** Resolve o nome de um item de raça por CASAMENTO EXATO contra o compêndio:
 * primeiro os nomes de raça base (que podem legitimamente conter parênteses e
 * ponto-e-vírgula - "Human (Ixalan)", "Dragonborn (Gem)"), depois os nomes de
 * TODAS as `_versions` ("Dragonborn (Gem; Amethyst)", "Variant; Gifted
 * Aetherborn"). Sem isso, a heurística de separador quebrava esses nomes em
 * base+linhagem inventadas (TC-0008). */
function resolveRaceByExactName(db, name) {
  const list = db?.races?.race;
  if (!Array.isArray(list)) return null;
  const n = norm(name);
  const bases = list.filter((r) => norm(r.name) === n);
  if (bases.length) return { id: bases[bases.length - 1].name.toLowerCase(), lineage: null };
  for (const r of list) {
    // Linhagens = `_versions` + sub-raças fundidas ("Human (Innistrad; Stensia)").
    const v = raceLineages(db, r).find((v) => norm(v.name) === n);
    if (v) return { id: r.name.toLowerCase(), lineage: v.name };
  }
  return null;
}

/** Reconstrói species a partir do item de raça. Primeiro tenta o casamento
 * EXATO contra o compêndio (raças base + `_versions` - cobre nomes com
 * parênteses/;, TC-0008); só então cai na heurística de separador: o nome de
 * uma variante vem como "Base; Variante" (nosso export) ou "Base, Variante"/
 * "Base (Variante)" (Plutonium/premades) → id = nome da BASE em minúsculas
 * (casa com resolveRaceObj); lineage = nome CANÔNICO do 5etools, resolvido via
 * `resolveLineageName` (ver ali - a forma abreviada dos premades não bate 1:1
 * com o nome real da versão). Sem separador = raça base, sem lineage.
 * @param {object} raceItem
 * @param {object} [db]  compêndio (p/ resolver o nome canônico da linhagem)
 */
function parseSpecies(raceItem, db) {
  if (!raceItem) return null;
  const name = raceItem.name ?? '';
  const exact = resolveRaceByExactName(db, name);
  if (exact) {
    return { id: exact.id, source: itemSource(raceItem), lineage: exact.lineage, choices: {} };
  }
  const m = name.match(/^([^;,(]+)[;,(]/);
  const hasLineage = !!m;
  const baseName = (hasLineage ? m[1] : name).trim();
  let lineage = null;
  if (hasLineage) {
    let rest = name.slice(m[0].length).trim();
    if (rest.endsWith(')')) rest = rest.slice(0, -1).trim();
    lineage = resolveLineageName(db, baseName, itemSource(raceItem), rest);
  }
  return {
    id: baseName.toLowerCase(),
    source: itemSource(raceItem),
    lineage,
    choices: {},
  };
}

/** Boosts fixos de atributo embutidos num item de talento (advancement ASI fixed). */
function featFixedBoosts(featItem) {
  const out = [];
  for (const adv of advList(featItem)) {
    if (adv.type !== 'AbilityScoreImprovement') continue;
    const fixed = adv.configuration?.fixed ?? {};
    for (const ab of ABILITIES) if (fixed[ab]) out.push({ ability: ab, amount: fixed[ab] });
  }
  return out;
}

/** Item concedido por um ItemGrant (primeiro item da lista), resolvido pelo _id. */
function grantedItems(adv, byId) {
  return Object.keys(adv?.value?.added ?? {}).map((id) => byId.get(id)).filter(Boolean);
}

/** É um talento ESCOLHÍVEL de verdade (existe em `feats.feat`)? Filtra os itens
 * estruturais que um ItemGrant de espécie/raça também concede nos premades reais
 * (ex: Human "Resourceful"/"Skillful"/"Versatile" - traços inerentes, não talentos
 * de 5etools), que não devem virar um pick de feat no choice-bag. */
function isRealFeat(item, db) {
  return (db?.feats?.feat ?? []).some((f) => norm(f.name) === norm(item?.name));
}

/** Reverte uma chave de Weapon Mastery do Foundry ('weapon:mar:greatsword') no
 * pick do builder ('Greatsword'), buscando o nome no items-base. NOME PURO, sem
 * fonte - o formato canônico da UI (TagChoice guarda `raw.name`); o "Nome|Fonte"
 * antigo funcionava mas quebrava o dedup do seletor e sujava o chip (TC-0003). */
function weaponKeyToPick(key, db) {
  const slug = String(key).split(':').pop(); // 'greatsword'
  const base = (db?.['items-base']?.baseitem ?? []).find(
    (b) => norm(b.name).replace(/[^a-z0-9]+/g, '') === slug,
  );
  return base ? base.name : null;
}

/** Reconstrói o sub-bag de um talento de ASI CRU ("Ability Score Improvement"):
 * as assignments viram picks {ability, amount}; alt 0 = +2 em um, alt 1 = +1 em dois. */
function asiFeatSubBag(assignments, featRef) {
  const picks = [];
  for (const [ability, amount] of Object.entries(assignments ?? {})) {
    for (let i = 0; i < amount; i += 1) picks.push({ ability, amount: 1 });
  }
  // Se algum aumento é +2 num único atributo, a alternativa é "+2 em um" (alt 0).
  const plusTwo = Object.values(assignments ?? {}).some((v) => v >= 2);
  const merged = plusTwo
    ? Object.entries(assignments ?? {}).map(([ability, amount]) => ({ ability, amount }))
    : picks;
  return {
    [featRef]: { 'ability-0': { kind: 'ability', alt: plusTwo ? 0 : 1, picks: merged } },
  };
}

/** slug de um rótulo p/ casar com o `identifier` do Foundry ("Divine Order" +
 * "Protector" → "divine-order-protector"). */
function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Reconstrói as escolhas de "uma das seguintes sub-features" (Divine Order,
 * Blessed Strikes, Hunter's Prey…) que NÃO ficam no advancement da classe: o
 * engine gera as opções da classe/subclasse e casamos com os feats concedidos do
 * ator, que o Foundry nomeia "<Feature>: <Opção>" (identifier "<feature>-<opção>").
 * @returns {Record<string, {kind:'featureoption', picks:string[]}>}
 */
function featureOptionChoiceBag(db, classId, classObj, subclassObj, level, featItems) {
  const names = new Set(featItems.map((i) => norm(i.name)));
  const idents = new Set(featItems.map((i) => norm(i.system?.identifier ?? '')).filter(Boolean));
  const bag = {};
  const all = [
    ...featureOptionChoices(db, classId, classObj, level),
    ...subclassFeatureOptionChoices(db, classId, subclassObj, level),
  ];
  for (const ch of all) {
    const picks = [];
    for (const opt of ch.pool?.options ?? []) {
      if (names.has(norm(`${ch.label}: ${opt.label}`)) || idents.has(slug(`${ch.label} ${opt.label}`))) {
        picks.push(opt.value);
      }
    }
    if (picks.length) bag[ch.id] = { kind: 'featureoption', picks: picks.slice(0, ch.count ?? 1) };
  }
  return bag;
}

/**
 * Reconstrói UMA classe (choice-bag + HP + subclasse) a partir do item de classe.
 * Acumula os boosts de atributo (ASI/feats) em `boostAcc` p/ reverter os scores base.
 */
function parseClassEntry(classItem, subclassItem, actor, byId, db, boostAcc) {
  const classId = classItem.system?.identifier ?? norm(classItem.name);
  const level = classItem.system?.levels ?? 1;
  const choices = {};
  const hitPoints = {};

  for (const adv of advList(classItem)) {
    switch (adv.type) {
      case 'HitPoints':
        for (const [lvl, v] of Object.entries(adv.value ?? {})) {
          if (typeof v === 'number') hitPoints[lvl] = v; // só rolagens manuais; 'max'/'avg' = padrão
        }
        break;
      case 'Trait': {
        const chosen = adv.value?.chosen ?? [];
        if (/skill/i.test(adv.title ?? '') && !/saving/i.test(adv.title ?? '')) {
          const picks = chosen.filter((c) => c.startsWith('skills:')).map((c) => c.slice('skills:'.length));
          if (picks.length) choices.skill = { kind: 'skill', picks };
        } else if (/weapon mastery/i.test(adv.title ?? '')) {
          const picks = chosen.map((k) => weaponKeyToPick(k, db)).filter(Boolean);
          if (picks.length) choices.weaponMastery = { kind: 'weapon', picks };
        }
        break;
      }
      case 'AbilityScoreImprovement': {
        const val = adv.value ?? {};
        const key = `feat@${adv.level}`;
        if (val.type === 'feat') {
          const featItem = byId.get(Object.keys(val.feat ?? {})[0]);
          if (featItem) {
            // Sub-escolhas do talento: flag do item (TC-0002); os aumentos
            // ESCOLHIDOS lá dentro contam nos boosts reconstruídos.
            const bag = featItem.flags?.builder5e?.choices;
            const ref = itemRef(featItem);
            choices[key] = { kind: 'feat', picks: [ref], sub: bag ? { [ref]: bag } : {} };
            for (const b of featFixedBoosts(featItem)) boostAcc[b.ability] += b.amount;
            for (const b of collectAbilityPicks(bag ?? {})) boostAcc[b.ability] += b.amount;
          }
        } else if (val.type === 'asi' && val.assignments) {
          // ASI cru → o talento especial "Ability Score Improvement".
          const featRef = 'Ability Score Improvement|XPHB';
          choices[key] = { kind: 'feat', picks: [featRef], sub: asiFeatSubBag(val.assignments, featRef) };
          for (const [ab, amt] of Object.entries(val.assignments)) boostAcc[ab] += amt;
        }
        break;
      }
      case 'ItemChoice': {
        if (/fighting style/i.test(adv.title ?? '')) {
          for (const [lvl, m] of Object.entries(adv.value?.added ?? {})) {
            const featItem = byId.get(Object.keys(m ?? {})[0]);
            if (featItem) {
              const bag = featItem.flags?.builder5e?.choices;
              const ref = itemRef(featItem);
              choices[`feat@${lvl}`] = { kind: 'feat', picks: [ref], sub: bag ? { [ref]: bag } : {} };
              for (const b of collectAbilityPicks(bag ?? {})) boostAcc[b.ability] += b.amount;
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // Escolhas de "uma das seguintes" (Divine Order, Blessed Strikes…) - não estão
  // no advancement da classe, vêm como feats concedidos "<Feature>: <Opção>".
  const subShort = subclassItem ? subclassShortName(db, classId, subclassItem) : null;
  const classObj = resolveClassObj(db, classId, itemSource(classItem));
  const subclassObj = subShort ? resolveSubclassObj(db, classId, subShort, itemSource(subclassItem)) : null;
  const featItems = (actor.items ?? []).filter((i) => i.type === 'feat');
  Object.assign(choices, featureOptionChoiceBag(db, classId, classObj, subclassObj, level, featItems));

  // Escolhas SEM casa nativa no Foundry (tool@start/expertise/grants curados/
  // optional features/grants `sub:` de subclasse) voltam da flag do item de
  // classe (DDL-0028; TC-0004/0005/0006). A flag vence: são as decisões exatas.
  const classFlag = classItem.flags?.builder5e?.choices;
  if (classFlag) {
    Object.assign(choices, classFlag);
    for (const b of collectAbilityPicks(classFlag)) boostAcc[b.ability] += b.amount;
  }

  // Fallback NATIVO para atores sem a flag (premades/Plutonium): optional
  // features (invocations, metamagic, maneuvers…) casadas por nome entre os
  // feats do ator e o catálogo do featureType de cada descritor (TC-0004).
  const featNames = new Set(featItems.map((i) => norm(i.name)));
  for (const ch of optionalFeatureChoices(classObj, subclassObj, level)) {
    if (choices[ch.id] || ch.kind !== 'optionalfeature') continue;
    const picks = latestOnly(db?.optionalfeatures?.optionalfeature ?? [])
      .filter((f) => (f.featureType ?? []).some((t) => (ch.pool.featureType ?? []).includes(t)))
      .filter((f) => featNames.has(norm(f.name)))
      .map((f) => `${f.name}|${f.source}`);
    if (picks.length) choices[ch.id] = { kind: 'optionalfeature', picks: picks.slice(0, ch.count ?? picks.length) };
  }

  return {
    uid: makeId(),
    classId,
    source: itemSource(classItem),
    level,
    isOriginalClass: actor.system?.details?.originalClass === classItem._id,
    subclassId: subShort,
    subclassSource: subclassItem ? itemSource(subclassItem) : null,
    hitPoints,
    choices,
    spells: [], // preenchido em foundryToCharacter (precisa ver todos os items)
  };
}

/**
 * Converte um ATOR do Foundry no Character do builder (decisões).
 * @param {object} actor  documento de Actor (type 'character')
 * @param {object} [db]   compêndio 5etools (p/ reverter chaves; opcional)
 * @returns {import('../schema/character').Character}
 */
export function foundryToCharacter(actor, db) {
  const char = createCharacter({ name: actor?.name || 'Imported Character' });
  if (actor?.img) char.meta.portrait = actor.img;

  // --- Biografia: `details` do Foundry → `identity` do builder ---------------
  const det = actor?.system?.details ?? {};
  char.identity = {
    ...char.identity,
    alignment: alignmentCode(det.alignment),
    backstory: htmlToText(det.biography?.value),
    personality: det.trait ?? '', // o Foundry chama personality de `trait`
    ideals: det.ideal ?? '',
    bonds: det.bond ?? '',
    flaws: det.flaw ?? '',
    appearance: det.appearance ?? '',
    age: det.age ?? '',
    height: det.height ?? '',
    weight: det.weight ?? '',
    eyes: det.eyes ?? '',
    hair: det.hair ?? '',
    skin: det.skin ?? '',
    gender: det.gender ?? '',
    faith: det.faith ?? '',
  };

  const items = actor?.items ?? [];
  const byId = new Map(items.map((i) => [i._id, i]));

  // Acumulador de TODOS os boosts de atributo (p/ reverter os scores base no fim).
  const boostAcc = Object.fromEntries(ABILITIES.map((a) => [a, 0]));

  // --- Espécie (+ sub-escolhas: Elf "Keen Senses", Human "Skillful"/"Versatile"…) ---
  // Ids fixos ('skill-0'/'feat-0'/…) casam com parseChoices(raceObj) porque nenhuma
  // espécie 5etools tem mais de UMA entrada por tipo de campo (skill/tool/language/
  // feat) - o contador nunca passa de 0 na prática.
  // Detecta o TIPO de um Trait pelo prefixo das chaves escolhidas (não pelo título -
  // premades reais usam títulos de sabor como "Keen Senses"/"Skillful", não "Skill
  // Proficiencies" como o nosso próprio export).
  const raceItem = items.find((i) => i.type === 'race');
  char.species = parseSpecies(raceItem, db);
  if (raceItem && char.species) {
    // Kinds de escolha que a RAÇA realmente oferece (parseChoices do objeto
    // resolvido): o back-fill dos Traits só cria uma entrada quando a raça tem
    // aquela escolha - sem isso, proficiências vindas de OUTRO documento (ex:
    // as ferramentas de um feat) reapareciam como escolha da espécie (TC-0010).
    const raceObj = resolveRaceObj(db, char.species.id, char.species.source, char.species.lineage);
    const offered = new Set(raceObj ? parseChoices(raceObj).map((c) => c.kind) : []);
    // Sub-bag de um feat da espécie: viaja na flag do item do feat (TC-0002);
    // os aumentos de atributo ESCOLHIDOS lá dentro contam nos boosts.
    const featSub = (featItems) => {
      const sub = {};
      for (const f of featItems) {
        const bag = f.flags?.builder5e?.choices;
        if (!bag) continue;
        sub[itemRef(f, db)] = bag;
        for (const b of collectAbilityPicks(bag)) boostAcc[b.ability] += b.amount;
      }
      return sub;
    };
    for (const adv of advList(raceItem)) {
      if (adv.type === 'AbilityScoreImprovement') {
        // SEM gate de "a raça oferece?": um ASI no item de raça pertence à raça
        // por construção (o nosso export é raso; nos legados/Plutonium ele é o
        // boost racial 2014) - e derrubar a entrada desequilibraria os scores
        // (o boost é subtraído da base mas deixaria de ser re-derivado).
        const assignments = adv.value?.assignments ?? {};
        const picks = Object.entries(assignments).map(([ability, amount]) => ({ ability, amount }));
        if (picks.length) {
          char.species.choices['ability-0'] = { kind: 'ability', picks };
          for (const [ab, amt] of Object.entries(assignments)) boostAcc[ab] += amt;
        }
      } else if (adv.type === 'Trait') {
        const chosen = adv.value?.chosen ?? [];
        if (chosen.some((c) => c.startsWith('skills:')) && (offered.has('skill') || !raceObj)) {
          const picks = chosen.filter((c) => c.startsWith('skills:')).map((c) => c.slice('skills:'.length));
          if (picks.length) char.species.choices['skill-0'] = { kind: 'skill', picks };
        } else if (chosen.some((c) => c.startsWith('tool:')) && (offered.has('tool') || !raceObj)) {
          const picks = chosen.map((c) => toolKeyToName(c, db)).filter(Boolean);
          if (picks.length) char.species.choices['tool-0'] = { kind: 'tool', picks };
        } else if (chosen.some((c) => c.startsWith('languages:')) && (offered.has('language') || !raceObj)) {
          const picks = chosen.map((c) => languageKeyToName(c, db)).filter(Boolean);
          if (picks.length) char.species.choices['language-0'] = { kind: 'language', picks };
        }
      } else if (adv.type === 'ItemGrant') {
        // Um ItemGrant de espécie também pode conceder traços ESTRUTURAIS (ex: o
        // Human real premade concede Resourceful/Skillful/Versatile como itens) -
        // só os que existem em `feats.feat` são picks de talento de verdade.
        const feats = grantedItems(adv, byId).filter((f) => isRealFeat(f, db));
        if (feats.length) {
          char.species.choices['feat-0'] = { kind: 'feat', picks: feats.map((f) => itemRef(f, db)), sub: featSub(feats) };
          for (const f of feats) for (const b of featFixedBoosts(f)) boostAcc[b.ability] += b.amount;
        }
      } else if (adv.type === 'ItemChoice') {
        // Forma dos premades reais (Human "Versatile"): `value.added` é FLAT
        // ({itemId: uuid}, sem nível), ao contrário do Fighting Style da classe.
        const addedId = Object.keys(adv.value?.added ?? {})[0];
        const featItem = addedId ? byId.get(addedId) : null;
        if (featItem && isRealFeat(featItem, db)) {
          char.species.choices['feat-0'] = { kind: 'feat', picks: [itemRef(featItem, db)], sub: featSub([featItem]) };
          for (const b of featFixedBoosts(featItem)) boostAcc[b.ability] += b.amount;
        }
      }
    }
    // Escolhas sem casa nativa (spellAbility/size/mixed) voltam da flag do item
    // de raça (DDL-0028; TC-0009 e o antigo waiver do tamanho).
    const raceFlag = raceItem.flags?.builder5e?.choices;
    if (raceFlag) Object.assign(char.species.choices, raceFlag);
  }

  // --- Origem (background) → origem custom do builder ---
  const bgItem = items.find((i) => i.type === 'background');
  if (bgItem) {
    for (const adv of advList(bgItem)) {
      if (adv.type === 'AbilityScoreImprovement') {
        for (const [ab, amt] of Object.entries(adv.value?.assignments ?? {})) {
          char.origin.abilityBoosts.push({ ability: ab, amount: amt });
          boostAcc[ab] += amt;
        }
      } else if (adv.type === 'Trait' && /skill/i.test(adv.title ?? '')) {
        char.origin.skillProficiencies = (adv.value?.chosen ?? [])
          .filter((c) => c.startsWith('skills:'))
          .map((c) => c.slice('skills:'.length));
      } else if (adv.type === 'Trait' && /tool/i.test(adv.title ?? '')) {
        char.origin.toolProficiencies = (adv.value?.chosen ?? [])
          .map((c) => toolKeyToName(c, db))
          .filter(Boolean);
      } else if (adv.type === 'Trait' && /language/i.test(adv.title ?? '')) {
        char.origin.languages = (adv.value?.chosen ?? [])
          .map((c) => languageKeyToName(c, db))
          .filter(Boolean);
      } else if (adv.type === 'ItemGrant') {
        const feat = grantedItems(adv, byId)[0];
        if (feat) {
          // Sub-escolhas do talento de origem: flag do item (TC-0002); os
          // aumentos ESCOLHIDOS lá dentro contam nos boosts reconstruídos.
          const featChoices = feat.flags?.builder5e?.choices ?? {};
          char.origin.originFeat = { id: feat.name, source: itemSource(feat), subtype: 'origin', choices: featChoices };
          for (const b of featFixedBoosts(feat)) boostAcc[b.ability] += b.amount;
          for (const b of collectAbilityPicks(featChoices)) boostAcc[b.ability] += b.amount;
        }
      }
    }
  }

  // --- Classes + subclasses ---
  const classItems = items.filter((i) => i.type === 'class');
  const subclassItems = items.filter((i) => i.type === 'subclass');
  char.classes = classItems.map((ci) => {
    const cid = ci.system?.identifier ?? norm(ci.name);
    const sub = subclassItems.find((s) => norm(s.system?.classIdentifier) === norm(cid));
    return parseClassEntry(ci, sub, actor, byId, db, boostAcc);
  });
  if (char.classes.length === 0) char.classes = createCharacter().classes; // nunca vazio (não quebra a UI)
  else if (!char.classes.some((c) => c.isOriginalClass)) char.classes[0].isOriginalClass = true;

  // --- Magias: só as ESCOLHAS do jogador voltam ao personagem; as concedidas
  // (subclasse/raça/talento) a derivação recria sozinha. Magias sem classe dona
  // (exports antigos, sem `sourceItem`) vão para a classe original.
  const spellsByClass = importSpellsByClass(items);
  for (const cls of char.classes) {
    cls.spells = spellsByClass.get(norm(cls.classId)) ?? [];
  }
  const orphans = spellsByClass.get(null);
  if (orphans?.length) {
    const target = char.classes.find((c) => c.isOriginalClass) ?? char.classes[0];
    target.spells = [...target.spells, ...orphans];
  }

  // --- Scores BASE ---
  // Nosso export carrega os scores base explícitos na flag (lossless): com o cap
  // de atributos (TC-0022) o final exportado pode saturar, e `final - Σboosts`
  // deixou de recuperar a base sem ambiguidade. Atores externos (premades/
  // Plutonium) não têm a flag → reconstrução por subtração dos boosts.
  const flagScores = actor.flags?.builder5e?.scores;
  for (const a of ABILITIES) {
    if (flagScores && typeof flagScores[a] === 'number') {
      char.scores[a] = flagScores[a];
      continue;
    }
    const final = actor.system?.abilities?.[a]?.value;
    if (typeof final === 'number') char.scores[a] = final - (boostAcc[a] ?? 0);
  }

  // Ajuste manual do HP máximo (bonuses.overall) → hpBonus. O export soma em
  // overall a parte DERIVÁVEL sem slot nativo (Boon of Fortitude, Draconic
  // Resilience - engine/hpBonuses); como a derivação a recria sozinha, ela é
  // subtraída aqui para hpBonus voltar a ser só o ajuste manual do jogador.
  // (bonuses.level - Tough/Dwarven Toughness - é ignorado pelo mesmo motivo.)
  const overall = Number(actor.system?.attributes?.hp?.bonuses?.overall);
  char.hpBonus = (Number.isFinite(overall) ? overall : 0) - deriveHpBonus(char, db).flat;

  // --- Inventário: Items físicos → entradas do builder (best-effort) ---
  // A fonte 5etools é re-resolvida pelo NOME (o item do Foundry não a carrega),
  // p/ o item reencontrar sua arte/stats no compêndio. Uma img custom (data:/URL,
  // não um ícone `icons/...` do Foundry) é preservada em customImg.
  char.inventory = items
    .filter((it) => PHYSICAL_ITEM_TYPES.has(it.type))
    .map((it) => {
      // `resolveInventorySource` acha a fonte pelo NOME; null = o item não existe
      // no catálogo 5etools, então guardamos um snapshot dos dados do Foundry.
      const source = resolveInventorySource(db, it.name);
      const entry = {
        uid: makeId(),
        itemId: it.name,
        source: source ?? itemSource(it),
        quantity: it.system?.quantity ?? 1,
        equipped: !!it.system?.equipped,
        attuned: !!it.system?.attuned,
      };
      if (it.img && /^(data:|https?:)/.test(it.img)) entry.customImg = it.img;
      if (!source) entry.custom = customSnapshot(it);
      return entry;
    });

  // --- Moeda (mesma forma nos dois lados: pp/gp/ep/sp/cp) ---
  const cur = actor.system?.currency ?? {};
  char.currency = {
    pp: cur.pp || 0, gp: cur.gp || 0, ep: cur.ep || 0, sp: cur.sp || 0, cp: cur.cp || 0,
  };

  return char;
}
