// =============================================================================
// WildShapeForms: as formas conhecidas do Wild Shape, escolhidas na aba de classe
// =============================================================================
// O QUE FAZ
//   U1 do plano de summons (DDL-0195): as formas do Wild Shape são DECISÃO do
//   personagem, guardadas em `character.wildShapeForms` ({ name, source }). Tem a
//   cara de qualquer escolha da aba (DDL-0197): o título que abre o texto do Wild
//   Shape, a contagem "1/4", a linha do limite (ND e voo, da tabela Beast Shapes),
//   as escolhidas no Chip comum (o toque abre o bloco da criatura, o X tira) e o
//   "Add form" no Chip de adicionar, que abre o painel seletor só com as feras que
//   cabem no nível.
//
// FUNÇÕES
//   crLabel(cr): o ND como texto ("1/4", "1").
//   WildShapeForms(props): o bloco.
//
// DECISÕES E ARMADILHAS
//   - Usa as classes do ChoiceList (.choice, .head, .labelLink, .counter, .tags, .hint)
//     e o Chip: nada de pílula ou cabeçalho próprio (§6.4, DDL-0197).
//   - Como nas outras escolhas, o "Add" some na contagem cheia; passar dela (o nível
//     desceu) fica em vermelho na contagem e não apaga nada (liberdade com aviso).
//   - A fera fora do ND ou com voo antes do nível 8 sai da lista: é regra do texto,
//     sem ambiguidade (§6.4, o esconder só para regra clara). O seletor é o
//     `beastFormEntity`, sem o tipo no cartão (são todas feras).
//   - O bestiário entra num db próprio, memorizado: a entity de criatura guarda a
//     lista por objeto de db. Só carrega quando o painel abre ou um chip é tocado.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import useBestiary from '../../hooks/useBestiary';
import { formEligible, transformRuleOf } from '../../engine/playForms';
import SelectorPanel from '../../selector/SelectorPanel';
import { beastFormEntity } from '../../selector/entities/creature';
import { showDetailPopup } from '../common/detailPopup';
import { showRulePopup } from '../common/RulePopup';
import Chip from '../common/Chip';
import styles from './ChoiceList.module.css';

/** O ND como texto ("1/4", "1"). */
const crLabel = (cr) => (cr > 0 && cr < 1 ? `1/${Math.round(1 / cr)}` : String(cr));

/**
 * O bloco das formas conhecidas.
 * @param {{ db: object, forms: {name:string, source:string}[], limits: {known:number, maxCr:number, fly:boolean, entries?:object[]}, onChange: Function }} props
 */
export default function WildShapeForms({ db, forms, limits, onChange }) {
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  const bestiary = useBestiary(open || wanted);
  const beastDb = useMemo(() => ({ ...db, bestiary: { monster: bestiary.list } }), [db, bestiary.list]);
  const rule = transformRuleOf('wild shape');
  const keyOf = (f) => `${f.name}|${f.source}`;
  const ids = new Set(forms.map(keyOf));
  const over = forms.length > limits.known;
  const remove = (key) => onChange(forms.filter((f) => keyOf(f) !== key));
  const openDetail = async (f) => {
    setWanted(true);
    const list = await bestiary.load();
    const raw = list.find((m) => keyOf(m) === keyOf(f)) ?? list.find((m) => m.name === f.name);
    if (raw) showDetailPopup({ entity: beastFormEntity, raw, db: { ...db, bestiary: { monster: list } } });
  };
  return (
    <div className={styles.choice}>
      <div className={styles.head}>
        {limits.entries ? (
          <button type="button" className={styles.labelLink} onClick={() => showRulePopup({ name: 'Wild Shape', entries: limits.entries })}>
            Wild Shape forms
          </button>
        ) : (
          <span className={styles.label}>Wild Shape forms</span>
        )}
        <span className={over ? `${styles.counter} ${styles.counterOver}` : styles.counter}>{forms.length}/{limits.known}</span>
      </div>
      <span className={styles.hint}>
        Beasts of CR {crLabel(limits.maxCr)} or lower{limits.fly ? '' : ', without a fly speed'}. You can swap one when you finish a Long Rest.
      </span>
      <div className={styles.tags}>
        {forms.map((f) => (
          <Chip key={keyOf(f)} onClick={() => openDetail(f)} onRemove={() => remove(keyOf(f))}>{f.name}</Chip>
        ))}
        {forms.length < limits.known && <Chip add onClick={() => setOpen(true)}>Add form</Chip>}
      </div>
      {open && (
        <SelectorPanel
          entity={beastFormEntity}
          db={beastDb}
          currentId={null}
          heading="Add a Wild Shape form"
          hint={bestiary.loading ? 'Loading the creatures…' : undefined}
          exclude={(m) => ids.has(keyOf(m)) || !formEligible(m, rule, limits)}
          onSelect={(m) => {
            const next = [...forms, { name: m.name, source: m.source }];
            onChange(next);
            if (next.length >= limits.known) setOpen(false);
          }}
          multi={{ total: limits.known, chosen: forms.map((f) => ({ key: keyOf(f), label: f.name })), onRemove: remove }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
