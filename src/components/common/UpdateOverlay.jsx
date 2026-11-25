// =============================================================================
// UpdateOverlay: o aviso de que uma versão nova do app está pronta, em tela inteira
// =============================================================================
// O QUE FAZ
//   Lê o estado de src/appUpdate.js e, quando a versão nova assumiu, escurece a tela
//   toda e mostra no centro a logo, a frase e o botão Refresh. Tocar em qualquer
//   outro ponto, o Escape ou o voltar do celular ignoram até a próxima versão.
//
// FUNÇÕES
//   UpdateOverlay(): decide se há o que mostrar e guarda a saída animada.
//   OverlayBody(props): o overlay aberto.
//
// DECISÕES E ARMADILHAS
//   - Montado pelo main, FORA do App: o App troca a tela inteira enquanto checa ou
//     baixa os dados (UpdatingScreen) e o aviso tem de valer em qualquer tela.
//   - Era um cartão no topo, que não bloqueava nada (UpdateToast, DDL-0208); o dono
//     pediu a tela inteira, com o ignorar em qualquer ponto (DDL-0318). Acima de tudo,
//     inclusive dos diálogos, e por isso é uma camada do voltar (useBackLayer).
//   - Ele aparece no meio do que a pessoa está fazendo: o foco vai para o overlay e não
//     para o botão (um Enter de quem digitava recarregaria o app), e nos primeiros
//     ARM_MS nenhum toque vale, nem o de ignorar.
//   - Depois de ignorado a versão nova entra em qualquer recarga, ou quando outra chega.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { subscribeUpdate, getUpdateState, applyUpdate, dismissUpdate } from '../../appUpdate';
import { useBackLayer } from '../../hooks/useBack';
import { reducedMotion } from '../../motion';
import Button from './Button';
import Icon from './Icon';
import styles from './UpdateOverlay.module.css';

const ARM_MS = 400;
const EXIT_MS = 160;

/** O overlay aberto: a logo, a frase e o Refresh. */
function OverlayBody({ closing, onDismiss }) {
  const ref = useRef(null);
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = Date.now();
    const prev = document.activeElement;
    ref.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  const armed = () => Date.now() - openedAt.current >= ARM_MS;

  return (
    <div
      ref={ref}
      className={closing ? `${styles.overlay} ${styles.closing}` : styles.overlay}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      onClick={() => armed() && onDismiss()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onDismiss();
      }}
    >
      <div className={styles.center}>
        <span className={styles.emblem} aria-hidden="true">
          <img className={styles.logo} src="/logo.svg" alt="" draggable={false} />
        </span>
        <h2 id="update-title" className={`${styles.title} ornate-rule ornate-rule-center`}>A new version is ready</h2>
        <p className={styles.text}>Refresh to update FlyBy. Your characters stay as they are.</p>
        <Button
          variant="primary"
          size="lg"
          onPage
          className={styles.refresh}
          onClick={(e) => {
            e.stopPropagation();
            if (armed()) applyUpdate();
          }}
        >
          <Icon name="refresh" /> Refresh
        </Button>
        <p className={styles.hint}>Tap anywhere else to do it later</p>
      </div>
    </div>
  );
}

/** O aviso de versão nova (nada quando não há uma, ou quando foi ignorada). */
export default function UpdateOverlay() {
  const { ready, dismissed } = useSyncExternalStore(subscribeUpdate, getUpdateState);
  const [closing, setClosing] = useState(false);
  const open = ready && !dismissed;

  const dismiss = () => {
    if (closing) return;
    if (reducedMotion()) {
      dismissUpdate();
      return;
    }
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      dismissUpdate();
    }, EXIT_MS);
  };
  useBackLayer(open, dismiss);

  if (!open) return null;
  return createPortal(<OverlayBody closing={closing} onDismiss={dismiss} />, document.body);
}
