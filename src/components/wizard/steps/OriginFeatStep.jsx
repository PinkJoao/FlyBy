// =============================================================================
// OriginFeatStep: o passo do talento de origem
// =============================================================================
// O QUE FAZ
//   Escolhe `origin.originFeat` e as sub-escolhas com o OriginFeatPicker da aba
//   (OriginParts). Nível e bag alimentam as escolhas de magia (TC-0011). O botão de
//   info não aparece: a descrição já está embaixo. Com um background pronto que fixa o
//   talento, só as sub-escolhas que sobram (o passo some sem nenhuma, DDL-0328).
//
// FUNÇÕES
//   OriginFeatStep(props): o passo.
// -----------------------------------------------------------------------------

import StepExplain from './StepExplain';
import { resolveFeat } from '../../../engine/resolve';
import { backgroundOf } from '../../../engine/backgrounds';
import DetailView from '../../common/DetailView';
import { OriginFeatPicker } from '../../builder/OriginParts';
import { originFeatSetup } from '../../builder/originSetup';
import styles from './steps.module.css';

export default function OriginFeatStep({ character, db, onChange }) {
  const originFeat = character.origin?.originFeat ?? null;
  const bg = backgroundOf(character, db);
  const raw = originFeat ? resolveFeat(db, `${originFeat.id}|${originFeat.source}`) : null;
  const { entity } = originFeatSetup(character, db);

  return (
    <div className={styles.step}>
      <StepExplain>
        {bg ? (
          <>
            Your background, <strong>{bg.name}</strong>, grants its <strong>Origin Feat</strong>. Make the choices it
            leaves to you below.
          </>
        ) : (
          <>
            Your origin reflects the life you lived before becoming an adventurer.
            It grants an <strong>&quot;Origin Feat&quot;</strong>, a small but defining talent such as Alert, Skilled, or Tough.
            Some Origin Feats also include additional choices, such as selecting a skill, tool, or spell.
          </>
        )}
      </StepExplain>

      <OriginFeatPicker
        character={character}
        db={db}
        onChangeOrigin={(o) => onChange({ ...character, origin: o })}
        showInfo={false}
        guided
        preview={raw && (
          <div className={styles.preview}>
            <DetailView entity={entity} raw={raw} db={db} hideHeader />
          </div>
        )}
      />
    </div>
  );
}
