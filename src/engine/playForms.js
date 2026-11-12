// =============================================================================
// playForms: as transformações do play mode (Wild Shape, Polymorph, Shapechange)
// =============================================================================
// O QUE FAZ
//   A fase S5 do plano de summons (docs/SUMMONS-TRANSFORMATIONS-PLAN.md, DDL-0195):
//   as regras de cada origem de forma (TRANSFORM_RULES, tiradas do texto do XPHB), os
//   limites do Wild Shape pela tabela Beast Shapes do próprio dado, quais criaturas a
//   origem aceita, as operações de transformar e reverter (estado `form` e os PV
//   temporários) e o CATÁLOGO na forma: o lado físico (ou tudo, no Polymorph) trocado
//   pelo bloco, os testes, a CA, os deslocamentos e os ataques da forma.
//
// FUNÇÕES
//   transformRuleOf(name): a regra da origem (feature ou magia), ou null.
//   crNumber(cr): o ND como número ("1/4" -> 0.25).
//   wildShapeLimits(entries, level, opts): formas conhecidas, ND máximo e voo.
//   wildShapeOf(db, cls): o Wild Shape de uma entrada de classe (limites, Circle Forms).
//   formEligible(m, rule, limits): a criatura serve para a origem?
//   formTempHp(rule, opts): os PV temporários ao assumir a forma.
//   transformOps(opts), revertOps(state): as operações de entrar e sair da forma.
//   formEventId(doc): o id do evento vivo que pôs a forma atual (o card do Revert).
//   bonusOf(text): o número de um "+5" do bloco, ou null.
//   sum(parts): a soma dos valores das partes de um teste.
//   formAttacks(stats): as ações com ataque ou dano no formato de ataque do jogo.
//   formCatalog(catalog, form, stats): o catálogo com a forma aplicada.
//   formStats(block): o bloco da forma resolvido pelo núcleo da criatura.
//
// DECISÕES E ARMADILHAS
//   - TRANSFORM_RULES por origem, cada campo com a frase do XPHB que o prova: o Wild
//     Shape mantém Int, Sab, Car, PV, as proficiências (e usa o do bloco se for maior),
//     ganha PV temporários iguais ao nível de druida (três vezes com o Circle Forms) e
//     não conjura (o Beast Spells do nível 18 libera); o Polymorph e o True Polymorph
//     trocam TUDO, menos os PV, dão PV temporários iguais aos da forma, que somem no
//     fim, e não conjuram; o Shapechange mantém o mental, as proficiências e a
//     conjuração; o Animal Shapes mantém o mental e não conjura (ND 4, Large ou menor).
//   - PV temporários não somam (regra do livro): a forma deixa o MAIOR entre os que o
//     personagem já tem e os da forma. Os que "somem quando a magia acaba" saem ao
//     reverter; os do Wild Shape ficam.
//   - O catálogo na forma é uma CÓPIA (o derivado nunca muda, §6.3); a forma guarda só
//     a referência do bloco e o que a regra decide, e a vista lê o bestiário.
//   - Lunar (Circle Forms): a CA é 13 + Sabedoria quando maior que a da fera; o ND
//     máximo é nível / 3. Lidos da prosa da subclasse, ligados pelo nome da feature.
//   - Ataque da forma usa o bônus do bloco (o PB do ND da fera já está nele).
//   - A célula do ND na tabela vem como {@filter 1/4|bestiary|...|miscellaneous=!swarm}:
//     a marca sai antes de ler, e o próprio filtro do dado tira os enxames (`noSwarm`).
// -----------------------------------------------------------------------------

import { creatureStats } from './creature';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const PHYSICAL = ['str', 'dex', 'con'];
const SIZE_RANK = { T: 0, S: 1, M: 2, L: 3, H: 4, G: 5 };

// ATENÇÃO: cada campo vem do texto do XPHB da origem (citado no DDL-0195); não completar de memória.
const TRANSFORM_RULES = {
  'wild shape': { kind: 'wildShape', label: 'Wild Shape', types: ['beast'], noSwarm: true, keepsMental: true, keepsProficiencies: true, spells: false, tempHp: 'classLevel', tempVanish: false, concentration: false },
  polymorph: { kind: 'polymorph', label: 'Polymorph', types: ['beast'], keepsMental: false, keepsProficiencies: false, spells: false, tempHp: 'formHp', tempVanish: true, endsAtZeroTemp: true, maxCr: 'level', concentration: true },
  'true polymorph': { kind: 'truePolymorph', label: 'True Polymorph', types: null, keepsMental: false, keepsProficiencies: false, spells: false, tempHp: 'formHp', tempVanish: true, maxCr: 'level', concentration: true },
  shapechange: { kind: 'shapechange', label: 'Shapechange', types: null, excludeTypes: ['construct', 'undead'], keepsMental: true, keepsProficiencies: true, spells: true, tempHp: 'formHp', tempVanish: true, maxCr: 'level', concentration: true },
  'animal shapes': { kind: 'animalShapes', label: 'Animal Shapes', types: ['beast'], keepsMental: true, keepsProficiencies: false, spells: false, tempHp: 'formHp', tempVanish: true, maxCr: 4, maxSize: 'L', concentration: false },
};

/** A regra da origem (feature ou magia), ou null. */
export function transformRuleOf(name) {
  return TRANSFORM_RULES[String(name ?? '').toLowerCase()] ?? null;
}

/** O ND como número ("1/4" -> 0.25), ou null. */
export function crNumber(cr) {
  const v = typeof cr === 'object' && cr ? cr.cr : cr;
  if (v == null) return null;
  const m = String(v).match(/^([0-9]+)\/([0-9]+)$/);
  return m ? Number(m[1]) / Number(m[2]) : Number.isFinite(Number(v)) ? Number(v) : null;
}

/**
 * Os limites do Wild Shape pela tabela "Beast Shapes" do texto da feature.
 * @param {object[]} entries  o texto da feature Wild Shape
 * @param {number} level  o nível de druida
 * @param {{ circleForms?: boolean }} [opts]
 * @returns {{ known: number, maxCr: number, fly: boolean }|null}
 */
export function wildShapeLimits(entries, level, { circleForms = false } = {}) {
  let table = null;
  const walk = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'table' && /beast shapes/i.test(e.caption ?? '')) table = e;
    for (const k of ['entries', 'items']) if (Array.isArray(e[k])) e[k].forEach(walk);
  };
  (entries ?? []).forEach(walk);
  if (!table) return null;
  const row = (table.rows ?? []).map((r) => r.map((v) => String(v).replace(/[{]@[a-zA-Z]+ ([^|}]*)[^}]*[}]/g, '$1'))).filter((r) => Number(r[0]) <= level).pop();
  if (!row) return null;
  const maxCr = crNumber(row[2]) ?? 0;
  return {
    known: Number(row[1]) || 0,
    maxCr: circleForms ? Math.max(maxCr, Math.floor(level / 3)) : maxCr,
    fly: /yes/i.test(String(row[3])),
  };
}

/**
 * O Wild Shape de uma entrada de classe: os limites no nível dela e o Circle Forms.
 * @returns {{ known: number, maxCr: number, fly: boolean, circleForms: boolean, level: number, entries: object[] }|null}
 */
export function wildShapeOf(db, cls) {
  const data = cls?.classId ? db?.[`class-${cls.classId}`] : null;
  const own = (data?.classFeature ?? []).filter((f) => f.name === 'Wild Shape' && f.level <= (cls?.level ?? 0));
  const pick = own.find((f) => f.source === cls.source) ?? own[own.length - 1];
  if (!pick) return null;
  const circleForms = !!cls.subclassId && (data?.subclassFeature ?? []).some((f) => f.name === 'Circle Forms'
    && f.subclassShortName === cls.subclassId && (!cls.subclassSource || f.subclassSource === cls.subclassSource) && f.level <= cls.level);
  const limits = wildShapeLimits(pick.entries, cls.level, { circleForms });
  return limits ? { ...limits, circleForms, level: cls.level, entries: pick.entries } : null;
}

/** A criatura serve para a origem? (tipo, ND, voo, tamanho) */
export function formEligible(m, rule, limits = {}) {
  if (!m || !rule) return false;
  const type = String(typeof m.type === 'object' && m.type ? m.type.type : m.type ?? '').toLowerCase();
  if (rule.types && !rule.types.includes(type)) return false;
  if (rule.excludeTypes?.includes(type)) return false;
  if (rule.noSwarm && typeof m.type === 'object' && m.type?.swarmSize) return false;
  const cr = crNumber(m.cr);
  const max = rule.maxCr === 'level' ? limits.level : typeof rule.maxCr === 'number' ? rule.maxCr : limits.maxCr;
  if (max != null && (cr == null || cr > max)) return false;
  if (limits.fly === false && m.speed?.fly) return false;
  if (rule.maxSize && (m.size ?? []).every((s) => (SIZE_RANK[s] ?? 9) > SIZE_RANK[rule.maxSize])) return false;
  return true;
}

/** Os PV temporários ao assumir a forma. */
export function formTempHp(rule, { classLevel = 0, circleForms = false, stats = null } = {}) {
  if (rule?.tempHp === 'classLevel') return (circleForms ? 3 : 1) * classLevel;
  if (rule?.tempHp === 'formHp') return stats?.hp?.value ?? 0;
  return 0;
}

/**
 * As operações de entrar na forma: o estado `form` e os PV temporários (o maior fica).
 * @param {{ state: object, rule: object, creature: object, tempHp: number, acFloor?: number|null, spells?: boolean, source?: string }} opts
 */
export function transformOps({ state, rule, creature, tempHp, acFloor = null, spells = rule.spells, source = rule.label }) {
  const set = {
    kind: rule.kind,
    source,
    ref: { name: creature.name, source: creature.source },
    label: `${source}: ${creature.name}`,
    keepsMental: rule.keepsMental,
    keepsProficiencies: rule.keepsProficiencies,
    spells,
    tempVanish: rule.tempVanish,
    endsAtZeroTemp: !!rule.endsAtZeroTemp,
    concentration: rule.concentration,
    acFloor,
  };
  const delta = Math.max(0, (tempHp ?? 0) - (state?.tempHp ?? 0));
  return [{ op: 'form', set }, ...(delta ? [{ op: 'hp', temp: delta }] : [])];
}

/** As operações de sair da forma: os PV temporários que "somem" saem junto. */
export function revertOps(state) {
  if (!state?.form) return [];
  const temp = state.form.tempVanish && state.tempHp > 0 ? [{ op: 'hp', temp: -state.tempHp }] : [];
  return [{ op: 'form', clear: true }, ...temp];
}

/** O id do evento (antes do cursor) que pôs a forma por último; null se nenhum ou se ela já saiu. */
export function formEventId(doc) {
  const events = doc?.events ?? [];
  for (let i = Math.min(doc?.cursor ?? events.length, events.length) - 1; i >= 0; i--) {
    const ops = events[i].ops ?? [];
    const last = [...ops].reverse().find((o) => o.op === 'form');
    if (last) return last.set ? events[i].id : null;
  }
  return null;
}

/** O número de um "+5" do bloco, ou null. */
export function bonusOf(text) {
  const m = String(text ?? '').match(/[+-]\s*[0-9]+/);
  return m ? Number(m[0].replace(/\s/g, '')) : null;
}

/** As ações da forma com ataque ou dano, no formato de ataque do play mode. */
export function formAttacks(stats) {
  return [...(stats?.actions ?? []), ...(stats?.bonus ?? [])]
    .filter((a) => a.attack || a.damage.length)
    .map((a) => {
      const bonus = a.attack?.bonus ?? 0;
      return {
        key: `form:${stats.name}:${a.name}`,
        kind: 'form',
        name: a.name,
        range: a.attack?.kind === 'ranged' ? 'ranged' : 'melee',
        equipped: true,
        ability: null,
        proficient: true,
        toHit: a.attack ? { total: bonus, parts: [{ label: stats.name, formula: bonus }] } : null,
        save: a.save ? { ability: a.save.ability, dc: a.save.dc } : null,
        damage: a.damage.length ? { dice: a.damage.map((d) => d.formula).join(' + '), bonus: 0, types: [...new Set(a.damage.map((d) => d.type).filter(Boolean))] } : null,
        versatile: null,
        properties: [],
        mastery: null,
        thrown: false,
        ammunition: false,
        distance: null,
      };
    });
}

const sum = (parts) => parts.reduce((n, p) => n + (Number(p.value) || 0), 0);

/**
 * O catálogo com a forma aplicada (uma cópia): atributos trocados, testes, CA,
 * deslocamentos e ataques da forma.
 */
export function formCatalog(catalog, form, stats) {
  if (!catalog || !form || !stats) return catalog;
  const replaced = form.keepsMental ? PHYSICAL : ABILITIES;
  const pb = catalog.stats?.profBonus ?? 0;
  const prof = form.keepsProficiencies;
  const blockSave = (a) => bonusOf(stats.saves?.[a]);
  const abilities = (catalog.checks?.abilities ?? []).map((a) => {
    if (!replaced.includes(a.ability)) return a;
    const mod = stats.mods[a.ability];
    let saveParts = [{ kind: 'ability', ability: a.ability, value: mod }, ...(prof && a.saveProf ? [{ kind: 'proficiency', level: 1, value: pb }] : [])];
    const block = blockSave(a.ability);
    if (block != null && block > sum(saveParts)) saveParts = [{ kind: 'form', label: stats.name, value: block }];
    return { ...a, score: stats.scores[a.ability], mod, save: sum(saveParts), saveProf: prof && a.saveProf, checkParts: [{ kind: 'ability', ability: a.ability, value: mod }], saveParts };
  });
  const skills = (catalog.checks?.skills ?? []).map((s) => {
    const replace = replaced.includes(s.ability);
    const mod = replace ? stats.mods[s.ability] : s.parts.find((p) => p.kind === 'ability')?.value ?? 0;
    let parts = replace
      ? [{ kind: 'ability', ability: s.ability, value: mod }, ...(prof ? s.parts.filter((p) => p.kind !== 'ability') : [])]
      : s.parts;
    const block = bonusOf(stats.skills?.[s.skill]);
    if (block != null && block > sum(parts)) parts = [{ kind: 'form', label: stats.name, value: block }];
    return { ...s, bonus: sum(parts), prof: parts === s.parts || prof ? s.prof : 0, parts };
  });
  const oldDex = catalog.checks?.abilities?.find((a) => a.ability === 'dex')?.mod ?? 0;
  const conSave = abilities.find((a) => a.ability === 'con')?.save ?? catalog.checks?.concentration?.bonus ?? 0;
  const rollAbilities = { ...(catalog.rollData?.abilities ?? {}) };
  for (const a of replaced) rollAbilities[a] = { ...(rollAbilities[a] ?? {}), value: stats.scores[a], mod: stats.mods[a], save: abilities.find((x) => x.ability === a)?.save ?? 0 };
  const speeds = Object.fromEntries(Object.entries(stats.speed ?? {})
    .filter(([k, v]) => k !== 'canHover' && k !== 'choose' && v)
    .map(([k, v]) => [k, { feet: Number(typeof v === 'object' ? v.number : v) }])
    .filter(([, v]) => Number.isFinite(v.feet) && v.feet > 0));
  const ac = Math.max(stats.ac?.value ?? 0, form.acFloor ?? 0);
  return {
    ...catalog,
    form: { ...form, stats },
    rollData: { ...catalog.rollData, abilities: rollAbilities },
    stats: { ...catalog.stats, ac, acBreakdown: [{ label: stats.name, value: ac }], speed: speeds.walk?.feet ?? 0, speeds, initiative: (catalog.stats?.initiative ?? 0) - oldDex + (replaced.includes('dex') ? stats.mods.dex : oldDex) },
    checks: { ...catalog.checks, abilities, skills, initiative: { bonus: (catalog.checks?.initiative?.bonus ?? 0) - oldDex + (replaced.includes('dex') ? stats.mods.dex : oldDex) }, concentration: { bonus: conSave } },
    attacks: formAttacks(stats),
  };
}

/** O bloco da forma resolvido (o PB pelo ND da própria fera). */
export function formStats(block) {
  return block ? creatureStats(block, {}) : null;
}
