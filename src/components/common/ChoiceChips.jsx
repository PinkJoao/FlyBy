// =============================================================================
// ChoiceChips: escolher uma opção entre poucas
// =============================================================================
// O QUE FAZ
//   A troca do <select> nativo nas escolhas curtas (DDL-0303, fase U3 do
//   docs/UI-STUDY.md). Duas formas, pelo tipo da escolha (DDL-0307):
//   - OBRIGATÓRIA (`clearable={false}`: o atributo de conjuração, o tamanho, os
//     atributos do bônus de antecedente, o agrupamento): um ALTERNADOR, o
//     SegmentedControl do Build | Play, quando as opções cabem numa linha;
//   - opcional, ou com opções demais para uma linha: Chips no tamanho normal (o das
//     proficiências e dos filtros), e tocar na escolhida de novo limpa
//     (`clearable`), que era o X do antigo ClearableSelect.
//
// FUNÇÕES
//   ChoiceChips(props): `options` ([{ value, label, title?, disabled? }]), `value`,
//     `onChange(valor)` ('' ao limpar), `clearable` (padrão true), `ariaLabel`,
//     `className`.
//   fitsToggle(options): as opções cabem num alternador de colunas iguais.
//
// DECISÕES E ARMADILHAS
//   - Uma opção que outra linha já usa vem DESABILITADA e à vista, não some:
//     o <select> antigo a escondia e o jogador não sabia por que faltava (a
//     regra "liberdade com aviso" do §6.4 do manual).
//   - Cabe num alternador: até 6 opções e o rótulo mais longo vezes o número de
//     opções até 42 caracteres (as colunas são iguais; 42 é o que cabe em 327 px do
//     celular). "Str" a "Cha" e "Intelligence | Wisdom | Charisma" cabem; os cinco
//     agrupamentos do grimório não, e ficam Chips.
//   - Os Chips têm o tamanho normal, nunca o pequeno: o dono achou os pequenos
//     pequenos demais para tocar (DDL-0307).
//   - Para listas longas (mais de uns 8 itens) o lugar é o seletor, não isto.
// -----------------------------------------------------------------------------

import Chip from './Chip';
import SegmentedControl from './SegmentedControl';
import styles from './ChoiceChips.module.css';

/** As opções cabem num alternador de colunas iguais? */
function fitsToggle(options) {
  if (options.length < 2 || options.length > 6) return false;
  const longest = Math.max(...options.map((o) => String(o.label ?? '').length));
  return longest * options.length <= 42;
}

/** A escolha: alternador quando obrigatória e cabe, senão Chips. */
export default function ChoiceChips({ options, value, onChange, clearable = true, ariaLabel, className }) {
  if (!clearable && fitsToggle(options)) {
    return (
      <SegmentedControl
        block
        role="radiogroup"
        ariaLabel={ariaLabel}
        className={className}
        value={value}
        options={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled && o.value !== value }))}
        onChange={onChange}
      />
    );
  }
  return (
    <div className={className ? `${styles.row} ${className}` : styles.row} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Chip
            key={o.value}
            active={on}
            disabled={o.disabled && !on}
            title={o.title}
            onClick={() => {
              if (on) {
                if (clearable) onChange('');
              } else onChange(o.value);
            }}
          >
            {o.label}
          </Chip>
        );
      })}
    </div>
  );
}
