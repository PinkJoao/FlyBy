// =============================================================================
// BackgroundStep: o passo do background (DDL-0328)
// =============================================================================
// O QUE FAZ
//   Escolhe a origem: o Custom (padrão, já escolhido) ou um background pronto, num
//   carrossel no próprio passo (InlineSelector), como classe e espécie. Next sem mexer
//   segue com o Custom e o fluxo de sempre.
//
// FUNÇÕES
//   BackgroundStep(props): o passo.
//
// DECISÕES E ARMADILHAS
//   - Duas páginas (useGuidePage): o texto que explica a etapa e o carrossel. "Choose X"
//     escolhe e vai à próxima etapa; o que o background pronto decide some dos passos
//     seguintes (o talento de origem aparece só com o que sobra, DDL-0328).
//   - Escolher passa pelo mesmo chooseBackground da aba (o aviso quando apaga escolhas).
// -----------------------------------------------------------------------------

import InlineSelector from '../../../selector/InlineSelector';
import backgroundEntity, { backgroundIdOf } from '../../../selector/entities/background';
import { chooseBackground, clearBackground } from '../../builder/originSetup';
import { useGuideNav, useGuidePage } from '../guidePages';
import Icon from '../../common/Icon';
import styles from './steps.module.css';

export default function BackgroundStep({ character, db, onChange }) {
  const page = useGuidePage(2);
  const nav = useGuideNav();
  const setOrigin = (origin) => onChange({ ...character, origin });

  const pick = async (raw) => {
    const next = await chooseBackground(character, db, raw);
    if (next) setOrigin(next);
    return !!next;
  };

  if (page === 0) {
    return (
      <div className={styles.step}>
        <div className={styles.introBlock}>
          <span className={styles.introEmoji}><Icon name="stepStory" /></span>
          <p className={styles.introText}>
            Your background is the life you lived before adventuring. It grants ability boosts, an origin feat, two skills
            and a tool. Build it piece by piece with the <strong>Custom Background</strong>, or take a ready-made one from the
            books and have those pieces chosen for you.
          </p>
          <p className={styles.introText}>Hit Next to see the options, then swipe through them.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <InlineSelector
        entity={backgroundEntity}
        db={db}
        currentId={backgroundIdOf(character.origin)}
        onSelect={pick}
        onClear={async () => {
          const next = await clearBackground(character);
          if (next) setOrigin(next);
        }}
        onChoose={async (raw) => {
          if (await pick(raw)) nav?.next({ force: true });
        }}
      />
    </div>
  );
}
