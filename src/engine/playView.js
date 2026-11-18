// =============================================================================
// playView: o catálogo da tela do play mode (o catálogo derivado com o estado de jogo aplicado)
// =============================================================================
// O QUE FAZ
//   Uma função só para o que a tela do play mode mostra: a forma atual (Wild Shape), o máximo dos recursos
//   mudado à mão, a arma de pacto, os estados de arma (Shillelagh, Holy Weapon, Tasha's Otherworldly Guise)
//   e a variante do Cleave. O Play.jsx e os roteiros de arquétipo (scripts/archetypes.js) leem a MESMA
//   cadeia, então um teste fora do navegador vê o número que a tela mostra (DDL-0246).
//
// FUNÇÕES
//   screenCatalog(catalog, state, formStats): o catálogo da tela.
//
// DECISÕES E ARMADILHAS
//   - A ordem importa: a forma troca o bloco antes de tudo, o máximo dos recursos vale para o catálogo da
//     forma, a arma de pacto antes dos estados de arma (o Hex Warrior e o Magic Weapon valem na arma de
//     pacto) e o Cleave por último (a variante herda os estados).
//   - `formStats` é o bloco já lido (`formStats` de engine/playForms); sem ele a forma não se aplica (o
//     bestiário ainda carregando), como antes no Play.jsx.
// -----------------------------------------------------------------------------

import { formCatalog } from './playForms';
import { withResourceMax } from './playUse';
import { withPactWeapon } from './playPact';
import { withWeaponStates, withMasteryAttacks } from './playWeapons';

/** O catálogo que a tela mostra: forma, máximo dos recursos, arma de pacto, estados de arma e o Cleave. */
export function screenCatalog(catalog, state, formStats = null) {
  const form = state?.form ?? null;
  const shaped = form && formStats ? formCatalog(catalog, form, formStats) : catalog;
  const sized = withResourceMax(shaped, { resourceMax: state?.resourceMax });
  return withMasteryAttacks(withWeaponStates(withPactWeapon(sized, state?.pactWeapon ?? null), state?.modifiers));
}
