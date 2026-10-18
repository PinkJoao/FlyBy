// =============================================================================
// Wizard: o shell da criação guiada (Character Guidance, DDL-0013)
// =============================================================================
// O QUE FAZ
//   Percorre uma LISTA de passos (engine/wizardSteps): barra de progresso, Back,
//   Skip e Next, e uma REVISÃO no fim com o estado de cada passo (a rede da
//   validação não-bloqueante). O shell desenha kicker, título, o corpo do passo
//   (`renderStep`, que recebe character, derived, db e onChange) e o rodapé; o
//   texto de guia vive na própria tela, num card.
//
// FUNÇÕES
//   Wizard(props): o shell.
//   Review(props): a revisão; a LINHA inteira é o botão de voltar ao passo, e os
//     passos informativos ficam fora da lista (o índice original é preservado).
//
// DECISÕES E ARMADILHAS
//   - Na CRIAÇÃO o Avançar NUNCA trava e há Revisão; no fixup e no level-up não há
//     Revisão e um passo obrigatório vazio trava o Avançar.
//   - Skip só em passos OPCIONAIS (biografia, nome, alinhamento). Sem passos, nada
//     a guiar.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import styles from './Wizard.module.css';

const STATUS_LABEL = { complete: 'Done', incomplete: 'Needs a choice', optional: 'Optional', info: 'Info' };

/**
 * O shell do guia.
 * @param {object} props
 * @param {Array<{id,title,subtitle,status:Function}>} props.steps
 * @param {object} props.character
 * @param {object} props.derived
 * @param {string} [props.title]
 * @param {() => void} props.onFinish
 * @param {() => void} [props.onExit]
 * @param {object} [props.db]
 * @param {(next) => void} [props.onChange]
 * @param {(step, ctx) => import('react').ReactNode} [props.renderStep]
 */
export default function Wizard({
  steps,
  character,
  derived,
  db,
  onChange,
  title,
  onFinish,
  onExit,
  renderStep,
  initialIndex = 0,
  showReview = true,
  blockIncomplete = false,
}) {
  const [index, setIndex] = useState(initialIndex);

  if (!steps || steps.length === 0) {
    return null;
  }

  const total = steps.length;
  const maxIndex = showReview ? total : total - 1;
  const clamped = Math.min(index, maxIndex);
  const onReview = showReview && clamped >= total;
  const step = onReview ? null : steps[clamped];
  const isLast = clamped === total - 1;
  const progress = Math.min(clamped, total) / total;

  const goto = (i) => setIndex(Math.max(0, Math.min(maxIndex, i)));
  const back = () => (clamped === 0 ? onExit?.() : goto(clamped - 1));

  const statusOf = (s) => s.status?.(character, derived) ?? 'optional';
  const pending = steps.filter((s) => statusOf(s) === 'incomplete');
  const stepStatus = step ? statusOf(step) : null;
  const canSkip = !onReview && stepStatus === 'optional';
  const blocked = blockIncomplete && !onReview && stepStatus === 'incomplete';

  const advance = () => (!showReview && isLast ? onFinish?.() : goto(clamped + 1));
  const primaryLabel = onReview ? 'Finish' : isLast ? (showReview ? 'Review' : 'Done') : 'Next';

  return (
    <div className={styles.wizard}>
      <header className={styles.head}>
        <div className={styles.progressWrap}>
          {title && <span className={styles.title}>{title}</span>}
          <div className={styles.progressBar} role="presentation">
            <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={styles.progressText}>
            {onReview ? 'Review' : `Step ${clamped + 1} of ${total}`}
          </span>
        </div>
        {onExit && (
          <button type="button" className={styles.exit} onClick={onExit} aria-label="Exit guide">
            ✕
          </button>
        )}
      </header>

      <main className={styles.body}>
        {onReview ? (
          <Review steps={steps} statusOf={statusOf} onGoto={goto} />
        ) : (
          <section className={styles.step}>
            <p className={styles.stepKicker}>{step.subtitle}</p>
            <h2 className={styles.stepTitle}>{step.title}</h2>

            <div className={styles.stepBody}>
              {renderStep?.(step, { character, derived, db, onChange }) ?? (
                <div className={styles.placeholder}>
                  <p>This step’s screen arrives in a later phase.</p>
                  <span className={`${styles.badge} ${styles[statusOf(step)]}`}>
                    {STATUS_LABEL[statusOf(step)]}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className={styles.foot}>
        <button type="button" className={styles.navBtn} onClick={back}>
          Back
        </button>
        {onReview ? (
          <button type="button" className={`${styles.navBtn} ${styles.primaryBtn}`} onClick={onFinish}>
            Finish
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.primaryBtn}`}
              onClick={advance}
              disabled={blocked}
              title={blocked ? 'Make this choice to continue.' : undefined}
            >
              {primaryLabel}
            </button>
            {canSkip && (
              <button type="button" className={styles.navBtn} onClick={advance}>
                Skip
              </button>
            )}
          </>
        )}
      </footer>

      {blocked && <p className={styles.footNote}>Make this choice to continue.</p>}

      {onReview && pending.length > 0 && (
        <p className={styles.footNote}>
          {pending.length} step{pending.length > 1 ? 's' : ''} still {pending.length > 1 ? 'need' : 'needs'} a choice -
          you can finish anyway and fill them in on the sheet.
        </p>
      )}
    </div>
  );
}

/** A revisão: cada passo com o estado e o pulo de volta. */
function Review({ steps, statusOf, onGoto }) {
  return (
    <section className={styles.step}>
      <h2 className={styles.stepTitle}>Review</h2>
      <p className={styles.stepHelp}>Everything in one place. Jump back to change anything.</p>
      <ul className={styles.reviewList}>
        {steps
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => statusOf(s) !== 'info')
          .map(({ s, i }) => {
            const st = statusOf(s);
            return (
              <li key={s.id} className={styles.reviewRow}>
                <button type="button" className={styles.reviewJump} onClick={() => onGoto(i)}>
                  <span className={styles.reviewText}>
                    <span className={styles.reviewName}>{s.title}</span>
                    <span className={styles.reviewSub}>{s.subtitle}</span>
                  </span>
                  <span className={`${styles.badge} ${styles[st]}`}>{STATUS_LABEL[st]}</span>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
