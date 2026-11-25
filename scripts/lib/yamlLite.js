// =============================================================================
// yamlLite: parser do SUBCONJUNTO de YAML que os packs do dnd5e usam
// =============================================================================
// O QUE FAZ
//   Os arquivos de `packs/_source` são GERADOS pelo próprio dnd5e, então o YAML é
//   regular: indentação de 2 espaços, mapas e listas, escalares simples ou entre
//   aspas e escalares de bloco (`|`/`>`), sem âncoras nem alias (medido: 0 dos 336
//   arquivos de classes24/origins24 usa `&`/`*` num bloco de activities). É bem
//   menos do que um parser de YAML completo cobre, e evita uma dependência nova só
//   para o gerador.
//
// FUNÇÕES
//   scalar(raw): escalar YAML -> número, booleano, null ou string sem aspas.
//   tokenize(text): as linhas úteis (sem comentário de linha inteira nem linha
//     vazia), com o recuo.
//   blockScalar(lines, start, indent, style): o corpo de um escalar de BLOCO (`|`,
//     `>`, `|-`, `>-`); `>` dobra as quebras em espaço, `|` as preserva.
//   parseBlock(lines, start, indent): um bloco (mapa ou lista) a partir de start.
//   parseList, parseMap: os dois casos do bloco; `- chave: valor` abre um mapa
//     cujo recuo é o do traço + 2.
//   parseYaml(text): o documento -> objeto JS.
//
// DECISÕES E ARMADILHAS
//   - Se o formato do pack sair desse subconjunto, o certo é trocar isto por uma
//     biblioteca de verdade, não remendar o parser.
// -----------------------------------------------------------------------------

/** Escalar YAML -> valor JS. */
function scalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === '[]') return [];
  if (s === '{}') return {};
  if (/^'(.*)'$/s.test(s)) return s.slice(1, -1).replace(/''/g, "'");
  if (/^"(.*)"$/s.test(s)) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  return s;
}

/** As linhas úteis, com o recuo. */
function tokenize(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    out.push({ indent: line.match(/^ */)[0].length, text: line.trim(), i });
  }
  return out;
}

/** O corpo de um escalar de BLOCO. */
function blockScalar(lines, start, indent, style) {
  const body = [];
  let i = start;
  while (i < lines.length && lines[i].indent > indent) {
    body.push(lines[i].text);
    i += 1;
  }
  const joined = style.startsWith('>') ? body.join(' ') : body.join('\n');
  return { value: joined, next: i };
}

/** Um bloco (mapa ou lista) a partir de `start`, no recuo `indent`. */
function parseBlock(lines, start, indent) {
  if (start >= lines.length || lines[start].indent < indent) return { value: null, next: start };
  const isList = lines[start].text.startsWith('- ') || lines[start].text === '-';
  return isList ? parseList(lines, start, indent) : parseMap(lines, start, indent);
}

function parseList(lines, start, indent) {
  const out = [];
  let i = start;
  while (i < lines.length && lines[i].indent === indent && (lines[i].text === '-' || lines[i].text.startsWith('- '))) {
    const rest = lines[i].text.slice(1).trim();
    if (!rest) {
      const sub = parseBlock(lines, i + 1, indent + 2);
      out.push(sub.value);
      i = sub.next;
      continue;
    }
    if (/^[^:\s][^:]*:( |$)/.test(rest)) {
      const inner = [{ indent: indent + 2, text: rest }];
      let j = i + 1;
      while (j < lines.length && lines[j].indent > indent) {
        inner.push(lines[j]);
        j += 1;
      }
      out.push(parseMap(inner, 0, indent + 2).value);
      i = j;
      continue;
    }
    out.push(scalar(rest));
    i += 1;
  }
  return { value: out, next: i };
}

function parseMap(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length && lines[i].indent === indent) {
    const m = lines[i].text.match(/^([^:]+):(?:\s+(.*))?$/);
    if (!m) break;
    const key = scalar(m[1]);
    const rest = (m[2] ?? '').trim();
    if (/^[|>][-+]?$/.test(rest)) {
      const b = blockScalar(lines, i + 1, indent, rest);
      out[key] = b.value;
      i = b.next;
    } else if (rest === '') {
      const sub = parseBlock(lines, i + 1, indent + 2);
      out[key] = sub.value === null ? null : sub.value;
      i = sub.next;
    } else {
      out[key] = scalar(rest);
      i += 1;
    }
  }
  return { value: out, next: i };
}

/**
 * Documento YAML (do subconjunto) -> objeto JS.
 * @param {string} text
 * @returns {object}
 */
export function parseYaml(text) {
  const lines = tokenize(text);
  if (!lines.length) return {};
  return parseBlock(lines, 0, lines[0].indent).value ?? {};
}
