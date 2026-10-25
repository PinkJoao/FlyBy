// =============================================================================
// ModeSwitch: o seletor Sheet | Play no topo da página do personagem
// =============================================================================
// O QUE FAZ
//   Os dois modos da mesma página (DDL-0117): a ficha (montar o personagem) e o
//   jogo (jogar com ele). Um controle segmentado no estilo dos seletores do painel
//   do PDF; chama onChange com 'sheet' ou 'play'. O realce do modo escolhido é
//   uma peça só (.thumb) que desliza de um botão ao outro na troca.
//
// FUNÇÕES
//   ModeSwitch(props): o seletor.
//
// DECISÕES E ARMADILHAS
//   - MODES dá a ordem e o rótulo; a ordem é também a direção da animação da troca
//     (a ficha à esquerda, o jogo à direita).
//   - O realce é um elemento à parte, e não o fundo do botão, para poder DESLIZAR:
//     os dois botões têm a mesma largura (grade 1fr 1fr) e ele anda 100% dela.
//     A posição vem do `data-mode` da trilha, só CSS, então já nasce no lugar.
//   - É um grupo de botões com aria-pressed, não abas: o conteúdo inteiro da página
//     troca, e as abas de verdade ficam embaixo.
// -----------------------------------------------------------------------------

import styles from './ModeSwitch.module.css';

const MODES = [
  { value: 'sheet', label: 'Sheet' },
  { value: 'play', label: 'Play' },
];

/**
 * O seletor de modo.
 * @param {{ mode: 'sheet'|'play', onChange: (mode: string) => void }} props
 */
export default function ModeSwitch({ mode, onChange }) {
  return (
    <div className={styles.seg} role="group" aria-label="Mode" data-mode={mode}>
      <span className={styles.thumb} aria-hidden="true" />
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={mode === m.value ? styles.on : undefined}
          aria-pressed={mode === m.value}
          onClick={() => onChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
