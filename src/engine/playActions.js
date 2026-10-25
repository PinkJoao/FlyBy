// =============================================================================
// playActions: as rolagens do play mode como eventos do log
// =============================================================================
// O QUE FAZ
//   A ponte pura entre o catálogo de jogo (engine/playCatalog), o motor de dados
//   (engine/dice) e o log (engine/playState): recebe o que o jogador escolheu no
//   diálogo de rolagem e devolve o EVENTO pronto para gravar, com a rolagem
//   inteira dentro (o refazer reaplica o mesmo resultado, DDL-0108).
//
//   As opções do diálogo são sempre { mode, bonus, manual, critical, versatile,
//   applied }: `applied` é a soma dos efeitos ligados (engine/playEffects:
//   vantagem e desvantagem das condições, partes do Bless, do Rage, do Sneak
//   Attack, o piso do Reliable Talent, o limiar do Improved Critical).
//   Antes:
//   `mode` é 'advantage' | 'normal' | 'disadvantage'; `bonus`, uma fórmula livre
//   (o "+1d4" do Bless, o "-2" do mestre); `manual`, os valores dos dados rolados
//   na mesa, em ordem; `critical` e `versatile`, só no dano.
//
// FUNÇÕES
//   testParts(catalog, test): as partes de um teste (atributo, save, perícia,
//     ferramenta, iniciativa); com as partes do catálogo, uma linha por peça (o atributo, a
//     proficiência, o item: engine/playChecks).
//   bonusParts(options): a parte do bônus livre, se houver.
//   rngFor(options, rng): o rng com os dados físicos na frente.
//   modeFlags(mode): vantagem e desvantagem do modo.
//   d20Options(options): o modo somado aos efeitos, o piso e o limiar.
//   rollTestEvent(args): o evento de um teste de d20.
//   rollAttackEvent(args): o evento do acerto de um ataque.
//   damageParts(attack, options): as partes do dano de um ataque.
//   rollDamageEvent(args): o evento do dano de um ataque.
//
// DECISÕES E ARMADILHAS
//   - Um teste rolado só ENTRA no histórico (`ops` vazio): na C2 nada muda no
//     estado. A munição gasta pelo ataque e o dano sofrido chegam na C3 e na C6,
//     como operações no MESMO evento.
//   - O acerto e o dano são DOIS eventos, como os dois cartões do chat do
//     Foundry: o dano se rola depois de saber se acertou, e o crítico vem do
//     acerto (`payload.critical` do ataque pré-marca o diálogo do dano).
//   - Cantrip de SALVAGUARDA não tem acerto: só o dano, com a CD no payload.
//   - O ataque desarmado não tem dado (1 + FOR); o crítico não dobra nada nele,
//     o que é a regra.
//   - O efeito com falha AUTOMÁTICA (Paralyzed num save de FOR) rola mesmo assim e
//     o evento leva `autoFail`, para o cartão dizer "Automatic failure".
//   - O limiar do crítico vem nas opções (`critThreshold`, 20 por padrão); quem
//     o baixa (Champion) é a fase C5.
// -----------------------------------------------------------------------------

import { d20Test, rollParts, sequenceRng, cryptoRng } from './dice';
import { makeEvent } from './playState';
import { checkPartsOf, partLabel } from './playChecks';

/**
 * As partes de um teste de d20 do catálogo.
 * @param {object} catalog
 * @param {{ type: 'ability'|'save'|'skill'|'tool'|'initiative', id?: string, ability?: string }} test
 * @returns {{ label: string, formula: number }[]}
 */
export function testParts(catalog, test) {
  const checks = catalog.checks ?? {};
  const parts = checkPartsOf(catalog, test);
  if (parts?.length) return parts.map((p) => ({ label: partLabel(p), formula: p.value }));
  switch (test.type) {
    case 'ability': {
      const a = checks.abilities?.find((x) => x.ability === test.id);
      return [{ label: 'Modifier', formula: a?.mod ?? 0 }];
    }
    case 'save': {
      const a = checks.abilities?.find((x) => x.ability === test.id);
      return [{ label: 'Save bonus', formula: a?.save ?? 0 }];
    }
    case 'skill': {
      const s = checks.skills?.find((x) => x.skill === test.id);
      return [{ label: 'Skill bonus', formula: s?.bonus ?? 0 }];
    }
    case 'initiative':
      return [{ label: 'Initiative bonus', formula: checks.initiative?.bonus ?? 0 }];
    default:
      return [];
  }
}

/** A parte do bônus livre do diálogo, se houver. */
export function bonusParts(options = {}) {
  const bonus = String(options.bonus ?? '').trim();
  return bonus ? [{ label: 'Bonus', formula: bonus }] : [];
}

/** O rng com os dados físicos digitados na frente (os que faltarem, o app rola). */
export function rngFor(options = {}, rng = cryptoRng) {
  const manual = (options.manual ?? []).filter((v) => Number.isFinite(v));
  return manual.length ? sequenceRng(manual, rng) : rng;
}

/** Vantagem e desvantagem do modo do diálogo. */
export function modeFlags(mode) {
  return { advantage: mode === 'advantage' ? 1 : 0, disadvantage: mode === 'disadvantage' ? 1 : 0 };
}

/** O modo do diálogo somado aos efeitos ligados, com o piso e o limiar do crítico. */
export function d20Options(options = {}) {
  const a = options.applied ?? {};
  const m = modeFlags(options.mode);
  return {
    advantage: m.advantage + (a.advantage ?? 0),
    disadvantage: m.disadvantage + (a.disadvantage ?? 0),
    d20Min: a.d20Min ?? null,
    critThreshold: options.critThreshold ?? a.critThreshold ?? 20,
  };
}

/**
 * O evento de um teste de d20 (atributo, save, perícia, iniciativa).
 * @param {{ catalog: object, test: object, name: string, options?: object, rng?: Function, now?: Date }} args
 */
export function rollTestEvent({ catalog, test, name, options = {}, rng, now = new Date() }) {
  const result = d20Test({
    parts: [...testParts(catalog, test), ...(options.applied?.parts ?? []), ...bonusParts(options)],
    ...d20Options(options),
    data: catalog.rollData,
    rng: rngFor(options, rng),
  });
  const effects = options.applied?.labels ?? [];
  return makeEvent('check', { label: name, payload: { test, mode: result.mode, effects, autoFail: !!options.applied?.autoFail }, rolls: result }, now);
}

/**
 * O evento do acerto de um ataque do catálogo.
 * @param {{ catalog: object, attack: object, options?: object, rng?: Function, now?: Date }} args
 */
export function rollAttackEvent({ catalog, attack, options = {}, rng, now = new Date() }) {
  const parts = attack.toHit
    ? attack.toHit.parts
    : attack.attack ? [{ label: 'Spell attack', formula: attack.attack.bonus ?? 0 }] : [];
  const result = d20Test({
    parts: [...parts, ...(options.applied?.parts ?? []), ...bonusParts(options)],
    ...d20Options(options),
    data: catalog.rollData,
    rng: rngFor(options, rng),
  });
  return makeEvent('attack', {
    label: attack.name,
    payload: { attackKey: attack.key, mode: result.mode, critical: result.isCritical, effects: options.applied?.labels ?? [] },
    rolls: result,
  }, now);
}

/** As partes do dano de um ataque (dado, modificador), com o versátil se pedido. */
export function damageParts(attack, options = {}) {
  const d = attack.damage;
  if (!d) return [];
  const dice = options.versatile && attack.versatile ? attack.versatile : d.dice;
  return [
    ...(dice ? [{ label: attack.name, formula: dice }] : []),
    ...(d.bonus ? [{ label: 'Modifier', formula: d.bonus }] : []),
  ];
}

/**
 * O evento do dano de um ataque, com crítico e versátil.
 * @param {{ catalog: object, attack: object, options?: object, rng?: Function, now?: Date }} args
 */
export function rollDamageEvent({ catalog, attack, options = {}, rng, now = new Date() }) {
  const result = rollParts([...damageParts(attack, options), ...(options.applied?.parts ?? []), ...bonusParts(options)], {
    data: catalog.rollData,
    rng: rngFor(options, rng),
    critical: !!options.critical,
  });
  return makeEvent('damageRoll', {
    label: attack.name,
    payload: {
      attackKey: attack.key,
      types: attack.damage?.types ?? [],
      critical: !!options.critical,
      versatile: !!(options.versatile && attack.versatile),
      save: attack.save ?? null,
      effects: options.applied?.labels ?? [],
    },
    rolls: result,
  }, now);
}
