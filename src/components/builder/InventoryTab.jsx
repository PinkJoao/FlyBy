// =============================================================================
// InventoryTab: a aba de inventário: navegar, equipar, atunar e guardar (Fase B1)
// =============================================================================
// O QUE FAZ
//   Layout de gerenciador de inventário de VTT: moedas e carga no topo; busca e
//   Shop numa linha (pedido do usuário); sub-abas por GRUPO; Group e Sort abaixo
//   delas. Cada seção é um painel colapsável com linhas compactas (arte, tipo,
//   propriedades, raridade) e o equipar à vista. Clicar abre o detalhe, que reúne
//   as outras ações. "All Items" agrupa por TIPO por padrão (GROUP_ORDER),
//   alternável. Equipar e atunar avisam pelo confirm in-app, nunca bloqueiam.
//
// FUNÇÕES
//   groupRows(list, keyFn): agrupa uma lista ordenada (null é seção única).
//   InventoryTab(props): a aba. Por dentro, moveInto guarda e tira.
//   ItemThumb(props): arte do fluff ou o glyph do grupo.
//   ImageSourceModal(props): upload, URL ou remover a imagem custom.
//   EquipToggle(props): o radio de equipar.
//   CustomDetail(props): o detalhe de um item custom (HTML do Foundry).
//   ItemRow(props): uma linha.
//
// DECISÕES E ARMADILHAS
//   - Só grupos que se vestem ou empunham mostram o equipar.
//   - O detalhe usa sempre a versão ATUAL da entrada; removida, ele fecha sozinho.
//   - Contêineres (DDL-0082): a lista principal mostra só o que está SOLTO; o
//     guardado aparece na tela do contêiner, um mini-inventário de propósito mais
//     simples (sem agrupamento, busca ou equipar). Guardar DESEQUIPA; tirar não
//     reequipa sozinho. Guardar e tirar vários de uma vez, com wouldCycle barrando
//     o contêiner dentro de si. A loja aberta ali compra para dentro dele.
//   - Remover um contêiner NÃO apaga o conteúdo: ele volta a ser solto.
//   - O colapso das seções tem chave por aba e agrupamento.
//   - O menos com quantidade 1 remove o item (a principal via de exclusão).
// -----------------------------------------------------------------------------

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
import CurrencyCard from './CurrencyCard';
import EquipmentShop from './EquipmentShop';
import ItemPickerModal from './ItemPickerModal';
import {
  RARITY_COLOR, GROUP_ICONS, cap, rarityRank, nameOf, metaParts, thumbOf,
} from './inventoryDisplay';
import styles from './InventoryTab.module.css';
import { useBackLayer } from '../../hooks/useBack';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import SortButton from '../common/SortButton';
import { NAME_SORT, sortName } from '../../sorting';

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
    { value: 'none', label: 'None' },
  ],
  weapon: [
    { value: 'none', label: 'None' },
    { value: 'category', label: 'Simple / Martial' },
    { value: 'kind', label: 'Melee / Ranged' },
  ],
  armor: [
    { value: 'none', label: 'None' },
    { value: 'armorSlot', label: 'Slot' },
  ],
};

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
  useBackLayer(infoUid != null, () => setInfoUid(null));
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [picker, setPicker] = useState(null);
  const imgFileRef = useRef(null);

  const entries = derived.inventory ?? [];
  const attunedCount = derived.attunedCount ?? 0;
  const infoEntry = infoUid ? entries.find((e) => e.uid === infoUid) : null;
  const loose = entries.filter((e) => !e.container);
  const contents = infoEntry?.isContainer ? contentsOf(entries, infoEntry.uid) : [];

  const selectGroup = (g) => {
    setActiveGroup(g);
    setGroupBy(g === 'all' ? 'type' : 'none');
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
      const reason = unmetAttunement(attunedCount, entry.raw);
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

  const onItemImgFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !infoUid) return;
    try {
      updateEntry(infoUid, { customImg: await fileToPortrait(file) });
      setImgModalOpen(false);
    } catch {
      // arquivo ilegível: mantém como está
    }
  };
  const setItemImgUrl = (url) => {
    if (infoUid) updateEntry(infoUid, { customImg: url });
    setImgModalOpen(false);
  };
  const clearItemImg = () => {
    if (infoUid) updateEntry(infoUid, { customImg: null });
    setImgModalOpen(false);
  };

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
      <div className={styles.header} data-tour={TUT.TAB_INV_TOP}>
        <CurrencyCard currency={character.currency} onChange={onChangeCurrency} />
        <div className={styles.statusCard}>
          <div className={encumbrance.encumbered ? `${styles.carried} ${styles.carriedOver}` : styles.carried}>
            <span className={styles.carriedText}>
              {Math.round(encumbrance.totalWeight * 100) / 100} / {encumbrance.capacity} lb
            </span>
            <div className={styles.carriedBar} role="presentation">
              <div
                className={encumbrance.encumbered ? `${styles.carriedFill} ${styles.carriedFillOver}` : styles.carriedFill}
                style={{ width: `${carriedPct}%` }}
              />
            </div>
          </div>
          <div className={styles.statusDivider} role="presentation" />
          <span className={attunedCount > ATTUNEMENT_MAX ? `${styles.attuned} ${styles.attunedOver}` : styles.attuned}>
            Attuned {attunedCount}/{ATTUNEMENT_MAX}
          </span>
        </div>
      </div>

      <div className={styles.controls} data-tour={TUT.TAB_INV_CONTROLS}>
        <div className={styles.searchBox}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search inventory…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <EquipmentShop character={character} db={db} onPurchase={onPurchase} />
      </div>

      <nav className={styles.subTabs}>
        <button
          type="button"
          className={activeGroup === 'all' ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
          onClick={() => selectGroup('all')}
        >
          <span className={styles.subTabIcon} aria-hidden="true"><Icon name={GROUP_ICONS.all} /></span>
          All Items
        </button>
        {presentGroups.map((g) => (
          <button
            key={g.key}
            type="button"
            className={activeGroup === g.key ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
            onClick={() => selectGroup(g.key)}
          >
            <span className={styles.subTabIcon} aria-hidden="true"><Icon name={GROUP_ICONS[g.key] ?? GROUP_ICONS.other} /></span>
            {g.label}
          </button>
        ))}
      </nav>

      <div className={styles.filters}>
        {groupByOptions && (
          <label className={styles.select}>
            <span className={styles.selectLabel}>Group</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {groupByOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        <SortButton
          options={SORT_OPTIONS}
          value={sortBy}
          dir={sortDir}
          onChange={(value, dir) => {
            setSortBy(value);
            setSortDir(dir);
          }}
        />
      </div>

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
        <div className={`${styles.infoOverlay} motion-page`} onClick={() => setInfoUid(null)}>
          <div className={`${styles.infoPanel} motion-pop ornate-frame`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <button type="button" className={styles.infoClose} onClick={() => setInfoUid(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className={styles.infoScroll}>
              {infoEntry.raw ? (
                <DetailView
                  entity={itemEntity}
                  raw={infoEntry.raw}
                  db={db}
                  capImage
                  customImg={infoEntry.customImg}
                  onImgClick={() => setImgModalOpen(true)}
                  onImgRemove={clearItemImg}
                />
              ) : infoEntry.isCustom ? (
                <CustomDetail entry={infoEntry} name={nameOf(infoEntry)} meta={metaParts(infoEntry)} />
              ) : (
                <p className={styles.infoUnresolved}>
                  “{nameOf(infoEntry)}” could not be resolved against the loaded item data.
                </p>
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
                    <button type="button" className={styles.contentsBtn} onClick={() => setPicker('stow')}>
                      Load <Icon name="down" />
                    </button>
                    <button
                      type="button"
                      className={styles.contentsBtn}
                      disabled={contents.length === 0}
                      onClick={() => setPicker('takeOut')}
                    >
                      Unload <Icon name="up" />
                    </button>
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
            </div>
            <div className={styles.infoActions}>
              <Stepper
                value={infoEntry.quantity}
                min={1}
                maxDigits={4}
                onChange={(n) => updateEntry(infoEntry.uid, { quantity: Math.max(1, n) })}
                onMinReached={() => removeEntry(infoEntry)}
                ariaLabel={`Quantity of ${nameOf(infoEntry)}`}
              />

              <div className={styles.infoRight}>
                {(() => {
                  const unit = infoEntry.raw ? itemValue(infoEntry.raw, db) : null;
                  if (unit == null) return null;
                  const derived = infoEntry.raw?.value == null;
                  return (
                    <div className={styles.infoValue}>
                      <span className={styles.infoValueLabel}>Value</span>
                      <span className={styles.infoValueAmount}>
                        {derived ? '~' : ''}{((unit * infoEntry.quantity) / 100).toLocaleString()} gp
                      </span>
                    </div>
                  );
                })()}
                {EQUIPPABLE_GROUPS.has(infoEntry.group) && !infoEntry.container && (
                  <button
                    type="button"
                    className={infoEntry.equipped ? `${styles.infoBtn} ${styles.infoBtnActive}` : styles.infoBtn}
                    onClick={() => toggleEquip(infoEntry)}
                  >
                    {infoEntry.equipped ? <><Icon name="check" /> Equipped</> : 'Equip'}
                  </button>
                )}
                {infoEntry.required && (
                  <button
                    type="button"
                    className={infoEntry.attuned ? `${styles.infoBtn} ${styles.infoBtnActive}` : styles.infoBtn}
                    onClick={() => toggleAttune(infoEntry)}
                  >
                    {infoEntry.attuned ? 'Attuned' : 'Attune'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <input ref={imgFileRef} type="file" accept="image/*" hidden onChange={onItemImgFile} />
          {imgModalOpen && (
            <ImageSourceModal
              hasCustom={!!infoEntry.customImg}
              onUpload={() => imgFileRef.current?.click()}
              onUseUrl={setItemImgUrl}
              onRemove={clearItemImg}
              onClose={() => setImgModalOpen(false)}
            />
          )}

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
        </div>
      )}
    </div>
  );
}

/** Thumbnail do item. */
function ItemThumb({ src, group, alt }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={styles.thumb} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={styles.thumbGlyph} aria-hidden="true">
      <Icon name={GROUP_ICONS[group] ?? GROUP_ICONS.other} />
    </span>
  );
}

/** O escolhedor da imagem do item. */
function ImageSourceModal({ hasCustom, onUpload, onUseUrl, onRemove, onClose }) {
  const [url, setUrl] = useState('');
  useBackLayer(true, onClose);
  const submitUrl = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onUseUrl(trimmed);
  };
  return (
    <div className={styles.imgModalOverlay} onClick={onClose}>
      <div className={styles.imgModalPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.imgModalHead}>
          <h3>{hasCustom ? 'Change item image' : 'Add item image'}</h3>
          <button type="button" className={styles.infoClose} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <button type="button" className={styles.imgModalUpload} onClick={onUpload}>
          Upload from device
        </button>
        <div className={styles.imgModalDivider}>
          <span>or</span>
        </div>
        <form className={styles.imgModalUrlRow} onSubmit={submitUrl}>
          <input
            type="url"
            className={styles.imgModalUrlInput}
            placeholder="https://example.com/item.webp"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.imgModalUrlBtn} disabled={!url.trim()}>
            Use URL
          </button>
        </form>
        {hasCustom && (
          <button type="button" className={styles.imgModalRemove} onClick={onRemove}>
            Remove custom image
          </button>
        )}
      </div>
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
function CustomDetail({ entry, name, meta }) {
  const bits = [...meta];
  if (entry.unitWeight) bits.push(`${entry.unitWeight} lb`);
  if (entry.rarity) bits.push(cap(entry.rarity));
  return (
    <div className={styles.customDetail}>
      <h3 className={styles.customName}>{name}</h3>
      {bits.length > 0 && <p className={styles.customMeta}>{bits.join(' • ')}</p>}
      {entry.custom?.description ? (
        <div className={styles.customDesc} dangerouslySetInnerHTML={{ __html: entry.custom.description }} />
      ) : (
        <p className={styles.infoUnresolved}>Custom item (imported) - no description.</p>
      )}
    </div>
  );
}

function ItemRow({ entry, thumb, onInfo, onEquip, onQty, onRemove, hideEquip = false }) {
  const canEquip = !hideEquip && EQUIPPABLE_GROUPS.has(entry.group);
  const rarity = entry.rarity ?? null;
  const rarityColor = rarity ? RARITY_COLOR[rarity] : null;
  const meta = metaParts(entry);
  const active = entry.equipped || entry.attuned;
  return (
    <li className={active ? `${styles.row} ${styles.rowActive}` : styles.row}>
      <button type="button" className={styles.rowHit} onClick={onInfo} title={`About ${nameOf(entry)}`}>
        <ItemThumb src={thumb} group={entry.group} alt="" />
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
              <span
                className={styles.rowRarity}
                style={rarityColor ? { color: rarityColor, borderColor: rarityColor } : undefined}
              >
                {cap(rarity)}
              </span>
            )}
            {entry.attuned && <span className={styles.rowAttunedChip}>Attuned</span>}
            {entry.isCustom && <span className={styles.rowUnknown}>Custom</span>}
            {!entry.raw && !entry.isCustom && <span className={styles.rowUnknown}>unresolved</span>}
          </span>
        </span>
      </button>

      <div className={styles.rowSide}>
        <span className={styles.rowWeight}>{entry.lineWeight} lb</span>
        <Stepper
          value={entry.quantity}
          min={1}
          maxDigits={4}
          onChange={onQty}
          onMinReached={onRemove}
          ariaLabel={`Quantity of ${nameOf(entry)}`}
        />
        {canEquip && <EquipToggle equipped={entry.equipped} onClick={onEquip} name={nameOf(entry)} />}
      </div>
    </li>
  );
}
