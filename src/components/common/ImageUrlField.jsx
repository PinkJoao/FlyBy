// =============================================================================
// ImageUrlField: o campo de URL dos escolhedores de imagem que também aceita colar a imagem
// =============================================================================
// O QUE FAZ
//   O campo "URL" do retrato e da imagem de item: digita-se ou cola-se o endereço,
//   como antes, e colar uma IMAGEM nele (Ctrl+V no PC, a área de transferência do
//   teclado no celular) entrega o arquivo a `onImage`. Enter confirma (`onSubmit`).
//
// FUNÇÕES
//   ImageUrlField(props): o campo.
//
// DECISÕES E ARMADILHAS
//   - É um elemento EDITÁVEL (contentEditable), não um <input>: no Android o
//     navegador só oferece ao teclado a inserção de imagem (o Gboard e a sua área
//     de transferência) num campo editável rico; num <input> o teclado diz que o
//     app não aceita imagem. E tem de ser "true", não "plaintext-only", pelo mesmo
//     motivo.
//   - O texto continua SIMPLES: colar texto entra sem formatação (insertText), e o
//     que sobrar de marcação depois de uma entrada (um <br>, um <div>) volta a ser
//     só texto (com o cursor no fim). O valor é o textContent; quem usa é dono dele (`value`), e o campo
//     só reescreve o DOM quando o valor difere, para não pular o cursor.
//   - A imagem chega por três caminhos, todos tratados: o evento paste (PC e o
//     "Colar" do Android), o beforeinput com dataTransfer (alguns teclados) e um
//     <img> inserido direto no campo (imageFromElement), que é lido e tirado.
//   - Enter: no teclado do celular o keydown costuma vir sem tecla (229); o que
//     chega com certeza é o beforeinput "insertParagraph", que vira o onSubmit.
//   - O placeholder é um ::before do campo vazio (data-placeholder).
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { imageFromElement, imageFromTransfer } from './imagePaste';
import styles from './ImageUrlField.module.css';

/**
 * O campo de URL que também recebe uma imagem colada.
 * @param {{ value: string, onChange: (text: string) => void, onImage: (file: File) => void, onSubmit?: () => void, placeholder?: string, className?: string, autoFocus?: boolean, label?: string }} props
 */
export default function ImageUrlField({ value, onChange, onImage, onSubmit, placeholder, className, autoFocus, label = 'Image URL or pasted image' }) {
  const ref = useRef(null);
  const props = useRef({ onChange, onImage, onSubmit });
  useEffect(() => {
    props.current = { onChange, onImage, onSubmit };
  });

  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    const onBeforeInput = (e) => {
      const file = imageFromTransfer(e.dataTransfer);
      if (file) {
        e.preventDefault();
        props.current.onImage(file);
      } else if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
        e.preventDefault();
        props.current.onSubmit?.();
      }
    };
    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
  }, []);

  const onPaste = (e) => {
    e.preventDefault();
    const file = imageFromTransfer(e.clipboardData);
    if (file) {
      onImage(file);
      return;
    }
    const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' ').trim();
    if (text) document.execCommand('insertText', false, text);
  };

  const onInput = async () => {
    const el = ref.current;
    const img = el.querySelector('img');
    if (el.children.length) {
      const text = el.textContent;
      el.textContent = text;
      const sel = window.getSelection();
      sel?.selectAllChildren(el);
      sel?.collapseToEnd();
    }
    onChange(el.textContent);
    if (img) {
      const file = await imageFromElement(img);
      if (file) props.current.onImage(file);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div
      ref={ref}
      className={className ? `${styles.field} ${className}` : styles.field}
      contentEditable
      role="textbox"
      aria-label={label}
      aria-multiline="false"
      data-placeholder={placeholder}
      inputMode="url"
      enterKeyHint="go"
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      onPaste={onPaste}
      onInput={onInput}
      onKeyDown={onKeyDown}
    />
  );
}
