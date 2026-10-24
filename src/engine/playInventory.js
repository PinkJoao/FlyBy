// =============================================================================
// playInventory: o inventário e o dinheiro em jogo
// =============================================================================
// O QUE FAZ
//   Gastar e ganhar no play mode muda o inventário e as moedas DO PERSONAGEM
//   (DDL-0108, pergunta 3), por operações `inventory` e `currency` que guardam o
//   antes e o depois (engine/playState): beber uma poção, ler um pergaminho, a
//   flecha de um ataque, a estalagem paga, o tesouro achado. Também lê do item o
//   que o uso faz (a cura da poção) e as cargas de uma varinha (que o catálogo vira
//   recurso).
//
// FUNÇÕES
//   typeCode(raw): o código do tipo do item ("P" de "P|XPHB").
//   isUsable(raw): o item se GASTA ao usar (poção, pergaminho, comida)?
//   itemCostOf(raw): o custo do turno de usar o item (poção: bônus; pergaminho: ação).
//   healOf(raw): a fórmula de cura do texto de uma poção, ou null.
//   rawEntry(character, uid): a entrada crua do inventário (o "antes" da operação).
//   quantityOp(character, uid, delta): a operação de mudar a quantidade (zero tira).
//   ammoEntry(character, derivedInventory, attack): a munição da arma, ou null.
//   itemUseEvent(args): usar um item que se gasta (e curar, na poção).
//   quantityEvent(args): mudar a quantidade à mão.
//   ammoOps(args): o gasto de 1 munição num ataque, com o aviso se não há.
//   currencyEvent(args): gastar ou ganhar moedas.
//   chargeResources(derivedInventory): as cargas dos itens, como recursos.
//
// DECISÕES E ARMADILHAS
//   - A operação guarda a entrada CRUA do personagem (`character.inventory`), não a
//     derivada: é ela que o applyCharacterOps compara para achar conflito.
//   - Quantidade zero tira o item da lista (e desfazer o devolve no mesmo lugar,
//     pelo `index`).
//   - Munição: a da arma é o item cujo nome e fonte batem com o `ammoType` dela
//     ("arrow|xphb" acha o "Arrow" do XPHB); sem fonte no ammoType, só o nome.
//     Sem munição, o ataque sai e o evento avisa (liberdade com aviso).
//   - Moeda: o delta por tipo (pp, gp, ep, sp, cp); ficar negativo é conflito do
//     applyCharacterOps, que não aplica e avisa. Sem troco automático: pagar 5 pp
//     com ouro é o jogador que converte.
//   - Beber uma poção é ação BÔNUS no XPHB; ler um pergaminho é a ação Magic; comer
//     não tem custo de combate.
//   - Cargas (Wand of Magic Missiles): `charges` do item; recarga `dawn` volta no
//     descanso longo, com o `rechargeAmount` do dado como fórmula (sem ele, tudo).
// -----------------------------------------------------------------------------

import { rollParts, cryptoRng } from './dice';
import { makeEvent } from './playState';
import { healOutcome } from './playHealth';

const USABLE = new Set(['P', 'SC', 'FD']);

/** O código do tipo do item ("P" de "P|XPHB"). */
export function typeCode(raw) {
  return String(raw?.type ?? '').split('|')[0];
}

/** O item se gasta ao usar (poção, pergaminho, comida)? */
export function isUsable(raw) {
  return USABLE.has(typeCode(raw));
}

/** O custo do turno de usar o item: poção é ação bônus (XPHB), pergaminho é ação. */
export function itemCostOf(raw) {
  const t = typeCode(raw);
  return t === 'P' ? 'bonus' : t === 'SC' ? 'action' : null;
}

/** A fórmula de cura do texto de uma poção ("2d4 + 2"), ou null. */
export function healOf(raw) {
  if (typeCode(raw) !== 'P') return null;
  const text = JSON.stringify(raw?.entries ?? []);
  if (!/regain/i.test(text)) return null;
  return text.match(/\{@dice ([^}|]+)/)?.[1]?.trim() ?? null;
}

/** A entrada crua do inventário do personagem. */
export function rawEntry(character, uid) {
  return (character.inventory ?? []).find((e) => e.uid === uid) ?? null;
}

/** A operação de mudar a quantidade de um item; zero tira da lista. */
export function quantityOp(character, uid, delta) {
  const list = character.inventory ?? [];
  const index = list.findIndex((e) => e.uid === uid);
  if (index < 0) return null;
  const before = list[index];
  const qty = Math.max(0, (before.quantity ?? 1) + delta);
  return { op: 'inventory', uid, before, after: qty > 0 ? { ...before, quantity: qty } : null, index };
}

/** A munição da arma no inventário derivado, ou null. */
export function ammoEntry(character, derivedInventory, attack) {
  if (!attack?.ammunition || !attack.ammoType) return null;
  const [name, source] = String(attack.ammoType).toLowerCase().split('|');
  const hit = (derivedInventory ?? []).find((e) => e.raw
    && String(e.raw.name).toLowerCase() === name
    && (!source || String(e.raw.source).toLowerCase() === source)
    && (rawEntry(character, e.uid)?.quantity ?? 0) > 0);
  return hit ?? null;
}

/**
 * Usar um item que se gasta: tira um da pilha e, numa poção de cura, rola e aplica.
 * @param {{ catalog: object, state: object, character: object, entry: object, options?: object, rng?: Function, now?: Date }} args
 */
export function itemUseEvent({ catalog, state, character, entry, options = {}, rng = cryptoRng, now = new Date() }) {
  const ops = [];
  const op = quantityOp(character, entry.uid, -1);
  if (op) ops.push(op);
  const formula = healOf(entry.raw);
  let rolls = null;
  let healed = null;
  if (formula) {
    rolls = rollParts([{ label: entry.raw.name, formula }], { data: catalog.rollData, rng });
    if (options.applyHeal !== false) {
      const heal = healOutcome(state, catalog, rolls.total);
      ops.push(...heal.ops);
      healed = heal.summary;
    }
  }
  return makeEvent('item', { label: entry.raw?.name ?? 'Item', ops, payload: { uid: entry.uid, used: true, healed, left: op?.after?.quantity ?? 0 }, rolls }, now);
}

/** Mudar a quantidade de um item à mão. */
export function quantityEvent({ character, entry, delta, now = new Date() }) {
  const op = quantityOp(character, entry.uid, delta);
  return makeEvent('item', {
    label: entry.raw?.name ?? 'Item',
    ops: op ? [op] : [],
    payload: { uid: entry.uid, delta, left: op?.after?.quantity ?? 0 },
  }, now);
}

/** O gasto de 1 munição num ataque: as operações e o nome, ou o aviso de que não há. */
export function ammoOps({ character, derivedInventory, attack }) {
  if (!attack?.ammunition) return { ops: [], ammo: null, missing: false };
  const entry = ammoEntry(character, derivedInventory, attack);
  if (!entry) return { ops: [], ammo: null, missing: true };
  const op = quantityOp(character, entry.uid, -1);
  return { ops: op ? [op] : [], ammo: entry.raw.name, left: op?.after?.quantity ?? 0, missing: false };
}

/** Gastar (negativo) ou ganhar (positivo) moedas: { gp: -5, sp: 3 }. */
export function currencyEvent({ delta, label = '', now = new Date() }) {
  const clean = Object.fromEntries(Object.entries(delta ?? {}).map(([k, v]) => [k, Math.trunc(Number(v) || 0)]).filter(([, v]) => v));
  const spent = Object.values(clean).some((v) => v < 0);
  return makeEvent('currency', {
    label: label || (spent ? 'Money spent' : 'Money gained'),
    ops: Object.keys(clean).length ? [{ op: 'currency', delta: clean }] : [],
    payload: { delta: clean },
  }, now);
}

/** As cargas dos itens do inventário derivado, como recursos do catálogo. */
export function chargeResources(derivedInventory) {
  const out = [];
  for (const e of derivedInventory ?? []) {
    const max = Number(e.raw?.charges) || 0;
    if (!max || !e.uid) continue;
    const amount = String(e.raw.rechargeAmount ?? '').match(/\{@dice ([^}|]+)/)?.[1]?.trim() ?? (e.raw.rechargeAmount != null ? String(e.raw.rechargeAmount) : null);
    const period = e.raw.recharge === 'dawn' ? 'dawn' : e.raw.recharge === 'dusk' ? 'dusk' : e.raw.recharge ? 'lr' : null;
    out.push({
      key: `charges:${e.uid}`,
      kind: 'charges',
      name: `${e.raw.name} charges`,
      uid: e.uid,
      max,
      recovery: period ? [amount ? { period, type: 'formula', formula: amount } : { period, type: 'recoverAll' }] : [],
    });
  }
  return out;
}
