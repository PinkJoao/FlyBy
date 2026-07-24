// =============================================================================
// InventoryTab - itens do personagem: navegar, equipar, atunar (Fase B1)
// =============================================================================
// Layout inspirado em gerenciadores de inventário de VTT (dnd5e items-section):
// barra de moedas + card de carga/attunement no topo; busca + Shop numa linha
// fixa; sub-abas por GRUPO de item (com ícone); dropdowns de Sort/Group logo
// abaixo delas. Cada seção é um PAINEL COLAPSÁVEL (header com nome + contagem
// + chevron) com linhas flat compactas dentro (thumbnail da arte do 5e.tools,
// tipo + propriedades de arma, badge de raridade) e equip à vista. Clicar na
// linha abre o overlay de detalhes, que concentra as demais ações (atunar /
// remover) - sem menu ⋯ por linha. Na aba "All Items" os itens vêm
// AGRUPADOS POR TIPO por padrão (ordem canônica GROUP_ORDER, alfabético dentro
// do grupo), alternável para raridade/sem grupo. Equipar/atunar seguem o mesmo
// padrão de aviso do ClassTab/ChoiceList (diálogo in-app confirm, nunca bloqueia).
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { GROUP_ORDER } from '../../engine/items';
import { unmetAttunement, ATTUNEMENT_MAX } from '../../engine/attunement';
import DetailView from '../common/DetailView';
import Stepper from '../common/Stepper';
import { confirm } from '../common/dialog';
import { fileToPortrait } from '../common/imageFile';
import { itemValue } from '../../engine/magicItemPrice';
import { imgUrl } from '../common/media';
import itemEntity from '../../selector/entities/item';
import CurrencyCard from './CurrencyCard';
import EquipmentShop from './EquipmentShop';
import styles from './InventoryTab.module.css';

// Grupos em que "equipar" faz sentido (arma/armadura/foco/ferramenta/instrumento
// - coisas que se veste ou empunha). O resto (poções, engenho, tesouro…) não
// mostra o botão de equipar.
const EQUIPPABLE_GROUPS = new Set(['weapon', 'armor', 'spellcastingFocus', 'tool', 'instrument']);

const RARITY_ORDER = ['artifact', 'legendary', 'very rare', 'rare', 'uncommon', 'common', 'none'];

/** Cores da escala de raridade (convenção D&D: verde/azul/roxo/laranja/dourado). */
const RARITY_COLOR = {
  uncommon: '#3fa14b',
  rare: '#4a90d9',
  'very rare': '#a45ee5',
  legendary: '#e08a2e',
  artifact: '#c9a227',
};

/** Ícone (emoji) por grupo - usado nas sub-abas e como fallback do thumbnail. */
const GROUP_ICONS = {
  all: '📦',
  weapon: '⚔️',
  armor: '🛡️',
  spellcastingFocus: '🔮',
  ammunition: '🏹',
  tool: '🛠️',
  instrument: '🎵',
  gear: '🎒',
  food: '🍖',
  wondrous: '✨',
  ring: '💍',
  wand: '🪄',
  rod: '🔱',
  potion: '🧪',
  scroll: '📜',
  treasure: '💎',
  other: '❔',
};

/** Rótulos das propriedades de arma do 5e.tools (`property: ["H", "2H|XPHB"…]`). */
const WEAPON_PROPS = {
  A: 'Ammunition',
  AF: 'Ammunition',
  BF: 'Burst Fire',
  F: 'Finesse',
  H: 'Heavy',
  L: 'Light',
  LD: 'Loading',
  R: 'Reach',
  RLD: 'Reload',
  S: 'Special',
  T: 'Thrown',
  V: 'Versatile',
  '2H': 'Two-Handed',
};

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function rarityRank(rarity) {
  const i = RARITY_ORDER.indexOf(rarity ?? 'none');
  return i === -1 ? RARITY_ORDER.length : i;
}

function nameOf(entry) {
  return entry.customName || entry.raw?.name || entry.itemId;
}

/** Partes da linha de tipo: "Martial Weapon • Heavy • Two-Handed",
 * "Light Armor", "Wondrous Item"… */
function metaParts(entry) {
  if (entry.raw && entry.group === 'weapon') {
    const parts = [`${cap(entry.category ?? '')} Weapon`.trim()];
    for (const p of entry.raw.property ?? []) {
      const code = typeof p === 'string' ? p.split('|')[0] : p?.uid?.split('|')[0];
      if (WEAPON_PROPS[code]) parts.push(WEAPON_PROPS[code]);
    }
    return parts;
  }
  if (entry.raw && entry.group === 'armor' && entry.armorSlot) {
    return [entry.armorSlot === 'shield' ? 'Shield' : `${cap(entry.armorSlot)} Armor`];
  }
  // Sem objeto do 5etools E sem snapshot custom (entrada legada): sem meta.
  if (!entry.raw && !entry.isCustom) return [];
  // groupLabel é plural (nome da aba) - singulariza pro rótulo do item.
  const label = entry.groupLabel?.replace(/ Items$/, ' Item').replace(/([a-rt-z])s$/, '$1');
  return label ? [label] : [];
}

/** URL do thumbnail (arte do fluff do 5e.tools), ou null → glyph do grupo. */
function thumbOf(entry, db) {
  // Imagem custom do usuário (data-URL ou URL) tem prioridade - vale até p/
  // itens não-resolvidos (sem arte do 5etools).
  if (entry.customImg) return entry.customImg;
  if (!entry.raw) return null;
  const fluff = itemEntity.fluff(entry.raw, db);
  return imgUrl(fluff?.images?.[0]?.href);
}

/** Agrupa uma lista já ordenada por uma chave; `null` = sem sub-agrupamento
 * (uma única seção sem título). Preserva a ordem de primeira aparição. */
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

// Opções de agrupamento por aba: All Items agrupa por TIPO por padrão.
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
  { value: 'name', label: 'Name' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'weight', label: 'Weight' },
];

// Ordem fixa das seções de cada sub-agrupamento (em vez de "primeira aparição").
const SECTION_ORDERS = {
  category: ['simple', 'martial'],
  kind: ['melee', 'ranged'],
  armorSlot: ['light', 'medium', 'heavy', 'shield'],
};

export default function InventoryTab({ character, db, derived, onChange, onChangeCurrency, onPurchase }) {
  const [activeGroup, setActiveGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [groupBy, setGroupBy] = useState('type'); // padrão do All Items: por tipo
  const [infoUid, setInfoUid] = useState(null); // uid do item com o detalhe aberto
  const [collapsed, setCollapsed] = useState(() => new Set()); // seções fechadas
  const [imgModalOpen, setImgModalOpen] = useState(false); // escolher imagem do item
  const imgFileRef = useRef(null);

  const entries = derived.inventory ?? [];
  const attunedCount = derived.attunedCount ?? 0;
  // Sempre a versão ATUAL da entrada (a derivação recomputa a cada mudança);
  // se o item for removido, some de `entries` e o overlay fecha sozinho.
  const infoEntry = infoUid ? entries.find((e) => e.uid === infoUid) : null;

  const selectGroup = (g) => {
    setActiveGroup(g);
    setGroupBy(g === 'all' ? 'type' : 'none');
  };

  // Abas presentes = grupos que o personagem de fato tem algo, na ordem canônica.
  const presentGroups = GROUP_ORDER
    .map((g) => ({ key: g, label: entries.find((e) => e.group === g)?.groupLabel }))
    .filter((g) => g.label);

  const updateEntry = (uid, patch) =>
    onChange(character.inventory.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  const removeEntry = async (entry) => {
    const qty = entry.quantity > 1 ? ` ×${entry.quantity}` : '';
    const ok = await confirm({
      title: 'Remove item',
      message: `Remove ${nameOf(entry)}${qty} from the inventory?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    onChange(character.inventory.filter((it) => it.uid !== entry.uid));
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

  // Imagem custom do item (mesmo padrão do retrato: arquivo→data-URL ou URL da
  // web). `customImg` sobrepõe a arte do 5etools; remover volta ao original.
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

  let visible = activeGroup === 'all' ? entries : entries.filter((e) => e.group === activeGroup);
  const q = query.trim().toLowerCase();
  if (q) visible = visible.filter((e) => nameOf(e).toLowerCase().includes(q));

  // Chave + posição da SEÇÃO de cada entrada (agrupamento ativo).
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
    if (sortBy === 'rarity') {
      const r = rarityRank(a.rarity) - rarityRank(b.rarity);
      if (r !== 0) return r;
    } else if (sortBy === 'weight') {
      const w = (b.lineWeight ?? 0) - (a.lineWeight ?? 0);
      if (w !== 0) return w;
    }
    return nameOf(a).localeCompare(nameOf(b));
  });

  const rows = groupRows(sorted, groupBy === 'none' ? null : sectionOf);

  // Colapso por seção, com chave por aba+agrupamento (fechar "Weapons" no All
  // Items não fecha a seção "Simple" da aba Weapons).
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
      <div className={styles.header}>
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

      {/* Busca + Shop SEMPRE lado a lado numa única linha (pedido do usuário). */}
      <div className={styles.controls}>
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
          <span className={styles.subTabIcon} aria-hidden="true">{GROUP_ICONS.all}</span>
          All Items
        </button>
        {presentGroups.map((g) => (
          <button
            key={g.key}
            type="button"
            className={activeGroup === g.key ? `${styles.subTab} ${styles.subTabActive}` : styles.subTab}
            onClick={() => selectGroup(g.key)}
          >
            <span className={styles.subTabIcon} aria-hidden="true">{GROUP_ICONS[g.key] ?? GROUP_ICONS.other}</span>
            {g.label}
          </button>
        ))}
      </nav>

      {/* Group/Sort juntos, abaixo das sub-abas de categoria. */}
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
        <label className={styles.select}>
          <span className={styles.selectLabel}>Sort</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {entries.length === 0 ? (
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
                    ▾
                  </span>
                </button>
              )}
              {!isCollapsed && (
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
              )}
            </section>
          );
        })
      )}

      {infoEntry && (
        <div className={styles.infoOverlay} onClick={() => setInfoUid(null)}>
          <div className={styles.infoPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.infoHead}>
              <button type="button" className={styles.infoClose} onClick={() => setInfoUid(null)} aria-label="Close">
                ✕
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
            </div>
            {/* Rodapé no mesmo espírito do preview da loja: contador à ESQUERDA
              * (zerar = remover), valor total + equipar/atunar à DIREITA. */}
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
                {EQUIPPABLE_GROUPS.has(infoEntry.group) && (
                  <button
                    type="button"
                    className={infoEntry.equipped ? `${styles.infoBtn} ${styles.infoBtnActive}` : styles.infoBtn}
                    onClick={() => toggleEquip(infoEntry)}
                  >
                    {infoEntry.equipped ? '✓ Equipped' : 'Equip'}
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

          {/* Escolhedor de imagem do item (upload / URL / remover custom). */}
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
        </div>
      )}
    </div>
  );
}

/** Thumbnail do item: arte do fluff quando existe, senão o glyph do grupo. */
function ItemThumb({ src, group, alt }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return <img className={styles.thumb} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
  }
  return (
    <span className={styles.thumbGlyph} aria-hidden="true">
      {GROUP_ICONS[group] ?? GROUP_ICONS.other}
    </span>
  );
}

/** Escolhedor da imagem do item: upload de arquivo, URL da web, ou remover a
 * imagem custom (volta à arte original). Mesmo padrão do retrato do personagem. */
function ImageSourceModal({ hasCustom, onUpload, onUseUrl, onRemove, onClose }) {
  const [url, setUrl] = useState('');
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
            ✕
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

/** Toggle de equipar: só o radio (círculo que preenche quando ativo), sem
 * legenda nem borda - economiza espaço horizontal (o estado é o preenchimento). */
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

/** Detalhe de um item CUSTOM (sem entrada no catálogo): nome, tipo/peso/raridade
 * e a descrição vinda do próprio arquivo importado (HTML do Foundry). */
function CustomDetail({ entry, name, meta }) {
  const bits = [...meta];
  if (entry.unitWeight) bits.push(`${entry.unitWeight} lb`);
  if (entry.rarity) bits.push(cap(entry.rarity));
  return (
    <div className={styles.customDetail}>
      <h3 className={styles.customName}>{name}</h3>
      {bits.length > 0 && <p className={styles.customMeta}>{bits.join(' • ')}</p>}
      {entry.custom?.description ? (
        // Descrição HTML do próprio arquivo importado (dado do usuário).
        <div className={styles.customDesc} dangerouslySetInnerHTML={{ __html: entry.custom.description }} />
      ) : (
        <p className={styles.infoUnresolved}>Custom item (imported) - no description.</p>
      )}
    </div>
  );
}

function ItemRow({ entry, thumb, onInfo, onEquip, onQty, onRemove }) {
  const canEquip = EQUIPPABLE_GROUPS.has(entry.group);
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
          {/* Meta + badges numa ÚNICA sublinha → linhas de altura uniforme. */}
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
        {/* − no qty 1 remove o item (principal via de exclusão). */}
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
