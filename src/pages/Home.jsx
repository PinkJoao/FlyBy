// =============================================================================
// Home - roster de personagens
// =============================================================================
// Título da marca (FlyBy) + menu sanduíche de preferências no topo; abaixo, o
// conteúdo centralizado verticalmente: título "Characters", uma barra de
// busca/agrupamento/ordenação (no espírito das abas de Inventário/Magias) com o
// botão "Add", e a lista de cards.
//
// O botão "New Character" cria direto. Se a Character Guidance está em "ask",
// pergunta se o jogador quer ser guiado (com um "remember my answer" que grava a
// preferência); o guiado navega para a rota do wizard (Fase D), sem guia para o
// builder normal. Importar e forçar a atualização do compêndio ficam no menu ☰.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import useSettingsStore from '../store/settingsStore';
import { useData } from '../data/dataContext';
import useCharacterImport from '../hooks/useCharacterImport';
import { assembleFoundryActor } from '../engine/foundryActor';
import { deriveFromDb } from '../engine/resolve';
import { totalLevel, classNames } from '../schema/character';
import { orderRoster } from './roster';
import MenuButton from '../components/common/MenuButton';
import { openGlossary } from '../store/glossaryStore';
import { confirm, ask } from '../components/common/dialog';
import styles from './Home.module.css';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'level', label: 'Level' },
  { value: 'created', label: 'Recent' },
  { value: 'class', label: 'Class' },
];

export default function Home() {
  const navigate = useNavigate();
  const { inputRef, onFileChange, pickFile } = useCharacterImport();

  const characters = useCharacterStore((s) => s.characters);
  const loaded = useCharacterStore((s) => s.loaded);
  const load = useCharacterStore((s) => s.load);
  const create = useCharacterStore((s) => s.create);
  const duplicate = useCharacterStore((s) => s.duplicate);
  const remove = useCharacterStore((s) => s.remove);
  const guidance = useSettingsStore((s) => s.guidance);
  const setGuidance = useSettingsStore((s) => s.setGuidance);
  const { db, forceCacheUpdate } = useData();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // --- Criar / importar --------------------------------------------------------

  /** Cria o personagem e navega: guiado → rota do wizard (Fase D); senão builder.
   * O guiado marca `meta.creating` (a Home retoma o wizard depois) e usa Standard
   * Array como método padrão de atributos. "Just the sheet" grava `guided: false`
   * - a guidance (botão ✦ / level-up) fica desligada nessa ficha por padrão. */
  const startNew = async (guided) => {
    const c = await create(
      guided ? { creating: true, guided: true, scoreMethod: 'standard-array' } : { guided: false },
    );
    navigate(guided ? `/build/${c.id}/wizard` : `/build/${c.id}`);
  };

  /** Fluxo "novo personagem", respeitando a preferência de Character Guidance. */
  const createNew = async () => {
    if (guidance === 'on') return startNew(true);
    if (guidance === 'off') return startNew(false);
    // 'ask': pergunta, com a opção de gravar a resposta como padrão.
    const res = await ask({
      title: 'Character Guidance',
      message: 'Want a step-by-step guide through creation, or jump straight into the sheet?',
      fields: [{ type: 'checkbox', name: 'remember', label: 'Remember my answer' }],
      actions: [
        { label: 'Just the sheet', value: 'plain' },
        { label: 'Guide me', value: 'guided', tone: 'primary', autoFocus: true },
      ],
      dismissValue: null,
    });
    if (!res || res.action == null) return; // fechado sem escolher
    const guided = res.action === 'guided';
    if (res.values.remember) setGuidance(guided ? 'on' : 'off');
    startNew(guided);
  };

  // --- Dados do compêndio ------------------------------------------------------

  /** Força re-baixar o conteúdo do 5etools, ignorando a regra dos 30 dias. O app
   * mostra a tela de "Updating…" enquanto baixa; os personagens não são tocados. */
  const updateData = async () => {
    const ok = await confirm({
      title: 'Update game data',
      message:
        'Re-download the latest game content from 5e.tools now? The app will refresh while it downloads. Your characters are not affected.',
      confirmLabel: 'Update',
    });
    if (ok) forceCacheUpdate();
  };

  // --- Ações por card ----------------------------------------------------------

  const handleExport = (character) => {
    const actor = assembleFoundryActor(character, db);
    const blob = new Blob([JSON.stringify(actor, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (character.meta.name || 'character').replace(/[^\w.-]+/g, '_');
    a.href = url;
    a.download = `${safe}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF: mesmo pipeline do builder (deriva aqui, onde há db; o módulo pesado do
  // @react-pdf/renderer é importado DINAMICAMENTE, fora do bundle principal).
  const handleExportPdf = async (character) => {
    const { exportCharacterPdf } = await import('../pdf/exportPdf');
    await exportCharacterPdf(character, deriveFromDb(character, db), db);
  };

  const askDelete = async (character) => {
    const ok = await confirm({
      title: 'Delete character',
      message: `Delete "${character.meta.name || 'Unnamed'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) remove(character.id);
  };

  // --- Busca / ordenação / agrupamento ----------------------------------------

  const items = useMemo(
    () => orderRoster(characters, { query, sortBy })[0].items,
    [characters, query, sortBy],
  );

  const total = characters.length;

  // Item do menu sanduíche p/ cada opção de guidance (✓ no atual).
  const guidanceItem = (value, label, sub) => ({
    label: `${guidance === value ? '✓  ' : '   '}${label}`,
    sub,
    onClick: () => setGuidance(value),
  });

  const renderCard = (c) => {
    const summary = classNames(c);
    return (
      <li key={c.id} className={styles.card}>
        <button
          type="button"
          className={styles.cardMain}
          onClick={() => navigate(c.meta?.creating ? `/build/${c.id}/wizard` : `/build/${c.id}`)}
        >
          {c.meta.portrait ? (
            <img className={styles.avatarImg} src={c.meta.portrait} alt="" aria-hidden="true" />
          ) : (
            <span className={styles.avatar} aria-hidden="true">
              {(c.meta.name || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className={styles.info}>
            <span className={styles.name}>{c.meta.name || 'Unnamed'}</span>
            <span className={styles.sub}>
              Level {totalLevel(c)}
              {summary ? ` · ${summary}` : ''}
            </span>
          </span>
        </button>
        <div className={styles.cardActions}>
          <MenuButton
            buttonClassName={styles.menuTrigger}
            buttonTitle="Character options"
            items={[
              { label: 'Duplicate', onClick: () => duplicate(c.id) },
              { label: 'Export', sub: 'Foundry actor JSON', onClick: () => handleExport(c) },
              { label: 'Export PDF', sub: 'Printable character sheet', onClick: () => handleExportPdf(c) },
              { label: 'Delete', danger: true, onClick: () => askDelete(c) },
            ]}
          >
            <span aria-hidden="true">⋮</span>
          </MenuButton>
        </div>
      </li>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <img src="/logo.svg" alt="" className={styles.brandLogo} />
          FlyBy
        </span>
        <MenuButton
          buttonClassName={styles.hamburger}
          buttonTitle="Settings"
          items={[
            { label: 'Glossary', sub: 'Search every rule, spell, item and feature', onClick: openGlossary },
            { label: 'Character Guidance', sub: 'The step-by-step creation guide', disabled: true },
            guidanceItem('ask', 'Ask each time'),
            guidanceItem('on', 'Always guided'),
            guidanceItem('off', 'Never guided'),
            { label: 'Import character', sub: 'Foundry actor JSON', onClick: pickFile },
            { label: 'Update game data', sub: 'Re-download 5e.tools content', onClick: updateData },
          ]}
        >
          <span aria-hidden="true">☰</span>
        </MenuButton>
      </header>

      <main className={styles.main}>
        <h2 className={styles.rosterTitle}>Characters</h2>

        {!loaded ? (
          <p className={styles.muted}>Loading…</p>
        ) : total === 0 ? (
          <div className={styles.empty}>
            <p>No characters yet.</p>
            <button type="button" className={styles.primary} onClick={createNew}>
              + New Character
            </button>
          </div>
        ) : (
          <>
            <div className={styles.controls}>
              <div className={styles.searchBox}>
                <input
                  type="search"
                  className={styles.search}
                  placeholder="Search characters…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <label className={styles.select}>
                <span className={styles.selectLabel}>Sort</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Botão da ação principal, centralizado abaixo da busca. */}
            <div className={styles.newRow}>
              <button type="button" className={styles.newBtn} onClick={createNew}>
                + New Character
              </button>
            </div>

            {/* Só a LISTA rola; a página inteira cabe na tela. */}
            <div className={styles.listScroll}>
              {items.length === 0 ? (
                <p className={styles.muted}>No characters match your search.</p>
              ) : (
                <ul className={styles.list}>{items.map(renderCard)}</ul>
              )}
            </div>
          </>
        )}
      </main>

      <footer className={styles.attribution}>
        Game data from{' '}
        <a href="https://5e.tools" target="_blank" rel="noopener noreferrer">5e.tools</a>. Includes SRD
        5.2 content © Wizards of the Coast, licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
        . An unofficial fan-made tool, not affiliated with or endorsed by Wizards of the Coast.
      </footer>

      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={onFileChange} />
    </div>
  );
}
