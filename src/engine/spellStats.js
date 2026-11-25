// =============================================================================
// spellStats: os números do topo do grimório e do que cada um é feito
// =============================================================================
// O QUE FAZ
//   Lê uma origem de conjuração derivada (resolve.deriveSpellcasting) e devolve, sem
//   texto nem tela: a CD e o ataque com as parcelas, os limites (truques, preparadas,
//   grimório, arcanum) e os espaços por círculo. A faixa do grimório, a janela de
//   explicação, a dos espaços e as gemas dos grupos leem daqui (DDL-0320, DDL-0321).
//
// FUNÇÕES
//   spellNumbers(origin, profBonus): a CD e o ataque `{ key, value, parts }`.
//   spellLimits(origin): os contadores `{ key, have, max, over, missing }`.
//   slotSummary(origin): `{ levels, total, pact, arcana }`.
//   slotsAt(origin, level): os espaços que aparecem no grupo de um círculo.
//   spellTimes(origin): as magias concedidas que têm uso próprio, sem gastar espaço.
//
// DECISÕES E ARMADILHAS
//   - As parcelas SOMAM o valor mostrado: o que a base, a proficiência e o atributo não
//     explicam é dos itens (itemSpellBonuses), com o nome deles quando a origem o diz.
//   - O "grimório" é um PISO (o mago pode copiar mais): `over` nunca acende nele.
//   - O pacto aparece nos grupos até o círculo dele (a magia de 1o círculo do bruxo
//     também o gasta), como no modo de jogo (playCast.slotPoolsFor).
// -----------------------------------------------------------------------------

/** A CD e o ataque de magia, com as parcelas. */
export function spellNumbers(origin, profBonus) {
  if (!origin?.ability) return [];
  const mod = origin.abilityMod ?? 0;
  const pb = profBonus ?? 0;
  const items = (kind) => (origin.itemBonuses ?? []).filter((b) => b[kind]).map((b) => b.source);
  const build = (key, kind, value, base) => {
    const parts = [...base, { key: 'prof', value: pb }, { key: origin.ability, value: mod }];
    const rest = value - parts.reduce((sum, p) => sum + p.value, 0);
    if (rest) parts.push({ key: 'items', value: rest, sources: items(kind) });
    return { key, value, parts };
  };
  const out = [];
  if (origin.saveDc != null) out.push(build('dc', 'dc', origin.saveDc, [{ key: 'base', value: 8 }]));
  if (origin.attackBonus != null) out.push(build('atk', 'attack', origin.attackBonus, []));
  return out;
}

/** Os contadores de uma origem: o que tem, o máximo, se passou e se falta. */
export function spellLimits(origin) {
  if (!origin) return [];
  const out = [];
  const add = (key, have, max, floor = false) => out.push({ key, have, max, over: !floor && have > max, missing: have < max });
  const cantrips = origin.cantrips?.length ?? 0;
  const prepared = origin.prepared?.length ?? 0;
  if (origin.cantripLimit > 0 || cantrips > 0) add('cantrips', cantrips, origin.cantripLimit ?? 0);
  if (origin.prepareLimit > 0 || prepared > 0) add('prepared', prepared, origin.prepareLimit ?? 0);
  if (origin.knownLimit != null) {
    const known = [...(origin.prepared ?? []), ...(origin.unprepared ?? [])].filter((s) => !s.free).length;
    add('known', known, origin.knownLimit, true);
  }
  const arcana = origin.arcana ?? [];
  if (arcana.length > 0) add('arcana', arcana.filter((a) => a.spell).length, arcana.length);
  return out;
}

/** Os espaços de uma origem: por círculo, o total, o pacto e o arcanum. */
export function slotSummary(origin) {
  const levels = Object.entries(origin?.slots ?? {})
    .map(([level, count]) => ({ level: Number(level), count }))
    .filter((l) => l.count > 0)
    .sort((a, b) => a.level - b.level);
  const pact = origin?.pactSlots?.slots ? { level: origin.pactSlots.level, count: origin.pactSlots.slots } : null;
  return { levels, total: levels.reduce((n, l) => n + l.count, 0), pact, arcana: origin?.arcana ?? [] };
}

/** Os espaços do grupo de um círculo: os do círculo, o pacto e o arcanum. */
export function slotsAt(origin, level) {
  if (!level) return [];
  const { levels, pact, arcana } = slotSummary(origin);
  const out = [];
  const own = levels.find((l) => l.level === level);
  if (own) out.push({ kind: 'slot', level, count: own.count });
  if (pact && level <= pact.level) out.push({ kind: 'pact', level: pact.level, count: pact.count });
  if (arcana.some((a) => a.level === level)) out.push({ kind: 'arcanum', level, count: 1 });
  return out;
}

/** As magias com uso próprio (concedidas), sem gastar espaço. */
export function spellTimes(origin) {
  return (origin?.uses ?? []).map((u) => ({ name: u.name, label: u.label, note: u.note ?? null }));
}
