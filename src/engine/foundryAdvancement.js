// =============================================================================
// foundryAdvancement - gera o `advancement[]` de um ITEM de classe (dnd5e)
// =============================================================================
// O item de classe do Foundry carrega uma "receita" (`advancement[]`) de passos
// tipados que o sistema desdobra no import/subida de nível (ver CLAUDE.md §5).
// Aqui GERAMOS esses passos a partir dos dados ESTRUTURADOS do 5e.tools (que já
// baixamos) - sem depender do Plutonium (ver DDL-0003).
//
// Cobre: HitPoints · Trait (saves/skills/armas/armadura/weapon mastery) ·
//   AbilityScoreImprovement (ASI + Epic Boon) · Subclass · ScaleValue (colunas da
//   tabela + overlay + o que o SRD publica à parte) · ItemChoice do Fighting Style.
// O ItemGrant por nível e as demais escadas de ItemChoice são montados no
// foundryItems (precisam dos itens já gerados e dos uuids de compêndio).
//
// Formato validado contra exports reais (etienne = Plutonium, randal = premade
// oficial) e o source MIT do sistema dnd5e.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { parseClass, skillCode } from './classData';
import { featUuid } from './compendiumUuids';
import { weaponMasteryCount } from './classFeatureChoices';
import { overlayClassAdvancement } from './foundryOverlay';

// startingProficiencies.weapons/armor (tokens) → códigos de trait do Foundry.
const WEAPON_START_TO_FVTT = { simple: 'sim', martial: 'mar' };
const ARMOR_START_TO_FVTT = { light: 'lgt', medium: 'med', heavy: 'hvy', shield: 'shl', shields: 'shl' };

// Features que abrem um slot de ASI/talento no Foundry (AbilityScoreImprovement).
const ASI_FEATURE_NAMES = new Set(['ability score improvement', 'epic boon']);

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

// Escalas em PROSA (não estão como coluna na tabela da classe) - curadas p/ casar
// com os premades. Chave = classId; cada entrada vira um advancement ScaleValue.
// Estas DUAS classes ficam curadas por terem sido validadas contra os premades
// reais (e a do clérigo é referenciada por uma activity); o resto das classes vem
// do overlay `class/foundry.json`, que traz a mesma informação upstream (DDL-0057).
const CURATED_SCALE_VALUES = {
  fighter: [
    { title: 'Action Surge', type: 'number', scale: { 2: { value: 1 }, 17: { value: 2 } } },
    { title: 'Indomitable', type: 'number', scale: { 9: { value: 1 }, 13: { value: 2 }, 17: { value: 3 } } },
  ],
  // Contagem de d8 da Divine Spark (Channel Divinity do Clérigo) - no premade oficial
  // vive num ScaleValue anexado ao próprio item da feature (`@scale.channel-divinity-
  // cleric.spark`); aqui usamos a mesma escala num ScaleValue de CLASSE (como as
  // demais), então a fórmula da activity referencia `@scale.cleric.divine-spark` -
  // funcionalmente equivalente (o Foundry resolve `@scale.<classe>.*` de qualquer item).
  cleric: [
    { title: 'Divine Spark', type: 'number', scale: { 2: { value: 1 }, 7: { value: 2 }, 13: { value: 3 }, 18: { value: 4 } } },
  ],
};

// Rótulos de coluna que NÃO viram escala a partir da TABELA. Magia e maestria
// saem por `srdScaleValues`, com o título e o identificador que o SRD usa
// ("Weapon Masteries Known"/`mastery`, "Max Prepared Spells"/`max-prepared`) -
// pela coluna sairiam com o nome da tabela e um identificador diferente.
const SCALE_LABEL_DENY = new Set([
  'slot level', 'cantrips', 'prepared spells', 'spells known', 'spell slots', 'weapon mastery',
]);

/** Remove tags 5etools ({@filter Rótulo|...} → Rótulo) e espaços das pontas. */
function cleanColLabel(label) {
  return String(label).replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, '$1').trim();
}

/** Uma célula da tabela → {type, value|number+faces} do ScaleValue, ou null se não
 * for um valor escalável (texto livre). Cobre número, bônus, dado e deslocamento. */
function parseScaleCell(cell) {
  if (cell == null || cell === '') return null;
  if (typeof cell === 'number') return { type: 'number', value: cell };
  if (typeof cell === 'string') {
    const n = Number(cell.replace('+', '').trim());
    return Number.isFinite(n) ? { type: 'number', value: n } : null;
  }
  if (typeof cell === 'object') {
    if (cell.type === 'bonus') return { type: 'number', value: cell.value };
    if (cell.type === 'bonusSpeed') return { type: 'distance', value: cell.value };
    const roll = cell.type === 'dice' ? cell.toRoll?.[0] : null;
    if (roll) return { type: 'dice', number: roll.number ?? 1, faces: roll.faces };
  }
  return null;
}

/** Entrada de `scale` (por nível) no formato do tipo. */
function scaleEntry(parsed) {
  return parsed.type === 'dice' ? { number: parsed.number, faces: parsed.faces } : { value: parsed.value };
}

/** Duas células parseadas representam o MESMO valor? (p/ achar breakpoints). */
function sameScale(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  return a.type === 'dice' ? a.number === b.number && a.faces === b.faces : a.value === b.value;
}

/** Entrada de ScaleValue no formato do advancement. */
function scaleAdv(title, type, scale, identifier = '') {
  return {
    type: 'ScaleValue',
    title,
    configuration: { identifier, type, distance: { units: type === 'distance' ? 'ft' : '' }, scale },
  };
}

/** Progressão por nível (array de 20) → só os breakpoints, no formato `scale`. */
function progressionScale(values) {
  const scale = {};
  let prev = null;
  (values ?? []).forEach((v, i) => {
    if (typeof v === 'number' && v !== prev) {
      scale[i + 1] = { value: v };
      prev = v;
    }
  });
  return Object.keys(scale).length ? scale : null;
}

/**
 * Escalas que o SRD publica mas a TABELA não dá de graça, com os títulos e
 * identificadores das fichas premade (conferidos uma a uma):
 *   · "Max Prepared Spells" / "Max Pact Magic Spells" → `max-prepared`, que é o
 *     que o `spellcasting.preparation.formula` referencia;
 *   · "Cantrips Known" (identificador vazio: o dnd5e cai no slug do título);
 *   · "Weapon Masteries Known" → `mastery` (a CONTAGEM; quais maestrias foram
 *     escolhidas continua nos Traits `mode: 'mastery'`, como no SRD - os premades
 *     têm as duas coisas);
 *   · "Eldritch Invocations Known" → `invocations-known` (única coluna
 *     `|optionalfeatures` do dataset, do Warlock).
 */
function srdScaleValues(classObj) {
  const out = [];
  const prepared = progressionScale(classObj?.preparedSpellsProgression);
  if (prepared) {
    const pact = norm(classObj?.casterProgression) === 'pact';
    out.push(scaleAdv(pact ? 'Max Pact Magic Spells' : 'Max Prepared Spells', 'number', prepared, 'max-prepared'));
  }
  const cantrips = progressionScale(classObj?.cantripProgression);
  if (cantrips) out.push(scaleAdv('Cantrips Known', 'number', cantrips));

  // Só para quem TEM a feature: `weaponMasteryCount` devolve o default do 2024
  // para qualquer classe, então sem este gate um Mago ganharia a escala.
  const hasMastery = (parseClass(classObj)?.features ?? []).some((f) => norm(f.name) === 'weapon mastery');
  if (hasMastery) {
    const masteryScale = {};
    let prevMastery = 0;
    for (let level = 1; level <= 20; level += 1) {
      const count = weaponMasteryCount(classObj, level);
      if (count > prevMastery) {
        masteryScale[level] = { value: count };
        prevMastery = count;
      }
    }
    // Só quando a contagem CRESCE: no SRD as classes de contagem fixa (Paladino,
    // Ranger, Ladino) não têm a escala - um valor constante não é um ScaleValue.
    if (Object.keys(masteryScale).length > 1) {
      out.push(scaleAdv('Weapon Masteries Known', 'number', masteryScale, 'mastery'));
    }
  }

  for (const group of classObj?.classTableGroups ?? []) {
    const labels = group.colLabels ?? [];
    for (let j = 0; j < labels.length; j += 1) {
      if (!/feature type=ei/.test(String(labels[j] ?? ''))) continue;
      const scale = progressionScale((group.rows ?? []).map((r) => parseScaleCell(r?.[j])?.value));
      if (scale) out.push(scaleAdv('Eldritch Invocations Known', 'number', scale, 'invocations-known'));
    }
  }
  return out;
}

/**
 * Advancements ScaleValue de um item de classe. Três fontes, nesta PRECEDÊNCIA
 * (a mesma do DDL-0031/0057, agora aplicada por ENTRADA e não por classe):
 *   1. curadas em prosa (CURATED_SCALE_VALUES) - validadas contra os premades;
 *   2. o overlay `class/foundry.json` - é quem traz os IDENTIFICADORES que o SRD
 *      usa (`points`, `focus`, `die`, `aura`, `rage-damage`…), e sem eles o
 *      dnd5e cai no slug do título: `@scale.sorcerer.sorcery-points` em vez de
 *      `@scale.sorcerer.points`, quebrando toda fórmula que os cite (TC-0062);
 *   3. as colunas de RECURSO da tabela, que preenchem o que faltar.
 * Uma entrada da TABELA é descartada quando já existe uma de mesmo TÍTULO **ou de
 * mesma escala** - o overlay às vezes nomeia diferente o mesmo recurso ("Bardic
 * Die" na tabela × "Inspiration Die" no SRD), e emitir as duas duplicaria.
 * Fecha com `srdScaleValues` (o que a tabela não expressa: preparadas, cantrips,
 * maestrias, invocações).
 * @param {object} classObj  objeto de classe 5etools
 * @returns {object[]} entradas de advancement ScaleValue (sem `_id`)
 */
export function scaleValueAdvancements(classObj, db = null) {
  const out = [];
  const seenTitle = new Set();
  const seenScale = new Set();
  // Chave canônica da ESCALA (nível → valor), para reconhecer o mesmo recurso sob
  // dois nomes. Normaliza a forma do dado: o overlay escreve `{faces}` e o SRD
  // `{number: null, faces}`, nós `{number: 1, faces}` - tudo "1dN".
  const scaleKey = (a) =>
    Object.entries(a.configuration.scale ?? {})
      .map(([lvl, v]) => `${lvl}:${v.faces != null ? `${v.number ?? 1}d${v.faces}` : v.value}`)
      .join('|');
  const push = (adv) => {
    out.push(adv);
    seenTitle.add(norm(adv.title));
    seenScale.add(scaleKey(adv));
  };

  for (const c of CURATED_SCALE_VALUES[norm(classObj?.name)] ?? []) {
    push(scaleAdv(c.title, c.type, c.scale));
  }
  if (db) {
    for (const a of overlayClassAdvancement(db, classObj?.name, classObj?.source)) {
      if (!seenTitle.has(norm(a.title))) push(a);
    }
  }
  for (const a of tableScaleValues(classObj)) {
    if (!seenTitle.has(norm(a.title)) && !seenScale.has(scaleKey(a))) push(a);
  }
  for (const a of srdScaleValues(classObj)) {
    if (!seenTitle.has(norm(a.title))) push(a);
  }
  return out;
}

/**
 * ScaleValues derivados das colunas de RECURSO da tabela da classe (Rages,
 * Second Wind, Sneak Attack…), pulando colunas de magia (`|spells`) e de optional
 * features (`|optionalfeatures`) - essas viram escalas próprias em
 * `srdScaleValues`, com o título e o identificador do SRD.
 */
function tableScaleValues(classObj) {
  const out = [];
  for (const group of classObj?.classTableGroups ?? []) {
    if (/spell slots/i.test(group.title ?? '')) continue; // grupo de slots de magia
    const labels = group.colLabels ?? [];
    const rows = group.rows ?? [];
    for (let j = 0; j < labels.length; j += 1) {
      const raw = String(labels[j] ?? '');
      if (/\|spells|\|optionalfeatures/.test(raw)) continue; // colunas de magia/invocations
      const title = cleanColLabel(raw);
      if (!title || SCALE_LABEL_DENY.has(title.toLowerCase())) continue;

      // Parseia a coluna; só é uma escala se todas as células parseáveis são do MESMO tipo.
      const parsedByLevel = rows.map((r) => parseScaleCell(r?.[j]));
      const present = parsedByLevel.filter(Boolean);
      if (present.length === 0) continue;
      const type = present[0].type;
      if (!present.every((p) => p.type === type)) continue;

      const scale = {};
      let prev = null;
      parsedByLevel.forEach((p, i) => {
        if (p && !sameScale(p, prev)) {
          scale[i + 1] = scaleEntry(p);
          prev = p;
        }
      });
      if (Object.keys(scale).length === 0) continue;
      out.push(scaleAdv(title, type, scale));
    }
  }
  return out;
}

/**
 * Um advancement Trait. `classRestriction` segue os premades: só é preenchido
 * quando entrar pela classe ORIGINAL e por MULTICLASSE dá coisas diferentes
 * ('primary' na versão completa, 'secondary' na reduzida). Quando os dois
 * conjuntos são iguais - ou quando não existe versão de multiclasse - o campo
 * fica de fora e o Trait vale nos dois casos.
 */
function traitAdvancement(title, { grants = [], choices = [], level = 1, mode = 'default', classRestriction = null }) {
  return {
    type: 'Trait',
    level,
    title,
    configuration: { mode, allowReplacements: false, grants, choices },
    ...(classRestriction ? { classRestriction } : {}),
  };
}

/** Duas listas de tokens de proficiência descrevem o mesmo conjunto? */
function sameProfList(a, b) {
  const A = [...new Set((a ?? []).map(norm))].sort();
  const B = [...new Set((b ?? []).map(norm))].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
}

/**
 * Gera o `advancement[]` (parte derivável) de um item de classe do Foundry.
 * @param {object} classObj  objeto de classe 5etools (db['class-fighter'].class[0])
 * @returns {object[]} entradas de advancement (sem `_id`; atribuídos ao serializar)
 */
export function buildClassAdvancement(classObj, db = null) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  const out = [];

  // 1) HitPoints - o sistema concede HP por nível a partir do dado.
  out.push({ type: 'HitPoints', configuration: {}, title: '' });

  // Proficiências ganhas ao entrar por MULTICLASSE (campo estruturado do
  // 5etools). Onde elas diferem das iniciais, o premade emite DOIS Traits -
  // 'primary' (completo) e 'secondary' (reduzido).
  const mc = classObj?.multiclassing?.proficienciesGained ?? null;

  // 2) Trait: saves proficientes (grant fixo). Multiclasse nunca concede saves,
  // então este é sempre exclusivo da classe original.
  if (parsed.proficientSaves.length) {
    out.push(
      traitAdvancement('Saving Throw Proficiencies', {
        grants: parsed.proficientSaves.map((s) => `saves:${s}`),
        classRestriction: 'primary',
      }),
    );
  }

  // 3) Trait: perícias iniciais (escolha). `any` (Bard) → pool com todas.
  const sc = parsed.skillChoice;
  const mcSkill = mc?.skills?.[0]?.choose ?? null;
  if (sc.count > 0) {
    const pool = sc.any ? ['skills:*'] : sc.from.map((code) => `skills:${code}`);
    // SEMPRE 'primary': entrar por multiclasse nunca concede as perícias
    // iniciais completas - no máximo a escolha reduzida do bloco `multiclassing`.
    out.push(traitAdvancement('Skill Proficiencies', { choices: [{ count: sc.count, pool }], classRestriction: 'primary' }));
  }
  if (mcSkill?.count > 0) {
    out.push(traitAdvancement('Skill Proficiencies', {
      choices: [{ count: mcSkill.count, pool: (mcSkill.from ?? []).map((n) => `skills:${skillCode(n)}`) }],
      classRestriction: 'secondary',
    }));
  }

  // 4) Trait: armas e armaduras iniciais (grant fixo; texto especial é ignorado).
  const toGrants = (list, map, prefix) => (list ?? []).map((x) => map[norm(x)]).filter(Boolean).map((c) => `${prefix}:${c}`);
  for (const [title, startList, mcList, map, prefix] of [
    ['Weapon Proficiencies', parsed.weapons, mc?.weapons, WEAPON_START_TO_FVTT, 'weapon'],
    ['Armor Training', parsed.armor, mc?.armor, ARMOR_START_TO_FVTT, 'armor'],
  ]) {
    const grants = toGrants(startList, map, prefix);
    if (!grants.length) continue;
    // Conjuntos iguais = um Trait só, sem restrição (vale pelos dois caminhos).
    const same = mcList != null && sameProfList(startList, mcList);
    out.push(traitAdvancement(title, { grants, classRestriction: same ? null : 'primary' }));
    if (same) continue;
    const mcGrants = toGrants(mcList, map, prefix);
    if (mcGrants.length) out.push(traitAdvancement(title, { grants: mcGrants, classRestriction: 'secondary' }));
  }

  // 5) Trait: Weapon Mastery (escolha) - só se a classe tem a feature homônima.
  // `mode: 'mastery'` (e não 'default') é o que faz o Foundry registrar MAESTRIA
  // em vez de proficiência de arma; o pool é `weapon:*` como nos premades (a
  // restrição RAW por classe é do lado do builder - o que vai no `chosen` já é
  // válido). A contagem CRESCE (Barbarian 2→3@4→4@10), e o SRD modela isso com um
  // Trait por breakpoint carregando só o DELTA daquele nível.
  if (parsed.features.some((f) => norm(f.name) === 'weapon mastery')) {
    let prev = 0;
    for (let level = 1; level <= 20; level += 1) {
      const count = weaponMasteryCount(classObj, level);
      if (count <= prev) continue;
      out.push(traitAdvancement('Weapon Mastery', {
        level,
        mode: 'mastery',
        choices: [{ count: count - prev, pool: ['weapon:*'] }],
      }));
      prev = count;
    }
  }

  // 6) ItemChoice: Fighting Style - classes com a feature homônima escolhem um
  // feat de Fighting Style (2024). Config no formato dos premades (pool vazio +
  // allowDrops; os premades usam refs de compêndio que não temos); o value (o
  // feat escolhido, embutido) é preenchido pelo buildClassItem.
  const fsFeature = parsed.features.find((f) => norm(f.name) === 'fighting style');
  if (fsFeature) {
    // O POOL são os talentos de Fighting Style que o compêndio do dnd5e publica
    // (o SRD tem 4 dos 10) - sem ele o passo existe mas não oferece nada ao subir
    // de nível (TC-0063). `allowDrops` continua permitindo arrastar os demais.
    const pool = latestOnly(db?.feats?.feat ?? [])
      .filter((f) => f.category === 'FS')
      .map((f) => featUuid(f.name))
      .filter(Boolean)
      .map((uuid) => ({ uuid }));
    out.push({
      type: 'ItemChoice',
      title: 'Fighting Style',
      configuration: {
        choices: { [fsFeature.level]: { count: 1, replacement: true } },
        allowDrops: true,
        type: 'feat',
        pool,
        spell: null,
        restriction: { type: 'feat', subtype: 'fightingStyle', list: [] },
      },
    });
  }

  // 7) AbilityScoreImprovement - um por nível de ASI/Epic Boon.
  for (const f of parsed.features) {
    if (ASI_FEATURE_NAMES.has(norm(f.name))) {
      out.push({
        type: 'AbilityScoreImprovement',
        level: f.level,
        title: '',
        configuration: { points: 2, fixed: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, cap: 2, locked: [], recommendation: null },
      });
    }
  }

  // 8) ScaleValue - colunas de recurso da tabela (Second Wind, Rages, Sneak
  // Attack…) + escalas curadas em prosa (Action Surge/Indomitable).
  out.push(...scaleValueAdvancements(classObj, db));

  // 9) Subclass - no nível em que a subclasse entra.
  if (parsed.nativeSubclassLevel != null) {
    out.push({ type: 'Subclass', level: parsed.nativeSubclassLevel, title: '', configuration: {} });
  }

  return out;
}
