// =============================================================================
// spellStatDialog: abre a explicação de um número do grimório
// =============================================================================
// O QUE FAZ
//   Abre, na janela de prévia, o SpellStatPanel (Save DC, ataque, truques, preparadas,
//   grimório, arcanum) ou o SlotsPanel (os espaços), com o link para a regra certa:
//   a do glossário para a salvaguarda, o ataque e o truque; a feature de conjuração da
//   classe para o resto (DDL-0321).
//
// FUNÇÕES
//   castingFeature(character, db, origin): a feature de conjuração da classe da origem.
//   open(title, body): a janela.
//   showSpellStat(args): um número ou contador.
//   showSpellSlots(args): os espaços.
//
// DECISÕES E ARMADILHAS
//   - A feature vem do dado ("Spellcasting", "Pact Magic"; a subclasse conjuradora tem a
//     própria): sem ela na fonte, a janela só não mostra o link.
// -----------------------------------------------------------------------------

import useDialogStore from '../../store/dialogStore';
import { classFeatureLevels } from '../../engine/classProgression';
import { resolveClassObj, resolveSubclassObj } from '../../engine/resolve';
import { showRulePopup } from '../common/RulePopup';
import { ruleOpener } from '../common/ruleNamed';
import SpellStatPanel, { SlotsPanel } from './SpellStatPanel';

const TITLE = { dc: 'Save DC', atk: 'Spell attack', cantrips: 'Cantrips', prepared: 'Prepared spells', known: 'Spellbook', arcana: 'Mystic Arcanum' };
const RULES = { dc: ['Saving Throw'], atk: ['Spell Attack', 'Attack Roll'], cantrips: ['Cantrip'] };
const FEATURES = { arcana: ['Mystic Arcanum'] };
const CASTING = ['Spellcasting', 'Pact Magic'];

/** A feature da classe (ou da subclasse) com um dos nomes, e a função que a abre. */
function castingFeature(character, db, origin, names = CASTING) {
  const cls = (character?.classes ?? []).find((c) => c.uid === origin?.uid);
  const classObj = cls ? resolveClassObj(db, cls.classId, cls.source) : null;
  if (!classObj) return null;
  const sub = cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
  const features = classFeatureLevels(db, cls.classId, classObj, sub).flatMap((l) => l.features);
  const hit = features.find((f) => names.includes(f.name));
  if (!hit) return null;
  const fromSub = hit.from === 'subclass';
  return () =>
    showRulePopup({
      type: fromSub ? 'subclassFeature' : 'classFeature',
      name: hit.name,
      source: fromSub ? sub.source : classObj.source,
      entries: hit.entries,
    });
}

function open(title, message) {
  useDialogStore.getState().open({
    variant: 'preview',
    title,
    message,
    dismissable: true,
    showClose: true,
    actions: [],
    maxWidth: 440,
  });
}

/** Abre a explicação de um número ou contador (`stat` de engine/spellStats). */
export function showSpellStat({ stat, origin, character, db }) {
  const cls = (character?.classes ?? []).find((c) => c.uid === origin?.uid);
  const onRule = RULES[stat.key] ? ruleOpener(db, ...RULES[stat.key]) : castingFeature(character, db, origin, FEATURES[stat.key]);
  open(TITLE[stat.key], <SpellStatPanel stat={stat} classLevel={cls?.level} className={origin?.label} onRule={onRule} />);
}

/** Abre os espaços de magia de uma origem. */
export function showSpellSlots({ origin, character, db }) {
  open('Spell slots', <SlotsPanel origin={origin} onRule={castingFeature(character, db, origin)} />);
}
