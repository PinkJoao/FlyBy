// =============================================================================
// UpdateToast: o aviso de que uma versão nova do app está pronta
// =============================================================================
// O QUE FAZ
//   Lê o estado de src/appUpdate.js e, quando a versão nova assumiu, mostra no
//   topo da tela "A new version of FlyBy is ready" com Reload e um X que adia.
//
// FUNÇÕES
//   UpdateToast(): o aviso (nada quando não há versão nova ou foi dispensado).
//
// DECISÕES E ARMADILHAS
//   - Montado pelo main, FORA do App: o App troca a tela inteira enquanto checa
//     ou baixa os dados (UpdatingScreen) e o aviso tem de valer em qualquer tela.
//   - No topo, não na base: no play mode a base do celular é dos comandos do
//     combate (CombatControls), que um aviso cobriria no pior momento.
//   - Não é camada (sem useBackLayer): não bloqueia nada, e o voltar do celular
//     segue com a tela de baixo.
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from 'react';
import { subscribeUpdate, getUpdateState, applyUpdate, dismissUpdate } from '../../appUpdate';
import Button from './Button';
import CloseButton from './CloseButton';
import styles from './UpdateToast.module.css';

/** O aviso de versão nova, com Reload e adiar. */
export default function UpdateToast() {
  const { ready, dismissed } = useSyncExternalStore(subscribeUpdate, getUpdateState);
  if (!ready || dismissed) return null;
  return (
    <div className={`${styles.toast} motion-pop`} role="status">
      <span className={styles.text}>A new version of FlyBy is ready.</span>
      <Button variant="primary" size="sm" onClick={() => applyUpdate()}>
        Reload
      </Button>
      <CloseButton onClick={dismissUpdate} label="Not now" />
    </div>
  );
}
