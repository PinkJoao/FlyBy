// =============================================================================
// IntroStep - tela de boas-vindas do wizard (Fase D2, informativa)
// =============================================================================
// Primeiro passo: prepara o jogador e tira a pressão - nada aqui é permanente,
// tudo pode ser mudado depois na ficha. Sem entrada (status 'info': sem Skip, fora
// da Revisão).
// -----------------------------------------------------------------------------

import styles from './steps.module.css';

export default function IntroStep() {
  return (
    <div className={styles.step}>
      <div className={styles.introBlock}>
        <span className={styles.introEmoji}>🎲</span>
        <p className={styles.introText}>
          We'll build your character together, one step at a time, choosing a class, species,
          background, ability scores, gear and a bit of personality.
        </p>
        <p className={styles.introText}>
          <strong>Nothing here is set in stone.</strong> Every choice you make can be changed later
          on the character sheet, so relax and experiment. You can't get it wrong.
        </p>
        <p className={styles.introText}>When you're ready, hit Next to begin.</p>
      </div>
    </div>
  );
}
