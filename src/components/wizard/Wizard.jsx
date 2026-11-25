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
//   sectionsOf(steps): as partes fixas (o `section` de cada passo) na ordem em que aparecem,
//     cada uma com os índices dos seus passos (uma parte pode voltar mais tarde: a subclasse
//     é da parte Class e vem depois da espécie, DDL-0313).
//   Review(props): a revisão; a LINHA inteira é o botão de voltar ao passo, e os
//     passos informativos ficam fora da lista (o índice original é preservado).
//
// DECISÕES E ARMADILHAS
//   - Na CRIAÇÃO o Avançar NUNCA trava e há Revisão; no fixup e no level-up não há
//     Revisão e um passo obrigatório vazio trava o Avançar.
//   - Skip só em passos OPCIONAIS (biografia, nome, alinhamento), ANTES do botão principal,
//     que fica sempre por último, à direita, como em todo rodapé do app (DDL-0301). Sem passos, nada
//     a guiar.
//   - Cada passo além do primeiro é uma entrada no histórico (useBackDepth): o
//     voltar do celular volta um passo; no primeiro, sai do guia como antes.
//   - Páginas (DDL-0289, guidePages.js): a etapa diz quantas tem (a introdução e a
//     escolha); Next anda uma página antes de ir à próxima etapa e só trava na última,
//     Back volta uma página, e voltar de uma etapa abre a anterior na última página. A
//     barra de progresso conta etapas, não páginas.
//   - O topo diz a ETAPA (o subtitle: "Class"), não o nome do guia ("New Character",
//     que fica no tooltip), e o título grande só aparece na primeira página da etapa,
//     centrado com o enfeite: nas seguintes a escolha ganha a altura (DDL-0290). O kicker
//     saiu (DDL-0291): repetia o nome que o topo já mostra, agora em destaque.
//   - Trocar de etapa volta a contagem de páginas a 1 (DDL-0292): a etapa paginada a
//     registra de novo ao montar; sem isso a etapa de uma página só herdava as 2 da
//     anterior, e ao voltar a ela (página "última") o título sumia.
//   - A barra conta PARTES fixas (Class, Species, Background, Abilities, Gear, Story,
//     Class choices; SECTION_OF em engine/wizardSteps), um segmento cada, que enche passo a
//     passo: o total não muda quando uma escolha acrescenta passos (antes "2 de 11" virava
//     "3 de 13" e "de 16" no caminho, DDL-0302). Guias sem partes (o level-up) seguem com
//     "Step N of M" (DDL-0306). A parte que acaba de se completar brilha uma vez (a key muda
//     com o estado e a animação roda ao montar; DDL-0309).
//   - Passo obrigatório vazio: o próprio botão principal, desabilitado, diz o que falta
//     (`need` do passo: "Choose your proficiencies"), no lugar da nota "Make this choice
//     to continue" embaixo do rodapé (DDL-0306).
//   - Um botão principal só: a etapa pode trocar o rótulo e a ação dele ("Choose
//     Fighter" escolhe e avança); sem troca, é o Next. Não há botão de escolher acima
//     do rodapé.
//   - No celular, arrastar o passo para o lado anda como o Back e o Next (useSwipeNav,
//     DDL-0309); o carrossel de classe e espécie tem gesto próprio (data-own-swipe) e
//     ganha, e um passo obrigatório vazio não deixa arrastar para a frente.
//   - O passo é remontado por `key` e entra deslizando na direção da navegação
//     (motion.js): avançar vem da direita, voltar (botão, revisão ou gesto) da
//     esquerda. A key também zera o estado local de um passo ao trocar.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { GuideContext } from './guidePages';
import { useBackDepth } from '../../hooks/useBack';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import { directionOf, slideClass } from '../../motion';
import styles from './Wizard.module.css';
import Icon from '../common/Icon';
import Tag from '../common/Tag';
import Button from '../common/Button';

const STATUS_LABEL = { complete: 'Done', incomplete: 'Needs a choice', optional: 'Optional', info: 'Info' };
const STATUS_TONE = { complete: 'success', incomplete: 'warning', optional: 'neutral', info: 'info' };

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
  const [dir, setDir] = useState(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [primary, setPrimary] = useState(null);
  const navRef = useRef(null);
  const swipeRef = useRef(null);
  const guide = useMemo(
    () => ({
      page,
      setPages,
      setPrimary,
      nav: { next: (opts) => navRef.current?.next(opts), page: (n) => navRef.current?.page(n) },
    }),
    [page],
  );
  const lastIndex = steps?.length ? (showReview ? steps.length : steps.length - 1) : 0;
  useBackDepth(Math.min(index, lastIndex), () => {
    setDir('prev');
    setPage(Number.MAX_SAFE_INTEGER);
    setPages(1);
    setIndex((i) => Math.max(0, Math.min(i, lastIndex) - 1));
  });
  const list = steps ?? [];
  const total = list.length;
  const maxIndex = showReview ? total : total - 1;
  const clamped = Math.min(index, maxIndex);
  const onReview = showReview && clamped >= total;
  const step = onReview ? null : list[clamped] ?? null;
  const isLast = clamped === total - 1;
  const progress = Math.min(clamped, total) / total;
  const parts = sectionsOf(list);
  const partAt = onReview ? parts.length : parts.findIndex((p) => p.idx.includes(clamped));
  const partDone = (p) => onReview || p.idx.every((i) => i < clamped);
  const partFill = (p) => (onReview ? 1 : p.idx.filter((i) => i <= clamped).length / p.idx.length);

  const curPage = Math.max(0, Math.min(page, pages - 1));
  const lastPage = curPage >= pages - 1;

  const goto = (i) => {
    const next = Math.max(0, Math.min(maxIndex, i));
    setDir(directionOf(clamped, next));
    setPage(next < clamped ? Number.MAX_SAFE_INTEGER : 0);
    setPages(1);
    setIndex(next);
  };
  const toPage = (n) => {
    setDir(n < curPage ? 'prev' : 'next');
    setPage(n);
  };
  const back = () => {
    if (!onReview && curPage > 0) return toPage(curPage - 1);
    return clamped === 0 ? onExit?.() : goto(clamped - 1);
  };

  const statusOf = (s) => s.status?.(character, derived) ?? 'optional';
  const pending = list.filter((s) => statusOf(s) === 'incomplete');
  const stepStatus = step ? statusOf(step) : null;
  const canSkip = !onReview && stepStatus === 'optional';
  const blocked = blockIncomplete && !onReview && stepStatus === 'incomplete';

  const advance = () => (!showReview && isLast ? onFinish?.() : goto(clamped + 1));
  const next = ({ force = false } = {}) => {
    if (!lastPage) return toPage(curPage + 1);
    if (blocked && !force) return undefined;
    return advance();
  };
  useEffect(() => {
    navRef.current = { next, page: toPage };
  });
  const primaryLabel = !lastPage ? 'Next' : onReview ? 'Finish' : isLast ? (showReview ? 'Review' : 'Done') : 'Next';
  const stepAction = !onReview && primary ? primary : null;
  const nextBlocked = blocked && lastPage && !stepAction;

  useSwipeNav(swipeRef, {
    onPrev: () => back(),
    onNext: () => next(),
    canPrev: !onReview || total > 0,
    canNext: !onReview && !nextBlocked && !stepAction,
  });

  if (total === 0) return null;

  return (
    <GuideContext.Provider value={guide}>
    <div className={styles.wizard}>
      <header className={styles.head}>
        <div className={styles.progressWrap}>
          <span className={styles.title} title={title || undefined}>{onReview ? 'Review' : step?.subtitle ?? title}</span>
          {parts.length > 0 ? (
            <>
              <div className={styles.parts} role="presentation">
                {parts.map((p) => (
                  <span key={`${p.name}-${partDone(p) ? 'done' : 'open'}`} className={partDone(p) ? `${styles.part} ${styles.partDone}` : styles.part} title={p.name}>
                    <span
                      className={styles.partFill}
                      style={{ width: `${partFill(p) * 100}%` }}
                    />
                  </span>
                ))}
              </div>
              <span className={styles.progressText}>
                {onReview ? 'Review' : partAt < 0 ? 'Before you start' : `Part ${partAt + 1} of ${parts.length}: ${parts[partAt].name}`}
              </span>
            </>
          ) : (
            <>
              <div className={styles.progressBar} role="presentation">
                <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
              </div>
              <span className={styles.progressText}>
                {onReview ? 'Review' : `Step ${clamped + 1} of ${total}`}
              </span>
            </>
          )}
        </div>
        {onExit && (
          <Button icon onClick={onExit} aria-label="Exit guide">
            <Icon name="close" />
          </Button>
        )}
      </header>

      <main ref={swipeRef} className={styles.body}>
        {onReview ? (
          <div key="review" className={slideClass(dir)}>
            <Review steps={steps} statusOf={statusOf} onGoto={goto} />
          </div>
        ) : (
          <section key={clamped} className={`${styles.step} ${curPage > 0 ? styles.stepBare : ''} ${slideClass(dir)}`}>
            {curPage === 0 && step.icon && (
              <span className={styles.stepIcon} aria-hidden="true">
                <Icon name={step.icon} />
              </span>
            )}
            {curPage === 0 && <h2 className={`${styles.stepTitle} ornate-rule ornate-rule-center`}>{step.title}</h2>}
            {curPage === 0 && step.lead && <p className={styles.stepLead}>{step.lead}</p>}

            <div key={curPage} className={`${styles.stepBody} ${curPage || dir === 'prev' ? slideClass(dir) : ''}`}>
              {renderStep?.(step, { character, derived, db, onChange }) ?? (
                <div className={styles.placeholder}>
                  <p>This step’s screen arrives in a later phase.</p>
                  <Tag tone={STATUS_TONE[statusOf(step)]}>{STATUS_LABEL[statusOf(step)]}</Tag>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className={styles.foot}>
        <Button size="lg" onClick={back}>Back</Button>
        {onReview ? (
          <Button size="lg" variant="primary" onPage className={styles.primaryBtn} onClick={onFinish}>Finish</Button>
        ) : (
          <>
            {canSkip && (
              <Button size="lg" onClick={advance}>Skip</Button>
            )}
            <Button
              size="lg"
              variant="primary"
              onPage
              className={styles.primaryBtn}
              onClick={stepAction ? stepAction.run : () => next()}
              disabled={nextBlocked}
            >
              {stepAction ? stepAction.label : nextBlocked ? step.need ?? 'Make this choice first' : primaryLabel}
            </Button>
          </>
        )}
      </footer>

      {onReview && pending.length > 0 && (
        <p className={styles.footNote}>
          {pending.length} step{pending.length > 1 ? 's' : ''} still {pending.length > 1 ? 'need' : 'needs'} a choice -
          you can finish anyway and fill them in on the sheet.
        </p>
      )}
    </div>
    </GuideContext.Provider>
  );
}

/** As partes fixas dos passos (`section`), na ordem, com o primeiro índice e quantos passos cada uma tem. */
function sectionsOf(steps) {
  const out = [];
  steps.forEach((s, i) => {
    if (!s.section) return;
    const part = out.find((p) => p.name === s.section);
    if (part) part.idx.push(i);
    else out.push({ name: s.section, idx: [i] });
  });
  return out;
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
                  <Tag tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Tag>
                </button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
