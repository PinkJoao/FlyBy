// =============================================================================
// Wizard - shell do Character Guidance (Fase D / D1, DDL-0013)
// =============================================================================
// Percorre uma LISTA de passos (de engine/wizardSteps): barra de progresso,
// navegação Back / Skip / Next, e uma tela de REVISÃO no fim que lista o estado
// de cada passo (a rede de segurança da validação não-bloqueante). O Avançar
// NUNCA é travado por um passo incompleto.
//
// O texto instrutivo de cada passo NÃO fica mais abaixo do título - vive dentro
// da própria tela, num card de guia (`.callout`, como na tela de Classe). O shell
// aqui só desenha o kicker + título + o corpo custom (via `renderStep`) + o
// rodapé/progresso. As telas recebem `character`, `derived`, `db`, `onChange`.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import styles from './Wizard.module.css';

const STATUS_LABEL = { complete: 'Done', incomplete: 'Needs a choice', optional: 'Optional', info: 'Info' };

/**
 * @param {object} props
 * @param {Array<{id,title,subtitle,status:Function}>} props.steps
 * @param {object} props.character
 * @param {object} props.derived
 * @param {string} [props.title]        rótulo do topo (ex: "New character")
 * @param {() => void} props.onFinish   concluir (fecha/navega)
 * @param {() => void} [props.onExit]   sair sem concluir (X / Back)
 * @param {object} [props.db]           compêndio, repassado às telas
 * @param {(next) => void} [props.onChange]  salva o personagem (live-save)
 * @param {(step, ctx) => import('react').ReactNode} [props.renderStep]  corpo custom (D2+)
 *   recebe `{ character, derived, db, onChange }`.
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
  showReview = true, // guia de CRIAÇÃO tem Review; o de fixup/level-up não (#7)
  blockIncomplete = false, // trava o Avançar em passo obrigatório vazio (#8)
}) {
  const [index, setIndex] = useState(initialIndex);

  if (!steps || steps.length === 0) {
    // Sem passos (ex: level-up sem decisões) - nada a guiar.
    return null;
  }

  const total = steps.length;
  // Índice máximo navegável: com Review vai até `total` (a tela de revisão),
  // sem Review para no último passo.
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
  // Skip só em passos OPCIONAIS (biografia/nome/alinhamento).
  const canSkip = !onReview && stepStatus === 'optional';
  // Trava: passo obrigatório ainda vazio não deixa avançar (#8).
  const blocked = blockIncomplete && !onReview && stepStatus === 'incomplete';

  // Avançar: no último passo sem Review → concluir; senão → próximo (ou Review).
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

      {/* Rodapé: Back · Next/Done · Skip (Skip só em passos opcionais). */}
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

/** Tela de revisão: lista cada passo com seu estado + um pulo de volta. */
function Review({ steps, statusOf, onGoto }) {
  return (
    <section className={styles.step}>
      <h2 className={styles.stepTitle}>Review</h2>
      <p className={styles.stepHelp}>Everything in one place. Jump back to change anything.</p>
      <ul className={styles.reviewList}>
        {/* Passos informativos (intro/transições) não têm o que revisar - ficam
            fora da lista, mas o índice original é preservado p/ o "jump back". */}
        {steps
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => statusOf(s) !== 'info')
          .map(({ s, i }) => {
            const st = statusOf(s);
            return (
              <li key={s.id} className={styles.reviewRow}>
                {/* A LINHA INTEIRA é o botão (título, subtítulo E o selo de estado
                    são clicáveis) - o selo sozinho era pouco intuitivo. */}
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
