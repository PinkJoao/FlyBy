// =============================================================================
// InventoryTab: a aba de inventário: navegar, equipar, atunar e guardar (Fase B1)
// =============================================================================
// O QUE FAZ
//   Layout de gerenciador de inventário de VTT: no topo, a faixa com o ouro, a carga e a
//   sintonia (StatStrip, cada parte abre a sua janela, DDL-0321); busca e
//   Shop numa linha (pedido do usuário); abaixo, Filtrar (o GRUPO de itens), Agrupar
//   e Ordenar, três botões (ListControls, DDL-0314). Cada seção é um painel colapsável com linhas compactas (arte, tipo,
//   propriedades, raridade) e o equipar à vista. Clicar abre o detalhe, que reúne
//   as outras ações. "All Items" agrupa por TIPO por padrão (GROUP_ORDER),
//   alternável. Equipar e atunar avisam pelo confirm in-app, nunca bloqueiam.
//
// FUNÇÕES
//   groupRows(list, keyFn): agrupa uma lista ordenada (null é seção única).
//   InventoryTab(props): a aba. Por dentro, moveInto guarda e tira.
//   EquipToggle(props): o radio de equipar.
//   CustomDetail(props): o detalhe de um item custom (HTML do Foundry).
//   ItemRow(props): uma linha. Exportada para a aba Inventory do play mode, que passa
//     `readOnly` (sem quantidade nem equipar: só o "x3"), `onUse` (o botão de usar)
//     e `usesLeft` (as cargas que sobram); com `onUsesLeft`, as cargas viram botão
//     do ajuste à mão (DDL-0202).
//
// DECISÕES E ARMADILHAS
//   - Só grupos que se vestem ou empunham mostram o equipar.
//   - O detalhe usa sempre a versão ATUAL da entrada; removida, ele fecha sozinho. É a
//     moldura comum de preview (PreviewLayer, DDL-0296): o nome no topo, o contador, o
//     valor, Attune e Equip no rodapé.
//   - Contêineres (DDL-0082): a lista principal mostra só o que está SOLTO; o
//     guardado aparece na tela do contêiner, um mini-inventário de propósito mais
//     simples (sem agrupamento, busca ou equipar). Guardar DESEQUIPA; tirar não
//     reequipa sozinho. Guardar e tirar vários de uma vez, com wouldCycle barrando
//     o contêiner dentro de si. A loja aberta ali compra para dentro dele.
//   - Remover um contêiner NÃO apaga o conteúdo: ele volta a ser solto.
//   - O item que leva magia (Enspelled, Ring of Spell Storing) mostra a seção `ItemSpells` no detalhe: a
//     magia escolhida e o que ele guarda moram na entrada (DDL-0258).
//   - O colapso das seções tem chave por aba e agrupamento.
//   - Sem opção "None" no Group (DDL-0312, pedido do dono): cada filtro abre agrupado pelo seu padrão
//     (DEFAULT_GROUP_BY); a armadura só tem um jeito (por tipo), e o botão mostra-o desabilitado; os
//     outros filtros, sem jeito de agrupar, mostram a lista corrida e o botão some.
//   - O menos com quantidade 1 remove o item (a principal via de exclusão).
//   - A imagem do item é escolhida no diálogo padrão (showImageSource, o mesmo do
//     retrato, DDL-0129), que aceita upload, URL e imagem colada (Ctrl+V ou, no
//     celular, o campo de URL editável).
// -----------------------------------------------------------------------------

import { gpText } from '../../engine/currency';
import AttunedWindow from './AttunedWindow';
import CarriedWindow from './CarriedWindow';
import CoinsWindow from './CoinsWindow';
import Coin from './Coin';
import StatStrip from '../common/StatStrip';
import ListControls from '../common/ListControls';
import SearchField from '../common/SearchField';
import { useRef, useState } from 'react';
import { GROUP_ORDER } from '../../engine/items';
import { contentsOf, orphanContents, wouldCycle } from '../../engine/containers';
import { unmetAttunement, ATTUNEMENT_MAX } from '../../engine/attunement';
import DetailView from '../common/DetailView';
import Stepper from '../common/Stepper';
import { confirm } from '../common/dialog';
import { fileToPortrait } from '../common/imageFile';
import { itemValue } from '../../engine/magicItemPrice';
import itemEntity from '../../selector/entities/item';
import { TUT } from '../../tutorial/anchors';
import EquipmentShop from './EquipmentShop';
import ItemSpells from './ItemSpells';
import ItemPickerModal from './ItemPickerModal';
import {
  RARITY_COLOR, GROUP_ICONS, cap, rarityRank, nameOf, metaParts, thumbOf,
} from './inventoryDisplay';
import styles from './InventoryTab.module.css';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import Thumb from '../common/Thumb';
import { NAME_SORT, sortName } from '../../sorting';
import { showImageSource } from '../common/imageSourceDialog';
import PreviewLayer from '../common/PreviewLayer';
import Button from '../common/Button';
import { FootStepper, FootValue } from '../common/PreviewFoot';
import Tag from '../common/Tag';

const EQUIPPABLE_GROUPS = new Set(['weapon', 'armor', 'spellcastingFocus', 'tool', 'instrument']);

/** Agrupa uma lista já ordenada por uma chave. */
function groupRows(list, keyFn) {
  if (!keyFn) return [[null, list]];
  const order = [];
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item) || 'Other';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(item);
  }
  return order.map((key) => [key, map.get(key)]);
}

const GROUP_BY_OPTIONS = {
  all: [
    { value: 'type', label: 'Type' },
    { value: 'rarity', label: 'Rarity' },
  ],
  weapon: [
    { value: 'category', label: 'Category' },
    { value: 'kind', label: 'Range' },
  ],
  armor: [{ value: 'armorSlot', label: 'Armor type' }],
};

const DEFAULT_GROUP_BY = { all: 'type', weapon: 'category', armor: 'armorSlot' };

const SORT_OPTIONS = [
  NAME_SORT,
  { value: 'rarity', label: 'Rarity', defaultDir: 'asc', dirLabels: ['Rarest first', 'Most common first'] },
  { value: 'weight', label: 'Weight', defaultDir: 'desc', dirLabels: ['Lightest first', 'Heaviest first'] },
];

const SECTION_ORDERS = {
  category: ['simple', 'martial'],
  kind: ['melee', 'ranged'],
  armorSlot: ['light', 'medium', 'heavy', 'shield'],
};

export default function InventoryTab({ character, db, derived, onChange, onChangeCurrency, onPurchase }) {
  const [activeGroup, setActiveGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [groupBy, setGroupBy] = useState('type');
  const [infoUid, setInfoUid] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [picker, setPicker] = useState(null);
  const [topWindow, setTopWindow] = useState(null);
  const imgFileRef = useRef(null);

  const entries = derived.inventory ?? [];
  const attunedCount = derived.attunedCount ?? 0;
  const attunementMax = derived.attunementMax ?? ATTUNEMENT_MAX;
  const infoEntry = infoUid ? entries.find((e) => e.uid === infoUid) : null;
  const loose = entries.filter((e) => !e.container);
  const contents = infoEntry?.isContainer ? contentsOf(entries, infoEntry.uid) : [];

  const selectGroup = (g) => {
    setActiveGroup(g);
    setGroupBy(DEFAULT_GROUP_BY[g] ?? 'none');
  };

  const presentGroups = GROUP_ORDER
    .map((g) => ({ key: g, label: loose.find((e) => e.group === g)?.groupLabel }))
    .filter((g) => g.label);

  const updateEntry = (uid, patch) =>
    onChange(character.inventory.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  const removeEntry = async (entry) => {
    const qty = entry.quantity > 1 ? ` ×${entry.quantity}` : '';
    const inside = contentsOf(entries, entry.uid).length;
    const note = inside
      ? ` Its ${inside === 1 ? 'item' : `${inside} items`} will go back to the inventory.`
      : '';
    const ok = await confirm({
      title: 'Remove item',
      message: `Remove ${nameOf(entry)}${qty} from the inventory?${note}`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    onChange(orphanContents(character.inventory, [entry.uid]).filter((it) => it.uid !== entry.uid));
  };

  /** Move entradas para dentro de um contêiner (ou para fora, com null); guardar desequipa. */
  const moveInto = (uids, targetUid) => {
    const set = new Set(uids);
    onChange(
      character.inventory.map((it) =>
        (set.has(it.uid) && !wouldCycle(character.inventory, it.uid, targetUid)
          ? { ...it, container: targetUid, equipped: targetUid ? false : it.equipped }
          : it)),
    );
    setPicker(null);
  };

  const toggleEquip = (entry) => updateEntry(entry.uid, { equipped: !entry.equipped });
  const toggleAttune = async (entry) => {
    if (!entry.attuned) {
      const reason = unmetAttunement(attunedCount, entry.raw, attunementMax);
      if (reason) {
        const ok = await confirm({
          title: 'Attunement',
          message: `${reason}. Attune anyway?`,
          confirmLabel: 'Attune anyway',
        });
        if (!ok) return;
      }
    }
    updateEntry(entry.uid, { attuned: !entry.attuned });
  };

  const applyItemImg = async (file) => {
    if (!infoUid) return;
    try {
      updateEntry(infoUid, { customImg: await fileToPortrait(file) });
    } catch {
      // arquivo ilegível: mantém como está
    }
  };
  const onItemImgFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyItemImg(file);
  };
  const setItemImgUrl = (url) => {
    if (infoUid) updateEntry(infoUid, { customImg: url });
  };
  const clearItemImg = () => {
    if (infoUid) updateEntry(infoUid, { customImg: null });
  };
  const openItemImage = (hasCustom) =>
    showImageSource({
      title: hasCustom ? 'Change item image' : 'Add item image',
      onUpload: () => imgFileRef.current?.click(),
      onUseUrl: setItemImgUrl,
      onImage: applyItemImg,
      onRemove: hasCustom ? clearItemImg : undefined,
      removeLabel: 'Remove custom image',
    });

  let visible = activeGroup === 'all' ? loose : loose.filter((e) => e.group === activeGroup);
  const q = query.trim().toLowerCase();
  if (q) visible = visible.filter((e) => nameOf(e).toLowerCase().includes(q));

  const sectionOf = (e) => {
    if (groupBy === 'none') return null;
    if (activeGroup === 'all') {
      if (groupBy === 'type') return e.groupLabel ?? 'Other';
      return e.rarity ? cap(e.rarity) : 'Mundane';
    }
    return cap(e[groupBy]) || 'Other';
  };
  const sectionRank = (e) => {
    if (groupBy === 'none') return 0;
    if (activeGroup === 'all') {
      return groupBy === 'type' ? GROUP_ORDER.indexOf(e.group) : rarityRank(e.rarity);
    }
    const order = SECTION_ORDERS[groupBy] ?? [];
    const i = order.indexOf(e[groupBy]);
    return i === -1 ? order.length : i;
  };

  const sorted = [...visible].sort((a, b) => {
    const s = sectionRank(a) - sectionRank(b);
    if (s !== 0) return s;
    const sign = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'rarity') {
      const r = (rarityRank(a.rarity) - rarityRank(b.rarity)) * sign;
      if (r !== 0) return r;
    } else if (sortBy === 'weight') {
      const w = ((a.lineWeight ?? 0) - (b.lineWeight ?? 0)) * sign;
      if (w !== 0) return w;
    } else {
      return sortName(nameOf(a)).localeCompare(sortName(nameOf(b))) * sign;
    }
    return sortName(nameOf(a)).localeCompare(sortName(nameOf(b)));
  });

  const rows = groupRows(sorted, groupBy === 'none' ? null : sectionOf);

  const sectionKey = (label) => `${activeGroup}|${groupBy}|${label}`;
  const toggleSection = (label) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      const key = sectionKey(label);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groupByOptions = GROUP_BY_OPTIONS[activeGroup] ?? null;
  const encumbrance = derived.encumbrance ?? { totalWeight: 0, capacity: 0, encumbered: false };
  const carriedPct = encumbrance.capacity ? Math.min(100, (encumbrance.totalWeight / encumbrance.capacity) * 100) : 0;

  return (
    <div className={styles.tab}>
      <StatStrip
        fit
        dataTour={TUT.TAB_INV_TOP}
        cells={[
          {
            key: 'gold',
            icon: <Coin denom="gp" />,
            value: gpText(character.currency),
            label: 'Gold',
            title: 'Your coins, as gold: see, change and convert them',
            onClick: () => setTopWindow('coins'),
          },
          {
            key: 'carried',
            wide: true,
            value: `${Math.round(encumbrance.totalWeight * 100) / 100} / ${encumbrance.capacity}`,
            label: 'Carried, lb',
            pct: carriedPct,
            tone: encumbrance.encumbered ? 'danger' : undefined,
            title: 'What you carry and what you can carry',
            onClick: () => setTopWindow('carried'),
          },
          {
            key: 'attuned',
            value: `${attunedCount} / ${attunementMax}`,
            label: 'Attuned',
            tone: attunedCount > attunementMax ? 'danger' : undefined,
            title: 'Your bonds with magic items',
            onClick: () => setTopWindow('attuned'),
          },
        ]}
      />
      {topWindow === 'coins' && (
        <CoinsWindow currency={character.currency} onChange={onChangeCurrency} onClose={() => setTopWindow(null)} />
      )}
      {topWindow === 'carried' && (
        <CarriedWindow
          encumbrance={encumbrance}
          strength={derived.scores?.str ?? 10}
          entries={entries}
          db={db}
          onInfo={(e) => setInfoUid(e.uid)}
          onClose={() => setTopWindow(null)}
        />
      )}
      {topWindow === 'attuned' && (
        <AttunedWindow
          entries={entries}
          max={attunementMax}
          db={db}
          onToggle={toggleAttune}
          onInfo={(e) => setInfoUid(e.uid)}
          onClose={() => setTopWindow(null)}
        />
      )}

      <div className={styles.controls} data-tour={TUT.TAB_INV_CONTROLS}>
        <SearchField placeholder="Search inventory…" value={query} onChange={setQuery} />
        <EquipmentShop character={character} db={db} onPurchase={onPurchase} />
      </div>

      <ListControls
        dataTour={TUT.TAB_INV_LIST}
        filterOptions={[{ value: 'all', label: 'All Items' }, ...presentGroups.map((g) => ({ value: g.key, label: g.label }))]}
        filter={activeGroup}
        onFilter={selectGroup}
        groupOptions={groupByOptions}
        groupBy={groupBy}
        onGroup={setGroupBy}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(value, dir) => {
          setSortBy(value);
          setSortDir(dir);
        }}
      />

      {loose.length === 0 ? (
        <p className={styles.empty}>No items yet. Visit the shop to add gear.</p>
      ) : sorted.length === 0 ? (
        <p className={styles.empty}>No items match your search.</p>
      ) : (
        rows.map(([label, items]) => {
          const isCollapsed = label != null && collapsed.has(sectionKey(label));
          return (
            <section key={label ?? 'flat'} className={styles.panel}>
              {label && (
                <button
                  type="button"
                  className={styles.panelHead}
                  onClick={() => toggleSection(label)}
                  aria-expanded={!isCollapsed}
                >
                  <span className={styles.panelTitle}>{label}</span>
                  <span className={styles.panelCount}>{items.length}</span>
                  <span
                    className={isCollapsed ? `${styles.panelChevron} ${styles.panelChevronClosed}` : styles.panelChevron}
                    aria-hidden="true"
                  >
                    <Icon name="chevron" />
                  </span>
                </button>
              )}
              <Collapse open={!isCollapsed}>
                <ul className={styles.list}>
                  {items.map((entry) => (
                    <ItemRow
                      key={entry.uid}
                      entry={entry}
                      thumb={thumbOf(entry, db)}
                      onInfo={() => setInfoUid(entry.uid)}
                      onEquip={() => toggleEquip(entry)}
                      onQty={(qty) => updateEntry(entry.uid, { quantity: Math.max(1, qty) })}
                      onRemove={() => removeEntry(entry)}
                    />
                  ))}
                </ul>
              </Collapse>
            </section>
          );
        })
      )}

      {infoEntry && (
        <PreviewLayer
          onClose={() => setInfoUid(null)}
          kicker={infoEntry.isCustom ? 'Custom item' : undefined}
          source={infoEntry.raw?.source}
          title={nameOf(infoEntry)}
          footer={
            <>
              <FootStepper
                value={infoEntry.quantity}
                min={1}
                maxDigits={4}
                onChange={(n) => updateEntry(infoEntry.uid, { quantity: Math.max(1, n) })}
                onMinReached={() => removeEntry(infoEntry)}
                ariaLabel={`Quantity of ${nameOf(infoEntry)}`}
              />
              {(() => {
                const unit = infoEntry.raw ? itemValue(infoEntry.raw, db) : null;
                if (unit == null) return null;
                const derived = infoEntry.raw?.value == null;
                return <FootValue label="Value" value={`${derived ? '~' : ''}${((unit * infoEntry.quantity) / 100).toLocaleString()} gp`} />;
              })()}
              {infoEntry.required && (
                <Button variant={infoEntry.attuned ? 'primary' : 'default'} aria-pressed={!!infoEntry.attuned} onClick={() => toggleAttune(infoEntry)}>
                  {infoEntry.attuned ? <><Icon name="check" /> Attuned</> : 'Attune'}
                </Button>
              )}
              {EQUIPPABLE_GROUPS.has(infoEntry.group) && !infoEntry.container && (
                <Button variant={infoEntry.equipped ? 'primary' : 'default'} aria-pressed={!!infoEntry.equipped} onClick={() => toggleEquip(infoEntry)}>
                  {infoEntry.equipped ? <><Icon name="check" /> Equipped</> : 'Equip'}
                </Button>
              )}
            </>
          }
        >
          {infoEntry.raw ? (
            <DetailView
              entity={itemEntity}
              raw={infoEntry.raw}
              db={db}
              capImage
              hideHeader
              customImg={infoEntry.customImg}
              onImgClick={() => openItemImage(!!infoEntry.customImg)}
              onImgRemove={clearItemImg}
            />
          ) : infoEntry.isCustom ? (
            <CustomDetail entry={infoEntry} meta={metaParts(infoEntry)} />
          ) : (
            <p className={styles.infoUnresolved}>
              “{nameOf(infoEntry)}” could not be resolved against the loaded item data.
            </p>
          )}

          {infoEntry.raw && (
            <ItemSpells entry={infoEntry} db={db} derived={derived} onUpdate={(patch) => updateEntry(infoEntry.uid, patch)} />
          )}

          {infoEntry.isContainer && (
            <section className={styles.contents}>
              <div className={styles.contentsHead}>
                <h4 className={styles.contentsTitle}>Contents</h4>
                <span className={styles.contentsWeight}>
                  {Math.round((infoEntry.contentsWeight ?? 0) * 100) / 100}
                  {infoEntry.containerProps?.capacity?.type === 'weight'
                    ? ` / ${infoEntry.containerProps.capacity.value}` : ''} lb
                </span>
              </div>

              {contents.length === 0 ? (
                <p className={styles.contentsEmpty}>Empty. Put something in it below.</p>
              ) : (
                <ul className={styles.list}>
                  {[...contents]
                    .sort((a, b) => sortName(nameOf(a)).localeCompare(sortName(nameOf(b))))
                    .map((entry) => (
                      <ItemRow
                        key={entry.uid}
                        entry={entry}
                        thumb={thumbOf(entry, db)}
                        hideEquip
                        onInfo={() => setInfoUid(entry.uid)}
                        onQty={(qty) => updateEntry(entry.uid, { quantity: Math.max(1, qty) })}
                        onRemove={() => removeEntry(entry)}
                      />
                    ))}
                </ul>
              )}

              <div className={styles.contentsActions}>
                <Button onClick={() => setPicker('stow')}>
                  Load <Icon name="down" />
                </Button>
                <Button disabled={contents.length === 0} onClick={() => setPicker('takeOut')}>
                  Unload <Icon name="up" />
                </Button>
                <EquipmentShop
                  character={character}
                  db={db}
                  onPurchase={onPurchase}
                  containerUid={infoEntry.uid}
                  label="Shop"
                />
              </div>
            </section>
          )}
        </PreviewLayer>
      )}
      {infoEntry && (
        <>
      <input ref={imgFileRef} type="file" accept="image/*" hidden onChange={onItemImgFile} />

      {picker === 'stow' && (
        <ItemPickerModal
          title={`Put items in ${nameOf(infoEntry)}`}
          entries={loose.filter((e) => e.uid !== infoEntry.uid)}
          confirmLabel="Put in"
          emptyText="Nothing loose in the inventory to put in."
          db={db}
          onConfirm={(uids) => moveInto(uids, infoEntry.uid)}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'takeOut' && (
        <ItemPickerModal
          title={`Take items out of ${nameOf(infoEntry)}`}
          entries={contents}
          confirmLabel="Take out"
          emptyText="This container is empty."
          db={db}
          onConfirm={(uids) => moveInto(uids, null)}
          onClose={() => setPicker(null)}
        />
      )}
        </>
      )}
    </div>
  );
}

/** Toggle de equipar: só o radio. */
function EquipToggle({ equipped, onClick, name }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={equipped}
      aria-label={equipped ? `Unequip ${name}` : `Equip ${name}`}
      className={equipped ? `${styles.equipRadio} ${styles.equipRadioOn}` : styles.equipRadio}
      onClick={onClick}
      title={equipped ? `Equipped - tap to unequip ${name}` : `Equip ${name}`}
    >
      <span className={styles.equipDot} aria-hidden="true" />
    </button>
  );
}

/** Detalhe de um item custom. */
function CustomDetail({ entry, meta }) {
  const bits = [...meta];
  if (entry.unitWeight) bits.push(`${entry.unitWeight} lb`);
  if (entry.rarity) bits.push(cap(entry.rarity));
  return (
    <div className={styles.customDetail}>
      {bits.length > 0 && <p className={styles.customMeta}>{bits.join(' • ')}</p>}
      {entry.custom?.description ? (
        <div className={styles.customDesc} dangerouslySetInnerHTML={{ __html: entry.custom.description }} />
      ) : (
        <p className={styles.infoUnresolved}>Custom item (imported) - no description.</p>
      )}
    </div>
  );
}

export function ItemRow({ entry, thumb, onInfo, onEquip, onQty, onRemove, hideEquip = false, readOnly = false, onUse, useLabel = 'Use', usesLeft = null, onUsesLeft }) {
  const canEquip = !readOnly && !hideEquip && EQUIPPABLE_GROUPS.has(entry.group);
  const rarity = entry.rarity ?? null;
  const rarityColor = rarity ? RARITY_COLOR[rarity] : null;
  const meta = metaParts(entry);
  const active = entry.equipped || entry.attuned;
  return (
    <li className={active ? `${styles.row} ${styles.rowActive}` : styles.row}>
      <button type="button" className={styles.rowHit} onClick={onInfo} title={`About ${nameOf(entry)}`}>
        <Thumb src={thumb} icon={GROUP_ICONS[entry.group] ?? GROUP_ICONS.other} width={36} className={styles.thumb} />
        <span className={styles.rowText}>
          <span className={styles.rowName}>{nameOf(entry)}</span>
          <span className={styles.rowSub}>
            {meta.length > 0 && (
              <span className={styles.rowMetaLine}>
                {meta.map((part, i) => (
                  <span key={part}>
                    {i > 0 && <span className={styles.metaDot} aria-hidden="true"> • </span>}
                    {part}
                  </span>
                ))}
              </span>
            )}
            {rarity && (
              <Tag color={rarityColor}>{cap(rarity)}</Tag>
            )}
            {entry.attuned && <Tag tone="accent">Attuned</Tag>}
            {entry.isCustom && <Tag>Custom</Tag>}
            {!entry.raw && !entry.isCustom && <Tag tone="danger" title="Not found in the data source">Unresolved</Tag>}
          </span>
        </span>
      </button>

      <div className={styles.rowSide}>
        <span className={styles.rowWeight}>{entry.lineWeight} lb</span>
        {readOnly ? (
          (entry.quantity ?? 1) > 1 && <span className={styles.rowQty}>x{entry.quantity}</span>
        ) : (
          <Stepper
            value={entry.quantity}
            min={1}
            maxDigits={4}
            onChange={onQty}
            onMinReached={onRemove}
            ariaLabel={`Quantity of ${nameOf(entry)}`}
          />
        )}
        {usesLeft && !onUsesLeft && <span className={styles.rowQty} title="Charges left">{usesLeft}</span>}
        {usesLeft && onUsesLeft && (
          <button type="button" className={`${styles.rowQty} ${styles.rowQtyBtn}`} onClick={onUsesLeft} title="Charges left: tap to change by hand">
            {usesLeft}
          </button>
        )}
        {onUse && (
          <Button size="sm" variant="primary" onClick={onUse} title={`${useLabel} ${nameOf(entry)}`}>
            {useLabel}
          </Button>
        )}
        {canEquip && <EquipToggle equipped={entry.equipped} onClick={onEquip} name={nameOf(entry)} />}
      </div>
    </li>
  );
}
