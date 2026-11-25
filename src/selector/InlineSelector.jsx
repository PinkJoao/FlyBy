// =============================================================================
// InlineSelector: o carrossel de um seletor dentro de uma tela (o guia de criação)
// =============================================================================
// O QUE FAZ
//   O passo de classe, espécie e subclasse do guia mostra o carrossel no próprio
//   passo, sem abrir o painel: deslizar e "Choose". "Search and filter" abre o
//   SelectorPanel completo, já em carrossel (DDL-0286, Q6 do DDL-0285).
//
// FUNÇÕES
//   InlineSelector(props): o carrossel com o contador, o atalho para o painel e o
//     botão de escolher (ou de tirar o já escolhido); no guia, o botão é o do rodapé.
//
// DECISÕES E ARMADILHAS
//   - A lista é a do painel aberto sem busca: o catálogo da entity com o filtro
//     pré-marcado dela (as variantes de cenário das espécies ficam fora) e a ordem
//     padrão. O já escolhido entra mesmo que esse filtro o tire (escolhido pelo
//     painel com o filtro desmarcado), senão o carrossel o perderia de vista.
//   - Com `onChoose` (o guia, DDL-0289) não há botão próprio: o botão principal do
//     rodapé do guia vira "Choose X" enquanto o cartão do centro não é o escolhido
//     (useGuidePrimary), e `onChoose` escolhe e avança. Um botão só, não um de
//     escolher e outro de avançar.
//   - Escolher pelo painel move o carrossel até a escolha (ajuste no render quando
//     `currentId` muda).
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import SelectorCarousel from './SelectorCarousel';
import SelectorPanel from './SelectorPanel';
import { applyFilters } from './filterModel';
import { NAME_SORT, sortList } from '../sorting';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import styles from './InlineSelector.module.css';
import { useGuidePrimary } from '../components/wizard/guidePages';

/**
 * O carrossel de um seletor dentro da tela.
 * @param {{ entity: object, db: object, currentId?: string|null, onSelect: (raw: object) => void,
 *   onClear?: () => void, exclude?: (raw: object) => boolean, onChoose?: (raw: object) => void }} props
 */
export default function InlineSelector({ entity, db, currentId = null, onSelect, onClear, exclude, onChoose }) {
  const [panel, setPanel] = useState(false);

  const items = useMemo(() => {
    const all = entity.list(db).map((r) => ({ id: entity.idOf(r), raw: r, ...entity.precompute(r) }));
    const kept = applyFilters(all, { query: '', filterState: entity.initialFilterState ?? {} }).filter(
      (it) => !exclude?.(it.raw),
    );
    const option = entity.naturalSort ?? NAME_SORT;
    const sorted = sortList(kept, { option, dir: option.defaultDir ?? 'asc', rawOf: (it) => it.raw });
    if (currentId && !sorted.some((it) => it.id === currentId)) {
      const chosen = all.find((it) => it.id === currentId);
      if (chosen) return [chosen, ...sorted];
    }
    return sorted;
  }, [entity, db, exclude, currentId]);

  const indexOf = (id) => Math.max(0, items.findIndex((it) => it.id === id));
  const [index, setIndex] = useState(() => indexOf(currentId));
  const [prev, setPrev] = useState({ currentId, items });
  if (prev.currentId !== currentId || prev.items !== items) {
    setPrev({ currentId, items });
    if (prev.currentId !== currentId && currentId) setIndex(indexOf(currentId));
    else if (index >= items.length) setIndex(0);
  }

  const at = Math.min(index, Math.max(0, items.length - 1));
  const centered = items[at]?.raw ?? null;
  const choosing = !!onChoose && !!centered && items[at].id !== currentId;
  useGuidePrimary(choosing ? `Choose ${centered.name}` : null, () => onChoose(centered));

  return (
    <div className={styles.inline}>
      <div className={styles.bar}>
        <span className={styles.count}>{items.length ? `${at + 1} of ${items.length}` : ''}</span>
        <Button variant="link" size="sm" onClick={() => setPanel(true)} className={styles.search}>
          <Icon name="search" /> Search and filter
        </Button>
      </div>
      <div className={styles.carousel}>
        <SelectorCarousel
          entity={entity}
          db={db}
          items={items}
          currentId={currentId}
          index={at}
          onIndex={setIndex}
          footer={onChoose ? null : (raw) =>
            entity.idOf(raw) === currentId ? (
              onClear ? (
                <Button block onClick={onClear}>Remove {raw.name}</Button>
              ) : null
            ) : (
              <Button variant="primary" block onClick={() => onSelect(raw)}>Choose {raw.name}</Button>
            )
          }
        />
      </div>
      {panel && (
        <SelectorPanel
          entity={entity}
          db={db}
          currentId={currentId}
          exclude={exclude}
          defaultView="cards"
          onClose={() => setPanel(false)}
          onSelect={(raw) => {
            onSelect(raw);
            setPanel(false);
          }}
        />
      )}
    </div>
  );
}
