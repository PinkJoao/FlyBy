// =============================================================================
// CharacterIdentity: retrato, nome e classe da página do personagem
// =============================================================================
// O QUE FAZ
//   O bloco de identidade do topo da página (DDL-0119), o MESMO nos modos ficha e
//   jogo: o retrato (adicionar por upload, URL ou imagem colada, ver em tela cheia,
//   trocar, baixar, remover), o nome editável e a linha da classe. À direita fica um lugar vazio
//   (`slotRef`) onde cada modo põe o seu controle: o nível na ficha, os descansos no
//   jogo.
//
// FUNÇÕES
//   CharacterIdentity(props): o bloco.
//     rename(name), applyPortraitFile(file), onPortraitFile(e), setPortraitUrl(url),
//     clearPortrait(), openPicker(), openViewer(): o nome e o retrato.
//   portraitFilename(name, src): o nome do arquivo para baixar o retrato.
//   downloadPortrait(src, filename): baixa o retrato (data-URL ou de outro domínio).
//
// DECISÕES E ARMADILHAS
//   - Nome e retrato são editáveis nos dois modos: não mudam a jogatina, e travar
//     no modo jogo só obrigaria a trocar de modo para corrigir um nome.
//   - O bloco vive na pages/Character, FORA do conteúdo de cada modo: não remonta na
//     troca, então nunca anima nem pisca.
//   - O CSS é o da ficha (Builder.module.css): .identity e o resto continuam lá.
//   - Retrato: o upload vira data-URL redimensionada; a URL da web é guardada
//     direto (como o seletor de imagem do Foundry).
//   - Padrões do app (DDL-0129): escolher a imagem é o diálogo padrão
//     (showImageSource, o mesmo da imagem de item), e ver em tela cheia é o
//     ImageViewer global com Change, Download e Remove. Antes eram um overlay e um
//     visualizador próprios, com X redondo e margens diferentes do resto.
//   - Download de retrato que é URL de OUTRO domínio: o navegador ignora o
//     atributo `download` e o link levava a aba do app para a imagem. downloadPortrait
//     baixa o arquivo (direto ou pelo cache wsrv.nl, fetchImageBlob, porque o
//     i.pinimg.com não manda CORS) e salva com o nome do personagem; se nada der,
//     abre numa aba nova (DDL-0127).
//   - Sugestões de retrato (a faixa no escolhedor e a galeria): só aparecem com
//     `experimental` ligado em settingsStore (DDL-0111, DDL-0124).
//   - Imagem COLADA: com o escolhedor aberto, o Ctrl+V de uma imagem em qualquer
//     lugar a usa (ImageSourcePanel); no celular, o campo de URL é editável e recebe
//     a imagem do teclado (ImageUrlField). As duas vão pelo caminho do upload.
// -----------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { classSummary } from '../../schema/character';
import useSettingsStore from '../../store/settingsStore';
import { showImageViewer } from '../../store/imageViewerStore';
import { fileToPortrait } from '../common/imageFile';
import { fetchImageBlob } from '../../data/imageProxy';
import { showImageSource } from '../common/imageSourceDialog';
import PortraitSuggestionsModal from '../common/PortraitSuggestionsModal';
import PortraitSuggestionStrip from '../common/PortraitSuggestionStrip';
import { TUT } from '../../tutorial/anchors';
import Icon from '../common/Icon';
import styles from '../../pages/Builder.module.css';

/**
 * O bloco de identidade.
 * @param {{ character: object, save: Function, slotRef: Function }} props
 */
export default function CharacterIdentity({ character, save, slotRef }) {
  const fileRef = useRef(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const experimental = useSettingsStore((s) => s.experimental);

  const rename = (name) => save({ ...character, meta: { ...character.meta, name } });

  const applyPortraitFile = async (file) => {
    try {
      const portrait = await fileToPortrait(file);
      save({ ...character, meta: { ...character.meta, portrait } });
    } catch {
      // arquivo ilegível/não-imagem: mantém como está
    }
  };
  const onPortraitFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyPortraitFile(file);
  };
  const setPortraitUrl = (url) => {
    save({ ...character, meta: { ...character.meta, portrait: url } });
    setSuggestionsOpen(false);
  };
  const clearPortrait = () => save({ ...character, meta: { ...character.meta, portrait: null } });

  const openPicker = () =>
    showImageSource({
      title: character.meta.portrait ? 'Change portrait' : 'Add portrait',
      onUpload: () => fileRef.current?.click(),
      onUseUrl: setPortraitUrl,
      onImage: applyPortraitFile,
      extra: experimental
        ? (close) => (
            <PortraitSuggestionStrip
              character={character}
              onSelect={(url) => {
                close();
                setPortraitUrl(url);
              }}
              onSeeAll={() => {
                close();
                setSuggestionsOpen(true);
              }}
            />
          )
        : undefined,
    });

  const openViewer = () => {
    const src = character.meta.portrait;
    showImageViewer([{ src, alt: 'Portrait' }], 0, [
      { label: 'Change', onClick: openPicker },
      { label: 'Download', onClick: () => downloadPortrait(src, portraitFilename(character.meta.name, src)) },
      { label: 'Remove', tone: 'danger', onClick: clearPortrait },
    ]);
  };

  return (
    <>
      <div className={styles.identity} data-tour={TUT.SHEET_IDENTITY}>
        <div className={styles.portraitWrap}>
          <button
            type="button"
            className={
              character.meta.portrait ? `${styles.portrait} ${styles.portraitFilled}` : styles.portrait
            }
            title={character.meta.portrait ? 'View portrait' : 'Add a portrait'}
            onClick={character.meta.portrait ? openViewer : openPicker}
          >
            {character.meta.portrait ? <img src={character.meta.portrait} alt="Portrait" /> : <Icon name="portrait" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPortraitFile}
          />
        </div>
        <div className={styles.nameWrap}>
          <input
            className={styles.name}
            value={character.meta.name}
            onChange={(e) => rename(e.target.value)}
            placeholder="Character name"
          />
          <p className={styles.sub}>{classSummary(character) || 'No class set'}</p>
        </div>
        <div ref={slotRef} className={styles.levelSlot} data-tour={TUT.SHEET_LEVEL} />
      </div>

      {suggestionsOpen && experimental && (
        <PortraitSuggestionsModal
          character={character}
          onSelect={setPortraitUrl}
          onClose={() => setSuggestionsOpen(false)}
        />
      )}
    </>
  );
}

/** O nome do arquivo para baixar o retrato. */
function portraitFilename(name, src) {
  let ext = 'png';
  if (/^data:/.test(src)) {
    const mime = String(src).slice(5, String(src).indexOf(';'));
    ext = (mime.split('/')[1] || 'png').replace('jpeg', 'jpg');
  } else {
    const m = String(src).match(/\.([a-zA-Z0-9]{2,4})(?:[?#]|$)/);
    if (m) ext = m[1].toLowerCase();
  }
  const base = (name || 'character').trim().replace(/[^\w-]+/g, '-').toLowerCase() || 'character';
  return `${base}-portrait.${ext}`;
}

/** Baixa o retrato: data-URL direto; de outro domínio, pelo arquivo (direto ou wsrv.nl), senão abre numa aba. */
async function downloadPortrait(src, filename) {
  const save = (href) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  if (/^(data|blob):/.test(src)) {
    save(src);
    return;
  }
  try {
    const href = URL.createObjectURL(await fetchImageBlob(src));
    save(href);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(src, '_blank', 'noopener,noreferrer');
  }
}
