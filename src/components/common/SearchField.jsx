// =============================================================================
// SearchField: a caixa de busca única do app
// =============================================================================
// O QUE FAZ
//   A lupa, o texto, um contador opcional e o X que limpa, numa caixa da altura
//   de um controle de linha (--control-h). Substitui as nove buscas que o app
//   tinha em seis estilos (DDL-0303, fase U1 do docs/UI-STUDY.md): a do seletor,
//   a dos filtros, a da lista de personagens, do inventário e do grimório (ficha
//   e jogo), das features do jogo e das tags de retrato.
//
// FUNÇÕES
//   SearchField(props): `value`, `onChange(texto)`, `placeholder`, `ariaLabel`,
//     `count` (número ou texto à direita, antes do X), `size` ('md' padrão, 40 px
//     nas páginas; 'sm', 34 px, nas barras do seletor), `autoFocus`, `onKeyDown`,
//     `inputRef`, `className` (a largura fica com quem usa) e o resto vai para o
//     <label> (data-tour, por exemplo).
//
// DECISÕES E ARMADILHAS
//   - O X nativo do type="search" sai (CSS): cada navegador desenha o seu, e o
//     nosso fica no mesmo lugar em todos. O X só aparece com texto.
//   - Esc com texto limpa e PARA ali (stopPropagation): sem isso fecharia a
//     camada que contém a busca; sem texto, o Esc segue para a camada.
// -----------------------------------------------------------------------------

import Icon from './Icon';
import styles from './SearchField.module.css';

/** A busca comum: lupa, texto, contador e limpar. */
export default function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  count,
  size = 'md',
  autoFocus = false,
  onKeyDown,
  inputRef,
  className,
  ...rest
}) {
  const cls = [styles.field, size === 'sm' ? styles.sm : null, className].filter(Boolean).join(' ');
  return (
    <label className={cls} {...rest}>
      <Icon name="search" className={styles.lens} />
      <input
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder.replace(/…$/, '')}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            onChange('');
          }
          onKeyDown?.(e);
        }}
      />
      {count != null && (
        <span className={styles.count} aria-live="polite">
          {count}
        </span>
      )}
      {value ? (
        <button type="button" className={styles.clear} aria-label="Clear the search" onClick={() => onChange('')}>
          <Icon name="close" />
        </button>
      ) : null}
    </label>
  );
}
