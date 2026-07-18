// =============================================================================
// FeatureText - texto de uma feature + a tabela da classe quando ele a cita
// =============================================================================
// Muitas features referem "the … Features table" (Spellcasting, Eldritch
// Invocations, Weapon Mastery do Barbarian…). Onde o texto menciona a tabela,
// mostramos a tabela de progressão da classe logo abaixo, para o jogador
// entender de onde vêm os números. `EntryContent` renderiza o markup 5etools;
// `ClassTableView` acrescenta a tabela (linha do nível atual + expandir).
// -----------------------------------------------------------------------------

import EntryContent from './EntryContent';
import ClassTableView from './ClassTableView';

/** O texto (markup 5etools) menciona a tabela de features? Heurística simples:
 * a palavra "table" com fronteira de palavra em qualquer string do bloco. */
function mentionsTable(entries) {
  try {
    return /\btable\b/i.test(JSON.stringify(entries ?? []));
  } catch {
    return false;
  }
}

/**
 * @param {object} props
 * @param {Array} props.entries        entries no formato 5etools
 * @param {object} [props.classObj]    objeto de classe (p/ a tabela)
 * @param {object} [props.subclass]    objeto de subclasse (opcional)
 * @param {number} [props.level]       nível da classe (linha destacada)
 * @param {boolean} [props.forceTable] força a tabela mesmo sem menção
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
