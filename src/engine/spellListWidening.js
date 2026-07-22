// =============================================================================
// spellListWidening - magias que CONTAM como da lista da origem (TC-0043)
// =============================================================================
// Puro: recebe db/objetos, devolve dados. Ver DDL-0054.
//
// Alargar a lista é DIFERENTE de conceder. Uma concessão (`known`/`prepared`/
// `innate`) põe a magia na ficha, sempre preparada; um ALARGAMENTO só diz que
// ela passa a contar como magia da sua classe - você ainda precisa prepará-la e
// gastar um espaço. Por isso `grantedSpells` ignora o bucket `expanded` (isso
// está certo, B2.3/DDL-0008) e este módulo cuida do outro lado: o conjunto
// "on-list" que o seletor usa para avisar "not on the X spell list" e para
// pré-marcar o filtro de Classe.
//
// O dataset inteiro tem TRÊS formas (varredura de 2026-07-22, todos os
// class-*.json + as features com `{@filter …|spells|class=…}`):
//
//   1. `expanded` com NOMES soltos - os 9 patronos de warlock legados (Archfey,
//      Fiend, Great Old One, Undying, Celestial, Hexblade, Fathomless, Genie,
//      Undead). Chave de nível `sN` = "quando você tiver espaços de círculo N"
//      (é o Expanded Spell List do pacto), ou numérica = nível de classe.
//   2. `expanded` com `{all: "level=N|class=X"}` - Divine Soul (lista de clérigo
//      inteira, um círculo por vez). A MESMA forma serve ao redirecionamento dos
//      third-casters (Eldritch Knight/Arcane Trickster), que já é tratado em
//      `spellListClassName` (resolve.js) trocando a lista inteira da origem.
//   3. `expanded` com LISTAS em `{all}` - Bard XPHB "Magical Secrets" @10
//      (`level=1;2;3;4;5|class=Cleric;Druid;Wizard`, mais `s6..s9` conforme os
//      círculos chegam). Os dois campos aceitam vários valores separados por
//      `;`, e é por isso que `parseAllSpec` NÃO pode ler só o primeiro.
//
// NÃO existe, hoje, alargamento que só viva na PROSA: o Magical Secrets parecia
// ser um (o texto usa `{@filter}` tags), mas está inteiro no dado - por isso
// este módulo não tem registro curado. Se algum dia aparecer um, o lugar dele é
// aqui, no formato dos outros registros de prosa (subclassGrants, hpBonuses).
//
// NÃO são alargamento, apesar de citarem outra lista (verificado um a um):
// Lore/Magical Discoveries e Arcana/Arcane Initiate são ESCOLHAS concedidas
// (`prepared`/`known` com `choose`); Psionic Spells e Clockwork Magic são regra
// de TROCA restrita às magias daquela tabela; Lunar Boons é metamagia; Psychic
// Spells é tipo de dano.
// -----------------------------------------------------------------------------

import { allSpells, classSpellList } from './spells';

// Índice nome→círculo, memoizado por db (o `spell-sources` não traz o nível, e
// a folha `{all: "level=N|class=X"}` precisa dele). Uma varredura do catálogo.
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

/** Uma chave de nível do `expanded` foi alcançada? `sN` = círculo de espaço. */
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

/**
 * "level=1;2;3|class=Cleric;Druid" → { levels: [1,2,3], classNames: [...] }.
 * Os dois campos são listas separadas por `;` (o Magical Secrets do Bardo usa as
 * duas de uma vez); `level` ausente = a lista inteira da classe.
 */
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
 * Nomes (minúsculos) que o bucket `expanded` de uma entidade acrescenta à lista.
 * @param {object|null} entity        classe ou subclasse (com additionalSpells)
 * @param {object} opts
 * @param {object} opts.db
 * @param {number} opts.classLevel
 * @param {number} [opts.maxSlotLevel] círculo máximo de espaço (chaves `sN`)
 * @param {string} [opts.activeGroup]  nome do grupo escolhido (spellSet, TC-0011)
 * @returns {Set<string>}
 */
export function expandedSpellNames(entity, { db, classLevel, maxSlotLevel = 0, activeGroup = null }) {
  const out = new Set();
  const groups = entity?.additionalSpells ?? [];
  // Grupos são ALTERNATIVAS (TC-0011): com mais de um, vale só o ESCOLHIDO -
  // mesma semântica que `grantedSpells` usa para conceder (sem escolha, nada
  // vale). Hoje todo grupo traz o MESMO `expanded` (as afinidades do Divine
  // Soul), mas seguir a regra mantém a semântica certa p/ conteúdo futuro.
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
      // `{all: "level=N|class=X"}`: as listas das classes X, só nos círculos N.
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

/**
 * Rótulo do badge quando quem alarga é a CLASSE (a subclasse usa o próprio
 * nome, que já é informativo: "The Genie", "Divine Soul"). Puramente COSMÉTICO -
 * o `expanded` da classe não diz de qual feature veio, e "Bard" como badge não
 * explica nada. Sem entrada, cai no nome da entidade.
 */
const CLASS_WIDENING_LABELS = {
  'Bard|XPHB': 'Magical Secrets',
};

/**
 * Conjunto "on-list" EXTRA de uma origem de classe: o que o `expanded` da classe
 * e o da subclasse acrescentam. Devolve também de ONDE veio cada magia, para o
 * badge do seletor.
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
