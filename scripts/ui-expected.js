// =============================================================================
// ui-expected: o que a tela do jogo DEVE mostrar de cada modelo (U2, docs/UI-TEST-PLAN.md)
// =============================================================================
// O QUE FAZ
//   Para cada personagem modelo do SRD (src/dev/playModels.json), monta o catálogo do
//   jogo pelo motor, sobre o MESMO pacote SRD que o app usa na primeira visita
//   (`srdBundle.json` pelo `prepareDb`), no estado descansado, e grava o esperado em
//   `test-results/ui-data/expected.json`: os ataques da ação Attack (acerto e dano), as
//   features da aba Features, os pools com o máximo e as magias preparadas. O
//   `testing/ui/u2.spec.js` confere a tela contra ele. Roda antes dos testes de
//   interface (o `globalSetup` do playwright.config).
//
// FUNÇÕES
//   expectedFor(character, db): o esperado de um personagem.
//   attackDetail(a, catalog, state): o acerto e o dano de um ataque, pelos números do motor.
//
// DECISÕES E ARMADILHAS
//   - O esperado vem do catálogo (`screenCatalog`, o mesmo do Play.jsx) e dos auxiliares do
//     motor (`fixedRollBonus`, `attackRollContext`), nunca da tela (o princípio do §3 do
//     plano): a U2 prova o caminho do motor até a tela.
//   - Estado descansado (`emptyPlayState`): é como a ficha abre num perfil novo.
//   - O arquivo é gerado a cada rodada e fica fora do git (`test-results/`), numa pasta que
//     o Playwright não limpa (`ui-data`; a `ui` é a saída dele, apagada a cada rodada).
// -----------------------------------------------------------------------------

import fs from 'node:fs';
import bundle from '../src/data/srdBundle.json' with { type: 'json' };
import models from '../src/dev/playModels.json' with { type: 'json' };
import { prepareDb } from '../src/engine/prepareDb.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { screenCatalog } from '../src/engine/playView.js';
import { emptyPlayState } from '../src/engine/playState.js';
import { actionContext } from '../src/engine/playBasicActions.js';
import { fixedRollBonus, attackRollContext } from '../src/engine/playEffects.js';
import { formatBonus } from '../src/engine/math.js';

const OUT = new URL('../test-results/ui-data/expected.json', import.meta.url);

/** O acerto e o dano de um ataque, pelos números do motor. */
function attackDetail(a, catalog, state) {
  const hit = a.toHit ? formatBonus(a.toHit.total + fixedRollBonus(state, catalog, attackRollContext(a, 'attack', catalog))) : null;
  const bonus = a.damage ? (a.damage.bonus ?? 0) + fixedRollBonus(state, catalog, attackRollContext(a, 'damage', catalog)) : 0;
  const damage = !a.damage ? null : a.damage.dice ? `${a.damage.dice}${bonus ? formatBonus(bonus) : ''}` : String(Math.max(0, bonus));
  return { name: a.name, hit, damage };
}

/** O esperado de um personagem. */
function expectedFor(character, db) {
  const state = emptyPlayState();
  const catalog = screenCatalog(derivePlayCatalog(character, db), state);
  const ctx = actionContext(catalog, state);
  return {
    id: character.id,
    attacks: ctx.attacks.map((a) => attackDetail(a, catalog, state)),
    features: [...new Set((catalog.featureList ?? []).map((f) => f.name))],
    pools: (catalog.resources ?? []).filter((r) => r.kind === 'pool' && r.item).map((r) => ({ feature: r.item, max: r.max })),
    spells: [...new Set((catalog.spells ?? []).flatMap((o) => o.spells.filter((s) => s.prepared !== false).map((s) => s.name)))],
  };
}

const db = prepareDb(bundle);
const all = models.map((c) => expectedFor(c, db));
fs.mkdirSync(new URL('.', OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
console.log(`[U2] esperado de ${all.length} modelos em test-results/ui-data/expected.json`);
