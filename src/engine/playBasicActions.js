// =============================================================================
// playBasicActions: as ações básicas do jogo, com os custos de cada personagem
// =============================================================================
// O QUE FAZ
//   A lista que a aba Actions do play mode mostra (docs/PLAY-MODE-V2-PLAN.md, §3 a
//   §5): as 18 ações do livro de 2024, que o catálogo já traz (`group: 'basic'`,
//   engine/foundryBasicActions), cada uma com TODOS os custos com que este
//   personagem pode tomá-la: o do livro (Dash é Action) e os que uma feature dá (o
//   Cunning Action faz do Dash uma Bonus Action). E, em combate, se cada custo ainda
//   está livre no turno.
//
// FUNÇÕES
//   MAIN_ACTIONS, OTHER_ACTIONS: as 12 ações principais (na ordem do livro) e as 6
//     do grupo "Other".
//   ACTION_SKILLS: as perícias de cada ação com teste (Influence, Study, Search,
//     Hide, Escape a Grapple), as da tabela de cada ação no XPHB.
//   ACTION_MEANS: o que o painel de "como usar" pergunta em cada ação; sem entrada,
//     só o custo (Disengage, Dodge, Help, Don or Doff a Shield, Improvising).
//   ACTION_COSTS: os custos alternativos que só a prosa declara (registro curado).
//     `feature` é o nome da feature no ator (minúsculo); `activity`, o nome da
//     atividade que o custo usa (o gasto vem dela; `*` é qualquer uma); sem
//     `activity`, o custo só marca o turno. `together`: as ações da linha saem
//     JUNTAS num custo só (o Focus); sem ele, é uma OU outra. `source` é o nome que
//     a tela mostra quando não é o da feature; `note`, um aviso curto.
//   lower(s), titleCase(s): o texto minúsculo; "keen mind" vira "Keen Mind" (o nome
//     sem feature no catálogo).
//   costOf(action): o custo do livro, a partir da activation do catálogo.
//   costLabel(cost): "Action", "Bonus Action", "Reaction", "Free", "Varies"...
//   altCostsFor(catalog): os custos alternativos deste personagem, por ação.
//   actionContext(catalog, state, inventory): o que o personagem tem para cada ação
//     (ataques, corpo a corpo, armas leves equipadas, magias preparadas e o tempo
//     delas, itens com carga, pergaminhos, consumíveis, escudo, agarrado, concentração).
//   actionRelevant(name, ctx): a ação tem o que fazer? (só então aparece)
//   basicActionList(catalog, state, ctx): as ações da aba, com custos e o que sobra.
//   costAvailable(cost, state): o custo está livre neste turno?
//
// DECISÕES E ARMADILHAS
//   - Medido em 2026-11-05 (sonda sobre a matriz): só o Cunning Action traz os custos
//     como atividades com o NOME da ação (Dash, Disengage, Hide); esses entram sem
//     registro. O SRD também traz as opções do monge e o Adrenaline Rush do orc como
//     atividades, mas com outros nomes ("Patient Defense (Focus Point)"): o registro
//     aponta para elas, e usar o custo usa a ATIVIDADE, que já gasta o pool certo
//     (Focus, os usos do Adrenaline Rush) pelo motor de features (engine/playUse).
//   - O resto só a prosa diz (Nimble Escape, Fast Hands, Keen Mind, Observant, Boon
//     of Speed, o Dash sem Focus do Step of the Wind): entra pelo nome da feature,
//     sem atividade, e só marca o custo do turno. Cada linha foi conferida no texto
//     do 5etools (XPHB, e MPMM para o Goblin).
//   - `with` (do `together` do registro): a versão com Focus faz DUAS ações de uma
//     vez (Patient Defense: Disengage e Dodge; Step of the Wind: Disengage e Dash); o
//     custo aparece nas duas.
//   - survey-play-catalog confere o registro: feature presente com a atividade citada
//     ausente vira problema (medido em 2026-11-05: 0 problemas, 506 custos nas 961
//     unidades).
//   - Fora do registro, de propósito: Rage of the Wilds (o Dash e o Disengage vêm
//     DENTRO da Bonus Action do Rage, não são um custo à parte) e o Exceptional
//     Training do Beast Master (é o companheiro que age, não o personagem).
//   - O custo `special` do dnd5e vira "Free" (End Concentration) ou "Varies"
//     (Improvising an Action) pelo nome: o dado do livro diz `Free` e `Varies`.
//   - Regra do dono (P4, 2026-11-05): TODA ação só aparece se o personagem tiver o
//     que fazer com ela (actionRelevant). Attack com arma ou desarmado; Magic com
//     magia preparada, item com carga ou pergaminho; Dash e Disengage com
//     deslocamento; Utilize com consumível (poção, comida); Opportunity Attack com
//     ataque corpo a corpo; Two-Weapon Fighting com DUAS armas leves equipadas;
//     Escape a Grapple agarrado; Don or Doff a Shield com escudo; End Concentration
//     concentrando. Dodge, Help, Hide, Influence, Ready, Search, Study e Improvising
//     sempre têm o que fazer.
//   - Magic ganha os custos das magias que o personagem lança (Bonus Action do Misty
//     Step, Reaction do Shield): no livro de 2024 elas não são a ação Magic, mas é
//     por ela que o jogador as procura na aba; o painel lança cada uma no tempo dela.
//   - O pergaminho é Magic (ler um é a ação Magic, playInventory); a poção é Utilize,
//     com o custo dela (Bonus Action).
//   - Disponibilidade só em combate (a economia do turno só existe nele, engine/
//     playCombat). Gasto não bloqueia: a tela avisa e deixa seguir (§6.4 do manual).
// -----------------------------------------------------------------------------

import { ECONOMY } from './playCombat';

export const MAIN_ACTIONS = ['Attack', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Influence', 'Magic', 'Ready', 'Search', 'Study', 'Utilize'];
/** As perícias de cada ação que pede um teste (o texto do XPHB; Hide é Stealth com CD 15). */
export const ACTION_SKILLS = {
  Hide: ['ste'],
  Influence: ['dec', 'itm', 'prf', 'per', 'ani'],
  Search: ['ins', 'med', 'prc', 'sur'],
  Study: ['arc', 'his', 'inv', 'nat', 'rel'],
  'Escape a Grapple': ['ath', 'acr'],
};

/** O que o painel de cada ação pergunta: o ataque, a magia ou o item, a perícia, ou nada. */
export const ACTION_MEANS = {
  Attack: 'attack',
  'Opportunity Attack': 'attack',
  'Two-Weapon Fighting': 'attack',
  Magic: 'magic',
  Utilize: 'item',
  Hide: 'skill',
  Influence: 'skill',
  Search: 'skill',
  Study: 'skill',
  'Escape a Grapple': 'skill',
  Dash: 'dash',
  Ready: 'ready',
  'End Concentration': 'endConcentration',
};

export const OTHER_ACTIONS = ['Opportunity Attack', 'Two-Weapon Fighting', 'Escape a Grapple', 'Don or Doff a Shield', 'End Concentration', 'Improvising an Action'];

/**
 * Os custos alternativos que só a prosa declara (ou cuja atividade tem outro nome).
 * @type {Array<{ feature: string, activity?: string, actions: string[], cost: string, together?: boolean, source?: string, note?: string }>}
 */
export const ACTION_COSTS = [
  { feature: "monk's focus", activity: 'patient defense', actions: ['Disengage'], cost: 'bonus' },
  { feature: "monk's focus", activity: 'patient defense (focus point)', actions: ['Disengage', 'Dodge'], cost: 'bonus', together: true },
  { feature: "monk's focus", actions: ['Dash'], cost: 'bonus', source: 'Step of the Wind' },
  { feature: "monk's focus", activity: 'step of the wind', actions: ['Disengage', 'Dash'], cost: 'bonus', together: true },
  { feature: 'adrenaline rush', activity: '*', actions: ['Dash'], cost: 'bonus' },
  { feature: 'nimble escape', actions: ['Disengage', 'Hide'], cost: 'bonus' },
  { feature: 'fast hands', actions: ['Utilize'], cost: 'bonus' },
  { feature: 'fast hands', actions: ['Magic'], cost: 'bonus', note: 'a magic item only' },
  { feature: 'keen mind', actions: ['Study'], cost: 'bonus' },
  { feature: 'observant', actions: ['Search'], cost: 'bonus' },
  { feature: 'boon of speed', actions: ['Disengage'], cost: 'bonus' },
];

const LABELS = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', free: 'Free', varies: 'Varies', minute: 'Minute', hour: 'Hour' };
const lower = (s) => String(s ?? '').toLowerCase();
const titleCase = (s) => s.split(' ').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/** O custo do livro de uma ação básica do catálogo. */
export function costOf(action) {
  const type = action?.activities?.[0]?.activation?.type ?? null;
  if (type !== 'special') return type;
  return lower(action.name) === 'end concentration' ? 'free' : 'varies';
}

/** "Action", "Bonus Action", "Reaction"... */
export function costLabel(cost) {
  return LABELS[cost] ?? (cost ? cost[0].toUpperCase() + cost.slice(1) : 'Varies');
}

/**
 * Os custos alternativos deste personagem, por nome de ação.
 * @returns {Map<string, Array<{ cost: string, source: string, via: { action: string, activity: string } | null, with: string[], note: string | null }>>}
 */
export function altCostsFor(catalog) {
  const out = new Map();
  const add = (name, entry) => {
    const list = out.get(name) ?? [];
    if (!list.some((x) => x.cost === entry.cost && x.source === entry.source && x.via?.activity === entry.via?.activity)) list.push(entry);
    out.set(name, list);
  };
  const basicNames = new Set((catalog?.actions ?? []).filter((a) => a.group === 'basic').map((a) => a.name));
  const features = new Set((catalog?.features ?? []).map(lower));
  for (const a of catalog?.actions ?? []) {
    if (a.group === 'basic') continue;
    for (const x of a.activities) {
      if (!basicNames.has(x.name) || !x.activation?.type) continue;
      add(x.name, { cost: x.activation.type, source: a.name, via: { action: a.key, activity: x.id }, with: [], note: null });
    }
  }
  for (const r of ACTION_COSTS) {
    if (!features.has(r.feature)) continue;
    const owner = (catalog?.actions ?? []).find((a) => lower(a.name) === r.feature);
    const act = r.activity ? owner?.activities.find((x) => r.activity === '*' || lower(x.name) === r.activity) : null;
    if (r.activity && !act) continue;
    const via = act ? { action: owner.key, activity: act.id } : null;
    const source = r.source ?? act?.name ?? owner?.name ?? titleCase(r.feature);
    for (const name of r.actions) add(name, { cost: r.cost, source, via, with: r.together ? r.actions.filter((n) => n !== name) : [], note: r.note ?? null });
  }
  return out;
}

/** O custo está livre neste turno? (fora de combate, sempre) */
export function costAvailable(cost, state) {
  if (!state?.combat || !ECONOMY.includes(cost)) return true;
  return !state.combat.used?.[cost];
}

/**
 * O que o personagem tem para fazer com cada ação: ataques, magias, itens, condições.
 * @param {object} catalog
 * @param {object} state
 * @param {object[]} [inventory] o inventário derivado
 */
export function actionContext(catalog, state, inventory = []) {
  const attacks = (catalog?.attacks ?? []).filter((a) => a.kind === 'weapon' || a.kind === 'unarmed');
  const spells = (catalog?.spells ?? []).flatMap((o) => o.spells.filter((s) => s.prepared !== false).map((s) => ({ origin: o, spell: s })));
  const items = (inventory ?? []).filter((e) => e?.raw);
  const typeOf = (e) => String(e.raw.type ?? '').split('|')[0];
  return {
    attacks,
    melee: attacks.filter((a) => a.range === 'melee'),
    light: attacks.filter((a) => a.kind === 'weapon' && a.equipped && (a.properties ?? []).includes('L')),
    spells,
    spellCosts: new Set(spells.map(({ spell }) => spell.time).filter((t) => ECONOMY.includes(t))),
    charged: (catalog?.resources ?? []).filter((r) => r.kind === 'charges'),
    scrolls: items.filter((e) => typeOf(e) === 'SC'),
    usable: items.filter((e) => ['P', 'FD'].includes(typeOf(e))),
    shield: items.some((e) => typeOf(e) === 'S'),
    grappled: !!state?.conditions?.grappled,
    concentrating: !!state?.concentration,
    speed: catalog?.stats?.speed ?? 0,
  };
}

/** A ação tem o que fazer para ESTE personagem agora? (só então ela aparece) */
export function actionRelevant(name, ctx) {
  switch (name) {
    case 'Attack': return ctx.attacks.length > 0;
    case 'Magic': return ctx.spells.length > 0 || ctx.charged.length > 0 || ctx.scrolls.length > 0;
    case 'Dash': case 'Disengage': return ctx.speed > 0;
    case 'Utilize': return ctx.usable.length > 0;
    case 'Opportunity Attack': return ctx.melee.length > 0;
    case 'Two-Weapon Fighting': return ctx.light.length >= 2;
    case 'Escape a Grapple': return ctx.grappled;
    case 'Don or Doff a Shield': return ctx.shield;
    case 'End Concentration': return ctx.concentrating;
    default: return true;
  }
}

/**
 * As ações da aba Actions, na ordem do livro, só as que têm o que fazer, com os custos.
 * @param {object} catalog o catálogo de jogo (derivePlayCatalog)
 * @param {object} state o estado de jogo
 * @param {ReturnType<typeof actionContext>} [ctx] o que o personagem tem (actionContext)
 */
export function basicActionList(catalog, state, ctx = actionContext(catalog, state)) {
  const byName = new Map((catalog?.actions ?? []).filter((a) => a.group === 'basic').map((a) => [a.name, a]));
  const alts = altCostsFor(catalog);
  const build = (name, group) => {
    const action = byName.get(name);
    if (!action || !actionRelevant(name, ctx)) return null;
    const base = { cost: costOf(action), source: null, via: null, with: [], note: null };
    const extra = name === 'Magic' ? ['bonus', 'reaction'].filter((c) => ctx.spellCosts.has(c)).map((cost) => ({ cost, source: 'a spell', via: null, with: [], note: null })) : [];
    const costs = [base, ...extra, ...(alts.get(name) ?? [])].map((c) => ({ ...c, label: costLabel(c.cost), available: costAvailable(c.cost, state) }));
    return { key: action.key, name, group, action, costs, available: costs.some((c) => c.available) };
  };
  return [...MAIN_ACTIONS.map((n) => build(n, 'main')), ...OTHER_ACTIONS.map((n) => build(n, 'other'))].filter(Boolean);
}
