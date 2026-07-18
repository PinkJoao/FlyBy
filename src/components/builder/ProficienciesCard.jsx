// =============================================================================
// ProficienciesCard - lista única de proficiências (expansível)
// =============================================================================
// Espelha o card "Proficiency +N" do dnd-sheet: o header mostra o bônus de
// proficiência; ao expandir, lista as proficiências agrupadas em Saving Throws,
// Skills, Expertise, Tools e Languages. Tudo vem do ENGINE (derived), que já
// agrega origem + escolhas recursivas. Por enquanto é SÓ LISTAGEM.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { ABILITIES } from '../../schema/character';
import { formatBonus } from '../../engine/math';
import { ABILITY_FULL, SKILL_LABEL } from './labels';
import styles from './ProficienciesCard.module.css';

export default function ProficienciesCard({ derived }) {
  const [open, setOpen] = useState(false);

  const saves = ABILITIES.filter((a) => derived.proficientSaves.includes(a)).map((a) => ({
    name: ABILITY_FULL[a],
    bonus: derived.saves[a],
  }));

  const skillCodes = Object.keys(SKILL_LABEL);
  const skills = skillCodes
    .filter((s) => derived.skills[s]?.proficiency >= 1)
    .map((s) => ({ name: SKILL_LABEL[s], bonus: derived.skills[s].bonus }));
  const expertise = skillCodes
    .filter((s) => derived.skills[s]?.proficiency >= 2)
    .map((s) => ({ name: SKILL_LABEL[s], bonus: derived.skills[s].bonus }));

  const armor = (derived.armor ?? []).map((a) => ({ name: a }));
  const weapons = (derived.weapons ?? []).map((w) => ({ name: w }));
  const tools = (derived.tools ?? []).map((t) => ({ name: t }));
  const languages = (derived.languages ?? []).map((l) => ({ name: l }));

  // Traços de dano (TC-0014): do personagem + de itens equipados, juntos na
  // exibição (o export separa - itens carregam o próprio efeito no Foundry).
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
        <span className={styles.icon}>᯽</span>
        <span className={styles.title}>Proficiencies</span>
        <span className={styles.bonusWrap}>
          <span className={styles.bonusLabel}>Bonus</span>
          <span className={styles.bonus}>{formatBonus(derived.proficiencyBonus)}</span>
        </span>
        <span className={styles.chevron}>▾</span>
      </button>

      {open && (
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
      )}
    </div>
  );
}

function Section({ title, items }) {
  if (!items.length) return null;
  return (
    <div className={styles.section}>
      <span className={styles.sectionTitle}>{title}</span>
      <div className={styles.pills}>
        {items.map((it) => (
          <span className={styles.pill} key={it.name}>
            {it.name}
            {it.bonus != null && <span className={styles.pillBonus}>{formatBonus(it.bonus)}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
