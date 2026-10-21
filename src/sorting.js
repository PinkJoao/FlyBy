// =============================================================================
// sorting: a ordenação escolhida pelo botão de ordenar (opção e direção)
// =============================================================================
// O QUE FAZ
//   O que o SortButton e as listas compartilham: a opção "Name" padrão, o passo
//   de escolha (outra opção começa na direção natural dela; a mesma opção de novo
//   inverte), o rótulo da direção, e a ordenação de uma lista por uma opção.
//   Uma opção é `{ value, label, defaultDir?, dirLabels?, keyOf? }`: `keyOf(raw)`
//   dá a chave; sem ele, a ordem natural da lista é a da própria opção.
//
// FUNÇÕES
//   nextSort(current, option): a ordenação depois de escolher `option`.
//   dirLabel(option, dir): "A to Z", "Low to high"... da direção.
//   sortName(name): o nome para ordenar, com o "+N" do começo levado ao fim.
//   compareValues(a, b): número com número, texto com texto; vazio por último.
//   sortList(list, { option, dir, rawOf, nameOf }): uma cópia ordenada.
//
// DECISÕES E ARMADILHAS
//   - Cada opção tem a sua direção NATURAL (`defaultDir`): o peso começa do mais
//     pesado, como já era; trocar de opção nunca herda a direção da anterior.
//   - Vazio (chave null ou undefined) fica no FIM nas duas direções: um item sem
//     preço não deve abrir a lista nem ao inverter.
//   - Empate cai no nome e, por fim, na posição original (a ordenação é estável).
//   - "+1 Arrow" ordena como "Arrow +1" (sortName): o "+" viria antes de toda
//     letra e jogaria os itens mágicos de bônus no topo da loja, longe do básico.
//   - Texto compara por um Intl.Collator único (rápido o bastante para os ~7700
//     itens do glossário a cada tecla, e "Arrows (20)" depois de "Arrows (5)").
// -----------------------------------------------------------------------------

const COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** O nome para ordenar: um "+1 Arrow" vira "Arrow +1", ao lado da flecha comum. */
export function sortName(name) {
  const m = /^\+(\d+)\s+(.*)$/.exec(String(name ?? ''));
  return m ? `${m[2]} +${m[1]}` : String(name ?? '');
}

export const NAME_SORT = { value: 'name', label: 'Name', defaultDir: 'asc', dirLabels: ['A to Z', 'Z to A'], keyOf: (raw) => sortName(raw?.name) };

/** A ordenação depois de escolher `option` (a mesma de novo inverte). */
export function nextSort(current, option) {
  if (current?.value === option.value) return { value: option.value, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { value: option.value, dir: option.defaultDir ?? 'asc' };
}

/** O rótulo da direção de uma opção. */
export function dirLabel(option, dir) {
  const [asc, desc] = option?.dirLabels ?? ['Low to high', 'High to low'];
  return dir === 'desc' ? desc : asc;
}

/** Número com número, texto com texto; vazio por último. */
export function compareValues(a, b) {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return COLLATOR.compare(String(a), String(b));
}

/** Uma cópia de `list` ordenada pela opção e direção. */
export function sortList(list, { option, dir, rawOf = (x) => x, nameOf = (x) => rawOf(x)?.name ?? '' }) {
  if (!option) return list;
  if (!option.keyOf) return dir === (option.defaultDir ?? 'asc') ? list : [...list].reverse();
  const sign = dir === 'desc' ? -1 : 1;
  return list
    .map((item, index) => ({ item, index, key: option.keyOf(rawOf(item)) }))
    .sort((x, y) => {
      const emptyX = x.key == null || x.key === '';
      const emptyY = y.key == null || y.key === '';
      if (emptyX !== emptyY) return emptyX ? 1 : -1;
      const c = compareValues(x.key, y.key) * sign;
      if (c !== 0) return c;
      const n = COLLATOR.compare(String(nameOf(x.item)), String(nameOf(y.item)));
      return n !== 0 ? n : x.index - y.index;
    })
    .map((x) => x.item);
}
