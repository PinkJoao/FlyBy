// =============================================================================
// Builder - a ficha completa (Fase 5)
// =============================================================================
// Shell: foto + nome, header de stats DERIVADOS (tiles + atributos editáveis),
// card de proficiências, e navegação por abas. As abas (Species / Background /
// Class / Inventory / Spellbook) recebem conteúdo nos sub-passos da Fase 5; aqui só
// Species já tem o seletor. Perícias não têm aba própria - ficam pro play mode
// (DDL-0004), junto do resto do que é "usar" a ficha em vez de "criar" o personagem.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import { useData } from '../data/dataContext';
import useDerived from '../hooks/useDerived';
import useCharacterImport from '../hooks/useCharacterImport';
import { classSummary } from '../schema/character';
import { assembleFoundryActor } from '../engine/foundryActor';
import { seedStartingGold } from '../engine/startingGold';
import { fileToPortrait } from '../components/common/imageFile';
import MenuButton from '../components/common/MenuButton';
import { openGlossary } from '../store/glossaryStore';
import BackButton from '../components/common/BackButton';
import LevelControls from '../components/builder/LevelControls';
import LevelUpWizard from '../components/wizard/LevelUpWizard';
import { buildFixupSteps, firstClassWithFixup } from '../components/wizard/fixupSteps';
import { guidancePendencies, guidanceActive } from '../components/wizard/guidancePendencies';
import { deriveFromDb, resolveClassObj, resolveSubclassObj, reconcileClassSpells } from '../engine/resolve';
import { cleanupClassEntry } from '../engine/classFeatureChoices';
import StatsHeader from '../components/builder/StatsHeader';
import ProficienciesCard from '../components/builder/ProficienciesCard';
import BackgroundTab from '../components/builder/BackgroundTab';
import BiographyTab from '../components/builder/BiographyTab';
import SpeciesTab from '../components/builder/SpeciesTab';
import ClassTab from '../components/builder/ClassTab';
import InventoryTab from '../components/builder/InventoryTab';
import SpellbookTab from '../components/builder/SpellbookTab';
import styles from './Builder.module.css';

const TABS = ['Species', 'Background', 'Class', 'Inventory', 'Spellbook', 'Biography'];

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

// Hooks isolados num componente com personagem garantido (evita hook-após-return).
function BuilderInner({ character, db, save, activeTab, setActiveTab }) {
  const navigate = useNavigate();
  const derived = useDerived(character);
  // Guidance é POR-PERSONAGEM (meta.guided): "just the sheet" nasce desligado.
  const active = guidanceActive(character);
  const setGuided = (guided) => save({ ...character, meta: { ...character.meta, guided } });
  // TODAS as pendências obrigatórias (não-biográficas) - alimenta o botão ✦
  // (accent + badge) enquanto a ficha não estiver completa. `basic` = passos de
  // criação (espécie/classe/talento/proficiências/atributos/boosts); `fixup` =
  // decisões de classe (subclasse/features/magias).
  const pend = guidancePendencies(db, character, derived);
  const { inputRef: importRef, onFileChange: onImportFile, pickFile: pickImport } = useCharacterImport();
  const fileRef = useRef(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rename = (name) => save({ ...character, meta: { ...character.meta, name } });

  // Retrato: arquivo de imagem → data-URL (redimensionado) em meta.portrait.
  const onPortraitFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    try {
      const portrait = await fileToPortrait(file);
      save({ ...character, meta: { ...character.meta, portrait } });
      setViewerOpen(false);
    } catch {
      // arquivo ilegível/não-imagem: mantém como está
    }
  };
  // Retrato por URL de imagem da web (como o seletor de imagem do Foundry VTT) -
  // guarda a URL direto, sem baixar/reencodar (ao contrário do upload de arquivo).
  const setPortraitUrl = (url) => {
    save({ ...character, meta: { ...character.meta, portrait: url } });
    setPickerOpen(false);
    setViewerOpen(false);
  };
  const clearPortrait = () => {
    save({ ...character, meta: { ...character.meta, portrait: null } });
    setViewerOpen(false);
  };
  // Sem foto o toque abre o escolhedor de fonte (upload/URL); com foto, abre o
  // visualizador em tela cheia (que por sua vez reabre o escolhedor em "Change").
  const onPortraitClick = () => {
    if (character.meta.portrait) setViewerOpen(true);
    else setPickerOpen(true);
  };

  const setBaseScore = (ability, value) =>
    save({ ...character, scores: { ...character.scores, [ability]: value } });

  const setAlignment = (code) =>
    save({ ...character, identity: { ...character.identity, alignment: code } });

  const setOrigin = (origin) => save({ ...character, origin });

  // Campos biográficos (aba Biography + a história na aba Background). Patch
  // parcial: cada campo mexe só em si.
  const setIdentity = (patch) => save({ ...character, identity: { ...character.identity, ...patch } });

  // --- Guia de fixup / level-up (overlay compartilhado) ----------------------
  // `overlay`: { classUid, toLevel? } | null. Com `toLevel` = aberto por level-up
  // (revertível); sem = aberto pelo botão ✦.
  const [overlay, setOverlay] = useState(null);

  // Ao definir a classe (original), soma o ouro inicial dela - mas só se a
  // carteira ainda estiver no padrão (50 GP do background) e o inventário vazio.
  // TAMBÉM detecta um level-up de UMA classe (+1) vindo de QUALQUER lugar
  // (LevelControls do topo OU o stepper da aba Class, #4) e abre o guia.
  const setClasses = (classes) => {
    const subLevel = character.rulesConfig?.subclassLevel ?? 3;
    // Cleanup centralizado no LEVEL-DOWN (de qualquer origem): poda escolhas de
    // níveis perdidos, apara Weapon Mastery/optional features e reverte a
    // subclasse se caiu - para nada persistir nem "voltar selecionado" ao subir.
    const cleaned = classes.map((nc) => {
      const oc = character.classes.find((c) => c.uid === nc.uid);
      if (!oc || !nc.classId) return nc;
      let entry = nc;
      // Level-down estrutural: poda escolhas/subclasse/mastery de níveis perdidos.
      if (nc.level < oc.level) {
        const classObj = resolveClassObj(db, nc.classId, nc.source);
        const subObj = nc.subclassId ? resolveSubclassObj(db, nc.classId, nc.subclassId, nc.subclassSource) : null;
        entry = cleanupClassEntry(nc, { classObj, subclassObj: subObj, subclassLevel: subLevel });
      }
      // Reconcilia as magias preparadas: remove as concessões da subclasse
      // trocada/removida e poda por prioridade no level-down. Roda DEPOIS do
      // cleanup (que já reverteu a subclasse se o nível caiu), então `entry` já
      // tem o nível/subclasse finais.
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
        // Deriva no nível alvo (o `derived` do closure ainda é o de antes) e abre
        // só se há algo a preencher (senão o +1 vale direto - DDL-0013 #3).
        const d = deriveFromDb(nextChar, db);
        if (buildFixupSteps(db, nextChar, nc.uid, d).length > 0) {
          setOverlay({ classUid: nc.uid, toLevel: nc.level });
        }
        return;
      }
    }
  };

  // Botão ✦: se falta algum BÁSICO de criação (espécie/classe/talento/
  // proficiências/atributos/boosts), abre o GUIA DE CRIAÇÃO direto na Revisão
  // (o overlay leve não cobre esses passos); a Revisão lista tudo que pende com
  // um pulo para cada. Se só faltam decisões de CLASSE, abre o overlay leve.
  const openGuide = () => {
    if (pend.basic > 0) {
      navigate(`/build/${character.id}/wizard`, { state: { atReview: true } });
      return;
    }
    const cls = firstClassWithFixup(db, character, derived);
    if (cls) setOverlay({ classUid: cls.uid });
  };

  // Reverter o +1 (só quando aberto por level-up).
  const revertLevelUp = () => {
    if (!overlay?.toLevel) return;
    setClasses(
      character.classes.map((c) => (c.uid === overlay.classUid ? { ...c, level: overlay.toLevel - 1 } : c)),
    );
  };

  // HP: rolar ou média (padrão = hitPoints vazio). O ÚNICO nível fixo é o 1 da
  // classe ORIGINAL (máximo do dado); multiclasses rolam até o nível 1.
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
  // Reset: volta ao HP máximo da FÓRMULA - limpa as rolagens por nível E o ajuste
  // manual (hpBonus), senão um bônus/penalidade manual sobreviveria ao reset.
  const averageHp = () =>
    save({ ...character, hpBonus: 0, classes: character.classes.map((cls) => ({ ...cls, hitPoints: {} })) });
  const hpRolled = character.classes.some((cls) =>
    Object.values(cls.hitPoints ?? {}).some((v) => typeof v === 'number'),
  );
  // Ajuste MANUAL do HP máximo (± no card). Não desce abaixo do HP derivado sem bônus.
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
  // Foundry VTT (dnd5e) é o ÚNICO formato de export/import - o objetivo-norte do
  // projeto é compatibilidade total com o Foundry (DDL-0005).
  const exportFoundry = () => download(assembleFoundryActor(character, db), '.json');
  // PDF: ficha própria (clean-room) desenhada com @react-pdf/renderer, importado
  // DINAMICAMENTE para manter a dep pesada fora do bundle principal (Fase E).
  const exportPdf = async () => {
    const { exportCharacterPdf } = await import('../pdf/exportPdf');
    await exportCharacterPdf(character, derived, db);
  };

  const pickSpecies = (race) =>
    save({ ...character, species: { id: race.name.toLowerCase(), source: race.source, choices: {}, lineage: null } });
  const clearSpecies = () => save({ ...character, species: null });
  const setSpeciesChoices = (choices) =>
    save({ ...character, species: { ...character.species, choices } });
  // Trocar a linhagem (sub-raça) reseta as escolhas de espécie (perícia etc. da
  // linhagem podem mudar). `null` limpa a linhagem.
  const setSpeciesLineage = (lineage) =>
    save({ ...character, species: { ...character.species, lineage, choices: {} } });

  // Magias preparadas de UMA classe (Spellbook) - as demais ficam intactas.
  const setClassSpells = (uid, spells) =>
    save({ ...character, classes: character.classes.map((c) => (c.uid === uid ? { ...c, spells } : c)) });

  const setInventory = (inventory) => save({ ...character, inventory });
  const setCurrency = (currency) => save({ ...character, currency });
  // Comprar na loja muda inventário E moeda de uma vez - um ÚNICO save() (não
  // dois setters em sequência, que se pisariam: cada save() substitui o
  // personagem inteiro a partir do `character` da closure, então o 2º
  // sobrescreveria o 1º sem a mudança dele). Aceita VÁRIOS itens (checkout do
  // carrinho) e faz MERGE em stacks existentes do mesmo item que não estejam
  // equipados nem atunados (equipar/atunar é por-item, não faz sentido somar).
  const purchaseItems = (items, currency) => {
    let inventory = [...character.inventory];
    for (const item of items) {
      const i = inventory.findIndex(
        (it) => it.itemId === item.itemId && it.source === item.source && !it.equipped && !it.attuned,
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
    <div className={styles.page}>
      <div className={styles.topBar}>
        <BackButton to="/" label="characters" />
        <div className={styles.topActions}>
          {/* Botão do guia: visível (accent) enquanto a ficha tiver QUALQUER
              campo obrigatório não-biográfico por preencher - espécie, classe,
              subclasse, talento de origem, proficiências, atributos, boosts e as
              decisões de classe. Some quando a ficha está completa ou a guidance
              foi desligada nesta ficha (meta.guided === false). */}
          {active && pend.total > 0 && (
            <button
              type="button"
              className={`${styles.guideBtn} ${styles.guideBtnAlert}`}
              onClick={openGuide}
              title={`${pend.total} choice${pend.total > 1 ? 's' : ''} left - open the guide`}
            >
              <span aria-hidden="true">⚛</span>
              <span className={styles.guideBadge}>{pend.total}</span>
            </button>
          )}
          {/* Menu sanduíche: export (Foundry / PDF) + liga/desliga a Character
              Guidance DESTE personagem (meta.guided). "Just the sheet" nasce
              desligado; aqui o jogador reativa/desativa o botão ✦ por ficha. */}
          <MenuButton
            buttonClassName={styles.menuBtn}
            buttonTitle="Menu"
            items={[
              { label: 'Glossary', sub: 'Search every rule, spell, item and feature', onClick: openGlossary },
              { label: 'Export', sub: 'Foundry actor JSON', onClick: exportFoundry },
              { label: 'Export PDF', sub: 'Printable character sheet', onClick: exportPdf },
              { label: 'Import character', sub: 'Opens a new character', onClick: pickImport },
              {
                label: 'Creation guide',
                sub: 'Re-run the full step-by-step',
                onClick: () => {
                  save({ ...character, meta: { ...character.meta, creating: true } });
                  navigate(`/build/${character.id}/wizard`);
                },
              },
              active
                ? { label: 'Disable Character Guidance', sub: 'Hide the guide for this character', onClick: () => setGuided(false) }
                : { label: 'Enable Character Guidance', sub: 'Show the guide for this character', onClick: () => setGuided(true) },
            ]}
          >
            <span aria-hidden="true">☰</span>
          </MenuButton>
        </div>
      </div>

      <div className={styles.identity}>
        <div className={styles.portraitWrap}>
          <button
            type="button"
            className={
              character.meta.portrait ? `${styles.portrait} ${styles.portraitFilled}` : styles.portrait
            }
            title={character.meta.portrait ? 'View portrait' : 'Add a portrait'}
            onClick={onPortraitClick}
          >
            {character.meta.portrait ? <img src={character.meta.portrait} alt="Portrait" /> : '👤'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPortraitFile}
          />
        </div>
        {/* Import de personagem (menu ☰) - cria um novo personagem e navega até ele. */}
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
          {/* Sem o nível total aqui: o contador já o mostra. */}
          <p className={styles.sub}>{classSummary(character) || 'No class set'}</p>
        </div>
        {/* Desktop: à direita do perfil. Mobile (identity em coluna): logo
            abaixo do nome + legenda de classes, centralizado. */}
        <div className={styles.levelSlot}>
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

      <div className={styles.stack}>
        <ProficienciesCard derived={derived} />
      </div>

      <nav className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className={styles.panel}>
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
          <SpellbookTab character={character} db={db} derived={derived} onChangeSpells={setClassSpells} />
        )}
        {activeTab === 'Biography' && <BiographyTab character={character} db={db} onChange={setIdentity} />}
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

/** Nome do arquivo p/ baixar o retrato: extensão do mime do data-URL (upload) ou
 * da própria URL (retrato por link - sem mime, pega o sufixo do caminho). */
function portraitFilename(name, src) {
  let ext = 'png';
  if (/^data:/.test(src)) {
    const mime = String(src).slice(5, String(src).indexOf(';')); // ex: image/webp
    ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else {
    const m = String(src).match(/\.([a-zA-Z0-9]{2,4})(?:[?#]|$)/);
    if (m) ext = m[1].toLowerCase();
  }
  const base = (name || 'character').trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'character';
  return `${base}-portrait.${ext}`;
}

/** Visualizador do retrato em tela cheia: trocar / baixar / remover. */
function PortraitViewer({ src, name, onChange, onRemove, onClose }) {
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
        ✕
      </button>
    </div>
  );
}

/** Escolhedor da FONTE do retrato: upload de arquivo ou URL de imagem da web
 * (como o seletor de imagem do Foundry VTT - a URL é guardada direto, sem baixar). */
function PortraitSourceModal({ onUpload, onUseUrl, onClose }) {
  const [url, setUrl] = useState('');
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
            ✕
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
