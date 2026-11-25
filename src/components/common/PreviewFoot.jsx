// =============================================================================
// PreviewFoot: as peças do rodapé de um preview (contador e valor)
// =============================================================================
// O QUE FAZ
//   O rodapé da moldura de preview (PreviewShell) leva botões `Button`, que dividem a
//   largura; quando também tem um contador e um valor (a loja: quantidade e total; o
//   inventário: quantidade e valor), eles vêm destas duas peças, para os dois rodapés
//   terem o mesmo desenho (DDL-0299).
//
// FUNÇÕES
//   FootStepper(props): o Stepper do rodapé, sempre do mesmo tamanho e cor.
//   FootValue(props): o rótulo pequeno em maiúsculas e o valor embaixo ("Total", "Value").
//
// DECISÕES E ARMADILHAS
//   - O contador é o Stepper no tamanho `md` (40 px, a altura dos botões do rodapé); no
//     celular a classe `.footStepper` de PreviewShell.module.css sobe a variável
//     `--stp-height` para 44, como os botões ali (DDL-0303).
// -----------------------------------------------------------------------------

import Stepper from './Stepper';
import styles from './PreviewShell.module.css';

/** O Stepper do rodapé de um preview. */
export function FootStepper(props) {
  return <Stepper size="md" className={styles.footStepper} {...props} />;
}

/** O rótulo e o valor de um rodapé ("Total 2 gp"). */
export function FootValue({ label, value }) {
  return (
    <div className={styles.footValue}>
      <span className={styles.footValueLabel}>{label}</span>
      <span className={styles.footValueAmount}>{value}</span>
    </div>
  );
}
