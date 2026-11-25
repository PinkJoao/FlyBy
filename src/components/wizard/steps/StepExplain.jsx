// =============================================================================
// StepExplain: a explicação de um passo do guia
// =============================================================================
// O QUE FAZ
//   O quadro de texto que explica o passo (o que é um talento de origem, de onde
//   vêm as perícias) ou a feature da classe que pede a escolha (as cantrips, as
//   magias), sempre INTEIRO.
//
// FUNÇÕES
//   StepExplain(props): o quadro; `children` é o texto (parágrafos, listas).
//
// DECISÕES E ARMADILHAS
//   - Nada dobrado, nada de "Read more" (DDL-0308, pedido do dono): no DDL-0306 o
//     quadro mostrava duas linhas e escondia o resto, e o texto que explica a decisão
//     ficava escondido (as cantrips dobradas, o Fighting Style inteiro). Quem usa o guia
//     é o iniciante: ele precisa do contexto todo para escolher. Um lugar só para o
//     quadro, para a regra valer em todo passo.
// -----------------------------------------------------------------------------

import styles from './steps.module.css';

/** A explicação do passo, inteira. */
export default function StepExplain({ children }) {
  return (
    <div className={styles.callout}>
      <div className={styles.explain}>{children}</div>
    </div>
  );
}
