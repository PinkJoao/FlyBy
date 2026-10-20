// =============================================================================
// TutorialOverlay: o spotlight do passo atual do tutorial
// =============================================================================
// O QUE FAZ
//   Montado UMA vez no App (DDL-0069). Lê o tutorialStore e, para o passo atual,
//   acha o alvo por `[data-tour="<anchor>"]`, o ilumina com um recorte sobre o
//   fundo escuro e mostra um balão com título, texto e Back, Next, Skip.
//   Reposiciona em scroll e resize; passo sem alvo vira balão central. O texto
//   pode ter versões { desktop, mobile }.
//
// FUNÇÕES
//   clamp(n, lo, hi), isMobile(): utilitários.
//   resolveText(value, mobile): o texto do dispositivo.
//   place(rect, tw, th, vw, vh, hint, mobile): a posição do balão (no mobile,
//     vertical; no desktop, a dica e depois os quatro lados por espaço).
//   TutorialOverlay(): o overlay.
//   Spotlight(props): um passo.
//
// DECISÕES E ARMADILHAS
//   - O Spotlight é REMONTADO a cada passo (key = tour:index): estado limpo, sem
//     reset no render, o que mantém o React Compiler feliz.
//   - Um "blocker" transparente engole os cliques (o tour é dirigido pelo Next).
//     Esc pula, seta direita ou Enter avança, seta esquerda volta. z-index acima do
//     SelectorPanel (150) e dos menus (200), abaixo dos diálogos.
//   - O alvo é procurado com tentativas em rAF (pode ainda não estar no DOM), e há
//     re-medições atrasadas: um alvo que ANIMA ao aparecer (a gaveta de filtros,
//     0.25s) só assenta depois. Nenhum setState síncrono no corpo do efeito.
// -----------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useTutorialStore from '../../store/tutorialStore';
import styles from './TutorialOverlay.module.css';
import { useBackLayer } from '../../hooks/useBack';

const PAD = 6;
const GAP = 12;
const EDGE = 12;
const MAX_TRIES = 24;

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

/** O texto do passo para o dispositivo. */
function resolveText(value, mobile) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return mobile ? value.mobile ?? value.desktop : value.desktop ?? value.mobile;
}

/** A posição do balão ao redor do recorte. */
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
  useBackLayer(!!step, finish);
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

/** Um passo do tour (remontado a cada passo). */
function Spotlight({ step, index, total, onNext, onBack, onSkip }) {
  const [rect, setRect] = useState(null);
  const [pos, setPos] = useState(null);
  const tipRef = useRef(null);
  const mobile = isMobile();
  const isLast = index + 1 >= total;
  const title = resolveText(step.title, mobile);
  const body = resolveText(step.body, mobile);

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

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    setPos(
      place(rect, tip.offsetWidth, tip.offsetHeight, window.innerWidth, window.innerHeight, step.placement, isMobile()),
    );
  }, [rect, step]);

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
      <div className={styles.blocker} />

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
