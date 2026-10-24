// =============================================================================
// Builder: a ficha completa
// =============================================================================
// O QUE FAZ
//   O shell da ficha: retrato e nome, o cabeçalho de stats DERIVADOS, o card de
//   proficiências e as abas (Species, Background, Class, Inventory, Spellbook,
//   Biography). Perícias não têm aba própria: ficam para o play mode (DDL-0004).
//   É aqui que as mudanças das abas viram `save`.
//
// FUNÇÕES
//   Builder(): carrega o personagem.
//   BuilderInner(props): a ficha, com o personagem garantido (os hooks ficam aqui
//     para não haver hook depois de um return).
//   portraitFilename(name, src): o nome do arquivo para baixar o retrato.
//   PortraitViewer(props): o retrato em tela cheia (trocar, baixar, remover).
//   PortraitSourceModal(props): upload ou URL do retrato.
//
// DECISÕES E ARMADILHAS
//   Menu e guia
//   - O d20 ao lado do voltar abre o play mode, uma tela à parte (DDL-0004), só com os
//     recursos experimentais ligados (DDL-0111).
//   - O menu segue o padrão de menus do app (AppMenus, DDL-0098): glossário,
//     Export & import, Character guide e Settings em janelinhas, e o feedback.
//   - A aba nova entra deslizando do lado para onde se foi (openTab, motion.js).
//     No celular, arrastar o conteúdo para o lado troca de aba (useSwipeNav, num
//     contêiner estável em volta do painel, que remonta a cada troca).
//   - A guidance é POR personagem (`meta.guided`). O botão do guia aparece enquanto
//     faltar qualquer campo obrigatório não-biográfico (guidancePendencies); com
//     pendência BÁSICA abre o guia de criação na Revisão, só com decisões de classe
//     abre o overlay leve. No passo do tutorial que o descreve, ele aparece mesmo
//     escondido, sem badge e inerte (`guideDemo`).
//   - O tour da FICHA dispara sem atraso no 1o mount, antes do timer do seletor;
//     o micro-tour de cada ABA dispara ao abri-la, com atraso (as âncoras precisam
//     existir), e o do Spellbook só para conjuradores. "Um por vez" é garantia do
//     store.
//   Classes e nível
//   - Definir a classe original soma o ouro inicial (só com a carteira padrão e o
//     inventário vazio). Um +1 de QUALQUER origem (topo ou aba Class) abre o guia de
//     level-up, derivando no nível alvo e só se houver o que preencher.
//   - O level-down é limpo AQUI, de forma central (cleanupClassEntry), e depois as
//     magias preparadas são reconciliadas (reconcileClassSpells).
//   - HP: o único nível fixo é o 1 da classe ORIGINAL; o reset volta à fórmula e
//     zera também o ajuste manual; o ajuste não desce abaixo do derivado sem bônus.
//   Export, espécie e inventário
//   - Foundry é o ÚNICO formato de export e import (DDL-0005). O PDF é importado
//     dinamicamente, fora do bundle principal.
//   - Trocar a linhagem reseta as escolhas de espécie.
//   - O balde de carga usa as operações puras do engine (unassignedSpells), cada
//     uma um único save.
//   - Comprar faz MERGE em stacks do mesmo item que não estejam equipados nem
//     atunados, e só no MESMO destino (a corda comprada com a mochila aberta não
//     empilha na corda solta).
//   - Retrato: o upload vira data-URL redimensionada; a URL da web é guardada
//     direto (como o seletor de imagem do Foundry).
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import useSettingsStore from '../store/settingsStore';
import { useData } from '../data/dataContext';
import useDerived from '../hooks/useDerived';
import useCharacterImport from '../hooks/useCharacterImport';
import { classSummary } from '../schema/character';
import { assembleFoundryActor } from '../engine/foundryActor';
import { seedStartingGold } from '../engine/startingGold';
import { fileToPortrait } from '../components/common/imageFile';
import MenuButton from '../components/common/MenuButton';
import { SettingsMenu, SheetFilesMenu, SheetGuideMenu } from '../components/common/AppMenus';
import { menu } from '../components/common/dialog';
import { directionOf, slideClass } from '../motion';
import { useSwipeNav } from '../hooks/useSwipeNav';
import { openGlossary } from '../store/glossaryStore';
import { FEEDBACK_URL } from '../feedback';
import useTutorialStore, { startTutorial, maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import BackButton from '../components/common/BackButton';
import LevelControls from '../components/builder/LevelControls';
import LevelUpWizard from '../components/wizard/LevelUpWizard';
import { buildFixupSteps, firstClassWithFixup } from '../components/wizard/fixupSteps';
import { guidancePendencies, guidanceActive } from '../components/wizard/guidancePendencies';
import { deriveFromDb, resolveClassObj, resolveSubclassObj, reconcileClassSpells } from '../engine/resolve';
import { cleanupClassEntry } from '../engine/classFeatureChoices';
import { assignCargoSpell, discardCargoSpell } from '../engine/unassignedSpells';
import StatsHeader from '../components/builder/StatsHeader';
import ProficienciesCard from '../components/builder/ProficienciesCard';
import BackgroundTab from '../components/builder/BackgroundTab';
import BiographyTab from '../components/builder/BiographyTab';
import SpeciesTab from '../components/builder/SpeciesTab';
import ClassTab from '../components/builder/ClassTab';
import InventoryTab from '../components/builder/InventoryTab';
import SpellbookTab from '../components/builder/SpellbookTab';
import styles from './Builder.module.css';
import { useBackLayer } from '../hooks/useBack';
import Icon from '../components/common/Icon';
import { showPdfExport } from '../components/common/pdfExportDialog';

const TABS = ['Species', 'Background', 'Class', 'Inventory', 'Spellbook', 'Biography'];

const TAB_TOUR = {
  Species: 'tab-species',
  Background: 'tab-background',
  Class: 'tab-class',
  Inventory: 'tab-inventory',
  Spellbook: 'tab-spellbook',
  Biography: 'tab-biography',
};

export default function Builder() {
  const { id } = useParams();
  const { db } = useData();

  const loaded = useCharacterStore((s) => s.loaded);
  const load = useCharacterStore((s) => s.load);
  const character = useCharacterStore((s) => s.getById(id));
  const save = useCharacterStore((s) => s.save);

  const [activeTab, setActiveTab] = useState('Species');

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <div className={styles.page}>Loading…</div>;
  if (!character) {
    return (
      <div className={styles.page}>
        <p>Character not found.</p>
        <BackButton to="/" label="characters" />
      </div>
    );
  }

  return (
    <BuilderInner
      key={character.id}
      character={character}
      db={db}
      save={save}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    />
  );
}

function BuilderInner({ character, db, save, activeTab, setActiveTab }) {
  const [tabDir, setTabDir] = useState(null);
  const swipeRef = useRef(null);
  const tabIndex = TABS.indexOf(activeTab);
  useSwipeNav(swipeRef, {
    onPrev: () => openTab(TABS[tabIndex - 1]),
    onNext: () => openTab(TABS[tabIndex + 1]),
    canPrev: tabIndex > 0,
    canNext: tabIndex < TABS.length - 1,
  });
  /** Troca de aba lembrando a direção, para a aba nova entrar do lado certo. */
  const openTab = (tab) => {
    if (tab === activeTab) return;
    setTabDir(directionOf(TABS.indexOf(activeTab), TABS.indexOf(tab)));
    setActiveTab(tab);
  };
  const navigate = useNavigate();
  const experimental = useSettingsStore((s) => s.experimental);
  const derived = useDerived(character);
  const active = guidanceActive(character);
  /** Liga ou desliga o guia; lê o personagem do store (o submenu fica aberto e ele muda). */
  const setGuided = (guided) => {
    const latest = useCharacterStore.getState().getById(character.id) ?? character;
    save({ ...latest, meta: { ...latest.meta, guided } });
  };
  const pend = guidancePendencies(db, character, derived);
  const { inputRef: importRef, onFileChange: onImportFile, pickFile: pickImport } = useCharacterImport();
  const fileRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setTutEnabled = useTutorialStore((s) => s.setEnabled);
  const resetTutorials = useTutorialStore((s) => s.resetSeen);
  const replayTutorials = () => {
    setTutEnabled(true);
    resetTutorials();
    startTutorial('sheet');
  };

  useEffect(() => {
    maybeStartTutorial('sheet');
  }, []);

  const hasSpellcasting = (derived.spellcasting?.origins?.length ?? 0) > 0;
  const tourAnchor = useTutorialStore((s) => (s.tourId ? s.steps[s.index]?.anchor ?? null : null));
  useEffect(() => {
    const id = TAB_TOUR[activeTab];
    if (!id) return undefined;
    if (activeTab === 'Spellbook' && !hasSpellcasting) return undefined;
    const t = setTimeout(() => maybeStartTutorial(id), 300);
    return () => clearTimeout(t);
  }, [activeTab, hasSpellcasting]);

  const rename = (name) => save({ ...character, meta: { ...character.meta, name } });

  const onPortraitFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const portrait = await fileToPortrait(file);
      save({ ...character, meta: { ...character.meta, portrait } });
      setViewerOpen(false);
    } catch {
      // arquivo ilegível/não-imagem: mantém como está
    }
  };
  const setPortraitUrl = (url) => {
    save({ ...character, meta: { ...character.meta, portrait: url } });
    setPickerOpen(false);
    setViewerOpen(false);
  };
  const clearPortrait = () => {
    save({ ...character, meta: { ...character.meta, portrait: null } });
    setViewerOpen(false);
  };
  const onPortraitClick = () => {
    if (character.meta.portrait) setViewerOpen(true);
    else setPickerOpen(true);
  };

  const setBaseScore = (ability, value) =>
    save({ ...character, scores: { ...character.scores, [ability]: value } });

  const setAlignment = (code) =>
    save({ ...character, identity: { ...character.identity, alignment: code } });

  const setOrigin = (origin) => save({ ...character, origin });

  const setIdentity = (patch) => save({ ...character, identity: { ...character.identity, ...patch } });

  const [overlay, setOverlay] = useState(null);

  const setClasses = (classes) => {
    const subLevel = character.rulesConfig?.subclassLevel ?? 3;
    const cleaned = classes.map((nc) => {
      const oc = character.classes.find((c) => c.uid === nc.uid);
      if (!oc || !nc.classId) return nc;
      let entry = nc;
      if (nc.level < oc.level) {
        const classObj = resolveClassObj(db, nc.classId, nc.source);
        const subObj = nc.subclassId ? resolveSubclassObj(db, nc.classId, nc.subclassId, nc.subclassSource) : null;
        entry = cleanupClassEntry(nc, { classObj, subclassObj: subObj, subclassLevel: subLevel });
      }
      // ATENÇÃO: a reconciliação roda DEPOIS do cleanup; só então a entrada tem nível e subclasse finais.
      const spells = reconcileClassSpells(oc, entry, db);
      return spells === entry.spells ? entry : { ...entry, spells };
    });
    const next = { ...character, classes: cleaned };
    const currency = seedStartingGold(next, db);
    const saved = currency ? { ...next, currency } : next;
    save(saved);
    maybeOpenLevelUp(character.classes, cleaned, saved);
  };

  const maybeOpenLevelUp = (oldClasses, newClasses, nextChar) => {
    if (!active) return;
    for (const nc of newClasses) {
      const oc = (oldClasses ?? []).find((c) => c.uid === nc.uid);
      if (oc && nc.classId && nc.level === oc.level + 1) {
        const d = deriveFromDb(nextChar, db);
        if (buildFixupSteps(db, nextChar, nc.uid, d).length > 0) {
          setOverlay({ classUid: nc.uid, toLevel: nc.level });
        }
        return;
      }
    }
  };

  const openGuide = () => {
    if (pend.basic > 0) {
      navigate(`/build/${character.id}/wizard`, { state: { atReview: true } });
      return;
    }
    const cls = firstClassWithFixup(db, character, derived);
    if (cls) setOverlay({ classUid: cls.uid });
  };

  const revertLevelUp = () => {
    if (!overlay?.toLevel) return;
    setClasses(
      character.classes.map((c) => (c.uid === overlay.classUid ? { ...c, level: overlay.toLevel - 1 } : c)),
    );
  };

  const dieOf = (classId) => derived.classBreakdown.find((b) => b.classId === classId)?.hitDie ?? 0;
  const rollHp = () =>
    save({
      ...character,
      classes: character.classes.map((cls) => {
        const die = dieOf(cls.classId);
        const hitPoints = {};
        const start = cls.isOriginalClass ? 2 : 1;
        for (let lvl = start; lvl <= cls.level; lvl++) {
          hitPoints[lvl] = die > 0 ? Math.floor(Math.random() * die) + 1 : 0;
        }
        return { ...cls, hitPoints };
      }),
    });
  const averageHp = () =>
    save({ ...character, hpBonus: 0, classes: character.classes.map((cls) => ({ ...cls, hitPoints: {} })) });
  const hpRolled = character.classes.some((cls) =>
    Object.values(cls.hitPoints ?? {}).some((v) => typeof v === 'number'),
  );
  const changeHpBonus = (delta) => save({ ...character, hpBonus: (character.hpBonus ?? 0) + delta });

  const safeName = () => (character.meta.name || 'character').replace(/[^\w.-]+/g, '_');
  const download = (data, suffix) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName()}${suffix}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  /** Os submenus do menu sanduíche (AppMenus, o padrão de menus do app). */
  const openFiles = () =>
    menu({
      title: 'Export & import',
      content: <SheetFilesMenu onExportFoundry={exportFoundry} onExportPdf={exportPdf} onImport={pickImport} />,
    });
  const openGuideMenu = () =>
    menu({
      title: 'Character guide',
      content: (
        <SheetGuideMenu
          characterId={character.id}
          onRerun={() => {
            save({ ...character, meta: { ...character.meta, creating: true } });
            navigate(`/build/${character.id}/wizard`);
          }}
          onSetGuided={setGuided}
        />
      ),
    });
  const openSettings = () => menu({ title: 'Settings', content: <SettingsMenu onReplayTutorials={replayTutorials} /> });

  const exportFoundry = () => download(assembleFoundryActor(character, db), '.json');
  const exportPdf = () =>
    showPdfExport(async (options) => {
      const { exportCharacterPdf } = await import('../pdf/exportPdf');
      await exportCharacterPdf(character, derived, db, options);
    });

  const pickSpecies = (race) =>
    save({ ...character, species: { id: race.name.toLowerCase(), source: race.source, choices: {}, lineage: null } });
  const clearSpecies = () => save({ ...character, species: null });
  const setSpeciesChoices = (choices) =>
    save({ ...character, species: { ...character.species, choices } });
  const setSpeciesLineage = (lineage) =>
    save({ ...character, species: { ...character.species, lineage, choices: {} } });

  const setClassSpells = (uid, spells) =>
    save({ ...character, classes: character.classes.map((c) => (c.uid === uid ? { ...c, spells } : c)) });

  const assignUnassignedSpell = (uid, index) => save(assignCargoSpell(character, uid, index));
  const discardUnassignedSpell = (index) => save(discardCargoSpell(character, index));

  const setInventory = (inventory) => save({ ...character, inventory });
  const setCurrency = (currency) => save({ ...character, currency });
  // ATENÇÃO: inventário e moeda num ÚNICO save; dois setters sobre a mesma closure se pisariam.
  const purchaseItems = (items, currency) => {
    let inventory = [...character.inventory];
    for (const item of items) {
      const i = inventory.findIndex(
        (it) => it.itemId === item.itemId && it.source === item.source && !it.equipped && !it.attuned
          && (it.container ?? null) === (item.container ?? null),
      );
      if (i === -1) {
        inventory.push(item);
      } else {
        inventory = inventory.map((it, idx) =>
          idx === i ? { ...it, quantity: (it.quantity ?? 1) + (item.quantity ?? 1) } : it,
        );
      }
    }
    save({ ...character, inventory, currency });
  };

  return (
    <div className={`${styles.page} motion-page`}>
      <div className={styles.topBar}>
        <div className={styles.topActions}>
          <BackButton to="/" label="characters" />
          {experimental && (
            <button
              type="button"
              className={styles.menuBtn}
              title="Play this character"
              aria-label="Play"
              onClick={() => navigate(`/play/${character.id}`)}
            >
              <span aria-hidden="true"><Icon name="dice" /></span>
            </button>
          )}
        </div>
        <div className={styles.topActions}>
          {(() => {
            const guideShown = active && pend.total > 0;
            const guideDemo = !guideShown && tourAnchor === TUT.SHEET_GUIDE;
            if (!guideShown && !guideDemo) return null;
            return (
              <button
                type="button"
                className={`${styles.guideBtn} ${styles.guideBtnAlert}`}
                onClick={guideShown ? openGuide : undefined}
                data-tour={TUT.SHEET_GUIDE}
                title={
                  guideShown
                    ? `${pend.total} choice${pend.total > 1 ? 's' : ''} left - open the guide`
                    : 'The guide button (shown here for the tutorial)'
                }
              >
                <span aria-hidden="true"><Icon name="guide" /></span>
                {pend.total > 0 && <span className={styles.guideBadge}>{pend.total}</span>}
              </button>
            );
          })()}
          <MenuButton
            buttonClassName={styles.menuBtn}
            buttonTitle="Menu"
            dataTour={TUT.SHEET_MENU}
            items={[
              { label: 'Glossary', sub: 'Search every rule, spell, item and feature', onClick: openGlossary },
              { label: 'Export & import', sub: 'Foundry VTT, PDF, or open another character', onClick: openFiles },
              { label: 'Character guide', sub: 'Re-run the creation guide, guide on or off', onClick: openGuideMenu },
              { label: 'Settings', sub: 'Theme, creation guide and tutorials', onClick: openSettings },
              { label: 'About FlyBy', sub: 'Version, credits and licenses', onClick: () => navigate('/about') },
              { label: 'Feedback / report a bug', sub: 'Sends an e-mail', href: FEEDBACK_URL },
            ]}
          >
            <span aria-hidden="true"><Icon name="menu" /></span>
          </MenuButton>
        </div>
      </div>

      <div className={styles.identity} data-tour={TUT.SHEET_IDENTITY}>
        <div className={styles.portraitWrap}>
          <button
            type="button"
            className={
              character.meta.portrait ? `${styles.portrait} ${styles.portraitFilled}` : styles.portrait
            }
            title={character.meta.portrait ? 'View portrait' : 'Add a portrait'}
            onClick={onPortraitClick}
          >
            {character.meta.portrait ? <img src={character.meta.portrait} alt="Portrait" /> : <Icon name="portrait" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPortraitFile}
          />
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={onImportFile}
        />
        <div className={styles.nameWrap}>
          <input
            className={styles.name}
            value={character.meta.name}
            onChange={(e) => rename(e.target.value)}
            placeholder="Character name"
          />
          <p className={styles.sub}>{classSummary(character) || 'No class set'}</p>
        </div>
        <div className={styles.levelSlot} data-tour={TUT.SHEET_LEVEL}>
          <LevelControls character={character} onChangeClasses={setClasses} />
        </div>
      </div>

      <StatsHeader
        derived={derived}
        character={character}
        onChangeBaseScore={setBaseScore}
        onChangeAlignment={setAlignment}
        onRollHp={rollHp}
        onAverageHp={averageHp}
        onChangeHpBonus={changeHpBonus}
        hpRolled={hpRolled}
      />

      <div className={styles.stack} data-tour={TUT.SHEET_PROFICIENCIES}>
        <ProficienciesCard derived={derived} />
      </div>

      <nav className={styles.tabBar} data-tour={TUT.SHEET_TABS}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => openTab(tab)}
            className={activeTab === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div ref={swipeRef}>
        <div key={activeTab} className={`${styles.panel} ${slideClass(tabDir)}`}>
          {activeTab === 'Species' && (
            <SpeciesTab
              character={character}
              db={db}
              onPick={pickSpecies}
              onClear={clearSpecies}
              onChangeChoices={setSpeciesChoices}
              onChangeLineage={setSpeciesLineage}
            />
          )}

          {activeTab === 'Background' && (
            <BackgroundTab character={character} db={db} onChangeOrigin={setOrigin} onChangeIdentity={setIdentity} />
          )}
          {activeTab === 'Class' && <ClassTab character={character} db={db} onChange={setClasses} />}
          {activeTab === 'Inventory' && (
            <InventoryTab
              character={character}
              db={db}
              derived={derived}
              onChange={setInventory}
              onChangeCurrency={setCurrency}
              onPurchase={purchaseItems}
            />
          )}
          {activeTab === 'Spellbook' && (
            <SpellbookTab
              character={character}
              db={db}
              derived={derived}
              onChangeSpells={setClassSpells}
              onAssignUnassigned={assignUnassignedSpell}
              onDiscardUnassigned={discardUnassignedSpell}
            />
          )}
          {activeTab === 'Biography' && <BiographyTab character={character} db={db} onChange={setIdentity} />}
        </div>
      </div>

      {viewerOpen && character.meta.portrait && (
        <PortraitViewer
          src={character.meta.portrait}
          name={character.meta.name}
          onChange={() => {
            setViewerOpen(false);
            setPickerOpen(true);
          }}
          onRemove={clearPortrait}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {pickerOpen && (
        <PortraitSourceModal
          onUpload={() => {
            setPickerOpen(false);
            fileRef.current?.click();
          }}
          onUseUrl={setPortraitUrl}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {overlay && (
        <LevelUpWizard
          character={character}
          db={db}
          save={save}
          classUid={overlay.classUid}
          levelUp={overlay.toLevel ? { toLevel: overlay.toLevel } : undefined}
          onClose={() => setOverlay(null)}
          onRevert={revertLevelUp}
        />
      )}
    </div>
  );
}

/** O nome do arquivo para baixar o retrato. */
function portraitFilename(name, src) {
  let ext = 'png';
  if (/^data:/.test(src)) {
    const mime = String(src).slice(5, String(src).indexOf(';'));
    ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else {
    const m = String(src).match(/\.([a-zA-Z0-9]{2,4})(?:[?#]|$)/);
    if (m) ext = m[1].toLowerCase();
  }
  const base = (name || 'character').trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'character';
  return `${base}-portrait.${ext}`;
}

/** O retrato em tela cheia: trocar, baixar, remover. */
function PortraitViewer({ src, name, onChange, onRemove, onClose }) {
  useBackLayer(true, onClose);
  return (
    <div className={styles.viewerOverlay} onClick={onClose}>
      <img className={styles.viewerImg} src={src} alt="Portrait" onClick={(e) => e.stopPropagation()} />
      <div className={styles.viewerActions} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.viewerBtn} onClick={onChange}>
          Change
        </button>
        <a className={styles.viewerBtn} href={src} download={portraitFilename(name, src)}>
          Download
        </a>
        <button type="button" className={`${styles.viewerBtn} ${styles.viewerDanger}`} onClick={onRemove}>
          Remove
        </button>
      </div>
      <button type="button" className={styles.viewerClose} onClick={onClose} aria-label="Close">
        <Icon name="close" />
      </button>
    </div>
  );
}

/** O escolhedor da fonte do retrato: upload ou URL. */
function PortraitSourceModal({ onUpload, onUseUrl, onClose }) {
  const [url, setUrl] = useState('');
  useBackLayer(true, onClose);
  const submitUrl = (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onUseUrl(trimmed);
  };
  return (
    <div className={styles.sourceOverlay} onClick={onClose}>
      <div className={styles.sourcePanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sourceHead}>
          <h2>Add portrait</h2>
          <button type="button" className={styles.viewerClose} onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <button type="button" className={styles.sourceUploadBtn} onClick={onUpload}>
          Upload from device
        </button>
        <div className={styles.sourceDivider}>
          <span>or</span>
        </div>
        <form className={styles.sourceUrlRow} onSubmit={submitUrl}>
          <input
            type="url"
            className={styles.sourceUrlInput}
            placeholder="https://example.com/portrait.webp"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <button type="submit" className={styles.sourceUrlBtn} disabled={!url.trim()}>
            Use URL
          </button>
        </form>
      </div>
    </div>
  );
}
