// =============================================================================
// Character: a página do personagem, nos modos ficha e jogo
// =============================================================================
// O QUE FAZ
//   Uma página só para montar e para jogar (DDL-0117). Carrega o personagem, lê o
//   modo do ENDEREÇO (/build/:id é a ficha, /play/:id o jogo) e monta o que os dois
//   modos dividem: a página da ficha, o topo (voltar, o seletor Sheet | Play no
//   centro, o botão do guia e os botões do modo à direita), o bloco de identidade
//   (CharacterIdentity: retrato e nome, editáveis nos dois) e, no jogo em tela
//   larga, a coluna do histórico. A derivação é feita UMA vez aqui e passada ao modo. O conteúdo de cada modo é o BuilderInner (pages/Builder) ou o
//   PlayInner (pages/Play), que entram com uma animação leve na troca.
//
// FUNÇÕES
//   Character(): a página.
//     switchMode(next): troca o modo trocando o endereço, sem empilhar.
//     openGuide(): o guia; no modo jogo, troca para a ficha e o abre lá.
//   GuideButton(props): o botão do guia, enquanto faltar algo (nos dois modos).
//   snapshot(page): onde estavam a página e cada pedaço marcado com `data-flip`.
//   flip(page, side, snap): anima da posição guardada até a nova (FLIP), o que
//     aparece e a coluna do histórico.
//
// DECISÕES E ARMADILHAS
//   - O modo vem do endereço, e trocar usa `replace`: o voltar do celular nunca
//     alterna entre ficha e jogo; ele sai da página (para a lista). O botão de
//     voltar também leva sempre à lista.
//   - Sem os recursos experimentais (DDL-0111) não há seletor, e /play/:id vira
//     /build/:id.
//   - O topo NÃO remonta na troca: os botões da direita e a coluna do histórico são
//     de cada modo, e entram por portal nos lugares que esta página reserva
//     (`actionsSlot`, `sideSlot`).
//   - A TROCA de modo só anima o que muda (DDL-0118). Cada pedaço marcado com
//     `data-flip` tem uma identidade (tile-hp, ability-str, tabs); antes da troca a
//     página guarda onde cada um estava (snapshot), e depois (flip): o que existe
//     nos dois modos e ficou no lugar NÃO se mexe (retrato, nome, atributos
//     fechados, proficiências); o que mudou de lugar desliza até o novo (os tiles HP e
//     CA trocando de posição, as abas descendo para a faixa de estado); o que só
//     existe no modo novo aparece (o tile de movimento, os descansos, a faixa de
//     estado, o painel da aba, a coluna do histórico). `data-flip-fade` também
//     esmaece o que ficou mas mudou por dentro (a barra de abas). As posições são
//     RELATIVAS à página: o deslocamento dela é animado uma vez só, nela. ATENÇÃO à
//     ordem em flip: medir TUDO antes de animar; a animação da página vale na hora,
//     e um pedaço medido depois dela parecia ter andado junto (cada card andava duas
//     vezes).
//   - A coluna do histórico só desloca a página quando PRECISA (Character.module.css):
//     com sobra dos dois lados, a página fica onde estava e o histórico ocupa a
//     sobra da direita. Quando desloca, a página desliza até o lugar novo, e a
//     coluna entra deslizando da direita.
//   - A aba aberta da ficha mora aqui (`sheetTab`): sobrevive a ir ao jogo e voltar.
//   - O GUIA aparece nos dois modos (DDL-0119): o jogador vê que falta algo em
//     qualquer um. Ele edita a build, então abri-lo no jogo troca para a ficha e
//     manda o pedido (`guideRequest`), que a ficha atende ao montar e devolve.
//   - A identidade e o lugar ao lado do nome (`levelSlot`, onde o nível ou os
//     descansos entram por portal) ficam fora do conteúdo do modo: não remontam.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import useSettingsStore from '../store/settingsStore';
import { useData } from '../data/dataContext';
import { reducedMotion } from '../motion';
import { deriveFromDb } from '../engine/resolve';
import useTutorialStore from '../store/tutorialStore';
import { TUT } from '../tutorial/anchors';
import { guidancePendencies, guidanceActive } from '../components/wizard/guidancePendencies';
import Icon from '../components/common/Icon';
import CharacterIdentity from '../components/builder/CharacterIdentity';
import BackButton from '../components/common/BackButton';
import ModeSwitch from '../components/common/ModeSwitch';
import { BuilderInner } from './Builder';
import { PlayInner } from './Play';
import sheetPage from './Builder.module.css';
import styles from './Character.module.css';

const MOVE = { duration: 280, easing: 'ease' };
const APPEAR = { duration: 220, easing: 'ease-out' };

/** Onde estavam a página e cada pedaço marcado com `data-flip` (relativo à página). */
function snapshot(page) {
  if (!page) return null;
  const base = page.getBoundingClientRect();
  const items = new Map();
  for (const el of page.querySelectorAll('[data-flip]')) {
    const r = el.getBoundingClientRect();
    items.set(el.dataset.flip, { x: r.left - base.left, y: r.top - base.top });
  }
  return { pageX: base.left, items };
}

/** Anima da posição guardada até a nova: desliza, aparece, ou nada (FLIP). */
function flip(page, side, snap) {
  if (!page || !snap || reducedMotion() || !page.animate) return;
  const base = page.getBoundingClientRect();
  const now = [...page.querySelectorAll('[data-flip]')].map((el) => ({ el, r: el.getBoundingClientRect() }));
  const dxPage = snap.pageX - base.left;
  if (Math.abs(dxPage) >= 1) page.animate([{ transform: `translateX(${dxPage}px)` }, { transform: 'none' }], MOVE);
  for (const { el, r } of now) {
    const was = snap.items.get(el.dataset.flip);
    if (!was) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], APPEAR);
      continue;
    }
    const dx = was.x - (r.left - base.left);
    const dy = was.y - (r.top - base.top);
    const fade = el.hasAttribute('data-flip-fade');
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      el.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: fade ? 0.4 : 1 }, { transform: 'none', opacity: 1 }], MOVE);
    } else if (fade) {
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], APPEAR);
    }
  }
  if (side?.offsetWidth) side.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], MOVE);
}

/** O botão do guia, enquanto faltar algo (ou mostrado de exemplo no tutorial). */
function GuideButton({ character, db, derived, onOpen }) {
  const tourAnchor = useTutorialStore((s) => (s.tourId ? s.steps[s.index]?.anchor ?? null : null));
  const pend = guidancePendencies(db, character, derived);
  const shown = guidanceActive(character) && pend.total > 0;
  const demo = !shown && tourAnchor === TUT.SHEET_GUIDE;
  if (!shown && !demo) return null;
  return (
    <button
      type="button"
      className={`${sheetPage.guideBtn} ${sheetPage.guideBtnAlert}`}
      onClick={shown ? onOpen : undefined}
      data-tour={TUT.SHEET_GUIDE}
      title={shown ? `${pend.total} choice${pend.total > 1 ? 's' : ''} left - open the guide` : 'The guide button (shown here for the tutorial)'}
    >
      <span aria-hidden="true"><Icon name="guide" /></span>
      {pend.total > 0 && <span className={sheetPage.guideBadge}>{pend.total}</span>}
    </button>
  );
}

export default function Character() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { db } = useData();
  const loaded = useCharacterStore((s) => s.loaded);
  const load = useCharacterStore((s) => s.load);
  const character = useCharacterStore((s) => s.getById(id));
  const save = useCharacterStore((s) => s.save);
  const experimental = useSettingsStore((s) => s.experimental);

  const wantsPlay = pathname.startsWith('/play/');
  const mode = wantsPlay && experimental ? 'play' : 'sheet';
  const [sheetTab, setSheetTab] = useState('Species');
  const derived = useMemo(() => (character ? deriveFromDb(character, db) : null), [character, db]);
  const [actionsSlot, setActionsSlot] = useState(null);
  const [levelSlot, setLevelSlot] = useState(null);
  const [guideRequest, setGuideRequest] = useState(0);
  const [sideSlot, setSideSlot] = useState(null);
  const pageRef = useRef(null);
  const sideRef = useRef(null);
  const snap = useRef(null);
  const sideMount = useCallback((el) => {
    sideRef.current = el;
    setSideSlot(el);
  }, []);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (wantsPlay && !experimental) navigate(`/build/${id}`, { replace: true });
  }, [wantsPlay, experimental, id, navigate]);

  useLayoutEffect(() => {
    flip(pageRef.current, mode === 'play' ? sideRef.current : null, snap.current);
    snap.current = null;
  }, [mode]);

  /** Troca o modo trocando o endereço, sem empilhar. */
  const switchMode = (next) => {
    if (next === mode) return;
    snap.current = snapshot(pageRef.current);
    navigate(`/${next === 'play' ? 'play' : 'build'}/${id}`, { replace: true });
  };

  /** O guia; no modo jogo, troca para a ficha e o abre lá. */
  const openGuide = () => {
    setGuideRequest((n) => n + 1);
    if (mode !== 'sheet') switchMode('sheet');
  };

  if (!loaded) return <div className={sheetPage.page}>Loading…</div>;
  if (!character) {
    return (
      <div className={sheetPage.page}>
        <p>Character not found.</p>
        <BackButton to="/" label="characters" />
      </div>
    );
  }

  const play = mode === 'play';
  return (
    <div className={play ? `${styles.shell} ${styles.withSide}` : styles.shell}>
      <div ref={pageRef} className={`${sheetPage.page} ${play ? styles.playPage : ''} motion-page`}>
        <div className={`${sheetPage.topBar} ${styles.bar}`}>
          <BackButton to="/" label="characters" />
          {experimental ? <ModeSwitch mode={mode} onChange={switchMode} /> : <span />}
          <div className={`${sheetPage.topActions} ${styles.right}`}>
            <GuideButton character={character} db={db} derived={derived} onOpen={openGuide} />
            <span ref={setActionsSlot} className={styles.slot} />
          </div>
        </div>
        <CharacterIdentity character={character} save={save} slotRef={setLevelSlot} />
        <div key={mode}>
          {play ? (
            <PlayInner
              key={character.id}
              character={character}
              derived={derived}
              actionsSlot={actionsSlot}
              sideSlot={sideSlot}
              levelSlot={levelSlot}
              onEditSheet={() => switchMode('sheet')}
            />
          ) : (
            <BuilderInner
              key={character.id}
              character={character}
              db={db}
              save={save}
              derived={derived}
              activeTab={sheetTab}
              setActiveTab={setSheetTab}
              actionsSlot={actionsSlot}
              levelSlot={levelSlot}
              guideRequest={guideRequest}
              onGuideHandled={() => setGuideRequest(0)}
            />
          )}
        </div>
      </div>
      {play && <div ref={sideMount} className={styles.side} />}
    </div>
  );
}
