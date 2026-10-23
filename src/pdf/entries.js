// =============================================================================
// entries: o texto do 5etools como blocos prontos para a ficha PDF
// =============================================================================
// O QUE FAZ
//   Puro. Converte as `entries` do 5etools (strings com tags {@...}, blocos
//   nomeados, listas, tabelas, insets, opções) numa lista de blocos que o
//   documento só desenha:
//     { type: 'p', lead?, runs }       parágrafo; `lead` é o nome em negrito
//     { type: 'list', items }          cada item é uma lista de blocos
//     { type: 'table', caption, head, rows }   células são listas de runs
//     { type: 'inset', name, blocks }  quadro destacado
//   Um run é { text, b?, i? }.
//
// FUNÇÕES
//   tagRuns(tag, content, style): o run de uma tag, pela gramática dela.
//   inlineRuns(str, style): uma string com tags em runs, com aninhamento.
//   mergeRuns(runs): funde runs vizinhos de mesmo estilo.
//   abilityLine(entry): as linhas `abilityDc` e `abilityAttackMod`.
//   refName(ref): o nome de uma referência ("Ambush|TCE" vira "Ambush").
//   toBlocks(entries): os blocos.
//   runsText(runs), blocksText(blocks): o texto puro (contagens e testes).
//
// DECISÕES E ARMADILHAS
//   - A exibição das tags segue o EntryContent do app (o display de cada
//     gramática de pipes), mais o que a ficha precisa e a tela não: {@atkr m}
//     vira "Melee Attack Roll:", {@actSave wis} vira "Wisdom Saving Throw:", e
//     {@scaledamage 8d6|3-9|1d6} mostra o ÚLTIMO segmento, o dado por círculo.
//   - O nome de um bloco vira o `lead` do primeiro parágrafo dele, como no
//     livro ("Spellcasting. You can cast..."); sem parágrafo logo de cara, sai um
//     parágrafo só com o lead.
//   - Referências (refClassFeature, refSubclassFeature, refOptionalfeature)
//     saem como o nome em itálico: a feature citada tem a própria entrada.
//   - Imagens são ignoradas: a ficha não leva arte (DDL-0003, DDL-0105).
// -----------------------------------------------------------------------------

import { GLOSSARY_TAGS, parseTagContent } from '../engine/glossary';

const ENTITY_TAGS = new Set(['spell', 'item', 'feat', 'optfeature', 'race', 'class', 'language', 'background', 'creature', 'deity', 'reward', 'vehicle', 'object', 'trap', 'hazard', 'psionic', 'boon', 'cult', 'card', 'deck']);

const ABILITY = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const ATK = {
  m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:', 'm,r': 'Melee or Ranged Attack Roll:',
  mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:', ms: 'Melee Spell Attack:',
  rs: 'Ranged Spell Attack:', 'mw,rw': 'Melee or Ranged Weapon Attack:', 'ms,rs': 'Melee or Ranged Spell Attack:',
};

const LABEL_TAGS = {
  h: 'Hit:', m: 'Miss:', hom: 'Hit or Miss:', actSaveFail: 'Failure:', actSaveSuccess: 'Success:',
  actSaveSuccessOrFail: 'Failure or Success:', actTrigger: 'Trigger:', actResponse: 'Response:',
};

/** O run de uma tag. */
function tagRuns(tag, content, style) {
  const parts = String(content ?? '').split('|');
  const first = parts[0];
  switch (tag) {
    case 'b':
    case 'bold':
      return inlineRuns(content, { ...style, b: true });
    case 'i':
    case 'italic':
      return inlineRuns(content, { ...style, i: true });
    case 'note':
      return inlineRuns(content, { ...style, i: true });
    case 'dice':
    case 'damage':
    case 'chance':
    case 'd20':
      if (tag === 'd20') return [{ ...style, text: /^[+-]/.test(first) ? first : `+${first}` }];
      return [{ ...style, text: tag === 'chance' ? `${first} percent` : first }];
    case 'scaledice':
    case 'scaledamage':
      return [{ ...style, text: parts[parts.length - 1] }];
    case 'dc':
      return [{ ...style, text: `DC ${first}` }];
    case 'hit':
      return [{ ...style, text: /^[+-]/.test(first) ? first : `+${first}` }];
    case 'recharge':
      return [{ ...style, text: first ? `(Recharge ${first}${first === '6' ? '' : '-6'})` : '(Recharge 6)' }];
    case 'atk':
    case 'atkr':
      return [{ ...style, i: true, text: ATK[first] ?? first }];
    case 'actSave':
      return [{ ...style, i: true, text: `${ABILITY[first] ?? first} Saving Throw:` }];
    case 'quickref':
      return inlineRuns(parts[4]?.trim() || first, style);
    case 'classFeature':
      return inlineRuns(parts[5]?.trim() || first, style);
    case 'subclassFeature':
      return inlineRuns(parts[7]?.trim() || first, style);
    case 'subclass':
      return inlineRuns(parts[4]?.trim() || first, style);
    default:
      if (LABEL_TAGS[tag]) return [{ ...style, i: true, text: LABEL_TAGS[tag] }];
      if (tag in GLOSSARY_TAGS || ENTITY_TAGS.has(tag) || tag === 'table') {
        return inlineRuns(parseTagContent(content).display, style);
      }
      return inlineRuns(first, style);
  }
}

/** Uma string com tags em runs, respeitando o aninhamento. */
export function inlineRuns(str, style = {}) {
  const s = String(str ?? '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{@', i);
    if (open === -1) {
      out.push({ ...style, text: s.slice(i) });
      break;
    }
    if (open > i) out.push({ ...style, text: s.slice(i, open) });
    let depth = 0;
    let j = open;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = s.slice(open + 2, j);
    const sp = inner.indexOf(' ');
    const tag = sp === -1 ? inner : inner.slice(0, sp);
    const content = sp === -1 ? '' : inner.slice(sp + 1);
    out.push(...tagRuns(tag, content, style));
    i = j + 1;
  }
  return mergeRuns(out);
}

/** Funde runs vizinhos de mesmo estilo e descarta os vazios. */
function mergeRuns(runs) {
  const out = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/** "Spell save DC = 8 + your Proficiency Bonus + your Wisdom modifier". */
function abilityLine(entry) {
  const abil = (entry.attributes ?? []).map((a) => ABILITY[a] ?? a).join(' or ');
  if (entry.type === 'abilityDc') {
    return { type: 'p', lead: `${entry.name} save DC`, runs: [{ text: `8 + your Proficiency Bonus + your ${abil} modifier` }] };
  }
  return { type: 'p', lead: `${entry.name} attack modifier`, runs: [{ text: `your Proficiency Bonus + your ${abil} modifier` }] };
}

/** O nome de uma referência ("Ambush|TCE" vira "Ambush"). */
const refName = (ref) => String(ref ?? '').split('|')[0];

/**
 * As entries do 5etools como blocos.
 * @param {Array|string|object} entries
 * @returns {object[]}
 */
export function toBlocks(entries) {
  const out = [];
  const list = Array.isArray(entries) ? entries : entries == null ? [] : [entries];

  const named = (name, body) => {
    const inner = toBlocks(body);
    if (inner[0]?.type === 'p' && !inner[0].lead) inner[0] = { ...inner[0], lead: name };
    else inner.unshift({ type: 'p', lead: name, runs: [] });
    out.push(...inner);
  };

  for (const e of list) {
    if (e == null) continue;
    if (typeof e === 'string' || typeof e === 'number') {
      const runs = inlineRuns(String(e));
      if (runs.length) out.push({ type: 'p', runs });
      continue;
    }
    switch (e.type) {
      case 'entries':
      case 'section':
      case 'item':
      case 'itemSub':
      case 'itemSpell': {
        const body = e.entries ?? (e.entry != null ? [e.entry] : []);
        if (e.name) named(inlineRuns(e.name).map((r) => r.text).join(''), body);
        else out.push(...toBlocks(body));
        break;
      }
      case 'list':
        out.push({
          type: 'list',
          items: (e.items ?? []).map((it) => toBlocks([it])).filter((b) => b.length),
        });
        break;
      case 'inset':
      case 'insetReadaloud':
        out.push({ type: 'inset', name: e.name ?? null, blocks: toBlocks(e.entries) });
        break;
      case 'quote':
        out.push(...toBlocks(e.entries).map((b) => (b.type === 'p' ? { ...b, runs: b.runs.map((r) => ({ ...r, i: true })) } : b)));
        if (e.by) out.push({ type: 'p', runs: [{ text: `- ${e.by}`, i: true }] });
        break;
      case 'table': {
        const headRow = e.colLabelRows?.[e.colLabelRows.length - 1] ?? e.colLabels ?? null;
        const cell = (c) => {
          if (c && typeof c === 'object') {
            if (c.type === 'cell') return inlineRuns(String(c.entry ?? c.roll?.exact ?? `${c.roll?.min ?? ''}-${c.roll?.max ?? ''}`));
            return toBlocks([c]).flatMap((b) => b.runs ?? []);
          }
          return inlineRuns(String(c ?? ''));
        };
        out.push({
          type: 'table',
          caption: e.caption ?? null,
          head: headRow ? headRow.map((c) => inlineRuns(String(c && typeof c === 'object' ? c.entry ?? c.name ?? '' : c))) : null,
          rows: (e.rows ?? []).map((row) => (Array.isArray(row) ? row : row?.row ?? [row]).map(cell)),
        });
        break;
      }
      case 'options':
        out.push({
          type: 'list',
          items: (e.entries ?? []).map((o) => toBlocks([o])).filter((b) => b.length),
        });
        break;
      case 'refOptionalfeature':
        out.push({ type: 'p', runs: [{ text: refName(e.optionalfeature), i: true }] });
        break;
      case 'refClassFeature':
        out.push({ type: 'p', runs: [{ text: refName(e.classFeature), i: true }] });
        break;
      case 'refSubclassFeature':
        out.push({ type: 'p', runs: [{ text: refName(e.subclassFeature), i: true }] });
        break;
      case 'abilityDc':
      case 'abilityAttackMod':
        out.push(abilityLine(e));
        break;
      case 'image':
      case 'gallery':
      case 'hr':
        break;
      default:
        if (e.entries) out.push(...toBlocks(e.entries));
        else if (e.entry != null) out.push(...toBlocks([e.entry]));
        break;
    }
  }
  return out;
}

/** O texto puro de uma lista de runs. */
export const runsText = (runs) => (runs ?? []).map((r) => r.text).join('');

/** O texto puro de uma lista de blocos. */
export function blocksText(blocks) {
  return (blocks ?? [])
    .map((b) => {
      if (b.type === 'p') return [b.lead, runsText(b.runs)].filter(Boolean).join('. ');
      if (b.type === 'list') return b.items.map(blocksText).join('\n');
      if (b.type === 'inset') return [b.name, blocksText(b.blocks)].filter(Boolean).join('\n');
      if (b.type === 'table') return b.rows.map((r) => r.map(runsText).join(' | ')).join('\n');
      return '';
    })
    .join('\n');
}
