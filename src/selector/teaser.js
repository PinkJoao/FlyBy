// =============================================================================
// teaser: o resumo que o cartão do carrossel mostra, tirado do dado (DDL-0286)
// =============================================================================
// O QUE FAZ
//   As peças com que as entities de classe, espécie e subclasse montam o `teaser`
//   do cartão do carrossel: o primeiro parágrafo de uma descrição e as linhas
//   "Level N: feature, feature". Nada é escrito por nós (§6.4): é o texto e os
//   nomes que o dado traz, com as tags do 5etools, que o EntryContent desenha.
//
// FUNÇÕES
//   firstParagraph(entries): o primeiro parágrafo de texto de uma árvore de entries,
//     pulando citações, quadros e tabelas.
//   featureRefLevels(refs): "Nome|Classe|Fonte|Nível" (ou { classFeature }) para
//     um mapa nível -> nomes.
//   levelLines(byLevel, upTo): as linhas "{@b Level N:} a, b" até o nível pedido.
//   trimEntries(entries, opts): a árvore sem o parágrafo que o resumo já mostrou (`skip`,
//     a primeira ocorrência) e sem o nome de uma seção igual ao da própria entrada
//     (`dropName`); devolve { entries, removed }.
//
// DECISÕES E ARMADILHAS
//   - O "Read more" do carrossel CONTINUA o resumo (DDL-0300): o detalhe abre embaixo dele
//     sem o parágrafo já lido (`trimEntries` com `skip`). E o texto da classe vem numa
//     seção com o nome dela ("Fighter"), que repetiria o título do cartão (`dropName`).
//   - Citação (`quote`) e quadro (`inset`) abrem muita descrição do 5etools com uma
//     frase de personagem; o resumo quer o texto que explica o que a coisa é.
// -----------------------------------------------------------------------------

const SKIP = new Set(['quote', 'inset', 'insetReadaloud', 'table', 'image', 'gallery', 'list']);

/** O primeiro parágrafo de texto de uma árvore de entries, ou null. */
export function firstParagraph(entries) {
  for (const e of entries ?? []) {
    if (typeof e === 'string') {
      if (e.trim()) return e;
      continue;
    }
    if (!e || typeof e !== 'object' || SKIP.has(e.type)) continue;
    const inner = firstParagraph(e.entries);
    if (inner) return inner;
  }
  return null;
}

/** Refs de feature de classe para um mapa nível -> nomes, na ordem do dado. */
export function featureRefLevels(refs) {
  const out = new Map();
  for (const r of refs ?? []) {
    const ref = typeof r === 'string' ? r : r?.classFeature;
    if (!ref) continue;
    const parts = ref.split('|');
    const name = parts[0];
    const level = Number(parts[3]);
    if (!name || !Number.isFinite(level)) continue;
    if (!out.has(level)) out.set(level, []);
    out.get(level).push(name);
  }
  return out;
}

/** As linhas "{@b Level N:} a, b" do mapa nível -> nomes, até `upTo`. */
export function levelLines(byLevel, upTo = Infinity) {
  return [...byLevel.entries()]
    .filter(([level, names]) => level <= upTo && names.length)
    .sort((a, b) => a[0] - b[0])
    .map(([level, names]) => `{@b Level ${level}:} ${[...new Set(names)].join(', ')}`);
}

/** A árvore sem o parágrafo `skip` (a 1a ocorrência) e sem a seção de nome `dropName`. */
export function trimEntries(entries, { skip = null, dropName = null } = {}) {
  let removed = false;
  const drop = dropName ? String(dropName).toLowerCase() : null;
  const walk = (list, top) => {
    const out = [];
    for (const e of list ?? []) {
      if (typeof e === 'string') {
        if (!removed && skip && e === skip) {
          removed = true;
          continue;
        }
        out.push(e);
        continue;
      }
      if (!e || typeof e !== 'object' || !Array.isArray(e.entries)) {
        out.push(e);
        continue;
      }
      const inner = walk(e.entries, false);
      if (!inner.length && e.entries.length) continue;
      const named = top && drop && String(e.name ?? '').toLowerCase() === drop;
      const copy = { ...e, entries: inner };
      if (named) delete copy.name;
      out.push(copy);
    }
    return out;
  };
  const result = walk(entries, true);
  return { entries: result, removed };
}
