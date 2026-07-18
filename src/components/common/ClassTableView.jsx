// =============================================================================
// ClassTableView - a tabela de progressão da classe (linha atual + completa)
// =============================================================================
// Extraído do ClassProgression para ser reutilizável: onde quer que um texto de
// feature mencione "the … Features table" (magias, invocações, weapon mastery…),
// mostramos a tabela ao lado. Por padrão só a LINHA do nível atual; um botão
// expande p/ a tabela inteira (linha atual destacada). Reusa `classTable` (engine)
// + TableViewer (scroll/fullscreen).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { classTable } from '../../engine/classProgression';
import { InlineEntry } from './EntryContent';
import TableViewer from './TableViewer';
import styles from './ClassTableView.module.css';

export default function ClassTableView({ classObj, subclass = null, level }) {
  const [full, setFull] = useState(false);
  const table = classTable(classObj, subclass);
  if (!table) return null;

  const renderTable = (rows) => (
    <table className="data-table data-table--center">
      <thead>
        <tr>
          {table.cols.map((c, i) => (
            <th key={i}>
              <InlineEntry text={c} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]} className={row[0] === String(level) ? styles.rowCurrent : undefined}>
            {row.map((v, i) => (
              <td key={i}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <TableViewer
      fullscreenChildren={renderTable(table.rows)}
      footer={
        <button type="button" className={styles.tableToggle} onClick={() => setFull((v) => !v)}>
          {full ? 'Show current level only' : 'Show full table'}
        </button>
      }
    >
      {renderTable(full ? table.rows : table.rows.slice(level - 1, level))}
    </TableViewer>
  );
}
