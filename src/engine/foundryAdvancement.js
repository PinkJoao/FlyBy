// =============================================================================
// foundryAdvancement - gera o `advancement[]` de um ITEM de classe (dnd5e)
// =============================================================================
// O item de classe do Foundry carrega uma "receita" (`advancement[]`) de passos
// tipados que o sistema desdobra no import/subida de nível (ver CLAUDE.md §5).
// Aqui GERAMOS esses passos a partir dos dados ESTRUTURADOS do 5e.tools (que já
// baixamos) - sem depender do Plutonium (ver DDL-0003).
//
// Cobre os passos DERIVÁVEIS e auto-contidos:
//   HitPoints · Trait (saves/skills/armas/armadura/weapon mastery) ·
//   AbilityScoreImprovement (níveis de ASI + Epic Boon) · Subclass
// Ficam para depois (precisam de UUIDs de itens do compêndio / tabela):
//   ItemGrant (features por nível) · ItemChoice (Fighting Style) · ScaleValue
//
// Formato validado contra exports reais (etienne = Plutonium, randal = premade
// oficial) e o source MIT do sistema dnd5e.
// -----------------------------------------------------------------------------

import { parseClass } from './classData';
import { weaponMasteryCount } from './classFeatureChoices';

// startingProficiencies.weapons/armor (tokens) → códigos de trait do Foundry.
const WEAPON_START_TO_FVTT = { simple: 'sim', martial: 'mar' };
const ARMOR_START_TO_FVTT = { light: 'lgt', medium: 'med', heavy: 'hvy', shield: 'shl', shields: 'shl' };

// Features que abrem um slot de ASI/talento no Foundry (AbilityScoreImprovement).
const ASI_FEATURE_NAMES = new Set(['ability score improvement', 'epic boon']);

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

// Escalas em PROSA (não estão como coluna na tabela da classe) - curadas p/ casar
// com os premades. Chave = classId; cada entrada vira um advancement ScaleValue.
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

// Rótulos de coluna que NÃO são recursos escaláveis (magia/derivados) → ignorados.
const SCALE_LABEL_DENY = new Set(['slot level', 'cantrips', 'prepared spells', 'spells known', 'spell slots']);

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

/**
 * Advancements ScaleValue a partir das colunas de RECURSO da tabela da classe
 * (Rages, Second Wind, Sneak Attack, Focus Points…), pulando colunas de magia
 * (`|spells`) e de optional features (`|optionalfeatures`). Guarda só os breakpoints.
 * Soma as escalas em prosa curadas (CURATED_SCALE_VALUES).
 * @param {object} classObj  objeto de classe 5etools
 * @returns {object[]} entradas de advancement ScaleValue (sem `_id`)
 */
export function scaleValueAdvancements(classObj) {
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
      out.push({
        type: 'ScaleValue',
        title,
        configuration: { identifier: '', type, distance: { units: type === 'distance' ? 'ft' : '' }, scale },
      });
    }
  }
  for (const c of CURATED_SCALE_VALUES[norm(classObj?.name)] ?? []) {
    out.push({ type: 'ScaleValue', title: c.title, configuration: { identifier: '', type: c.type, distance: { units: '' }, scale: c.scale } });
  }
  return out;
}

function traitAdvancement(title, { grants = [], choices = [] }) {
  return {
    type: 'Trait',
    level: 1,
    title,
    configuration: { mode: 'default', allowReplacements: false, grants, choices },
    classRestriction: 'primary',
  };
}

/**
 * Gera o `advancement[]` (parte derivável) de um item de classe do Foundry.
 * @param {object} classObj  objeto de classe 5etools (db['class-fighter'].class[0])
 * @returns {object[]} entradas de advancement (sem `_id`; atribuídos ao serializar)
 */
export function buildClassAdvancement(classObj) {
  const parsed = parseClass(classObj);
  if (!parsed) return [];
  const out = [];

  // 1) HitPoints - o sistema concede HP por nível a partir do dado.
  out.push({ type: 'HitPoints', configuration: {}, title: '' });

  // 2) Trait: saves proficientes (grant fixo).
  if (parsed.proficientSaves.length) {
    out.push(
      traitAdvancement('Saving Throw Proficiencies', {
        grants: parsed.proficientSaves.map((s) => `saves:${s}`),
      }),
    );
  }

  // 3) Trait: perícias iniciais (escolha). `any` (Bard) → pool com todas.
  const sc = parsed.skillChoice;
  if (sc.count > 0) {
    const pool = sc.any ? ['skills:*'] : sc.from.map((code) => `skills:${code}`);
    out.push(traitAdvancement('Skill Proficiencies', { choices: [{ count: sc.count, pool }] }));
  }

  // 4) Trait: armas e armaduras iniciais (grant fixo; texto especial é ignorado).
  const weaponGrants = (parsed.weapons ?? []).map((w) => WEAPON_START_TO_FVTT[norm(w)]).filter(Boolean).map((c) => `weapon:${c}`);
  if (weaponGrants.length) out.push(traitAdvancement('Weapon Proficiencies', { grants: weaponGrants }));
  const armorGrants = (parsed.armor ?? []).map((a) => ARMOR_START_TO_FVTT[norm(a)]).filter(Boolean).map((c) => `armor:${c}`);
  if (armorGrants.length) out.push(traitAdvancement('Armor Training', { grants: armorGrants }));

  // 5) Trait: Weapon Mastery (escolha) - só se a classe tem a feature homônima.
  if (parsed.features.some((f) => norm(f.name) === 'weapon mastery')) {
    const count = weaponMasteryCount(classObj, 1);
    out.push(traitAdvancement('Weapon Mastery', { choices: [{ count, pool: ['weapon:sim:*', 'weapon:mar:*'] }] }));
  }

  // 6) ItemChoice: Fighting Style - classes com a feature homônima escolhem um
  // feat de Fighting Style (2024). Config no formato dos premades (pool vazio +
  // allowDrops; os premades usam refs de compêndio que não temos); o value (o
  // feat escolhido, embutido) é preenchido pelo buildClassItem.
  const fsFeature = parsed.features.find((f) => norm(f.name) === 'fighting style');
  if (fsFeature) {
    out.push({
      type: 'ItemChoice',
      title: 'Fighting Style',
      configuration: {
        choices: { [fsFeature.level]: { count: 1, replacement: true } },
        allowDrops: true,
        type: 'feat',
        pool: [],
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
  out.push(...scaleValueAdvancements(classObj));

  // 9) Subclass - no nível em que a subclasse entra.
  if (parsed.nativeSubclassLevel != null) {
    out.push({ type: 'Subclass', level: parsed.nativeSubclassLevel, title: '', configuration: {} });
  }

  return out;
}
