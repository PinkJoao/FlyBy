// =============================================================================
// PreviewLayer: a camada de uma janela (o preview, o aviso, o painel)
// =============================================================================
// O QUE FAZ
//   Põe a moldura PreviewShell por cima da tela, numa JANELA no centro, no
//   celular e no desktop (DDL-0303, fase U2; até o DDL-0302 o celular abria uma
//   gaveta). Duas portas: o DialogHost (avisos, perguntas, painéis do jogo e os
//   popups de preview: detailPopup, featureText, regras) usa PreviewFrame, e quem
//   tem conteúdo VIVO (o item do inventário, a magia do grimório, a descrição do
//   PickerField) usa PreviewLayer, declarativo (DDL-0296).
//
// FUNÇÕES
//   PreviewFrame(props): o véu, a janela e a moldura; `closing` anima a saída,
//     `onDismiss` fecha (X, toque fora, Esc), `onBack` e `depth` dão o voltar e
//     os pontos de profundidade quando há outra janela embaixo, `buried` guarda a
//     janela de baixo (sem véu nem moldura à vista), `fit` ajusta a largura ao
//     conteúdo (até `maxWidth`), `drawer` faz dela a gaveta do celular (só onde a
//     tela de trás importa), `z` e `maxWidth` ajustam a pilha e a largura,
//     `cardRef` recebe o foco, `role` e `onKeyDown` vão para a janela.
//   PreviewLayer(props): a camada declarativa: portal, voltar do celular, saída
//     animada (EXIT_MS) e então `onClose`.
//
// DECISÕES E ARMADILHAS
//   - z-index 110 por padrão: acima da página e do guia, abaixo do SelectorPanel
//     (150), que um preview pode abrir (a magia guardada num item), e dos diálogos
//     (1000), que os links do texto empilham por cima. O DialogHost passa 1000.
//   - O Esc é tratado na própria janela (focada ao abrir), como no DialogHost: um
//     ouvinte no documento fecharia a camada de baixo junto com a de cima.
//   - A janela de baixo fica montada (o estado dela não se perde) e volta no lugar
//     quando a de cima fecha.
//   - O PreviewLayer se registra no store (`addLive`, DDL-0313): um diálogo aberto por cima dele
//     é empilhado (voltar, pontos, entra pela direita) e ele se guarda (`buried`) até o de cima fechar;
//     o mesmo entre duas janelas vivas (a multi-seleção do contêiner sobre o detalhe dele).
// -----------------------------------------------------------------------------

import { PHONE_QUERY } from '../../breakpoints';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PreviewShell from './PreviewShell';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useBackLayer } from '../../hooks/useBack';
import { reducedMotion } from '../../motion';
import useDialogStore from '../../store/dialogStore';
import styles from './PreviewShell.module.css';

const EXIT_MS = 160;

/** O véu, a janela (ou a gaveta) e a moldura. */
export function PreviewFrame({
  closing = false,
  buried = false,
  onDismiss,
  onBack,
  depth = 0,
  drawer = false,
  fit = false,
  z = 110,
  maxWidth = 560,
  cardRef,
  role = 'dialog',
  onKeyDown,
  style,
  ...shell
}) {
  const phone = useMediaQuery(PHONE_QUERY);
  const sheet = drawer && phone;
  const ownRef = useRef(null);
  const ref = cardRef ?? ownRef;
  useEffect(() => {
    if (!cardRef) ownRef.current?.focus();
  }, [cardRef]);
  const layerCls = [styles.layer, sheet ? styles.layerSheet : null, closing ? styles.layerClosing : null, buried ? styles.layerBuried : null]
    .filter(Boolean)
    .join(' ');
  const cardCls = [styles.card, sheet ? styles.cardSheet : null, fit ? styles.cardFit : null, depth > 0 && !sheet ? styles.cardStacked : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={layerCls}
      style={{ zIndex: z }}
      aria-hidden={buried || undefined}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div
        className={cardCls}
        role={role}
        aria-modal="true"
        ref={ref}
        tabIndex={-1}
        style={{ ...style, '--preview-max': `${maxWidth}px` }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDismiss?.();
            return;
          }
          onKeyDown?.(e);
        }}
      >
        <PreviewShell sheet={sheet} onClose={onDismiss} onBack={onBack} depth={depth} {...shell} />
      </div>
    </div>
  );
}

/** A camada declarativa de uma janela com conteúdo vivo; `onClose` roda depois da saída. */
export default function PreviewLayer({ onClose, ...shell }) {
  const [closing, setClosing] = useState(false);
  const liveId = useId();
  useEffect(() => {
    useDialogStore.getState().addLive(liveId);
    return () => useDialogStore.getState().removeLive(liveId);
  }, [liveId]);
  const buried = useDialogStore((s) => {
    const k = s.live.findIndex((l) => l.id === liveId);
    return k >= 0 && (s.dialogs.length > s.live[k].base || k < s.live.length - 1);
  });
  const depth = useDialogStore((s) => {
    const k = s.live.findIndex((l) => l.id === liveId);
    return k >= 0 ? s.live[k].base + k : 0;
  });
  const close = () => {
    if (closing) return;
    if (reducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, EXIT_MS);
  };
  useBackLayer(true, close);
  return createPortal(
    <PreviewFrame closing={closing} buried={buried} depth={depth} onBack={depth > 0 ? close : undefined} onDismiss={close} {...shell} />,
    document.body,
  );
}
