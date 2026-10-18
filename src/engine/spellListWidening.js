// =============================================================================
// spellListWidening: as magias que CONTAM como da lista da origem (TC-0043)
// =============================================================================
// O QUE FAZ
//   Alargar a lista é DIFERENTE de conceder (DDL-0054): a concessão põe a magia na
//   ficha, sempre preparada; o alargamento só diz que ela conta como da sua classe,
//   e você ainda prepara e gasta espaço. O grantedSpells ignora o bucket
//   `expanded` (DDL-0008); este módulo monta o conjunto "on-list" que o seletor
//   usa para avisar "not on the X spell list" e pré-marcar o filtro de Classe.
//
//   O dataset tem TRÊS formas (varredura de 2026-07-22):
//     1. `expanded` com nomes soltos: os 9 patronos de warlock legados. A chave
//        `sN` é "quando você tiver espaços de círculo N"; numérica é nível.
//     2. `expanded` com {all: "level=N|class=X"}: Divine Soul. A mesma forma serve
//        ao redirecionamento dos third-casters, tratado em spellListClassName.
//     3. `expanded` com LISTAS em {all}: o Magical Secrets do Bardo XPHB @10
//        ("level=1;2;3|class=Cleric;Druid;Wizard", mais s6 a s9).
//
// FUNÇÕES
//   spellLevelIndex(db): nome para círculo, memoizado (o sources.json não traz).
//   keyReached(key, classLevel, maxSlotLevel): a chave de nível foi alcançada?
//   parseAllSpec(spec): "level=1;2|class=X;Y" em listas.
//   expandedSpellNames(entity, opts): o que o `expanded` de uma entidade soma.
//   originExtraSpells(opts): o on-list extra de uma origem e a fonte de cada um.
//
// DECISÕES E ARMADILHAS
//   - parseAllSpec lê TODOS os valores separados por `;` nos dois campos.
//   - Grupos são ALTERNATIVAS (TC-0011): vale só o escolhido, como no
//     grantedSpells.
//   - NÃO há alargamento só em prosa hoje (o Magical Secrets está inteiro no dado),
//     então não há registro curado; se aparecer, mora aqui. NÃO são alargamento:
//     Magical Discoveries e Arcane Initiate (escolhas concedidas), Psionic Spells e
//     Clockwork Magic (regra de troca), Lunar Boons (metamagia), Psychic Spells.
//   - CLASS_WIDENING_LABELS é cosmético: o badge da CLASSE diz a feature (o
//     `expanded` da classe não diz de onde veio); a subclasse usa o próprio nome.
// -----------------------------------------------------------------------------

import { allSpells, classSpellList } from './spells';

const levelIndexCache = new WeakMap();
function spellLevelIndex(db) {
  if (!db) return new Map();
  let idx = levelIndexCache.get(db);
  if (!idx) {
    idx = new Map(allSpells(db).map((s) => [s.name.toLowerCase(), s.level]));
    levelIndexCache.set(db, idx);
  }
  return idx;
}

/** Uma chave de nível do `expanded` foi alcançada? (`sN` é círculo de espaço) */
function keyReached(key, classLevel, maxSlotLevel) {
  const s = String(key);
  if (s === '_') return true;
  if (s.startsWith('s')) {
    const n = Number(s.slice(1));
    return Number.isFinite(n) && maxSlotLevel >= n;
  }
  const n = Number(s);
  return Number.isFinite(n) && classLevel >= n;
}

/** "level=1;2;3|class=Cleric;Druid" vira { levels, classNames }. */
function parseAllSpec(spec) {
  if (typeof spec !== 'string') return null;
  const cls = spec.match(/class=([^|]+)/i);
  const lvl = spec.match(/level=([^|]+)/i);
  if (!cls) return null;
  return {
    classNames: cls[1].split(';').map((s) => s.trim()).filter(Boolean),
    levels: lvl ? lvl[1].split(';').map(Number).filter(Number.isFinite) : null,
  };
}

/**
 * Os nomes que o bucket `expanded` de uma entidade soma à lista.
 * @param {object|null} entity
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.classLevel
 * @param {number} [opts.maxSlotLevel]
 * @param {string} [opts.activeGroup]
 * @returns {Set<string>}
 */
export function expandedSpellNames(entity, { db, classLevel, maxSlotLevel = 0, activeGroup = null }) {
  const out = new Set();
  const groups = entity?.additionalSpells ?? [];
  const group =
    groups.length > 1
      ? (activeGroup ? groups.find((g) => (g?.name ?? null) === activeGroup) : null) ?? null
      : groups[0] ?? null;
  for (const [key, entries] of Object.entries(group?.expanded ?? {})) {
    if (!keyReached(key, classLevel, maxSlotLevel)) continue;
    for (const e of Array.isArray(entries) ? entries : [entries]) {
      if (typeof e === 'string') {
        out.add(e.split('|')[0].split('#')[0].trim().toLowerCase());
        continue;
      }
      const spec = parseAllSpec(e?.all);
      if (!spec) continue;
      const levelOf = spellLevelIndex(db);
      for (const className of spec.classNames) {
        for (const name of classSpellList(db, className)) {
          if (spec.levels === null || spec.levels.includes(levelOf.get(name))) out.add(name);
        }
      }
    }
  }
  return out;
}

const CLASS_WIDENING_LABELS = {
  'Bard|XPHB': 'Magical Secrets',
};

/**
 * O conjunto on-list extra de uma origem de classe, com a fonte de cada um.
 * @returns {{ names: Set<string>, sources: Map<string, string> }}
 */
export function originExtraSpells({ db, classObj, subclassObj, classLevel, maxSlotLevel = 0, activeGroup = null }) {
  const names = new Set();
  const sources = new Map();
  const add = (set, label) => {
    for (const n of set) {
      names.add(n);
      if (!sources.has(n)) sources.set(n, label);
    }
  };

  const classLabel =
    CLASS_WIDENING_LABELS[`${classObj?.name}|${classObj?.source}`] ?? classObj?.name ?? 'Class';
  for (const [entity, label] of [
    [classObj, classLabel],
    [subclassObj, subclassObj?.name ?? subclassObj?.shortName ?? 'Subclass'],
  ]) {
    if (!entity) continue;
    add(expandedSpellNames(entity, { db, classLevel, maxSlotLevel, activeGroup }), label);
  }

  return { names, sources };
}
