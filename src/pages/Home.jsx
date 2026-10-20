// =============================================================================
// Home: o roster de personagens
// =============================================================================
// O QUE FAZ
//   A marca e o menu sanduíche no topo; abaixo, centralizados, o título, a barra
//   de busca, agrupamento e ordenação (como no Inventário e nas Magias) com o botão
//   "Add", e a lista (só ela rola; a página cabe na tela). Importar, forçar a
//   atualização do compêndio, a fonte de dados, o glossário e o tutorial ficam
//   no menu. No Samsung Internet, um aviso dispensável sob o topo manda instalar
//   pelo Chrome (installHint, DDL-0095).
//
// FUNÇÕES
//   Home(): a página. Por dentro: startNew, createNew, updateData, chooseSource
//     (a fonte de dados, DDL-0091), copySetupLink (o link da mesa), chooseTheme
//     (o tema da interface) e as ações por card (abrir, duplicar, exportar
//     Foundry e PDF, apagar).
//
// DECISÕES E ARMADILHAS
//   - Criar respeita a Character Guidance: 'ask' pergunta, com "remember my
//     answer". O guiado vai para a rota do wizard, marca `meta.creating` e usa
//     Standard Array; "just the sheet" grava `guided: false`.
//   - Semeadura do tutorial na 1a carga do roster: quem já tem personagens nasce
//     com os tours vistos; instalação nova os mantém para disparar.
//   - O PDF usa o mesmo pipeline do Builder, importado dinamicamente.
//   - O aviso do Samsung Internet lembra que os personagens ficam neste navegador:
//     o Chrome tem armazenamento próprio, então exportar antes evita a surpresa.
//   - chooseSource: trocar de fonte não toca nos personagens; a fonte nova vale a
//     partir do recarregamento do compêndio. "Update game data" só existe para
//     fonte por URL (o SRD embutido não tem o que re-baixar). O campo aceita o
//     endereço, um link do GitHub ou um link de configuração colado, e o testa
//     antes de gravar (resolveSourceInput); a falha pergunta, não bloqueia.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import useSettingsStore from '../store/settingsStore';
import { useData } from '../data/dataContext';
import { describeSource, sameSource, SRD_SOURCE, SOURCE_PLACEHOLDER } from '../data/dataSource';
import { buildSetupLink, resolveSourceInput } from '../data/setupLink';
import { describeProblem } from '../data/sourceAddress';
import useCharacterImport from '../hooks/useCharacterImport';
import { assembleFoundryActor } from '../engine/foundryActor';
import { deriveFromDb } from '../engine/resolve';
import { totalLevel, classNames } from '../schema/character';
import { orderRoster } from './roster';
import MenuButton from '../components/common/MenuButton';
import { openGlossary } from '../store/glossaryStore';
import { FEEDBACK_URL } from '../feedback';
import useTutorialStore, { seedTutorials } from '../store/tutorialStore';
import { alert, confirm, ask } from '../components/common/dialog';
import { isSamsungInternet, isStandalone, chromeIntentUrl } from '../installHint';
import { THEME_CHOICES } from '../theme';
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
  const samsungHintDismissed = useSettingsStore((s) => s.samsungHintDismissed);
  const dismissSamsungHint = useSettingsStore((s) => s.dismissSamsungHint);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const showSamsungHint = !samsungHintDismissed && isSamsungInternet(navigator.userAgent) && !isStandalone();
  const tutEnabled = useTutorialStore((s) => s.enabled);
  const setTutEnabled = useTutorialStore((s) => s.setEnabled);
  const resetTutorials = useTutorialStore((s) => s.resetSeen);
  const replayTutorials = () => {
    setTutEnabled(true);
    resetTutorials();
  };
  const { db, forceCacheUpdate, source, missing, changeSource } = useData();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (loaded) seedTutorials(characters.length);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Cria o personagem e navega (guiado vai ao wizard). */
  const startNew = async (guided) => {
    const c = await create(
      guided ? { creating: true, guided: true, scoreMethod: 'standard-array' } : { guided: false },
    );
    navigate(guided ? `/build/${c.id}/wizard` : `/build/${c.id}`);
  };

  /** O fluxo de novo personagem, respeitando a preferência de guidance. */
  const createNew = async () => {
    if (guidance === 'on') return startNew(true);
    if (guidance === 'off') return startNew(false);
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
    if (!res || res.action == null) return;
    const guided = res.action === 'guided';
    if (res.values.remember) setGuidance(guided ? 'on' : 'off');
    startNew(guided);
  };

  /** Força re-baixar da fonte configurada; os personagens não são tocados. */
  const updateData = async () => {
    const ok = await confirm({
      title: 'Update game data',
      message: `Re-download the game data from ${describeSource(source)} now? The app will refresh while it downloads. Your characters are not affected.`,
      confirmLabel: 'Update',
    });
    if (ok) forceCacheUpdate();
  };

  /** Copia o link de configuração da fonte atual, para mandar à mesa. */
  const copySetupLink = async () => {
    const link = buildSetupLink(window.location.origin, source.base);
    const copied = await navigator.clipboard.writeText(link).then(() => true, () => false);
    await alert({
      title: copied ? 'Setup link copied' : 'Setup link',
      message:
        `${link}\n\n` +
        'Send it to your players. Opening it the first time sets FlyBy to this game data; opening it again changes nothing, so they can keep using it as the site link.',
    });
  };

  /** Escolhe a fonte de dados: o SRD embutido ou um endereço do usuário. */
  const chooseSource = async () => {
    const current = describeSource(source);
    const gaps = missing?.length
      ? `\n\nThis source is missing ${missing.length} of the files the app reads; that content is unavailable.`
      : '';
    const res = await ask({
      title: 'Game data source',
      message:
        `Currently using: ${current}.${gaps}\n\n` +
        'The built-in SRD 5.2 content works offline and needs no download. To use other content, paste a GitHub repository or release link, or the address of a folder of game data in the 5etools format. Your characters are not affected.',
      fields: [{
        type: 'text',
        name: 'url',
        label: 'Data address',
        placeholder: SOURCE_PLACEHOLDER,
        default: source?.kind === 'url' ? source.base : '',
      }],
      actions: [
        { label: 'Cancel', value: null },
        ...(source?.kind === 'url' ? [{ label: 'Copy setup link', value: 'copy' }] : []),
        { label: 'Use SRD 5.2', value: 'srd' },
        { label: 'Use this address', value: 'url', tone: 'primary' },
      ],
    });
    if (!res || res.action == null) return;
    if (res.action === 'copy') {
      copySetupLink();
      return;
    }
    if (res.action === 'srd') {
      if (source?.kind !== 'srd') changeSource(SRD_SOURCE);
      return;
    }
    const result = await resolveSourceInput(res.values.url);
    if (!result.ok && !result.base) {
      const title = result.reason === 'no-repo' ? 'Repository not found' : 'Invalid address';
      await alert({ title, message: describeProblem(result) });
      return;
    }
    if (!result.ok) {
      const anyway = await confirm({ title: 'No game data found', message: describeProblem(result), confirmLabel: 'Use anyway' });
      if (!anyway) return;
    }
    if (sameSource(source, { kind: 'url', base: result.base })) return;
    changeSource({ kind: 'url', base: result.base });
  };

  /** Escolhe o tema da interface (src/theme.js). */
  const chooseTheme = async () => {
    const res = await ask({
      title: 'Theme',
      message: 'How FlyBy looks on this device. "Match the device" follows its light or dark mode.',
      fields: [{ type: 'select', name: 'theme', label: 'Theme', options: THEME_CHOICES, default: theme }],
      actions: [
        { label: 'Cancel', value: null },
        { label: 'Apply', value: 'apply', tone: 'primary' },
      ],
    });
    if (res?.action === 'apply' && res.values.theme !== theme) setTheme(res.values.theme);
  };

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

  const items = useMemo(
    () => orderRoster(characters, { query, sortBy })[0].items,
    [characters, query, sortBy],
  );

  const total = characters.length;

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
            { label: 'Tutorials', sub: 'In-app usage walkthroughs', disabled: true },
            { label: 'Replay tutorials', sub: 'Show them again as you navigate', onClick: replayTutorials },
            tutEnabled
              ? { label: 'Disable tutorials', sub: 'Turn off the walkthroughs', onClick: () => setTutEnabled(false) }
              : { label: 'Enable tutorials', sub: 'Turn on the walkthroughs', onClick: () => setTutEnabled(true) },
            { label: 'Theme', sub: THEME_CHOICES.find((t) => t.value === theme)?.label, onClick: chooseTheme },
            { label: 'Import character', sub: 'Foundry actor JSON', onClick: pickFile },
            { label: 'Game data source', sub: describeSource(source), onClick: chooseSource },
            ...(source?.kind === 'url'
              ? [{ label: 'Update game data', sub: 'Re-download from the data source', onClick: updateData }]
              : []),
            { label: 'Feedback / report a bug', sub: 'Sends an e-mail', href: FEEDBACK_URL },
          ]}
        >
          <span aria-hidden="true">☰</span>
        </MenuButton>
      </header>

      {showSamsungHint && (
        <aside className={styles.installHint}>
          <p className={styles.installHintText}>
            Installing from Samsung Internet is blocked by Google Play Protect. To install
            FlyBy as an app, open it in Chrome. Characters stay in this browser, so export
            any you made here first.
          </p>
          <div className={styles.installHintActions}>
            <a className={styles.installHintLink} href={chromeIntentUrl(window.location)}>
              Open in Chrome
            </a>
            <button type="button" className={styles.installHintClose} onClick={dismissSamsungHint}>
              Dismiss
            </button>
          </div>
        </aside>
      )}

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

            <div className={styles.newRow}>
              <button type="button" className={styles.newBtn} onClick={createNew}>
                + New Character
              </button>
            </div>

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
        {source?.kind === 'srd' ? 'Built-in game data in the ' : 'Game data from '}
        <a href="https://5e.tools" target="_blank" rel="noopener noreferrer">5e.tools</a>
        {source?.kind === 'srd' ? ' format' : ''}. Includes SRD
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
