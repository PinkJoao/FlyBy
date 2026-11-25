// =============================================================================
// Thumb: a miniatura de uma entrada (a arte, senão um ícone)
// =============================================================================
// O QUE FAZ
//   Desenha a arte de um item, classe ou espécie num quadro de tamanho fixo e, sem
//   arte (o pacote SRD não traz nenhuma) ou com a arte quebrada, o ícone no lugar,
//   para o quadro nunca ficar vazio. O inventário, o card da loja e o carrossel dos
//   seletores usam a mesma (DDL-0285).
//
// FUNÇÕES
//   Thumb(props): a miniatura.
//
// DECISÕES E ARMADILHAS
//   - A arte vem pelo wsrv.nl já na largura do quadro (thumbUrl, `width` em px de
//     tela; pede o dobro para a tela de alta densidade). Se o proxy falha, tenta a URL
//     direta; se ela também falha, o ícone. Imagem custom do usuário (data:) vai
//     direto.
//   - `fit` cover (a linha do inventário, quadrada) ou contain (o card da loja: a
//     arte de item vem com fundo transparente e não pode ser cortada).
//   - O erro é resetado quando o src muda (ajuste no render), como no DetailView.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import Icon from './Icon';
import { thumbUrl } from '../../data/imageProxy';
import styles from './Thumb.module.css';

/**
 * A miniatura: a arte, senão o ícone.
 * @param {{ src?: string|null, icon?: string, tint?: string|null, width: number, fit?: 'cover'|'contain', className?: string, alt?: string }} props
 */
export default function Thumb({ src, icon = 'itemOther', tint = null, width, fit = 'cover', className, alt = '' }) {
  const [stage, setStage] = useState(0);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStage(0);
  }
  const proxied = src ? thumbUrl(src, width * 2) : null;
  const tries = [proxied, src].filter(Boolean);
  const url = tries[stage] ?? null;
  const cls = [styles.thumb, className].filter(Boolean).join(' ');

  if (url) {
    return (
      <span className={cls}>
        <img
          className={fit === 'contain' ? `${styles.img} ${styles.contain}` : styles.img}
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setStage((s) => s + 1)}
        />
      </span>
    );
  }
  return (
    <span className={`${cls} ${styles.glyph} ${tint ? styles.tinted : ''}`} style={tint ? { color: tint } : undefined} aria-hidden="true">
      <Icon name={icon} />
    </span>
  );
}
