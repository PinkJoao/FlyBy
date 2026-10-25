// =============================================================================
// playChecks: os testes de atributo, perícia e save do play mode, peça por peça
// =============================================================================
// O QUE FAZ
//   O que entra no bônus de um teste, separado como o jogador pensa nele: os bônus
//   FIXOS (o modificador do atributo, a proficiência, a expertise), os ROLADOS (um
//   dado a mais, como o Guidance) e os TEMPORÁRIOS OU CONDICIONAIS (um item mágico,
//   uma aura, um efeito ligado, uma condição, e também vantagem, desvantagem e
//   falha automática). O seletor de perícia mostra isso antes de rolar, e as
//   partes fixas viram as linhas da rolagem e do histórico.
//
// FUNÇÕES
//   partLabel(part): o rótulo de uma parte fixa ("Dexterity", "Expertise", o item).
//   checkPartsOf(catalog, test): as partes guardadas no catálogo para o teste.
//   rollOf(catalog, test): a descrição do teste para o rollEffects.
//   testBreakdown(catalog, state, test): { fixed, rolled, conditional, total }.
//   isDice(formula): a fórmula tem um dado?
//
// DECISÕES E ARMADILHAS
//   - ABILITY_NAME e PROF_LABEL ficam aqui (e não nos rótulos da interface) porque
//     o rótulo vai para dentro do EVENTO gravado: o histórico mostra o que foi
//     gravado, e o engine não importa componentes.
//   - O bônus de item ao save (Cloak of Protection) é CONDICIONAL, não fixo: depende
//     de estar vestido e sintonizado, como o usuário classificou os itens mágicos.
//   - O total soma só números: o fixo e o condicional numérico LIGADOS por padrão.
//     Um dado (rolado) aparece à parte, como "+1d4", e um efeito opcional não soma.
//   - Teste de FERRAMENTA (`{ type: 'tool', id: nome, ability }`): o jogador
//     escolhe o atributo (a ferramenta não tem um fixo no 2024), e soma a
//     proficiência inteira, porque só ferramentas proficientes aparecem para rolar.
//   - Proficiência guardada como nível (0.5, 1, 2), com o valor já calculado pelo
//     catálogo: a meia proficiência sai como "Half proficiency".
// -----------------------------------------------------------------------------

import { rollEffects } from './playEffects';

export const ABILITY_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const PROF_LABEL = { 0.5: 'Half proficiency', 1: 'Proficiency', 2: 'Expertise' };

/** O rótulo de uma parte fixa. */
export function partLabel(part) {
  if (part.kind === 'ability') return ABILITY_NAME[part.ability] ?? part.ability;
  if (part.kind === 'proficiency') return PROF_LABEL[part.level] ?? 'Proficiency';
  return part.label ?? 'Bonus';
}

/** As partes do teste guardadas no catálogo, ou null (catálogo sem elas). */
export function checkPartsOf(catalog, test) {
  const checks = catalog.checks ?? {};
  if (test.type === 'ability') return checks.abilities?.find((a) => a.ability === test.id)?.checkParts ?? null;
  if (test.type === 'save') return checks.abilities?.find((a) => a.ability === test.id)?.saveParts ?? null;
  if (test.type === 'skill') return checks.skills?.find((s) => s.skill === test.id)?.parts ?? null;
  if (test.type === 'tool') {
    const a = checks.abilities?.find((x) => x.ability === test.ability);
    const base = a?.checkParts ?? [{ kind: 'ability', ability: test.ability, value: a?.mod ?? 0 }];
    return [...base, { kind: 'proficiency', level: 1, value: catalog.stats?.profBonus ?? 0 }];
  }
  return null;
}

/** A descrição do teste para o rollEffects (o tipo, o atributo, a perícia). */
export function rollOf(catalog, test) {
  if (test.type === 'save') return { kind: 'save', ability: test.id };
  if (test.type === 'initiative') return { kind: 'initiative', ability: 'dex' };
  if (test.type === 'tool') return { kind: 'check', ability: test.ability, tool: test.id, proficient: true };
  if (test.type === 'skill') {
    const s = catalog.checks?.skills?.find((x) => x.skill === test.id);
    return { kind: 'check', ability: s?.ability, skill: test.id, proficient: (s?.prof ?? 0) >= 1 };
  }
  return { kind: 'check', ability: test.id };
}

/** A fórmula tem um dado? */
export function isDice(formula) {
  return /\d*d\d/i.test(String(formula ?? ''));
}

const MODE_TEXT = { adv: 'advantage', dis: 'disadvantage' };

/**
 * O bônus de um teste separado em fixo, rolado e condicional.
 * @returns {{ fixed: object[], rolled: object[], conditional: object[], total: number }}
 */
export function testBreakdown(catalog, state, test) {
  const parts = checkPartsOf(catalog, test) ?? [];
  const fixed = parts.filter((p) => p.kind !== 'item').map((p) => ({ label: partLabel(p), value: p.value }));
  const rolled = [];
  const conditional = parts.filter((p) => p.kind === 'item').map((p) => ({ label: p.label, value: p.value, on: true }));
  for (const e of rollEffects(state, catalog, rollOf(catalog, test))) {
    const on = e.defaultOn !== false;
    if (e.part) {
      const f = e.part.formula;
      if (isDice(f)) rolled.push({ label: e.label, formula: String(f), on });
      else if (Number.isFinite(Number(f))) conditional.push({ label: e.label, value: Number(f), on });
      else conditional.push({ label: e.label, formula: String(f), on });
    } else if (e.adv || e.dis) {
      conditional.push({ label: e.label, text: MODE_TEXT[e.adv ? 'adv' : 'dis'], on });
    } else if (e.autoFail) {
      conditional.push({ label: e.label, text: 'automatic failure', on });
    } else if (e.d20Min) {
      conditional.push({ label: e.label, text: `d20 minimum ${e.d20Min}`, on });
    }
  }
  const total = fixed.reduce((s, p) => s + p.value, 0)
    + conditional.filter((c) => c.on && typeof c.value === 'number').reduce((s, c) => s + c.value, 0);
  return { fixed, rolled, conditional, total };
}
