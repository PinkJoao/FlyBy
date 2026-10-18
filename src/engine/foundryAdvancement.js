// =============================================================================
// foundryAdvancement: o advancement de um item de classe (dnd5e)
// =============================================================================
// O QUE FAZ
//   O item de classe carrega uma "receita" de passos tipados que o Foundry desdobra
//   no import e no level-up (CLAUDE.md §5). Aqui eles são GERADOS dos dados
//   estruturados do 5e.tools, sem o Plutonium (DDL-0003): HitPoints, Trait (saves,
//   perícias, armas, armaduras, weapon mastery), AbilityScoreImprovement (ASI e
//   Epic Boon), Subclass, ScaleValue e o ItemChoice do Fighting Style. Os
//   ItemGrant e as outras escadas de ItemChoice ficam no foundryItems (precisam
//   dos itens e dos uuids). Formato validado contra exports reais e o source do
//   dnd5e.
//
// FUNÇÕES
//   norm(s), cleanColLabel(label): normalização.
//   parseScaleCell(cell), scaleEntry(parsed), sameScale(a, b), scaleAdv(title,
//     type, scale, identifier), progressionScale(values): as peças de ScaleValue.
//   srdScaleValues(classObj): as escalas que o SRD publica e a tabela não dá.
//   scaleValueAdvancements(classObj, db): todos os ScaleValue da classe.
//   tableScaleValues(classObj): os das colunas de RECURSO da tabela.
//   traitAdvancement(title, opts), sameProfList(a, b): um Trait.
//   buildClassAdvancement(classObj, db): o advancement derivável.
//
// DECISÕES E ARMADILHAS
//   - ScaleValue, precedência POR ENTRADA (DDL-0031, DDL-0057): (1) curados em
//     prosa (CURATED_SCALE_VALUES, validados contra os premades: Action Surge e
//     Indomitable, e a Divine Spark do Clérigo, que uma activity cita como
//     `@scale.cleric.divine-spark`); (2) o overlay, que traz os IDENTIFICADORES do
//     SRD (`points`, `focus`, `die`), sem os quais o dnd5e cai no slug do título e
//     toda fórmula que os cite quebra (TC-0062); (3) as colunas da tabela. Uma
//     entrada da tabela sai quando já há uma de mesmo título OU de mesma escala
//     (o "Bardic Die" e o "Inspiration Die"), normalizando 1dN.
//   - srdScaleValues, com os títulos e ids dos premades: "Max Prepared Spells"
//     (`max-prepared`, que o `preparation.formula` cita), "Cantrips Known",
//     "Weapon Masteries Known" (`mastery`, a contagem; as escolhas seguem nos
//     Traits) e "Eldritch Invocations Known". Só existe quando a contagem CRESCE.
//   - Trait de Weapon Mastery: `mode: 'mastery'` registra MAESTRIA, não
//     proficiência; o pool é `weapon:*` como nos premades (a restrição RAW fica no
//     builder). A contagem cresce, e o SRD faz um Trait por breakpoint com o DELTA.
//   - `classRestriction` segue os premades: 'primary' na versão completa,
//     'secondary' na reduzida de multiclasse, e nenhuma quando os conjuntos são
//     iguais. Saves e perícias iniciais são sempre da classe original.
//   - ItemChoice do Fighting Style: o pool são os talentos FS que o SRD publica
//     (4 de 10), sem o qual o passo não oferece nada no level-up (TC-0063);
//     `allowDrops` deixa arrastar os outros.
// -----------------------------------------------------------------------------

import { latestOnly } from '../selector/reprints';
import { parseClass, skillCode } from './classData';
import { featUuid } from './compendiumUuids';
import { weaponMasteryCount } from './classFeatureChoices';
import { overlayClassAdvancement } from './foundryOverlay';

const WEAPON_START_TO_FVTT = { simple: 'sim', martial: 'mar' };
const ARMOR_START_TO_FVTT = { light: 'lgt', medium: 'med', heavy: 'hvy', shield: 'shl', shields: 'shl' };

const ASI_FEATURE_NAMES = new Set(['ability score improvement', 'epic boon']);

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

const CURATED_SCALE_VALUES = {
  fighter: [
    { title: 'Action Surge', type: 'number', scale: { 2: { value: 1 }, 17: { value: 2 } } },
    { title: 'Indomitable', type: 'number', scale: { 9: { value: 1 }, 13: { value: 2 }, 17: { value: 3 } } },
  ],
  cleric: [
    { title: 'Divine Spark', type: 'number', scale: { 2: { value: 1 }, 7: { value: 2 }, 13: { value: 3 }, 18: { value: 4 } } },
  ],
};

const SCALE_LABEL_DENY = new Set([
  'slot level', 'cantrips', 'prepared spells', 'spells known', 'spell slots', 'weapon mastery',
]);

/** Remove as tags do 5etools e os espaços das pontas. */
function cleanColLabel(label) {
  return String(label).replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, '$1').trim();
}

/** Uma célula da tabela como valor de ScaleValue, ou null. */
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

/** Uma entrada de `scale` no formato do tipo. */
function scaleEntry(parsed) {
  return parsed.type === 'dice' ? { number: parsed.number, faces: parsed.faces } : { value: parsed.value };
}

/** Duas células representam o mesmo valor? */
function sameScale(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  return a.type === 'dice' ? a.number === b.number && a.faces === b.faces : a.value === b.value;
}

/** Uma entrada de ScaleValue no formato do advancement. */
function scaleAdv(title, type, scale, identifier = '') {
  return {
    type: 'ScaleValue',
    title,
    configuration: { identifier, type, distance: { units: type === 'distance' ? 'ft' : '' }, scale },
  };
}

/** Uma progressão de 20 níveis como breakpoints. */
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

/** As escalas que o SRD publica e a tabela não dá. */
function srdScaleValues(classObj) {
  const out = [];
  const prepared = progressionScale(classObj?.preparedSpellsProgression);
  if (prepared) {
    const pact = norm(classObj?.casterProgression) === 'pact';
    out.push(scaleAdv(pact ? 'Max Pact Magic Spells' : 'Max Prepared Spells', 'number', prepared, 'max-prepared'));
  }
  const cantrips = progressionScale(classObj?.cantripProgression);
  if (cantrips) out.push(scaleAdv('Cantrips Known', 'number', cantrips));

  // ATENÇÃO: só para quem TEM a feature; o default do 2024 daria a escala até a um Mago.
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
 * Os ScaleValue de um item de classe, com precedência por entrada.
 * @param {object} classObj
 * @returns {object[]}
 */
export function scaleValueAdvancements(classObj, db = null) {
  const out = [];
  const seenTitle = new Set();
  const seenScale = new Set();
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

/** Os ScaleValue das colunas de recurso da tabela. */
function tableScaleValues(classObj) {
  const out = [];
  for (const group of classObj?.classTableGroups ?? []) {
    if (/spell slots/i.test(group.title ?? '')) continue;
    const labels = group.colLabels ?? [];
    const rows = group.rows ?? [];
    for (let j = 0; j < labels.length; j += 1) {
      const raw = String(labels[j] ?? '');
      if (/\|spells|\|optionalfeatures/.test(raw)) continue;
      const title = cleanColLabel(raw);
      if (!title || SCALE_LABEL_DENY.has(title.toLowerCase())) continue;

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

/** Um advancement Trait, com `classRestriction` quando os caminhos diferem. */
function traitAdvancement(title, { grants = [], choices = [], level = 1, mode = 'default', classRestriction = null }) {
  return {
    type: 'Trait',
    level,
    title,
    configuration: { mode, allowReplacements: false, grants, choices },
    ...(classRestriction ? { classRestriction } : {}),
  };
}

/** Duas listas de proficiência descrevem o mesmo conjunto? */
function sameProfList(a, b) {
  const A = [...new Set((a ?? []).map(norm))].sort();
  const B = [...new Set((b ?? []).map(norm))].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
}

/**
 * O advancement derivável de um item de classe (sem `_id`).
 * @param {object} classObj
 * @returns {object[]}
 */
export function buildClassAdvancement(classObj, db = null) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  const out = [];

  out.push({ type: 'HitPoints', configuration: {}, title: '' });

  const mc = classObj?.multiclassing?.proficienciesGained ?? null;

  if (parsed.proficientSaves.length) {
    out.push(
      traitAdvancement('Saving Throw Proficiencies', {
        grants: parsed.proficientSaves.map((s) => `saves:${s}`),
        classRestriction: 'primary',
      }),
    );
  }

  const sc = parsed.skillChoice;
  const mcSkill = mc?.skills?.[0]?.choose ?? null;
  if (sc.count > 0) {
    const pool = sc.any ? ['skills:*'] : sc.from.map((code) => `skills:${code}`);
    out.push(traitAdvancement('Skill Proficiencies', { choices: [{ count: sc.count, pool }], classRestriction: 'primary' }));
  }
  if (mcSkill?.count > 0) {
    out.push(traitAdvancement('Skill Proficiencies', {
      choices: [{ count: mcSkill.count, pool: (mcSkill.from ?? []).map((n) => `skills:${skillCode(n)}`) }],
      classRestriction: 'secondary',
    }));
  }

  const toGrants = (list, map, prefix) => (list ?? []).map((x) => map[norm(x)]).filter(Boolean).map((c) => `${prefix}:${c}`);
  for (const [title, startList, mcList, map, prefix] of [
    ['Weapon Proficiencies', parsed.weapons, mc?.weapons, WEAPON_START_TO_FVTT, 'weapon'],
    ['Armor Training', parsed.armor, mc?.armor, ARMOR_START_TO_FVTT, 'armor'],
  ]) {
    const grants = toGrants(startList, map, prefix);
    if (!grants.length) continue;
    const same = mcList != null && sameProfList(startList, mcList);
    out.push(traitAdvancement(title, { grants, classRestriction: same ? null : 'primary' }));
    if (same) continue;
    const mcGrants = toGrants(mcList, map, prefix);
    if (mcGrants.length) out.push(traitAdvancement(title, { grants: mcGrants, classRestriction: 'secondary' }));
  }

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

  const fsFeature = parsed.features.find((f) => norm(f.name) === 'fighting style');
  if (fsFeature) {
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

  out.push(...scaleValueAdvancements(classObj, db));

  if (parsed.nativeSubclassLevel != null) {
    out.push({ type: 'Subclass', level: parsed.nativeSubclassLevel, title: '', configuration: {} });
  }

  return out;
}
