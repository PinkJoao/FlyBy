// =============================================================================
// MenuList: a lista de itens de um submenu, dentro de um diálogo
// =============================================================================
// O QUE FAZ
//   Os itens no mesmo visual do dropdown do MenuButton, para os submenus que
//   abrem numa janelinha (dialog.js, `menu()`). Itens:
//     { heading }: um título de grupo;
//     { label, sub?, onClick?, href?, disabled?, danger?, checked?, keepOpen? }:
//       uma ação. `checked` (true ou false) faz dela uma opção de escolha única,
//       com a marca redonda; com `toggle`, um liga/desliga de marca quadrada;
//       `keepOpen` não fecha o diálogo ao tocar.
//
// FUNÇÕES
//   MenuList({ items }): a lista.
//
// DECISÕES E ARMADILHAS
//   - Escolhas (tema, guia, ligar tutoriais) usam keepOpen: o efeito aparece na
//     hora e a marca anda, então o submenu é também a pré-visualização. Uma ação
//     que leva a outro lugar (outro diálogo, o seletor de arquivo) fecha ANTES de
//     rodar, para a janela nova não nascer por baixo desta.
//   - A lista não guarda estado: quem a monta lê os stores com hooks, e a marca
//     acompanha porque o conteúdo é um componente vivo dentro do DialogHost.
// -----------------------------------------------------------------------------

import { useDialogClose } from './dialogContext';
import styles from './MenuList.module.css';

/**
 * A lista de itens de um submenu.
 * @param {{ items: Array<object> }} props
 */
export default function MenuList({ items }) {
  const close = useDialogClose();
  return (
    <div className={styles.list} role="menu">
      {items.map((item, i) => {
        if (item.heading) {
          return (
            <div key={`h-${i}`} className={styles.heading} role="presentation">
              {item.heading}
            </div>
          );
        }
        const choice = typeof item.checked === 'boolean';
        const className = [styles.item, item.danger && styles.danger, item.checked && styles.checked, item.toggle && styles.toggle]
          .filter(Boolean)
          .join(' ');
        const body = (
          <>
            {choice && <span className={styles.mark} aria-hidden="true" />}
            <span className={styles.text}>
              <span className={styles.title}>{item.label}</span>
              {item.sub && <span className={styles.sub}>{item.sub}</span>}
            </span>
          </>
        );
        if (item.href) {
          const external = /^https?:/.test(item.href);
          return (
            <a
              key={item.label}
              role="menuitem"
              className={className}
              href={item.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              onClick={() => close()}
            >
              {body}
            </a>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            role={!choice ? 'menuitem' : item.toggle ? 'menuitemcheckbox' : 'menuitemradio'}
            aria-checked={choice ? item.checked : undefined}
            className={className}
            disabled={item.disabled}
            onClick={() => {
              if (!item.keepOpen) close();
              item.onClick?.();
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
