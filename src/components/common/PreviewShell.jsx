// =============================================================================
// PreviewShell: a moldura única de todo preview (DDL-0295)
// =============================================================================
// O QUE FAZ
//   O mesmo topo, corpo e rodapé para tudo que mostra o detalhe de uma coisa: a
//   coluna de preview do seletor (desktop), a gaveta de detalhe do seletor no
//   celular, o popup de detalhe (detailPopup), o texto de uma feature
//   (featureText), a regra do glossário (RulePopup), a fonte (sourcePopup) e o
//   texto de uma ação de summon. Topo FIXO: a linha pequena com o tipo e a fonte
//   (o "kicker"), o nome em destaque e o X; o corpo rola; o rodapé FIXO leva os
//   botões, o principal à direita.
//
// FUNÇÕES
//   PreviewShell(props): a moldura. `kicker` (o tipo: "Species", "Rule"),
//     `source` (a SourceTag), `title`, `titleId`, `onClose` (o X), `footer` (os
//     botões), `note` (uma linha curta acima dos botões: "Prepared for Wizard.",
//     DDL-0296), `sheet` (gaveta do celular: o puxador e arrastar para baixo fecha),
//     `onBack` e `depth` (o voltar e os pontos quando a janela está sobre outra,
//     DDL-0303),
//     `children` (o corpo). A camada por cima da tela é o PreviewLayer.
//
// DECISÕES E ARMADILHAS
//   - Arrastar para fechar só depois de 6 px: capturar o ponteiro já no toque
//     roubaria o clique do X (o clique vai ao ancestral comum do down e do up).
//   - O nome e a fonte numa linha só ("Elf XPHB"), como no carrossel; o kicker (o tipo)
//     só quando quem abre o passa: o seletor não passa, o título do painel já diz o tipo.
//     A divisória do topo só aparece depois que o corpo rola (DDL-0297).
//   - Quem fecha anima a saída (o DialogHost e o SelectorPanel); a moldura só
//     desloca durante o arrasto e devolve o lugar se não passou de CLOSE_PX.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import CloseButton from './CloseButton';
import Icon from './Icon';
import SourceTag from './SourceTag';
import styles from './PreviewShell.module.css';

const CLOSE_PX = 80;

/** A moldura de um preview: topo fixo, corpo que rola, rodapé fixo. */
export default function PreviewShell({ kicker, source, title, titleId, onClose, onBack, depth = 0, footer, note, sheet = false, className, children }) {
  const [dragY, setDragY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const drag = useRef(null);

  const onDown = (e) => {
    if (!sheet || !onClose) return;
    drag.current = { y: e.clientY, id: e.pointerId, on: false };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = Math.max(0, e.clientY - d.y);
    if (!d.on && dy > 6) {
      d.on = true;
      e.currentTarget.setPointerCapture?.(d.id);
    }
    if (d.on) setDragY(dy);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    if (dragY > CLOSE_PX) onClose();
    else setDragY(0);
  };

  const cls = [styles.shell, sheet ? styles.sheet : null, className].filter(Boolean).join(' ');
  return (
    <div className={cls} style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}>
      <header
        className={scrolled ? `${styles.head} ${styles.headScrolled}` : styles.head}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {sheet && <span className={styles.grabber} aria-hidden="true" />}
        <div className={styles.headRow}>
          {onBack && (
            <button type="button" className={styles.back} onClick={onBack} aria-label="Back" title="Back">
              <Icon name="chevron" />
            </button>
          )}
          <div className={styles.titles}>
            {kicker && <div className={styles.kicker}>{kicker}</div>}
            {title != null && (
              <h2 id={titleId} className={styles.title}>
                {title}
                {source && <SourceTag source={source} className={styles.source} />}
              </h2>
            )}
          </div>
          {onClose && <CloseButton onClick={onClose} className={styles.close} />}
        </div>
        {depth > 0 && (
          <div className={styles.depth} aria-hidden="true">
            {Array.from({ length: depth + 1 }, (_, i) => (
              <i key={i} className={i === depth ? styles.dotOn : styles.dot} />
            ))}
          </div>
        )}
      </header>
      <div className={styles.body} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
        {children}
      </div>
      {(footer || note) && (
        <footer className={styles.foot}>
          {note && <div className={styles.note}>{note}</div>}
          {footer && <div className={styles.footRow}>{footer}</div>}
        </footer>
      )}
    </div>
  );
}
