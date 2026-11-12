// =============================================================================
// RevertFormButton: o botão de sair da forma, no aviso do topo e no histórico
// =============================================================================
// O QUE FAZ
//   O "Revert" de uma transformação (Wild Shape, Polymorph...): o ícone de voltar, o
//   rótulo e, quando sair custa um gasto do turno (o Wild Shape: Ação Bônus), a Tag
//   desse gasto no tom dele. O MESMO botão no aviso da forma e no card do histórico
//   que a criou (DDL-0201).
//
// FUNÇÕES
//   RevertFormButton(props): o botão.
//
// DECISÕES E ARMADILHAS
//   - Só desenha: quem chama passa `onClick` (o `revertForm` da tela, que grava o
//     evento e gasta a Ação Bônus do Wild Shape).
//   - Primária (borda accent): é a ação do aviso, como os "Use" das abas.
// -----------------------------------------------------------------------------

import Button from '../common/Button';
import Icon from '../common/Icon';
import Tag from '../common/Tag';

/**
 * O botão de reverter a forma.
 * @param {{ form: object, onClick: Function, className?: string }} props
 */
export default function RevertFormButton({ form, onClick, className }) {
  const bonus = form?.kind === 'wildShape';
  return (
    <Button size="sm" variant="primary" className={className} onClick={onClick} title={`End ${form?.label ?? 'the form'}`}>
      <Icon name="undo" />
      Revert
      {bonus && <Tag tone="bonus">Bonus Action</Tag>}
    </Button>
  );
}
