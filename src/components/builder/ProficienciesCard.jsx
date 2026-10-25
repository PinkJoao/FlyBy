// =============================================================================
// ProficienciesCard: a lista única de proficiências
// =============================================================================
// O QUE FAZ
//   O cabeçalho mostra o bônus de proficiência; expandido, lista Saving Throws,
//   Skills, Expertise, Tools, Languages e os traços de dano. Tudo vem do derived.
//   Os traços de dano do personagem e dos itens aparecem juntos (o export os
//   separa; TC-0014).
//
//   No play mode (DDL-0120), saves, perícias, expertise e ferramentas são
//   botões que abrem a rolagem (`onSave`, `onSkill`, `onTool`); na ficha, sem
//   essas props, é só listagem.
//
// FUNÇÕES
//   ProficienciesCard(props): o card.
//   Section(props): um grupo; o item com `onRoll` vira botão de rolar.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { ABILITIES } from '../../schema/character';
import { formatBonus } from '../../engine/math';
import { ABILITY_FULL, SKILL_LABEL } from './labels';
import styles from './ProficienciesCard.module.css';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';

/**
 * O card de proficiências; com os callbacks, os itens roláveis viram botões.
 * @param {{ derived: object, onSave?: Function, onSkill?: Function, onTool?: Function }} props
 */
export default function ProficienciesCard({ derived, onSave, onSkill, onTool }) {
  const [open, setOpen] = useState(false);

  const saves = ABILITIES.filter((a) => derived.proficientSaves.includes(a)).map((a) => ({
    name: ABILITY_FULL[a],
    bonus: derived.saves[a],
    onRoll: onSave ? () => onSave(a) : null,
  }));

  const skillCodes = Object.keys(SKILL_LABEL);
  const skills = skillCodes
    .filter((s) => derived.skills[s]?.proficiency >= 1)
    .map((s) => ({ name: SKILL_LABEL[s], bonus: derived.skills[s].bonus, onRoll: onSkill ? () => onSkill(s) : null }));
  const expertise = skillCodes
    .filter((s) => derived.skills[s]?.proficiency >= 2)
    .map((s) => ({ name: SKILL_LABEL[s], bonus: derived.skills[s].bonus, onRoll: onSkill ? () => onSkill(s) : null }));

  const armor = (derived.armor ?? []).map((a) => ({ name: a }));
  const weapons = (derived.weapons ?? []).map((w) => ({ name: w }));
  const tools = (derived.tools ?? []).map((t) => ({ name: t, onRoll: onTool ? () => onTool(t) : null }));
  const languages = (derived.languages ?? []).map((l) => ({ name: l }));

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const dt = derived.damageTraits ?? {};
  const damageTrait = (kind) =>
    [...(dt[kind] ?? []), ...(dt.fromItems?.[kind] ?? [])].map((t) => ({ name: cap(t) }));
  const resistances = damageTrait('resist');
  const immunities = damageTrait('immune');
  const vulnerabilities = damageTrait('vulnerable');

  const isEmpty =
    !saves.length &&
    !skills.length &&
    !expertise.length &&
    !armor.length &&
    !weapons.length &&
    !tools.length &&
    !languages.length &&
    !resistances.length &&
    !immunities.length &&
    !vulnerabilities.length;

  return (
    <div className={open ? `${styles.card} ${styles.open}` : styles.card}>
      <button type="button" className={styles.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.icon}><Icon name="proficiency" /></span>
        <span className={styles.title}>Proficiencies</span>
        <span className={styles.bonusWrap}>
          <span className={styles.bonusLabel}>Bonus</span>
          <span className={styles.bonus}>{formatBonus(derived.proficiencyBonus)}</span>
        </span>
        <span className={styles.chevron}><Icon name="chevron" /></span>
      </button>

      <Collapse open={open}>
        <div className={styles.body}>
          {isEmpty ? (
            <p className={styles.empty}>
              No proficiencies yet. Pick a species, background and class to gain them.
            </p>
          ) : (
            <>
              <Section title="Saving Throws" items={saves} />
              <Section title="Skills" items={skills} />
              <Section title="Expertise" items={expertise} />
              <Section title="Armor" items={armor} />
              <Section title="Weapons" items={weapons} />
              <Section title="Tools" items={tools} />
              <Section title="Languages" items={languages} />
              <Section title="Damage Resistances" items={resistances} />
              <Section title="Damage Immunities" items={immunities} />
              <Section title="Damage Vulnerabilities" items={vulnerabilities} />
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
}

function Section({ title, items }) {
  if (!items.length) return null;
  return (
    <div className={styles.section}>
      <span className={styles.sectionTitle}>{title}</span>
      <div className={styles.pills}>
        {items.map((it) => (it.onRoll ? (
          <button type="button" className={`${styles.pill} ${styles.pillRoll}`} key={it.name} onClick={it.onRoll} title={`Roll ${it.name}`}>
            <span className={styles.pillDice} aria-hidden="true"><Icon name="dice" /></span>
            {it.name}
            {it.bonus != null && <span className={styles.pillBonus}>{formatBonus(it.bonus)}</span>}
          </button>
        ) : (
          <span className={styles.pill} key={it.name}>
            {it.name}
            {it.bonus != null && <span className={styles.pillBonus}>{formatBonus(it.bonus)}</span>}
          </span>
        )))}
      </div>
    </div>
  );
}
