// =============================================================================
// WildShapeForms: as formas conhecidas do Wild Shape, escolhidas na aba de classe
// =============================================================================
// O QUE FAZ
//   U1 do plano de summons (DDL-0195): as formas do Wild Shape são DECISÃO do
//   personagem, guardadas em `character.wildShapeForms` ({ name, source }). Mostra
//   quantas o nível dá (a tabela Beast Shapes do próprio texto, engine/playForms),
//   as escolhidas em chips removíveis e "+ Add form", que abre o painel seletor de
//   criatura sobre o bestiário (o mesmo da aba Summons), só com as feras que cabem
//   no ND e no voo do nível.
//
// FUNÇÕES
//   WildShapeForms(props): o bloco.
//
// DECISÕES E ARMADILHAS
//   - Passar do número de formas fica em vermelho e não bloqueia (liberdade com
//     aviso, §6.4): o texto deixa o mestre permitir mais.
//   - A fera fora do ND ou com voo antes do nível 8 sai da lista: é regra do texto,
//     sem ambiguidade (§6.4, o esconder só para regra clara).
//   - O bestiário entra num db próprio, memorizado: a entity de criatura guarda a
//     lista por objeto de db.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import useBestiary from '../../hooks/useBestiary';
import { formEligible, transformRuleOf } from '../../engine/playForms';
import SelectorPanel from '../../selector/SelectorPanel';
import creatureEntity from '../../selector/entities/creature';
import Chip from '../common/Chip';
import Button from '../common/Button';
import styles from './ClassTab.module.css';

/**
 * O bloco das formas conhecidas.
 * @param {{ db: object, forms: {name:string, source:string}[], limits: {known:number, maxCr:number, fly:boolean}, onChange: Function }} props
 */
export default function WildShapeForms({ db, forms, limits, onChange }) {
  const [open, setOpen] = useState(false);
  const bestiary = useBestiary(open);
  const beastDb = useMemo(() => ({ ...db, bestiary: { monster: bestiary.list } }), [db, bestiary.list]);
  const rule = transformRuleOf('wild shape');
  const ids = new Set(forms.map((f) => `${f.name}|${f.source}`));
  const over = forms.length > limits.known;
  const remove = (key) => onChange(forms.filter((f) => `${f.name}|${f.source}` !== key));
  return (
    <div className={styles.choices}>
      <span className={styles.subLabel}>
        Wild Shape forms{' '}
        <span className={over ? styles.over : undefined}>{forms.length} of {limits.known}</span>
        {` · CR ${limits.maxCr < 1 ? `1/${Math.round(1 / limits.maxCr)}` : limits.maxCr} or lower${limits.fly ? '' : ', no fly speed'}`}
      </span>
      <div className={styles.formRow}>
        {forms.map((f) => (
          <Chip key={`${f.name}|${f.source}`} onRemove={() => remove(`${f.name}|${f.source}`)}>{f.name}</Chip>
        ))}
        <Button size="sm" onClick={() => setOpen(true)}>+ Add form</Button>
      </div>
      {open && (
        <SelectorPanel
          entity={creatureEntity}
          db={beastDb}
          currentId={null}
          heading="Add a Wild Shape form"
          hint={bestiary.loading ? 'Loading the creatures…' : 'Beasts your druid level allows. You can swap one form when you finish a Long Rest.'}
          exclude={(m) => ids.has(`${m.name}|${m.source}`) || !formEligible(m, rule, limits)}
          onSelect={(m) => {
            onChange([...forms, { name: m.name, source: m.source }]);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
