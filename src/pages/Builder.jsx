// =============================================================================
// Builder: o modo ficha da página do personagem
// =============================================================================
// O QUE FAZ
//   O shell da ficha: retrato e nome, o cabeçalho de stats DERIVADOS, o card de
//   proficiências e as abas (Species, Background, Class, Inventory, Spellbook,
//   Biography). Perícias não têm aba própria: ficam para o play mode (DDL-0004).
//   É aqui que as mudanças das abas viram `save`. A página em volta (o topo, o
//   seletor Sheet | Play, a troca de modo) é a pages/Character (DDL-0117).
//
// FUNÇÕES
//   BuilderInner(props): a ficha, com o personagem e a derivação garantidos (quem
//     carrega é a pages/Character); o controle de nível entra por portal no lugar
//     ao lado do nome (`levelSlot`).
//
// DECISÕES E ARMADILHAS
//   Menu e guia
//   - `data-flip` marca o que a troca de modo anima (pages/Character, DDL-0118): o
//     controle de nível, as proficiências, a barra de abas e o painel.
//   - O play mode é o OUTRO MODO desta página (o seletor Sheet | Play no topo,
//     DDL-0117), só com os recursos experimentais ligados (DDL-0111).
//   - O menu é da pages/Character (CharacterMenu, DDL-0120), o mesmo nos dois modos.
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
//   Espécie e inventário
//   - Trocar a linhagem reseta as escolhas de espécie.
//   - O balde de carga usa as operações puras do engine (unassignedSpells), cada
//     uma um único save.
//   - Comprar faz MERGE em stacks do mesmo item que não estejam equipados nem
//     atunados, e só no MESMO destino (a corda comprada com a mochila aberta não
//     empilha na corda solta).
//   - Retrato, nome e o botão do guia são da pages/Character (DDL-0119), os mesmos
//     nos dois modos; o guia aberto no modo jogo chega aqui como `guideRequest`, e
//     a ficha o abre ao montar e avisa (`onGuideHandled`) para não reabrir.
// -----------------------------------------------------------------------------

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { seedStartingGold } from '../engine/startingGold';
import { directionOf, slideClass } from '../motion';
import { useSwipeNav } from '../hooks/useSwipeNav';
import { maybeStartTutorial } from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
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

const TABS = ['Species', 'Background', 'Class', 'Inventory', 'Spellbook', 'Biography'];

const TAB_TOUR = {
  Species: 'tab-species',
  Background: 'tab-background',
  Class: 'tab-class',
  Inventory: 'tab-inventory',
  Spellbook: 'tab-spellbook',
  Biography: 'tab-biography',
};

/** O modo ficha da página do personagem. */
export function BuilderInner({ character, db, save, derived, activeTab, setActiveTab, levelSlot, guideRequest, onGuideHandled }) {
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
  const active = guidanceActive(character);
  const pend = guidancePendencies(db, character, derived);

  useEffect(() => {
    maybeStartTutorial('sheet');
  }, []);

  const hasSpellcasting = (derived.spellcasting?.origins?.length ?? 0) > 0;
  useEffect(() => {
    const id = TAB_TOUR[activeTab];
    if (!id) return undefined;
    if (activeTab === 'Spellbook' && !hasSpellcasting) return undefined;
    const t = setTimeout(() => maybeStartTutorial(id), 300);
    return () => clearTimeout(t);
  }, [activeTab, hasSpellcasting]);

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

  const onGuideRequest = useEffectEvent(() => {
    openGuide();
    onGuideHandled?.();
  });
  useEffect(() => {
    if (!guideRequest) return undefined;
    const t = setTimeout(onGuideRequest, 0);
    return () => clearTimeout(t);
  }, [guideRequest]);

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
    <>
      {levelSlot && createPortal(
        <div data-flip="slot-level">
          <LevelControls character={character} onChangeClasses={setClasses} />
        </div>,
        levelSlot,
      )}

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

      <div className={styles.stack} data-tour={TUT.SHEET_PROFICIENCIES} data-flip="profs">
        <ProficienciesCard derived={derived} />
      </div>

      <nav className={styles.tabBar} data-wheel-x="" data-tour={TUT.SHEET_TABS} data-flip="tabs" data-flip-fade="">
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

      <div ref={swipeRef} data-flip="panel-sheet">
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
    </>
  );
}
