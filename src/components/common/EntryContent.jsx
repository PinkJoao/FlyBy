// =============================================================================
// EntryContent - renderiza a estrutura de `entries` do 5etools
// =============================================================================
// Converte o markup do 5etools (objetos aninhados + tags inline {@...}) em
// React. Cobre os casos comuns de raça/talento: strings, blocos `entries`
// nomeados, listas, insets, citações, tabelas e imagens. Tags de referência
// ({@spell ...}, {@variantrule ...}, etc.) viram o texto exibido (antes do "|").
// -----------------------------------------------------------------------------

import { useContext } from 'react';
import { DataContext } from '../../data/dataContext';
import { glossaryFor, lookupRule, parseTagContent, GLOSSARY_TAGS } from '../../engine/glossary';
import { lookupEntityLink, isEntityTag, entityTagDisplay } from './entityLinks';
import { imgUrl } from './media';
import { showImageViewer } from '../../store/imageViewerStore';
import TableViewer from './TableViewer';
import { showRulePopup } from './RulePopup';
import { showDetailPopup } from './detailPopup';
import styles from './EntryContent.module.css';

// --- Inline: resolve as tags {@tag conteúdo} (com aninhamento balanceado) ----
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
    // Como o 5etools imprime: {@dc 15} → "DC 15"; {@hit 5} → "+5".
    case 'dc':
      return <span key={key}>DC {display}</span>;
    case 'hit':
      return <span key={key}>{/^[+-]/.test(display) ? display : `+${display}`}</span>;
    // Sem alvo no db (quickref/creature não são baixados), mas o texto exibido
    // respeita a gramática de pipes própria de cada uma.
    case 'quickref':
      return <span key={key}>{content.split('|')[4]?.trim() || display}</span>;
    // {@table Nome|Fonte|display}: inerte (tabelas moram em book/gendata), mas o
    // display do 3º pipe deve valer - "three {@table Skill List; Skills|XPHB|
    // skills}" imprime "skills", não o nome da tabela. NÃO generalizar para o
    // default: {@filter} tem display no 1º segmento e filtros nos seguintes.
    case 'creature':
    case 'table':
      return (
        <span key={key} className={styles.ref}>
          {renderInline(parseTagContent(content).display, key)}
        </span>
      );
    default:
      // Tags de referência. As do GLOSSÁRIO (condition/variantrule/action/…)
      // viram links que abrem o popup da regra; as de ENTIDADE (spell/item/
      // feat/…) abrem o preview da entidade (DDL-0025); as demais ficam como
      // hoje: o texto exibido, estilizado mas inerte.
      if (tag in GLOSSARY_TAGS) return <RuleLink key={key} tag={tag} content={content} />;
      if (isEntityTag(tag)) return <EntityLink key={key} tag={tag} content={content} />;
      return (
        <span key={key} className={styles.ref}>
          {renderInline(display, key)}
        </span>
      );
  }
}

// --- TapLink: span clicável compartilhado por RuleLink/EntityLink ------------
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

// --- RuleLink: menção de regra tappável (glossário) --------------------------
// Componente (não helper puro) para poder ler o db via contexto. Fora do
// DataProvider, ou quando o termo não resolve, degrada para o span inerte - um
// link nunca pode ser "morto".
function RuleLink({ tag, content }) {
  const ctx = useContext(DataContext);
  const hit = ctx?.db ? lookupRule(glossaryFor(ctx.db), tag, content) : null;
  if (!hit) {
    // Sem match: span inerte, mas com o display correto da gramática de pipes
    // (3º segmento quando presente - ex: "{@variantrule weapon mastery
    // properties|XPHB|mastery properties}" exibe "mastery properties").
    return <span className={styles.ref}>{renderInline(parseTagContent(content).display, 'rl')}</span>;
  }
  return <TapLink display={hit.display} onOpen={() => showRulePopup(hit.entry)} />;
}

// --- EntityLink: menção de entidade tappável ({@spell}, {@item}, {@feat}…) ---
// Abre o preview EXISTENTE da entidade (DetailView, o mesmo do seletor) no
// dialog stack; tipos sem entity própria (background, classFeature…) abrem o
// popup de regra. Mesma degradação inerte do RuleLink quando não resolve.
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

// --- Bloco: cada item de um array de `entries` ------------------------------
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
    // Item NOMEADO de lista (ex: as opções de Celestial Revelation do Aasimar ou
    // as estações do Eladrin). Pode ter `entries` (array) OU `entry` (singular).
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
    // Bloco de OPÇÕES ("escolha uma das seguintes") → cada opção vira um CARD
    // distinto, com nome em destaque. Separa visualmente as opções entre si e da
    // prosa ao redor (ex: distinguir Fighting Styles dos Blade Flourishes).
    case 'options':
      return (
        <div key={key} className={styles.section}>
          {entry.name && <span className={styles.entryName}>{entry.name}. </span>}
          <div className={styles.optionCards}>
            {(entry.entries ?? []).map((opt, idx) => renderOptionCard(opt, `${key}-o-${idx}`))}
          </div>
        </div>
      );
    // Referências que não foram pré-resolvidas: mostra ao menos o nome (evita
    // buracos no texto). refSubclassFeature normalmente já vem resolvido.
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
      // Fallback p/ `entry` singular (alguns tipos usam string única).
      if (entry.entry != null) return <p key={key}>{renderInline(String(entry.entry), key)}</p>;
      return null;
  }
}

function renderList(entries, key) {
  return (entries ?? []).map((e, idx) => renderEntry(e, `${key}-${idx}`));
}

/** Uma opção de um bloco `options` renderizada como card (nome + corpo). */
function renderOptionCard(opt, key) {
  if (opt && typeof opt === 'object') {
    // opção NOMEADA já resolvida (entries/item/section) → título + corpo
    if (['entries', 'item', 'section'].includes(opt.type)) {
      const body = opt.entries ?? (opt.entry != null ? [opt.entry] : []);
      return (
        <div key={key} className={styles.optionCard}>
          {opt.name && <span className={styles.optionCardName}>{opt.name}</span>}
          {renderList(body, key)}
        </div>
      );
    }
    // referência não resolvida → card só com o nome
    if (typeof opt.type === 'string' && opt.type.startsWith('ref')) {
      const ref = opt.optionalfeature ?? opt.subclassFeature ?? opt.classFeature;
      return (
        <div key={key} className={styles.optionCard}>
          <span className={styles.optionCardName}>{refName(ref)}</span>
        </div>
      );
    }
  }
  // string ou outro tipo → card simples
  return (
    <div key={key} className={styles.optionCard}>
      {renderEntry(opt, key)}
    </div>
  );
}

/** "Ambush|TCE" / "Manifest Echo|Fighter||…" → "Ambush" / "Manifest Echo". */
function refName(ref) {
  return String(ref ?? '').split('|')[0];
}

function renderTable(entry, key) {
  const rows = entry.rows ?? [];
  // Cabeçalho: `colLabelRows` (várias linhas, células podem ser objetos
  // {type:'cellHeader', entry, width}) tem prioridade sobre `colLabels` (linha
  // única de strings). Antes só colLabels era tratado - tabelas como "Travel
  // Pace" (só colLabelRows) renderizavam sem cabeçalho.
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

/** Render INLINE de uma string 5etools (tags {@...}) - p/ headers de tabela etc. */
export function InlineEntry({ text }) {
  return renderInline(String(text ?? ''), 'inl');
}
