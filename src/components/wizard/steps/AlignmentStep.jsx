// =============================================================================
// AlignmentStep - o alinhamento moral do personagem (Fase D2)
// =============================================================================
// Logo após personalidade & história. Grava o CÓDIGO em `character.identity.
// alignment` (LG/NG/…/CE) - o mesmo que o export do Foundry mapeia em
// `details.alignment` (engine/foundryExport FOUNDRY_ALIGNMENT). Cards grandes no
// estilo do Divine Order: "sigla - alinhamento" + descrição. Tocar no selecionado
// de novo limpa. Nada aqui muda números (guard-rail DDL-0013).
// -----------------------------------------------------------------------------

import styles from './steps.module.css';

// Cor da sigla pelo eixo Good↔Evil (como no card da ficha): azul p/ bons (código
// termina em G), vermelho p/ maus (termina em E), accent p/ neutros.
const codeAxisClass = (code) =>
  code.endsWith('G') ? styles.alignCodeGood : code.endsWith('E') ? styles.alignCodeEvil : '';

// Canonical order (good → neutral → evil, each lawful/neutral/chaotic).
const ALIGNMENTS = [
  {
    code: 'LG',
    label: 'Lawful Good',
    desc: 'I believe doing the right thing means helping others while remaining true to my principles, even when it is difficult.',
  },
  {
    code: 'NG',
    label: 'Neutral Good',
    desc: 'Helping others matters most to me. Rules and traditions are valuable only when they serve that purpose.',
  },
  {
    code: 'CG',
    label: 'Chaotic Good',
    desc: 'I trust my conscience over any code. If a rule stands in the way of doing good, then the rule should be broken.',
  },
  {
    code: 'LN',
    label: 'Lawful Neutral',
    desc: 'A life guided by consistent principles is better than one guided by convenience. I strive to remain true to my code.',
  },
  {
    code: 'N',
    label: 'True Neutral',
    desc: 'I judge each situation on its own merits rather than committing myself to rigid ideals or absolute freedoms.',
  },
  {
    code: 'CN',
    label: 'Chaotic Neutral',
    desc: 'I believe every person should decide for themselves what is right. No set of rules should define how I live.',
  },
  {
    code: 'LE',
    label: 'Lawful Evil',
    desc: 'Discipline and order are the surest path to achieving my goals. I keep my word when it serves my ambitions.',
  },
  {
    code: 'NE',
    label: 'Neutral Evil',
    desc: 'My own interests come first. I use whatever methods are most effective, whether orderly or unpredictable.',
  },
  {
    code: 'CE',
    label: 'Chaotic Evil',
    desc: 'No one has the right to tell me how to live. I follow my desires and let nothing stand in my way.',
  },
];

export default function AlignmentStep({ character, onChange }) {
  const identity = character.identity ?? {};
  const current = identity.alignment ?? '';

  // Tap to select; tap again to clear.
  const select = (code) =>
    onChange({
      ...character,
      identity: {
        ...identity,
        alignment: code === current ? '' : code,
      },
    });

  return (
    <div className={styles.step}>
      <p className={styles.callout}>
        Alignment is a roleplaying guide, not a rule. It is defined by two independent moral axes.
        The <strong>Good↔Evil</strong> axis reflects whether you naturally prioritize the well-being
        of others or your own interests, while the <strong>Lawful↔Chaotic</strong> axis reflects
        whether you strive to follow a consistent moral code or instead rely on your own judgment in
        each situation. Characters who are <strong>Neutral</strong> on either axis simply don't
        strongly favor one approach over the other.
      </p>

      <div className={styles.alignOptions}>
        {ALIGNMENTS.map((a) => {
          const selected = a.code === current;

          return (
            <button
              key={a.code}
              type="button"
              className={
                selected
                  ? `${styles.alignOption} ${styles.alignOptionSel}`
                  : styles.alignOption
              }
              onClick={() => select(a.code)}
              aria-pressed={selected}
            >
              <span className={styles.alignName}>
                <span className={`${styles.alignCode} ${codeAxisClass(a.code)}`}>{a.code}</span>
                <span className={styles.alignDash}> - </span>
                {a.label}
              </span>

              <span className={styles.alignDesc}>
                <em>“{a.desc}”</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}