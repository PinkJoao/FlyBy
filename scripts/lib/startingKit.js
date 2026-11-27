// =============================================================================
// startingKit: o kit inicial da classe num personagem montado por script
// =============================================================================
// O QUE FAZ
//   Dá a um personagem do `autoBuild` o kit inicial da classe original, como o guia de criação
//   faria: a primeira opção que não é só ouro, com as escolhas do kit sorteadas entre os itens do
//   SRD, o inventário, as moedas e a marca `meta.startingKit` (o passo Gear up completo).
//
// FUNÇÕES
//   withStartingKit(db, c, rng, problems): o kit inicial da classe, com as escolhas do SRD.
//
// DECISÕES E ARMADILHAS
//   - Usado pelos personagens modelo (scripts/play-models.js, DDL-0219) e pela amostra da U3
//     (scripts/ui-u3-sample.js): o mesmo kit nos dois.
//   - Armadura e arma nascem equipadas (startingKitInventory).
// -----------------------------------------------------------------------------

import { resolveClassObj } from '../../src/engine/resolve.js';
import { parseStartingEquipment, isGoldOnlyOption, kitChooseAllows, startingKitInventory, startingKitCurrency } from '../../src/engine/startingEquipment.js';
import itemEntity from '../../src/selector/entities/item.js';

/** O kit inicial da classe (a primeira opção que não é só ouro), com as escolhas do SRD. */
export function withStartingKit(db, c, rng, problems) {
  const classObj = resolveClassObj(db, c.classes[0].classId, c.classes[0].source);
  const option = parseStartingEquipment(db, classObj).find((o) => !isGoldOnlyOption(o));
  if (!option) {
    problems.push({ where: 'builder', message: 'no starting kit' });
    return;
  }
  const items = itemEntity.list(db).filter((r) => r.srd52 || r.srd);
  const picks = {};
  (option.chooses ?? []).forEach((ch, i) => {
    const allowed = items.filter((r) => kitChooseAllows(ch, r));
    const chosen = [];
    while (chosen.length < ch.quantity && allowed.length) chosen.push(allowed.splice(Math.floor(rng() * allowed.length), 1)[0]);
    if (chosen.length < ch.quantity) problems.push({ where: 'builder', message: `kit: nothing to pick for ${ch.label ?? ch.type}` });
    picks[i] = chosen.map((r) => `${r.name}|${r.source}`);
  });
  c.inventory = startingKitInventory(option, db, picks);
  c.currency = startingKitCurrency(option);
  c.meta = { ...c.meta, startingKit: option.key, startingKitPicks: picks };
}
