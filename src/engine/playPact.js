// =============================================================================
// playPact: a arma de pacto do Pact of the Blade no play mode
// =============================================================================
// O QUE FAZ
//   O Pact of the Blade (XPHB) cria ou vincula uma arma: "conjure a pact weapon in your hand, a
//   Simple or Martial Melee weapon of your choice with which you bond, or create a bond with a
//   magic weapon you touch". Enquanto o vínculo dura, o warlock é proficiente com ela, usa o CAR
//   no ataque e no dano no lugar de FOR ou DES, e pode trocar o tipo de dano por necrótico,
//   psíquico ou radiante. O Improved Pact Weapon (XGE) soma +1 no ataque e no dano (se a arma não
//   for mágica com bônus) e deixa invocar arco curto, arco longo, besta leve ou besta pesada.
//   O vínculo é estado do jogo (`state.pactWeapon`, op `pact`), e o catálogo da tela ganha o
//   ataque da arma de pacto (`withPactWeapon`), como o `withResourceMax` faz com os máximos.
//
// FUNÇÕES
//   norm(s): o texto aparado e em minúsculas, para comparar nomes.
//   hasPactOfTheBlade(catalog): o personagem tem o Pact of the Blade?
//   conjurableWeapons(db, catalog): as armas que dá para invocar (com o Improved, os arcos e bestas).
//   pactChoices(db, catalog): as escolhas do vínculo: as armas que carrega e as que invoca.
//   pactEvent({ choice, state, character, now }): o evento que vincula uma arma mágica, conjura uma (a
//     arma entra no inventário, equipada e com "(pact weapon)" no nome) ou desfaz o vínculo; a conjurada
//     anterior sai do inventário (operações `inventory`, que o desfazer devolve).
//   pactAttack(attack, catalog): um ataque transformado em ataque da arma de pacto.
//   conjuredAttack(weapon, catalog): o ataque de uma arma invocada, pelos dados da arma-base.
//   withPactWeapon(catalog, pact): o catálogo com o ataque da arma de pacto.
//
// DECISÕES E ARMADILHAS
//   - O CAR entra quando é MAIOR que o atributo da arma ("you can use your Charisma modifier");
//     com empate, fica o da arma.
//   - O +1 do Improved Pact Weapon só vale sem bônus mágico; a arma vinculada guarda o bônus
//     mágico dela (a parte "Magic" do ataque). O extra solto do registro (que valia para qualquer
//     arma) saiu: o +1 agora mora no ataque da arma de pacto.
//   - A arma vinculada SUBSTITUI a dela na lista de ataques: enquanto dura o vínculo ela é a arma
//     de pacto, e a linha comum ao lado (+0 no warlock sem proficiência marcial) só confundia.
//   - O Eldritch Smite e o Lifedrinker valem só na arma de pacto: `when: 'pact'` no FEATURE_ROLLS,
//     pelo `pact` do contexto da rolagem (attackRollContext).
//   - DDL-0240: só arma MÁGICA se vincula ("create a bond with a magic weapon you touch"); a conjurada
//     é corpo a corpo simples ou marcial (arcos e bestas só com o Improved Pact Weapon) e VIRA ITEM do
//     inventário (`pactConjured`, o jogador troca a imagem na ficha); o vínculo aponta o uid dela. O
//     estado antigo `{ kind: 'conjure', weapon }` ainda vira ataque (conjuredAttack), sem item.
//   - O tipo de dano é escolha do diálogo (`damage.typeOptions`: o da arma, necrótico, psíquico ou
//     radiante), gravada no evento.
//   - Só a arma de pacto conta para o Thirsting Blade e o Devouring Blade; a contagem de ataques
//     é do Attack (playBasicActions), e a escolha da arma fica com o jogador.
// -----------------------------------------------------------------------------
import { DAMAGE_NAME, handsOf } from './playCatalog';
import { makeEvent } from './playState';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const RANGED_OK = ['shortbow', 'longbow', 'light crossbow', 'heavy crossbow'];
const PACT_TYPES = ['necrotic', 'psychic', 'radiant'];

/** O personagem tem o Pact of the Blade? */
export function hasPactOfTheBlade(catalog) {
  return (catalog?.features ?? []).includes('pact of the blade');
}

/** As armas que dá para invocar: corpo a corpo simples ou marcial; com o Improved Pact Weapon, os arcos e as bestas. */
export function conjurableWeapons(db, catalog) {
  const improved = (catalog?.features ?? []).includes('improved pact weapon');
  return (db?.['items-base']?.baseitem ?? [])
    .filter((i) => i.weapon && i.source === 'XPHB' && (String(i.type ?? '').startsWith('M|') || (improved && RANGED_OK.includes(norm(i.name)))))
    .map((i) => ({
      name: i.name,
      source: i.source,
      dmg1: i.dmg1 ?? null,
      dmgType: i.dmgType ?? null,
      versatile: i.dmg2 ?? null,
      hands: handsOf(i),
      props: (i.property ?? []).map((p) => String(typeof p === 'string' ? p : p?.uid ?? '').split('|')[0]),
      ranged: String(i.type ?? '').startsWith('R|'),
      distance: i.range ?? null,
      category: i.weaponCategory ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** As escolhas do vínculo: as armas MÁGICAS que o personagem carrega (não a conjurada) e as que invoca. */
export function pactChoices(db, catalog) {
  const carried = (catalog?.attacks ?? []).filter((a) => a.kind === 'weapon' && a.uid && a.magical && !a.pactConjured && !a.cleave).map((a) => ({ kind: 'bond', uid: a.uid, name: a.name }));
  const conjure = conjurableWeapons(db, catalog).map((w) => ({ kind: 'conjure', weapon: w, name: w.name }));
  return { carried, conjure };
}

/**
 * O evento que vincula uma arma mágica, conjura uma (entra no inventário, equipada) ou desfaz o vínculo
 * (`choice` null); a arma conjurada antes sai do inventário.
 */
export function pactEvent({ choice, state = null, character = null, now = new Date() }) {
  const ops = [];
  const inventory = character?.inventory ?? [];
  const old = state?.pactWeapon?.conjured ? inventory.findIndex((e) => e.uid === state.pactWeapon.uid) : -1;
  if (old >= 0) ops.push({ op: 'inventory', uid: inventory[old].uid, before: inventory[old], after: null, index: old });
  let value = null;
  if (choice?.kind === 'bond') value = { kind: 'bond', uid: choice.uid, name: choice.name };
  else if (choice?.kind === 'conjure') {
    const entry = { uid: `pact-${Date.now().toString(36)}`, itemId: choice.weapon.name, source: choice.weapon.source, quantity: 1, equipped: true, attuned: false, customName: `${choice.weapon.name} (pact weapon)`, pactConjured: true };
    ops.push({ op: 'inventory', uid: entry.uid, before: null, after: entry, index: inventory.length - (old >= 0 ? 1 : 0) });
    value = { kind: 'bond', uid: entry.uid, name: choice.weapon.name, conjured: true };
  }
  ops.push({ op: 'pact', value });
  return makeEvent('use', {
    label: 'Pact of the Blade',
    ops,
    payload: {
      logged: true,
      feature: 'Pact of the Blade',
      option: value ? (value.conjured ? 'Conjure' : 'Bond') : 'End the bond',
      costs: [],
      short: [],
      lines: [value ? (value.conjured ? `Conjured a ${value.name}` : `Bonded with ${value.name}`) : 'The bond ends'],
    },
  }, now);
}

/** Um ataque transformado em ataque da arma de pacto: CAR se maior, proficiência, +1 do Improved Pact Weapon. */
export function pactAttack(attack, catalog) {
  const mods = catalog?.rollData?.abilities ?? {};
  const prof = catalog?.stats?.profBonus ?? 0;
  const cha = mods.cha?.mod ?? 0;
  const own = mods[attack.ability]?.mod ?? 0;
  const useCha = cha > own;
  const ability = useCha ? 'cha' : attack.ability;
  const mod = useCha ? cha : own;
  const magic = (attack.toHit?.parts ?? []).filter((p) => p.label === 'Magic').reduce((s, p) => s + (Number(p.formula) || 0), 0);
  const improved = (catalog?.features ?? []).includes('improved pact weapon') && magic === 0 ? 1 : 0;
  const label = { str: 'Strength', dex: 'Dexterity', cha: 'Charisma' }[ability] ?? ability;
  const parts = [
    { label, formula: mod },
    { label: 'Proficiency', formula: prof },
    ...(magic ? [{ label: 'Magic', formula: magic }] : []),
    ...(improved ? [{ label: 'Improved Pact Weapon', formula: 1 }] : []),
  ];
  return {
    ...attack,
    key: `${attack.key}#pact`,
    name: `${attack.name} (pact weapon)`,
    pact: true,
    ability,
    proficient: true,
    toHit: { total: mod + prof + magic + improved, parts },
    damage: attack.damage ? { ...attack.damage, bonus: mod + magic + improved, typeOptions: [...new Set([...(attack.damage.types ?? []), ...PACT_TYPES])] } : null,
  };
}

/** O ataque de uma arma invocada, pelos dados da arma-base. */
export function conjuredAttack(weapon, catalog) {
  const base = {
    key: `pact:${norm(weapon.name).replace(/[^a-z0-9]+/g, '-')}`,
    kind: 'weapon',
    name: weapon.name,
    uid: null,
    range: weapon.ranged ? 'ranged' : 'melee',
    category: weapon.category,
    equipped: true,
    ability: weapon.ranged ? 'dex' : 'str',
    proficient: true,
    toHit: { total: 0, parts: [] },
    damage: weapon.dmg1 ? { dice: weapon.dmg1, bonus: 0, types: [DAMAGE_NAME[weapon.dmgType] ?? weapon.dmgType ?? ''].filter(Boolean) } : null,
    versatile: weapon.versatile ?? null,
    ...(weapon.hands ? { hands: weapon.hands } : {}),
    properties: weapon.props ?? [],
    mastery: null,
    thrown: (weapon.props ?? []).includes('T'),
    ammunition: false,
    ammoType: null,
    distance: weapon.distance ?? null,
  };
  return pactAttack(base, catalog);
}

/** O catálogo com o ataque da arma de pacto (vinculada ou invocada). */
export function withPactWeapon(catalog, pact) {
  if (!pact || !hasPactOfTheBlade(catalog)) return catalog;
  const attacks = catalog.attacks ?? [];
  if (pact.kind === 'bond') {
    const bonded = attacks.find((a) => a.uid === pact.uid);
    return bonded ? { ...catalog, attacks: [pactAttack(bonded, catalog), ...attacks.filter((a) => a !== bonded)] } : catalog;
  }
  return pact.weapon ? { ...catalog, attacks: [conjuredAttack(pact.weapon, catalog), ...attacks] } : catalog;
}
