// =============================================================================
// EntryContent: renderiza a estrutura de entries do 5etools
// =============================================================================
// O QUE FAZ
//   Converte o markup do 5etools (objetos aninhados e tags inline {@...}) em React:
//   strings, blocos `entries` nomeados, listas, insets, citações, tabelas e
//   imagens. As tags de GLOSSÁRIO viram links para o popup da regra (DDL-0020); as
//   de ENTIDADE abrem o preview da entidade (DDL-0025); as demais mostram o texto
//   exibido, inertes.
//
// FUNÇÕES
//   renderInline(str, key), renderTag(tag, content, key): as tags, com aninhamento
//     balanceado.
//   TapLink(props): o span clicável comum.
//   RuleLink(props), TableLink(props), EntityLink(props): os links (componentes,
//     para ler o db pelo contexto).
//   renderEntry(entry, key), renderList(entries, key), renderOptionCard(opt, key),
//     refName(ref), renderTable(entry, key): os blocos.
//   EntryContent(props): o renderizador.
//   InlineEntry(props): uma string com tags, inline (cabeçalhos de tabela).
//
// DECISÕES E ARMADILHAS
//   - Link nunca é morto: fora do DataProvider ou sem match, o span inerte, com o
//     display certo da gramática de pipes.
//   - {@dc 15} vira "DC 15", {@hit 5} vira "+5". Tags sem alvo no db (quickref,
//     creature: o bestiário não é baixado) ficam inertes.
//   - {@table Nome|Fonte|display}: o 3º pipe é o texto exibido. As ~2300 tabelas
//     estão carregadas desde o DDL-0035; o que não resolver vira texto.
//   - Item NOMEADO de lista aceita `entries` ou `entry`; um bloco de OPÇÕES vira
//     um card por opção (separa os Fighting Styles dos Blade Flourishes); ref não
//     resolvida mostra ao menos o nome.
//   - Cabeçalho de tabela: `colLabelRows` (várias linhas, células objeto) tem
//     prioridade sobre `colLabels`; antes a "Travel Pace" saía sem cabeçalho.
// -----------------------------------------------------------------------------

import { useContext } from 'react';
import { DataContext } from '../../data/dataContext';
import { glossaryFor, lookupRule, lookupTable, parseTagContent, GLOSSARY_TAGS } from '../../engine/glossary';
import { lookupEntityLink, isEntityTag, entityTagDisplay } from './entityLinks';
import { imgUrl } from './media';
import { showImageViewer } from '../../store/imageViewerStore';
import TableViewer from './TableViewer';
import { showRulePopup } from './RulePopup';
import { showDetailPopup } from './detailPopup';
import styles from './EntryContent.module.css';

function renderInline(str, key = 't') {
  if (typeof str !== 'string') return str;
  const nodes = [];
  let i = 0;
  let n = 0;
  while (i < str.length) {
    const open = str.indexOf('{@', i);
    if (open === -1) {
      nodes.push(str.slice(i));
      break;
    }
    if (open > i) nodes.push(str.slice(i, open));
    let depth = 0;
    let j = open;
    for (; j < str.length; j++) {
      if (str[j] === '{') depth++;
      else if (str[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = str.slice(open + 2, j);
    const sp = inner.indexOf(' ');
    const tag = sp === -1 ? inner : inner.slice(0, sp);
    const content = sp === -1 ? '' : inner.slice(sp + 1);
    nodes.push(renderTag(tag, content, `${key}-${n++}`));
    i = j + 1;
  }
  return nodes;
}

function renderTag(tag, content, key) {
  const display = content.split('|')[0];
  switch (tag) {
    case 'b':
    case 'bold':
      return <strong key={key}>{renderInline(content, key)}</strong>;
    case 'i':
    case 'italic':
      return <em key={key}>{renderInline(content, key)}</em>;
    case 'note':
      return (
        <span key={key} style={{ opacity: 0.75 }}>
          {renderInline(content, key)}
        </span>
      );
    case 'dice':
    case 'damage':
    case 'scaledice':
    case 'scaledamage':
    case 'chance':
      return <span key={key}>{display}</span>;
    case 'dc':
      return <span key={key}>DC {display}</span>;
    case 'hit':
      return <span key={key}>{/^[+-]/.test(display) ? display : `+${display}`}</span>;
    case 'quickref':
      return <span key={key}>{content.split('|')[4]?.trim() || display}</span>;
    // ATENÇÃO: não generalize para o default; o {@filter} tem o display no 1º segmento.
    case 'table':
      return <TableLink key={key} content={content} />;
    case 'creature':
      return (
        <span key={key} className={styles.ref}>
          {renderInline(parseTagContent(content).display, key)}
        </span>
      );
    default:
      if (tag in GLOSSARY_TAGS) return <RuleLink key={key} tag={tag} content={content} />;
      if (isEntityTag(tag)) return <EntityLink key={key} tag={tag} content={content} />;
      return (
        <span key={key} className={styles.ref}>
          {renderInline(display, key)}
        </span>
      );
  }
}

function TapLink({ display, onOpen }) {
  const open = (e) => {
    e.stopPropagation();
    onOpen();
  };
  return (
    <span
      role="button"
      tabIndex={0}
      className={`${styles.ref} ${styles.refLink}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open(e);
        }
      }}
    >
      {renderInline(display, 'rl')}
    </span>
  );
}

function RuleLink({ tag, content }) {
  const ctx = useContext(DataContext);
  const hit = ctx?.db ? lookupRule(glossaryFor(ctx.db), tag, content) : null;
  if (!hit) {
    return <span className={styles.ref}>{renderInline(parseTagContent(content).display, 'rl')}</span>;
  }
  return <TapLink display={hit.display} onOpen={() => showRulePopup(hit.entry)} />;
}

function TableLink({ content }) {
  const ctx = useContext(DataContext);
  const { name, source, display } = parseTagContent(content);
  const hit = ctx?.db ? lookupTable(ctx.db, name, source) : null;
  if (!hit) return <span className={styles.ref}>{renderInline(display, 'tl')}</span>;
  return <TapLink display={display} onOpen={() => showRulePopup(hit)} />;
}

function EntityLink({ tag, content }) {
  const ctx = useContext(DataContext);
  const hit = ctx?.db ? lookupEntityLink(ctx.db, tag, content) : null;
  if (!hit) {
    return <span className={styles.ref}>{renderInline(entityTagDisplay(tag, content), 'rl')}</span>;
  }
  const open =
    hit.kind === 'entity'
      ? () => showDetailPopup({ entity: hit.entity, raw: hit.raw, db: ctx.db })
      : () => showRulePopup(hit.entry);
  return <TapLink display={hit.display} onOpen={open} />;
}

function renderEntry(entry, key) {
  if (entry == null) return null;
  if (typeof entry === 'string' || typeof entry === 'number') {
    return <p key={key}>{renderInline(String(entry), key)}</p>;
  }
  switch (entry.type) {
    case 'entries':
    case 'section':
      return (
        <div key={key} className={styles.section}>
          {entry.name && <span className={styles.entryName}>{entry.name}. </span>}
          {renderList(entry.entries, key)}
        </div>
      );
    case 'list':
      return (
        <ul key={key}>
          {(entry.items ?? []).map((it, idx) => (
            <li key={idx}>{typeof it === 'string' ? renderInline(it, `${key}-${idx}`) : renderList([it], `${key}-${idx}`)}</li>
          ))}
        </ul>
      );
    case 'item':
      return (
        <div key={key} className={styles.section}>
          {entry.name && <span className={styles.entryName}>{entry.name}. </span>}
          {entry.entry != null ? renderInline(String(entry.entry), key) : renderList(entry.entries, key)}
        </div>
      );
    case 'inset':
    case 'insetReadaloud':
      return (
        <div key={key} className={styles.inset}>
          {entry.name && <span className={styles.entryName}>{entry.name}. </span>}
          {renderList(entry.entries, key)}
        </div>
      );
    case 'quote':
      return (
        <div key={key} className={styles.quote}>
          {renderList(entry.entries, key)}
        </div>
      );
    case 'image': {
      const src = imgUrl(entry.href);
      if (!src) return null;
      const credit = entry.credit || entry.title;
      return (
        <button
          key={key}
          type="button"
          className={styles.imageBtn}
          onClick={() => showImageViewer([{ src, credit }])}
          title="Expand image"
        >
          <img className={styles.image} src={src} alt={entry.title || ''} loading="lazy" />
        </button>
      );
    }
    case 'table':
      return renderTable(entry, key);
    case 'options':
      return (
        <div key={key} className={styles.section}>
          {entry.name && <span className={styles.entryName}>{entry.name}. </span>}
          <div className={styles.optionCards}>
            {(entry.entries ?? []).map((opt, idx) => renderOptionCard(opt, `${key}-o-${idx}`))}
          </div>
        </div>
      );
    case 'refOptionalfeature':
      return (
        <p key={key} className={styles.ref}>
          {refName(entry.optionalfeature)}
        </p>
      );
    case 'refSubclassFeature':
      return (
        <p key={key} className={styles.ref}>
          {refName(entry.subclassFeature)}
        </p>
      );
    case 'refClassFeature':
      return (
        <p key={key} className={styles.ref}>
          {refName(entry.classFeature)}
        </p>
      );
    default:
      if (entry.entries) return <div key={key}>{renderList(entry.entries, key)}</div>;
      if (entry.entry != null) return <p key={key}>{renderInline(String(entry.entry), key)}</p>;
      return null;
  }
}

function renderList(entries, key) {
  return (entries ?? []).map((e, idx) => renderEntry(e, `${key}-${idx}`));
}

/** Uma opção de um bloco `options` como card. */
function renderOptionCard(opt, key) {
  if (opt && typeof opt === 'object') {
    if (['entries', 'item', 'section'].includes(opt.type)) {
      const body = opt.entries ?? (opt.entry != null ? [opt.entry] : []);
      return (
        <div key={key} className={styles.optionCard}>
          {opt.name && <span className={styles.optionCardName}>{opt.name}</span>}
          {renderList(body, key)}
        </div>
      );
    }
    if (typeof opt.type === 'string' && opt.type.startsWith('ref')) {
      const ref = opt.optionalfeature ?? opt.subclassFeature ?? opt.classFeature;
      return (
        <div key={key} className={styles.optionCard}>
          <span className={styles.optionCardName}>{refName(ref)}</span>
        </div>
      );
    }
  }
  return (
    <div key={key} className={styles.optionCard}>
      {renderEntry(opt, key)}
    </div>
  );
}

/** "Ambush|TCE" vira "Ambush". */
function refName(ref) {
  return String(ref ?? '').split('|')[0];
}

function renderTable(entry, key) {
  const rows = entry.rows ?? [];
  const headerRows = entry.colLabelRows ?? (entry.colLabels ? [entry.colLabels] : null);
  const colCount = rows[0]?.length ?? entry.colLabels?.length ?? 1;
  return (
    <TableViewer key={key}>
      <table className="data-table">
        {headerRows && (
          <thead>
            {headerRows.map((hr, hi) => (
              <tr key={hi}>
                {hr.map((c, idx) => {
                  const obj = c && typeof c === 'object';
                  const text = obj ? c.entry ?? c.name ?? '' : String(c);
                  const span = obj && c.width > 1 ? c.width : undefined;
                  return (
                    <th key={idx} colSpan={span}>{renderInline(String(text), `${key}-h-${hi}-${idx}`)}</th>
                  );
                })}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                <td key={ci}>{typeof cell === 'string' ? renderInline(cell, `${key}-${ri}-${ci}`) : renderList([cell], `${key}-${ri}-${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {entry.footnotes?.length > 0 && (
          <tfoot>
            {entry.footnotes.map((fn, fi) => (
              <tr key={fi}>
                <td colSpan={colCount} className={styles.footnote}>{renderInline(String(fn), `${key}-fn-${fi}`)}</td>
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </TableViewer>
  );
}

export default function EntryContent({ entries }) {
  if (!entries?.length) return null;
  return <div className={styles.content}>{renderList(entries, 'e')}</div>;
}

/** Render inline de uma string do 5etools. */
export function InlineEntry({ text }) {
  return renderInline(String(text ?? ''), 'inl');
}
