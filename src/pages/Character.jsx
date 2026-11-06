// =============================================================================
// Character: a página do personagem, nos modos ficha e jogo
// =============================================================================
// O QUE FAZ
//   Uma página só para montar e para jogar (DDL-0117). Carrega o personagem, lê o
//   modo do ENDEREÇO (/build/:id é a ficha, /play/:id o jogo) e monta o que os dois
//   modos dividem: a página da ficha, o topo (voltar, o seletor Sheet | Play no
//   centro, o botão do guia e o menu à direita), o bloco de identidade
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
//     aparece, o que sumiu e a coluna do histórico.
//   vanish(node, rect): a cópia de um tile que sumiu encolhe e some no lugar dele.
//   morph(el, was, r): a peça que muda de largura entre os modos (nível e descansos):
//     some o conteúdo antigo, a caixa muda, aparece o novo.
//
// DECISÕES E ARMADILHAS
//   - O modo vem do endereço, e trocar usa `replace`: o voltar do celular nunca
//     alterna entre ficha e jogo; ele sai da página (para a lista). O botão de
//     voltar também leva sempre à lista.
//   - Sem os recursos experimentais (DDL-0111) não há seletor, e /play/:id vira
//     /build/:id.
//   - O topo NÃO remonta na troca. O MENU é um só nos dois modos (CharacterMenu,
//     DDL-0120: o que não mexe na jogatina não muda entre eles); a coluna do
//     histórico é do jogo e entra por portal no lugar que esta página reserva
//     (`sideSlot`).
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
//   - Sumir e surgir dos tiles (DDL-0144): o que tem `data-flip-scale` e só existe
//     num modo encolhe ao sumir e surge menor, crescendo. Quem some já saiu do DOM
//     quando flip roda, então snapshot guarda uma CÓPIA (cloneNode) e o lugar dele na
//     tela; vanish a põe no body, fixa nesse lugar, e anima. Os que surgem esperam
//     110 ms e os que deslizam 100 ms, para o encolher aparecer antes: sem isso o HP
//     e a CA subiam por cima das cópias do Level e do Alignment ainda visíveis (os
//     números se sobrepunham). `fill: backwards` (nunca `both`, DDL-0100) os segura
//     no estado inicial durante a espera.
//   - `data-flip-after` (DDL-0145): o que só existe num modo e entra NO ESPAÇO por
//     onde algo desliza (os cards de Conditions e Effects, a faixa de estado, o
//     painel da aba) espera os deslizes quase terminarem (75% do MOVE). Antes eles
//     surgiam enquanto a barra de abas passava por cima: indo ao jogo a barra ficava
//     parada sobre o Conditions nascendo e depois descia pelo Effects; voltando, o
//     painel da ficha nascia embaixo da barra ainda no lugar velho. flip planeja
//     primeiro (o que surge, muda, desliza ou esmaece) e só então anima, porque a
//     espera depende de haver algo deslizando.
//   - Nível e descansos são a MESMA peça (`slot-mode`, `data-flip-morph`): ela não
//     desliza, muda de LARGURA (as duas têm a mesma altura fixa, 37px), em três
//     tempos: a cópia do conteúdo antigo (sem fundo nem borda, no body, por cima da
//     caixa ainda no tamanho antigo) esmaece em 110 ms; a caixa vai à largura nova em
//     230 ms; o conteúdo novo aparece em 150 ms. Antes a altura também animava (36,95
//     para 36,6 px) e o conteúdo novo aparecia durante a mudança: os botões tremiam
//     na vertical, reajustando em pequenos passos.
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
import CharacterMenu from '../components/builder/CharacterMenu';
import BackButton from '../components/common/BackButton';
import ModeSwitch from '../components/common/ModeSwitch';
import { BuilderInner } from './Builder';
import { PlayInner } from './Play';
import sheetPage from './Builder.module.css';
import styles from './Character.module.css';

const MOVE = { duration: 280, easing: 'ease' };
const APPEAR = { duration: 220, easing: 'ease-out' };
const VANISH = { duration: 170, easing: 'ease-in' };
const GROW = { duration: 240, easing: 'ease-out' };
const SMALL = 'scale(0.82)';
const SLIDE_WAIT = 100;
const GROW_WAIT = 110;
const MORPH_OUT = { duration: 110, easing: 'ease-out' };
const MORPH_BOX = { duration: 230, easing: 'ease-in-out' };
const MORPH_IN = { duration: 150, easing: 'ease-out' };

/** Onde estavam a página e cada pedaço marcado com `data-flip` (relativo à página). */
function snapshot(page) {
  if (!page) return null;
  const base = page.getBoundingClientRect();
  const items = new Map();
  for (const el of page.querySelectorAll('[data-flip]')) {
    const r = el.getBoundingClientRect();
    const ghost = el.hasAttribute('data-flip-scale') || el.hasAttribute('data-flip-morph') ? { node: el.cloneNode(true), rect: r } : null;
    items.set(el.dataset.flip, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, ghost });
  }
  return { pageX: base.left, items };
}

/** Anima da posição guardada até a nova: desliza, aparece, ou nada (FLIP). */
function flip(page, side, snap) {
  if (!page || !snap || reducedMotion() || !page.animate) return;
  const base = page.getBoundingClientRect();
  const now = [...page.querySelectorAll('[data-flip]')].map((el) => ({ el, r: el.getBoundingClientRect() }));
  const dxPage = snap.pageX - base.left;
  const present = new Set(now.map(({ el }) => el.dataset.flip));
  const gone = [...snap.items].filter(([key, it]) => it.ghost && !present.has(key) && !it.ghost.node.hasAttribute('data-flip-morph')).map(([, it]) => it.ghost);
  for (const { node, rect } of gone) vanish(node, rect);
  if (Math.abs(dxPage) >= 1) page.animate([{ transform: `translateX(${dxPage}px)` }, { transform: 'none' }], MOVE);
  const plan = now.map(({ el, r }) => {
    const was = snap.items.get(el.dataset.flip);
    if (!was) return { el, kind: 'appear' };
    if (el.hasAttribute('data-flip-morph')) return { el, kind: 'morph', was, r };
    const dx = was.x - (r.left - base.left);
    const dy = was.y - (r.top - base.top);
    const fade = el.hasAttribute('data-flip-fade');
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) return { el, kind: 'slide', dx, dy, fade };
    return { el, kind: fade ? 'fade' : 'still' };
  });
  const slideDelay = gone.length ? SLIDE_WAIT : 0;
  const anySlide = plan.some((p) => p.kind === 'slide');
  const afterDelay = anySlide ? slideDelay + Math.round(MOVE.duration * 0.75) : gone.length ? GROW_WAIT : 0;
  for (const p of plan) {
    const { el } = p;
    if (p.kind === 'appear') {
      const after = el.hasAttribute('data-flip-after');
      if (el.hasAttribute('data-flip-scale')) {
        el.animate([{ opacity: 0, transform: SMALL }, { opacity: 1, transform: 'none' }], { ...GROW, delay: after ? afterDelay : gone.length ? GROW_WAIT : 0, fill: 'backwards' });
      } else {
        el.animate([{ opacity: 0 }, { opacity: 1 }], after ? { ...APPEAR, delay: afterDelay, fill: 'backwards' } : APPEAR);
      }
    } else if (p.kind === 'morph') {
      morph(el, p.was, p.r);
    } else if (p.kind === 'slide') {
      el.animate([{ transform: `translate(${p.dx}px, ${p.dy}px)`, opacity: p.fade ? 0.4 : 1 }, { transform: 'none', opacity: 1 }], slideDelay ? { ...MOVE, delay: slideDelay, fill: 'backwards' } : MOVE);
    } else if (p.kind === 'fade') {
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], APPEAR);
    }
  }
  if (side?.offsetWidth) side.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], MOVE);
}

/** A cópia de um tile que sumiu encolhe e some no lugar onde ele estava. */
function vanish(node, rect) {
  node.removeAttribute('data-flip');
  Object.assign(node.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '1',
  });
  node.setAttribute('aria-hidden', 'true');
  document.body.appendChild(node);
  const a = node.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: SMALL }], VANISH);
  a.onfinish = () => node.remove();
  a.oncancel = () => node.remove();
}

/**
 * A mesma peça com outro conteúdo muda de tamanho, em três tempos: o conteúdo antigo
 * esmaece, a caixa vai à largura nova, e só então o conteúdo novo aparece.
 */
function morph(el, was, r) {
  if (Math.abs(was.w - r.width) < 1) return;
  const old = was.ghost?.node;
  if (old) {
    old.removeAttribute('data-flip');
    old.removeAttribute('data-flip-morph');
    Object.assign(old.style, {
      position: 'fixed',
      left: `${was.ghost.rect.left}px`,
      top: `${was.ghost.rect.top}px`,
      width: `${was.ghost.rect.width}px`,
      height: `${was.ghost.rect.height}px`,
      margin: '0',
      background: 'transparent',
      borderColor: 'transparent',
      boxShadow: 'none',
      pointerEvents: 'none',
      zIndex: '1',
    });
    old.setAttribute('aria-hidden', 'true');
    document.body.appendChild(old);
    const a = old.animate([{ opacity: 1 }, { opacity: 0 }], MORPH_OUT);
    a.onfinish = () => old.remove();
    a.oncancel = () => old.remove();
  }
  const prev = el.style.overflow;
  el.style.overflow = 'hidden';
  const box = el.animate([{ width: `${was.w}px` }, { width: `${r.width}px` }], { ...MORPH_BOX, delay: MORPH_OUT.duration, fill: 'backwards' });
  const done = () => {
    el.style.overflow = prev;
  };
  box.onfinish = done;
  box.oncancel = done;
  for (const child of el.children) child.animate([{ opacity: 0 }, { opacity: 1 }], { ...MORPH_IN, delay: MORPH_OUT.duration + MORPH_BOX.duration, fill: 'backwards' });
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
            <CharacterMenu character={character} db={db} derived={derived} save={save} mode={mode} />
          </div>
        </div>
        <CharacterIdentity character={character} save={save} slotRef={setLevelSlot} />
        <div key={mode}>
          {play ? (
            <PlayInner
              key={character.id}
              character={character}
              derived={derived}
              sideSlot={sideSlot}
              levelSlot={levelSlot}
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
