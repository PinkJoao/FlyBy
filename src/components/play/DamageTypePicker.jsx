// =============================================================================
// DamageTypePicker: a escolha do tipo de dano num diálogo do play mode
// =============================================================================
// O QUE FAZ
//   O tipo de dano que o texto deixa escolher (§6.4): até quatro tipos, o controle
//   segmentado do app; mais que isso (o Elemental Strike com sete, o Chromatic Orb com
//   seis), chips que quebram linha, porque sete rótulos não cabem numa faixa de 400px.
//   Usado pelo diálogo do dano (RollPanel) e pelo de usar uma feature (UsePanel).
//
// FUNÇÕES
//   label(t): o tipo com a inicial maiúscula.
//   DamageTypePicker(props): a escolha; `types`, `value`, `onChange`.
//
// DECISÕES E ARMADILHAS
//   - O limite de quatro foi medido no diálogo de 440px: "Bludgeoning" encostava em
//     "Cold" com sete opções no segmentado (DDL-0251).
// -----------------------------------------------------------------------------
import SegmentedControl from '../common/SegmentedControl';
import Chip from '../common/Chip';

const label = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** O tipo de dano à escolha: segmentado até quatro, chips além disso. */
export default function DamageTypePicker({ types, value, onChange }) {
  if (types.length <= 4) {
    return (
      <SegmentedControl
        block
        role="radiogroup"
        ariaLabel="Damage type"
        value={value}
        options={types.map((t) => ({ value: t, label: label(t) }))}
        onChange={onChange}
      />
    );
  }
  return (
    <div role="radiogroup" aria-label="Damage type" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {types.map((t) => (
        <Chip key={t} active={value === t} onClick={() => onChange(t)}>
          {label(t)}
        </Chip>
      ))}
    </div>
  );
}
