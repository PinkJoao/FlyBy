// =============================================================================
// ChoiceMenuButton: um botão que abre uma lista de opções e mostra a escolhida
// =============================================================================
// O QUE FAZ
//   O irmão do SortButton para uma escolha simples (o filtro e o agrupamento das
//   listas da ficha, DDL-0314): o mesmo menu (MenuButton, o check na opção ativa) e a
//   mesma altura, com o ícone e o NOME da opção escolhida no botão, para se ler o
//   que está na tela sem abrir nada.
//
// FUNÇÕES
//   ChoiceMenuButton(props): `icon`, `label` (o que se escolhe: "Filter", "Group"),
//     `options` ([{ value, label }]), `value`, `onChange(value)`, `className`.
//
// DECISÕES E ARMADILHAS
//   - Com uma opção só o botão fica, desabilitado: mostra o que vale sem oferecer
//     um menu de um item (a armadura agrupa só por tipo).
//   - O title e o aria-label dizem "Group: Type": o texto do botão sozinho pode
//     ficar cortado num celular estreito.
// -----------------------------------------------------------------------------

import MenuButton from './MenuButton';
import Icon from './Icon';
import { buttonClass } from './buttonClass';
import styles from './ChoiceMenuButton.module.css';

/** O botão de escolha com a opção ativa à vista. */
export default function ChoiceMenuButton({ icon, label, options, value, onChange, className }) {
  const active = options.find((o) => o.value === value) ?? options[0];
  const cls = buttonClass({ className: className ? `${styles.btn} ${className}` : styles.btn });
  const inner = (
    <>
      <Icon name={icon} className={styles.icon} />
      <span className={styles.text}>{active?.label}</span>
      {options.length > 1 && <Icon name="chevron" className={styles.chevron} />}
    </>
  );
  if (options.length <= 1) {
    return (
      <button type="button" className={cls} disabled aria-label={`${label}: ${active?.label}`} title={`${label}: ${active?.label}`}>
        {inner}
      </button>
    );
  }
  return (
    <MenuButton
      buttonClassName={cls}
      buttonTitle={`${label}: ${active?.label}`}
      align="left"
      items={options.map((o) => ({
        label: o.label,
        checked: o.value === active?.value,
        onClick: () => onChange(o.value),
      }))}
    >
      {inner}
    </MenuButton>
  );
}
