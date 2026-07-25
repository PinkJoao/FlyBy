// =============================================================================
// TutorialOverlay - destaca (spotlight) o elemento do passo atual do tutorial
// =============================================================================
// Montado UMA vez no App (ao lado de DialogHost/ImageViewer). Le o tutorialStore
// e, para o passo atual, resolve o alvo por `[data-tour="<anchor>"]`, o ilumina
// com um recorte sobre um fundo escurecido, e mostra um balao com titulo/texto e
// Back / Next / Skip. Reposiciona em scroll/resize; um passo sem `anchor` (ou com
// alvo ausente) vira um balao central. Adapta o texto entre mobile e desktop
// (body/title podem ser `{ desktop, mobile }`).
//
// O passo e renderizado por um `Spotlight` REMONTADO a cada passo (key =
// tour:index): assim cada passo comeca com estado limpo (sem reset em render nem
// callback compartilhado), o que mantem o React Compiler feliz. Interacao: um
// "blocker" transparente por baixo engole cliques (o tour e dirigido por Next),
// e o recorte + o balao ficam por cima. Esc = pular, ->/Enter = proximo, <- =
// voltar. z-index acima do SelectorPanel (150)/menus (200), abaixo dos dialogos.
// -----------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useTutorialStore from '../../store/tutorialStore';
import styles from './TutorialOverlay.module.css';

const PAD = 6; // folga do recorte ao redor do alvo
const GAP = 12; // distancia entre o balao e o alvo
const EDGE = 12; // folga minima das bordas da viewport
const MAX_TRIES = 24; // tentativas (rAF) esperando o alvo aparecer

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function isMobile() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 760px)').matches
  );
}

/** Resolve texto do passo p/ o dispositivo (string ou { desktop, mobile }). */
function resolveText(value, mobile) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return mobile ? value.mobile ?? value.desktop : value.desktop ?? value.mobile;
}

/** Posiciona o balao ao redor do recorte (ou centraliza quando nao ha alvo). */
function place(rect, tw, th, vw, vh, hint, mobile) {
  if (!rect) {
    return { top: clamp((vh - th) / 2, EDGE, vh - th - EDGE), left: clamp((vw - tw) / 2, EDGE, vw - tw - EDGE) };
  }
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;
  const fits = (side) => {
    if (side === 'bottom') return spaceBelow >= th + GAP + EDGE;
    if (side === 'top') return spaceAbove >= th + GAP + EDGE;
    if (side === 'right') return spaceRight >= tw + GAP + EDGE;
    if (side === 'left') return spaceLeft >= tw + GAP + EDGE;
    return false;
  };
  // No mobile preferimos vertical (largura estreita); no desktop, a dica e depois
  // os quatro lados por espaco.
  const order = mobile
    ? ['bottom', 'top']
    : hint && hint !== 'auto'
      ? [hint, 'bottom', 'top', 'right', 'left']
      : ['bottom', 'top', 'right', 'left'];
  let side = order.find(fits);
  if (!side) side = spaceBelow >= spaceAbove ? 'bottom' : 'top';

  const cx = () => clamp(rect.left + rect.width / 2 - tw / 2, EDGE, vw - tw - EDGE);
  const cy = () => clamp(rect.top + rect.height / 2 - th / 2, EDGE, vh - th - EDGE);
  let top;
  let left;
  if (side === 'bottom') {
    top = rect.top + rect.height + GAP;
    left = cx();
  } else if (side === 'top') {
    top = rect.top - th - GAP;
    left = cx();
  } else if (side === 'right') {
    left = rect.left + rect.width + GAP;
    top = cy();
  } else {
    left = rect.left - tw - GAP;
    top = cy();
  }
  return { top: clamp(top, EDGE, vh - th - EDGE), left: clamp(left, EDGE, vw - tw - EDGE) };
}

export default function TutorialOverlay() {
  const tourId = useTutorialStore((s) => s.tourId);
  const steps = useTutorialStore((s) => s.steps);
  const index = useTutorialStore((s) => s.index);
  const next = useTutorialStore((s) => s.next);
  const back = useTutorialStore((s) => s.back);
  const finish = useTutorialStore((s) => s.finish);

  const step = steps[index] ?? null;
  if (!step) return null;

  return createPortal(
    <Spotlight
      key={`${tourId}:${index}`}
      step={step}
      index={index}
      total={steps.length}
      onNext={next}
      onBack={back}
      onSkip={finish}
    />,
    document.body,
  );
}

/** Um passo. Remontado a cada passo (key no pai), entao `step` e fixo aqui. */
function Spotlight({ step, index, total, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null); // retangulo do alvo (ou null = central)
  const [pos, setPos] = useState(null); // posicao do balao (null = ainda medindo)
  const tipRef = useRef(null);
  const mobile = isMobile();
  const isLast = index + 1 >= total;
  const title = resolveText(step.title, mobile);
  const body = resolveText(step.body, mobile);

  // Acha o alvo (com algumas tentativas p/ esperar o DOM), rola-o para a vista e
  // mede; depois segue medindo em scroll/resize. Nenhum setState sincrono no
  // corpo do efeito (a medicao roda sempre dentro de rAF ou de um listener).
  useEffect(() => {
    let raf = 0;
    let done = false;
    let tries = 0;
    const measure = () => {
      if (!step.anchor) {
        setRect(null);
        return;
      }
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const tick = () => {
      if (done) return;
      const el = step.anchor ? document.querySelector(`[data-tour="${step.anchor}"]`) : null;
      if (step.anchor && !el && tries < MAX_TRIES) {
        tries += 1;
        raf = requestAnimationFrame(tick);
        return;
      }
      if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
      raf = requestAnimationFrame(() => {
        done = true;
        measure();
      });
    };
    tick();
    const onMove = () => measure();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // Re-medicoes atrasadas: um alvo que ANIMA ao aparecer (ex: a gaveta de
    // filtros do mobile, transform 0.25s) so assenta depois; sem isto o recorte
    // ficaria na posicao intermediaria.
    const t1 = setTimeout(measure, 180);
    const t2 = setTimeout(measure, 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [step]);

  // Posiciona o balao quando o rect muda (mede o balao ja renderizado).
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    setPos(
      place(rect, tip.offsetWidth, tip.offsetHeight, window.innerWidth, window.innerHeight, step.placement, isMobile()),
    );
  }, [rect, step]);

  // Foca o balao ao montar (teclado).
  useEffect(() => {
    tipRef.current?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onSkip();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onNext();
    } else if (e.key === 'ArrowLeft') {
      e.stopPropagation();
      if (index > 0) onBack();
    }
  };

  return (
    <div className={styles.root}>
      {/* Blocker transparente: engole cliques p/ o tour ser dirigido por Next. */}
      <div className={styles.blocker} />

      {/* Escurecimento: com alvo, um recorte (box-shadow gigante) ilumina so ele;
          sem alvo, um fundo escuro cheio. */}
      {rect ? (
        <div
          className={styles.hole}
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className={styles.dim} />
      )}

      {/* Balao */}
      <div
        className={styles.tip}
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Tutorial'}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { top: 0, left: 0, opacity: 0 }}
      >
        {title && <h3 className={styles.tipTitle}>{title}</h3>}
        {body && <p className={styles.tipBody}>{body}</p>}
        <div className={styles.tipFoot}>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Skip
          </button>
          <span className={styles.counter}>
            {index + 1} / {total}
          </span>
          <span className={styles.navBtns}>
            {index > 0 && (
              <button type="button" className={styles.navBtn} onClick={onBack}>
                Back
              </button>
            )}
            <button type="button" className={`${styles.navBtn} ${styles.navPrimary}`} onClick={onNext}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
