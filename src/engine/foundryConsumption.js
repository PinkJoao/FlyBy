// =============================================================================
// foundryConsumption: os alvos de consumo das activities, ligados ao item certo
// =============================================================================
// O QUE FAZ
//   Uma activity do Foundry gasta usos de um item pelo `consumption.targets`. O
//   alvo chega de quatro fontes em quatro formas: vazio (o próprio item), o `_id`
//   de um item do ator, `feat:<identifier>` (o SRD e o nosso registro curado), um
//   uuid de compêndio (o SRD) e um OBJETO cru do overlay (`{ prop, uid }`,
//   `{ consumes: { name } }`). Este módulo acha o item de cada forma e, no export,
//   reescreve o alvo para o `_id` do item no ator.
//
// FUNÇÕES
//   norm(s), slug(s), identOf(item): nome sem caixa, slug e o identifier do item.
//   consumptionTargetItem(target, item, items): o item que o alvo aponta, ou null.
//   linkConsumptionTargets(items): reescreve os alvos de todas as activities do
//     ator (troca o `system` de cada item por uma cópia) e devolve quantos não
//     resolveram.
//
// DECISÕES E ARMADILHAS
//   - O alvo exportado é o `_id` (T2d, 2026-11-08): o Foundry real NÃO resolve o
//     objeto do overlay (59 activities mortas no lote do sweep, TC-0097), e o
//     `feat:<identifier>` só se resolve se o identifier bater exatamente (o nosso
//     Channel Divinity era `channel-divinity` e o SRD aponta
//     `channel-divinity-paladin`). O `_id` vale em toda versão do dnd5e que tem
//     activities, e o import mantém os ids (`keepId`).
//   - `feat:<identifier>` sem item exato cai no identifier que é PREFIXO do outro,
//     nos dois sentidos (`channel-divinity-paladin` e `channel-divinity`), o mais
//     longo primeiro.
//   - CONSUMES_BY_NAME: o nome que o overlay põe em `consumes` é o do RECURSO, não
//     o da feature ("Sorcery Point" é o pool do Font of Magic). Confira contra o
//     survey do catálogo.
//   - `activityUses` numa activity SEM usos própria não gasta nada no Foundry: se
//     o item tem usos, o alvo vira o pool do item (o "Recharge with Psionic
//     Energy" do Bulwark of Force devolve o uso do item); se não tem, sai.
//   - Feature que gasta o PRÓPRIO item sem ter `uses` deixa o botão MORTO (o
//     Foundry recusa o uso, medido no Aspect of the Wilds): o alvo sai, como no
//     War Bond (TC-0094). Só em feat: consumível e arma gastam quantidade.
//   - NUNCA muta a activity recebida: as do SRD saem do registro gerado por
//     REFERÊNCIA, e a primeira versão gravou o `_id` do primeiro Paladino no
//     registro, que os atores seguintes herdavam (alvo para item inexistente,
//     visto no Foundry). Cada activity alterada é uma cópia, e o `system` do item
//     também.
//   - Alvo que não resolve fica como veio (carga, nunca perda silenciosa); a
//     contagem devolvida é a rede dos testes.
// -----------------------------------------------------------------------------

const CONSUMES_BY_NAME = {
  'focus point': "Monk's Focus",
  'sorcery point': 'Font of Magic',
  'superiority die': 'Combat Superiority',
};

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const identOf = (i) => i?.system?.identifier || slug(i?.name);

/**
 * O item que um alvo de consumo aponta, ou null.
 * @param {unknown} target
 * @param {object} item  o item dono da activity (alvo vazio)
 * @param {object[]} items  os itens do ator
 * @returns {object|null}
 */
export function consumptionTargetItem(target, item, items) {
  if (!target) return item ?? null;
  const list = items ?? [];
  if (typeof target === 'object') {
    const name = target.uid
      ? String(target.uid).split('|')[0]
      : CONSUMES_BY_NAME[norm(target.consumes?.name)] ?? target.consumes?.name;
    return list.find((i) => i.type === 'feat' && norm(i.name) === norm(name)) ?? null;
  }
  const t = String(target);
  const byId = list.find((i) => i._id === t);
  if (byId) return byId;
  if (t.startsWith('Compendium.')) return list.find((i) => i._stats?.compendiumSource === t) ?? null;
  const colon = t.indexOf(':');
  if (colon > 0) {
    const type = t.slice(0, colon);
    const wanted = t.slice(colon + 1);
    const pool = list.filter((i) => i.type === type);
    const exact = pool.find((i) => identOf(i) === wanted);
    if (exact) return exact;
    return pool
      .filter((i) => wanted.startsWith(`${identOf(i)}-`) || identOf(i).startsWith(`${wanted}-`))
      .sort((a, b) => identOf(b).length - identOf(a).length)[0] ?? null;
  }
  return null;
}

/**
 * Liga os alvos de consumo de todas as activities ao `_id` do item no ator.
 * @param {object[]} items
 * @returns {number} quantos alvos não resolveram
 */
export function linkConsumptionTargets(items) {
  let unresolved = 0;
  for (const item of items ?? []) {
    const acts = item.system?.activities;
    if (!acts || !Object.keys(acts).length) continue;
    const next = {};
    for (const [key, act] of Object.entries(acts)) {
      next[key] = act;
      const targets = act?.consumption?.targets;
      if (!Array.isArray(targets) || !targets.length) continue;
      const out = [];
      for (const t of targets) {
        if (t?.type === 'activityUses' && !act.uses?.max) {
          if (item.system?.uses?.max) out.push({ ...t, type: 'itemUses', target: '' });
          continue;
        }
        if (t?.type !== 'itemUses' && t?.type !== 'material') {
          out.push(t);
          continue;
        }
        if (!t.target) {
          if (t.type === 'itemUses' && item.type === 'feat' && !item.system?.uses?.max) continue;
          out.push(t);
          continue;
        }
        const found = consumptionTargetItem(t.target, item, items);
        if (!found) {
          unresolved += 1;
          out.push(t);
          continue;
        }
        if (t.type === 'itemUses' && found === item && item.type === 'feat' && !item.system?.uses?.max) continue;
        out.push({ ...t, target: found === item && t.type === 'itemUses' ? '' : found._id });
      }
      next[key] = { ...act, consumption: { ...act.consumption, targets: out } };
    }
    item.system = { ...item.system, activities: next };
  }
  return unresolved;
}
