// =============================================================================
// SourceScreen: a escolha da fonte de dados antes do app (Fases 3 e 4, DDL-0091)
// =============================================================================
// O QUE FAZ
//   Dois casos, decididos por decideBoot (data/setupLink.js):
//     'first': a primeira visita (R1). Explorar com o SRD 5.2 embutido, ou usar
//       os próprios dados (colando o endereço ou o link de configuração).
//     'confirm': o link de configuração traz uma fonte nova (sem fonte ainda, ou
//       diferente da atual). Um toque confirma; a alternativa é o SRD (sem fonte)
//       ou manter a atual (com fonte).
//   O link da MESMA fonte nunca chega aqui (R2).
//
// FUNÇÕES
//   SourceScreen({ pending, onChoose, onDismiss }): a tela.
//   FirstVisit({ onChoose }): a primeira visita, com o passo do endereço.
//   ConfirmLink({ link, current, onChoose, onDismiss }): a confirmação do link.
//
// DECISÕES E ARMADILHAS
//   - O campo aceita o link inteiro (sourceFromInput): no iPhone, o app instalado
//     não abre o link, que vai para o Safari; colar dentro do app resolve.
//   - FirstVisit testa o endereço antes de gravar (resolveSourceInput), mas a
//     falha não bloqueia: "Use anyway" grava a base que o resolve achou, porque
//     um servidor fora do ar agora pode ser o certo depois (liberdade com aviso).
//   - Nenhuma escolha é definitiva: o menu da Home troca a fonte depois.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import base from './UpdatingScreen.module.css';
import styles from './SourceScreen.module.css';
import { describeSource, SRD_SOURCE, SOURCE_PLACEHOLDER } from '../../data/dataSource';
import { resolveSourceInput } from '../../data/setupLink';
import { describeProblem } from '../../data/sourceAddress';

export default function SourceScreen({ pending, onChoose, onDismiss }) {
  return (
    <div className={base.wrap}>
      <div className={base.card}>
        {pending?.action === 'confirm' ? (
          <ConfirmLink link={pending.link} current={pending.current} onChoose={onChoose} onDismiss={onDismiss} />
        ) : (
          <FirstVisit onChoose={onChoose} />
        )}
      </div>
    </div>
  );
}

/** A primeira visita: SRD embutido ou os próprios dados. */
function FirstVisit({ onChoose }) {
  const [step, setStep] = useState('pick');
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setProblem(null);
    const result = await resolveSourceInput(text);
    setChecking(false);
    if (result.ok) onChoose({ kind: 'url', base: result.base });
    else setProblem(result);
  };

  if (step === 'url') {
    return (
      <form onSubmit={submit}>
        <h1 className={base.title}>Your game data</h1>
        <p className={base.subtitle}>
          Paste the setup link you were given, a GitHub repository or release link, or the address of a data folder.
        </p>
        <label className={styles.field}>
          Setup link or data address
          <input
            className={styles.input}
            type="text"
            inputMode="url"
            autoFocus
            value={text}
            placeholder={SOURCE_PLACEHOLDER}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(null);
            }}
          />
        </label>
        {problem ? <p className={styles.error}>{describeProblem(problem)}</p> : null}
        <div className={styles.row}>
          <button type="button" className={styles.ghost} onClick={() => setStep('pick')}>
            Back
          </button>
          {problem?.base ? (
            <button type="button" className={styles.ghost} onClick={() => onChoose({ kind: 'url', base: problem.base })}>
              Use anyway
            </button>
          ) : null}
          <button type="submit" className={base.retry} disabled={checking}>
            {checking ? 'Checking...' : 'Continue'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <h1 className={base.title}>Welcome to FlyBy</h1>
      <p className={base.subtitle}>
        Choose where the game content comes from. You can change it later in the menu.
      </p>
      <div className={styles.options}>
        <button type="button" className={`${styles.option} ${styles.primary}`} onClick={() => onChoose(SRD_SOURCE)}>
          <span className={styles.optionTitle}>Explore with SRD 5.2</span>
          <span className={styles.optionSub}>Built in, free to use, works offline. No download.</span>
        </button>
        <button type="button" className={styles.option} onClick={() => setStep('url')}>
          <span className={styles.optionTitle}>Use my own game data</span>
          <span className={styles.optionSub}>Paste the setup link or data address you were given.</span>
        </button>
      </div>
    </>
  );
}

/** A confirmação do link de configuração. */
function ConfirmLink({ link, current, onChoose, onDismiss }) {
  const switching = !!current;
  return (
    <>
      <h1 className={base.title}>{switching ? 'Switch game data?' : 'Set up game data'}</h1>
      <p className={base.subtitle}>
        {switching ? 'This link switches your game data from ' : 'This link sets FlyBy to read game data from '}
        {switching ? (
          <>
            <span className={styles.source}>{describeSource(current)}</span>
            {' to '}
          </>
        ) : null}
        <span className={styles.source}>{describeSource(link)}</span>. Your characters are not affected.
      </p>
      <div className={styles.options}>
        <button type="button" className={`${styles.option} ${styles.primary}`} onClick={() => onChoose(link)}>
          <span className={styles.optionTitle}>{switching ? 'Switch' : 'Use this source'}</span>
        </button>
        {switching ? (
          <button type="button" className={styles.option} onClick={onDismiss}>
            <span className={styles.optionTitle}>Keep {describeSource(current)}</span>
          </button>
        ) : (
          <button type="button" className={styles.option} onClick={() => onChoose(SRD_SOURCE)}>
            <span className={styles.optionTitle}>Explore with SRD 5.2 instead</span>
          </button>
        )}
      </div>
    </>
  );
}
