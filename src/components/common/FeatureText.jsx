// =============================================================================
// FeatureText: o texto de uma feature, com a tabela da classe quando ele a cita
// =============================================================================
// O QUE FAZ
//   Muitas features citam "the ... Features table" (Spellcasting, Eldritch
//   Invocations, Weapon Mastery). Onde o texto a menciona, a tabela de progressão
//   aparece logo abaixo (ClassTableView), para o jogador ver de onde vêm os números.
//
// FUNÇÕES
//   mentionsTable(entries): heurística, a palavra "table" em qualquer string.
//   FeatureText(props): o texto e a tabela (`forceTable` força).
// -----------------------------------------------------------------------------

import EntryContent from './EntryContent';
import ClassTableView from './ClassTableView';

/** O texto menciona a tabela de features? */
function mentionsTable(entries) {
  try {
    return /\btable\b/i.test(JSON.stringify(entries ?? []));
  } catch {
    return false;
  }
}

/**
 * O texto de uma feature, com a tabela quando citada.
 * @param {object} props
 * @param {Array} props.entries
 * @param {object} [props.classObj]
 * @param {object} [props.subclass]
 * @param {number} [props.level]
 * @param {boolean} [props.forceTable]
 */
export default function FeatureText({ entries, classObj, subclass = null, level, forceTable = false }) {
  const showTable = classObj && (forceTable || mentionsTable(entries));
  return (
    <>
      <EntryContent entries={entries} />
      {showTable && <ClassTableView classObj={classObj} subclass={subclass} level={level} />}
    </>
  );
}
