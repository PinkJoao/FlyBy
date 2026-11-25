// =============================================================================
// ImageSourcePanel: escolher uma imagem por upload, URL ou imagem colada
// =============================================================================
// O QUE FAZ
//   O corpo do diálogo "Add portrait" (CharacterIdentity) e "Add item image"
//   (InventoryTab), aberto por showImageSource (imageSourceDialog.jsx) dentro de um
//   menu() do DialogHost: o botão de upload, um espaço opcional (`extra`, onde o
//   retrato põe a faixa de sugestões), o campo de URL que também aceita imagem
//   colada, e uma ação opcional de remover. Toda escolha fecha o diálogo antes de
//   chamar quem abriu.
//
// FUNÇÕES
//   ImageSourcePanel(props): o painel. run(fn) fecha o diálogo e chama fn;
//     submitUrl usa a URL digitada.
//
// DECISÕES E ARMADILHAS
//   - Era DUAS telas quase iguais, cada uma com o seu overlay, cabeçalho, X e CSS
//     (o retrato com o X redondo e margens próprias). Agora é o padrão do app para
//     um painel em diálogo, como o PdfExportPanel (DDL-0129): título, X, Escape,
//     voltar do celular e saída animada vêm do DialogHost.
//   - Ctrl+V de uma imagem em qualquer lugar vale enquanto o painel está aberto
//     (useImagePaste), como antes nos dois escolhedores (DDL-0123).
//   - `extra` é uma função que recebe o `close`: a faixa de sugestões precisa
//     fechar o diálogo antes de aplicar o retrato ou abrir a galeria.
//   - O upload clica no <input type=file> de quem abriu, no MESMO toque: fora do
//     gesto do usuário o navegador bloqueia o seletor de arquivos.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import Button from './Button';
import { useDialogClose } from './dialogContext';
import Icon from './Icon';
import ImageUrlField from './ImageUrlField';
import { useImagePaste } from './imagePaste';
import styles from './ImageSourcePanel.module.css';

/**
 * Painel de escolha de imagem (upload, extra, URL ou colada, remover).
 * @param {{
 *   onUpload: () => void, onUseUrl: (url: string) => void, onImage: (file: File) => void,
 *   extra?: (close: () => void) => any, onRemove?: () => void, removeLabel?: string,
 * }} props
 */
export default function ImageSourcePanel({ onUpload, onUseUrl, onImage, extra, onRemove, removeLabel }) {
  const close = useDialogClose();
  const [url, setUrl] = useState('');
  const run = (fn) => (...args) => {
    close();
    fn(...args);
  };
  useImagePaste(run(onImage));

  const submitUrl = (e) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (trimmed) run(onUseUrl)(trimmed);
  };

  return (
    <div className={styles.panel}>
      <Button block onClick={run(onUpload)}>
        <Icon name="addImage" />
        Upload from device
      </Button>
      {extra?.(close)}
      <div className={styles.divider}>
        <span>or</span>
      </div>
      <form className={styles.urlRow} onSubmit={submitUrl}>
        <ImageUrlField
          className={styles.urlInput}
          placeholder="Paste an image or URL"
          value={url}
          onChange={setUrl}
          onImage={run(onImage)}
          onSubmit={submitUrl}
        />
        <Button type="submit" variant="primary" disabled={!url.trim()}>
          Use URL
        </Button>
      </form>
      {onRemove && (
        <Button variant="danger" size="sm" block onClick={run(onRemove)}>
          {removeLabel ?? 'Remove image'}
        </Button>
      )}
    </div>
  );
}
