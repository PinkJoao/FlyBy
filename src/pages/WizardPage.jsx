// =============================================================================
// WizardPage: a rota da criação guiada (/build/:id/wizard)
// =============================================================================
// O QUE FAZ
//   Carrega o personagem (como o Builder) e monta os passos de CRIAÇÃO a partir do
//   estado (engine/wizardSteps), com a tela de cada passo em STEP_SCREENS (sem
//   entrada, o shell mostra um placeholder). As flags que precisam do db vêm de
//   createGuideContext.
//
// FUNÇÕES
//   WizardPage(): carrega o personagem.
//   WizardInner(props): o guia.
//
// DECISÕES E ARMADILHAS
//   - Aberto pelo botão do guia com pendências básicas, começa na Revisão.
//   - Concluir tira `meta.creating` e vai à ficha. Fechar um personagem já
//     construído volta à ficha mantendo a marca (para retomar); uma criação em
//     branco pergunta Descartar ou Manter.
//   - A tela de subclasse mira a primeira classe que já passou do nível dela.
// -----------------------------------------------------------------------------

import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import useCharacterStore from '../store/characterStore';
import { useData } from '../data/dataContext';
import useDerived from '../hooks/useDerived';
import { useLeaveTo } from '../hooks/useBack';
import { buildCreateSteps, pendingSubclassClass } from '../engine/wizardSteps';
import { createGuideContext } from '../components/wizard/createGuideContext';
import Wizard from '../components/wizard/Wizard';
import ClassStep from '../components/wizard/steps/ClassStep';
import SubclassStep from '../components/wizard/steps/SubclassStep';
import SpeciesStep from '../components/wizard/steps/SpeciesStep';
import OriginFeatStep from '../components/wizard/steps/OriginFeatStep';
import ProficienciesStep from '../components/wizard/steps/ProficienciesStep';
import AbilitiesStep from '../components/wizard/steps/AbilitiesStep';
import BoostsStep from '../components/wizard/steps/BoostsStep';
import EquipmentStep from '../components/wizard/steps/EquipmentStep';
import NamePortraitStep from '../components/wizard/steps/NamePortraitStep';
import PersonalityStoryStep from '../components/wizard/steps/PersonalityStoryStep';
import AlignmentStep from '../components/wizard/steps/AlignmentStep';
import IntroStep from '../components/wizard/steps/IntroStep';
import FeaturesIntroStep from '../components/wizard/steps/FeaturesIntroStep';
import FeaturesStep from '../components/wizard/steps/FeaturesStep';
import CantripsStep from '../components/wizard/steps/CantripsStep';
import SpellsStep from '../components/wizard/steps/SpellsStep';
import BackButton from '../components/common/BackButton';
import { ask } from '../components/common/dialog';

const STEP_SCREENS = {
  intro: IntroStep,
  class: ClassStep,
  subclass: SubclassStep,
  species: SpeciesStep,
  originFeat: OriginFeatStep,
  proficiencies: ProficienciesStep,
  abilities: AbilitiesStep,
  boosts: BoostsStep,
  equipment: EquipmentStep,
  story: PersonalityStoryStep,
  alignment: AlignmentStep,
  identity: NamePortraitStep,
  featuresIntro: FeaturesIntroStep,
  features: FeaturesStep,
  cantrips: CantripsStep,
  spells: SpellsStep,
};

export default function WizardPage() {
  const { id } = useParams();
  const loaded = useCharacterStore((s) => s.loaded);
  const load = useCharacterStore((s) => s.load);
  const character = useCharacterStore((s) => s.getById(id));

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!character) {
    return (
      <div style={{ padding: 24 }}>
        <p>Character not found.</p>
        <BackButton to="/" label="characters" />
      </div>
    );
  }

  return <WizardInner key={character.id} character={character} />;
}

function WizardInner({ character }) {
  const leaveTo = useLeaveTo();
  const location = useLocation();
  const { db } = useData();
  const save = useCharacterStore((s) => s.save);
  const remove = useCharacterStore((s) => s.remove);
  const derived = useDerived(character);
  const ctx = createGuideContext(db, character);
  const steps = buildCreateSteps(character, derived, ctx);
  const initialIndex = location.state?.atReview ? steps.length : 0;

  const built = (character.classes ?? []).some((c) => c.classId);
  const subLevel = character.rulesConfig?.subclassLevel ?? 3;
  const subclassClass =
    (character.classes ?? []).find((c) => c.classId && c.level >= subLevel) ?? pendingSubclassClass(character);

  const renderStep = (step, sctx) => {
    const Screen = STEP_SCREENS[step.id];
    if (!Screen) return null;
    if (step.id === 'subclass') return <Screen {...sctx} classUid={subclassClass?.uid} />;
    return <Screen {...sctx} />;
  };

  const onFinish = () => {
    save({ ...character, meta: { ...character.meta, creating: false } });
    leaveTo(`/build/${character.id}`);
  };

  const onExit = async () => {
    if (built) {
      leaveTo(`/build/${character.id}`);
      return;
    }
    const choice = await ask({
      title: 'Leave character creation?',
      message: 'This character is still being created. Discard it, or keep it to finish later?',
      actions: [
        { label: 'Discard', value: 'discard', tone: 'danger' },
        { label: 'Keep it', value: 'keep', tone: 'primary', autoFocus: true },
      ],
      dismissValue: null,
    });
    if (choice == null) return;
    if (choice === 'discard') await remove(character.id);
    leaveTo('/');
  };

  return (
    <Wizard
      steps={steps}
      character={character}
      derived={derived}
      db={db}
      onChange={save}
      title={character.meta?.name || 'New character'}
      onFinish={onFinish}
      onExit={onExit}
      renderStep={renderStep}
      initialIndex={initialIndex}
      blockIncomplete
    />
  );
}
