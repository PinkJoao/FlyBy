// =============================================================================
// creature: um bloco de estatísticas do 5etools como criatura em jogo
// =============================================================================
// O QUE FAZ
//   O núcleo da criatura em jogo, comum aos summons e formas do play mode e ao
//   FlyBy do mestre (DDL-0173, DDL-0188): lê o bloco (`bestiary`) e devolve CA, PV,
//   deslocamento, atributos, salvaguardas, perícias, sentidos e as AÇÕES roláveis
//   (ataque, dano, salvaguarda e CD tirados das marcas). Um CONTEXTO resolve o que é
//   do invocador: círculo da magia, nível de classe, modificadores, bônus de
//   proficiência, ataque e CD de magia, e a variante escolhida (Air, Land, Defender).
//
// FUNÇÕES
//   termValue(raw, ctx): um termo do molde, ou null.
//   templateValue(text, ctx): o número de um molde em prosa ("11 + the spell's
//     level", "5 + five times your ranger level"), as variantes que ele oferece e
//     se sobrou trecho que o leitor não entende.
//   damageFormula(expr, tail, ctx): a fórmula do dano, com `summonSpellLevel`, `PB`
//     e o "plus your Intelligence modifier" resolvidos.
//   parseAction(entry, ctx): uma ação com o ataque, os danos e a salvaguarda.
//   objectSummons(objects): os objetos que uma feature cria (Eldritch Cannon) como bloco.
//   creatureStats(m, ctx): a criatura inteira, pronta para o jogo.
//   abilityMod(score), crPb(cr): o modificador e o bônus de proficiência pelo ND.
//
// DECISÕES E ARMADILHAS
//   - Os moldes em prosa são um conjunto FECHADO, medido nos 38 blocos de summon
//     (2026-11-09): termos somados por "+" ou "plus" (número, "the spell's level",
//     "N for each spell level above K", "N per spell level", "five times your X level",
//     "your X level", "your Intelligence modifier", "PB"), com variante por forma
//     ("20 (Air only) or 30 (Land and Water only)", "+ 2 (Defender only)", por
//     tamanho). O parêntese final ("(natural armor)", os dados de vida) sai do cálculo.
//     O que o leitor não entende volta com `unknown: true` e valor null: a interface
//     mostra o texto e pede o número (liberdade com aviso, §6.4), nunca inventa.
//   - O ataque do summon é o do invocador (`{@hitYourSpellAttack}`, 63 vezes, ou o
//     texto "your spell attack modifier to hit" dos livros antigos); o "{@hit N} plus
//     PB" soma o PB do contexto. A CD vem do `{@actSave}`, do "{@dc N} ... saving
//     throw" no meio da frase ou do "your spell save DC" do invocador.
//   - Dano: a parte de exibição depois de `|` sai, a conta no número de dados
//     ("(summonSpellLevel - 4)d4" do Animated Object) é feita, e o "+ your
//     spellcasting ability modifier" usa o `spellMod` do contexto.
//   - Tipo do dano: depois do dado ("5 ({@damage 1d6 + 2}) Piercing"), antes dele
//     ("Force damage equal to {@damage ...}") ou por forma ("of Radiant (Celestial),
//     Psychic (Fey)..." do Otherworldly Steed: escolhe pela variante, que entra nas
//     variantes da criatura); o dado sem tipo herda o anterior na mesma frase ou com
//     "damage of the same type".
//   - O bloco chega com o `_copy` já resolvido (o Hound of Ill Omen é cópia do Dire
//     Wolf): quem lista resolve (selector/copy.js), este módulo não procura pai.
//   - S4 (DDL-0194): o Eldritch Cannon é OBJETO (`objects.json`), não criatura;
//     objectSummons pega só o que a nota diz "Created by the subclassFeature", põe a CA
//     em lista, abre a lista de opções do "Activate Cannon" em ações e marca
//     `summonedByClass`. Por isso o ataque também vale em prosa ("Make a ranged spell
//     attack", com o ataque do invocador), a CD no `{@dcYourSpellSave}`, o molde aceita
//     "5 × your artificer level" e "equal to five times...", e o parêntese do Mending sai.
//   - O PB da criatura comum vem do ND (crPb); o do summon é o do invocador (o
//     `pbNote` diz "equals your Proficiency Bonus"), dado pelo contexto.
//   - Nada aqui lê a ficha do jogador: o contexto chega pronto (a regra do reducer,
//     DDL-0108), e o mesmo módulo serve ao mestre sem ficha nenhuma.
// -----------------------------------------------------------------------------

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_WORD = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const NUMBER_WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const SIZE = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };

/** O modificador de um valor de atributo. */
export function abilityMod(score) {
  return Math.floor((Number(score ?? 10) - 10) / 2);
}

/** O bônus de proficiência pelo nível de desafio. */
export function crPb(cr) {
  const s = String(typeof cr === 'object' && cr ? cr.cr : cr ?? '0');
  const n = s.includes('/') ? 0 : Number(s);
  return Number.isFinite(n) ? 2 + Math.floor((Math.max(n, 1) - 1) / 4) : 2;
}

/** Um termo do molde, ou null se o leitor não o entende. */
function termValue(raw, ctx) {
  const t = raw.trim().toLowerCase().replace(/[.]$/, '');
  if (/^[0-9]+$/.test(t)) return Number(t);
  if (/^(the spell's level|the level of the spell|summonspelllevel)$/.test(t)) return ctx.spellLevel ?? null;
  let m = t.match(/^([0-9]+) for each spell level above ([0-9]+)(?:st|nd|rd|th)?$/);
  if (m) return ctx.spellLevel == null ? null : Number(m[1]) * Math.max(0, ctx.spellLevel - Number(m[2]));
  m = t.match(/^([0-9]+) per spell level$/);
  if (m) return ctx.spellLevel == null ? null : Number(m[1]) * ctx.spellLevel;
  m = t.match(/^(?:equal to )?(\w+) (?:times|×) your \w+ level$/);
  if (m) return ctx.classLevel == null ? null : (NUMBER_WORD[m[1]] ?? Number(m[1])) * ctx.classLevel;
  if (/^your \w+ level$/.test(t)) return ctx.classLevel ?? null;
  m = t.match(/^your (\w+) modifier$/);
  if (m) return ctx.mods?.[ABILITY_WORD[m[1]]] ?? null;
  if (t === 'pb' || t === 'your proficiency bonus') return ctx.pb ?? null;
  return null;
}

/**
 * O número de um molde em prosa, as variantes que ele oferece e se sobrou trecho não lido.
 * @param {string} text
 * @param {{spellLevel?:number, classLevel?:number, mods?:object, pb?:number, variant?:string}} [ctx]
 * @returns {{value:number|null, variants:string[], unknown:boolean}}
 */
export function templateValue(text, ctx = {}) {
  let s = String(text ?? '').replace(/\s+[(](?:natural armor|the [^)]*hit dice[^)]*)[)]/gi, '');
  s = s.replace(/[(][^)]*Hit Dice[^)]*[)]/gi, '').replace(/\s*[(]casting [^)]*[)]/gi, '').trim();
  const variants = [];
  const choose = (re) => {
    const alts = [...s.matchAll(re)];
    if (alts.length < 2) return;
    for (const a of alts) variants.push(...a[2].split(/ and | or |, /).map((x) => x.trim()).filter(Boolean));
    const pick = alts.find((a) => ctx.variant && a[2].toLowerCase().includes(String(ctx.variant).toLowerCase())) ?? alts[0];
    s = s.replace(alts.map((a) => a[0]).join(''), `${pick[1]}`);
  };
  choose(/([0-9]+) [(]([^)]*?) only[)](?: or |, )?/g);
  choose(/([0-9]+) [(](Medium or smaller|Large|Huge|Gargantuan)[)](?:, )?/g);
  let total = 0;
  let unknown = false;
  for (const part of s.split(/ [+] | plus /)) {
    const cond = part.match(/^([0-9]+) [(](\w+) only[)]$/);
    if (cond) {
      if (!variants.includes(cond[2])) variants.push(cond[2]);
      if (ctx.variant && ctx.variant.toLowerCase() === cond[2].toLowerCase()) total += Number(cond[1]);
      continue;
    }
    const v = termValue(part, ctx);
    if (v == null) unknown = true;
    else total += v;
  }
  return { value: unknown ? null : total, variants: [...new Set(variants)], unknown };
}

/** A fórmula do dano, com `summonSpellLevel`, `PB` e o "plus your X modifier" resolvidos. */
export function damageFormula(expr, tail, ctx = {}) {
  let f = String(expr ?? '').split('|')[0]
    .replace(/summonSpellLevel/gi, String(ctx.spellLevel ?? 0))
    .replace(/[+] *PB\b/g, `+ ${ctx.pb ?? 0}`)
    .replace(/[(]\s*([0-9]+)\s*([+-])\s*([0-9]+)\s*[)]/g, (m, a, op, b) => String(Math.max(0, op === '+' ? Number(a) + Number(b) : Number(a) - Number(b))));
  const plus = String(tail ?? '').match(/^\s*(?:plus|[+]) (?:your (\w+) modifier|your spellcasting ability modifier|PB)/i);
  if (plus) {
    const add = /spellcasting/i.test(plus[0]) ? ctx.spellMod ?? 0 : plus[1] ? (ctx.mods?.[ABILITY_WORD[plus[1].toLowerCase()]] ?? 0) : (ctx.pb ?? 0);
    f += ` + ${add}`;
  }
  return f.replace(/[+] -/g, '- ').replace(/\s+/g, ' ').trim();
}

const DAMAGE_TYPE = /^[ )]*(?:(?:plus|[+]) (?:your [a-z]+ modifier|your spellcasting ability modifier|PB)[ ]*)?(?:[(][^)]*[)][ ]*)?(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\b/i;

/**
 * Uma ação com o ataque, os danos e a salvaguarda.
 * @returns {{name:string, attack:{bonus:number|null, kind:string}|null, damage:{formula:string,type:string|null}[], save:{ability:string,dc:number|null}|null, text:string}}
 */
export function parseAction(entry, ctx = {}) {
  const text = JSON.stringify(entry?.entries ?? []);
  let attack = null;
  const atk = text.match(/[{]@atkr? ([a-z,]+)[}]/);
  if (atk) {
    let bonus = null;
    const hit = text.match(/[{]@hit (-?[0-9]+)[}]( plus PB)?/);
    if (hit) bonus = Number(hit[1]) + (hit[2] ? (ctx.pb ?? 0) : 0);
    else if (/[{]@hitYourSpellAttack|your spell attack modifier to hit/.test(text)) bonus = ctx.spellAttack ?? null;
    attack = { bonus, kind: atk[1].includes('r') && !atk[1].includes('m') ? 'ranged' : atk[1].includes('r') ? 'melee or ranged' : 'melee' };
  } else {
    const prose = text.match(/[Mm]ake an? (melee|ranged) spell attack/);
    if (prose) attack = { bonus: ctx.spellAttack ?? null, kind: prose[1] };
  }
  const damage = [];
  const variants = [];
  let lastType = null;
  let lastEnd = 0;
  for (const m of text.matchAll(/[{]@damage ([^}]+)[}]([^{"]{0,80})/g)) {
    let type = m[2].match(DAMAGE_TYPE)?.[1]?.toLowerCase() ?? null;
    const byForm = [...(m[2].match(/^ of ([^.]*?) damage/)?.[1] ?? '').matchAll(/([A-Za-z]+) [(]([A-Za-z]+)[)]/g)];
    if (!type && byForm.length) {
      variants.push(...byForm.map((p) => p[2]));
      const pick = byForm.find((p) => ctx.variant && p[2].toLowerCase() === String(ctx.variant).toLowerCase()) ?? byForm[0];
      type = pick[1].toLowerCase();
    }
    if (!type) type = text.slice(Math.max(0, m.index - 40), m.index).match(/([A-Za-z]+) damage equal to $/)?.[1]?.toLowerCase() ?? null;
    if (!type && lastType && (!text.slice(lastEnd, m.index).includes('.') || /^ damage of the same type/i.test(m[2]))) type = lastType;
    damage.push({ formula: damageFormula(m[1], m[2], ctx), type });
    lastType = type ?? lastType;
    lastEnd = m.index + m[0].length;
  }
  let save = null;
  const spellDc = /your spell save DC|[{]@dcYourSpellSave[}]/i.test(text) ? ctx.spellDc ?? null : null;
  const act = text.match(/[{]@actSave (\w+)[}]\s*(?:[{]@dc ([0-9]+)[}])?/);
  const inline = text.match(/[{]@dc ([0-9]+)[}][^.]*?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
  const prose = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
  if (act) save = { ability: act[1].toLowerCase().slice(0, 3), dc: act[2] ? Number(act[2]) : spellDc };
  else if (inline) save = { ability: ABILITY_WORD[inline[2].toLowerCase()], dc: Number(inline[1]) };
  else if (prose && spellDc != null) save = { ability: ABILITY_WORD[prose[1].toLowerCase()], dc: spellDc };
  return { name: entry?.name ?? '', attack, damage, save, variants: [...new Set(variants)], text: entry?.entries ?? [] };
}

/** Os objetos que uma feature de classe cria (o Eldritch Cannon), no formato de bloco que creatureStats lê. */
export function objectSummons(objects) {
  return (objects ?? []).flatMap((o) => {
    const by = JSON.stringify(o?.entries ?? []).match(/Created by the [{]@subclassFeature [^|}]+[|](\w+)[|](\w+)/);
    if (!by) return [];
    const action = (o.actionEntries ?? []).flatMap((e) => {
      const list = (e.entries ?? []).find((x) => x?.type === 'list');
      return list ? list.items.map((it) => ({ name: it.name, entries: it.entries ?? [] })) : [e];
    });
    return [{ ...o, ac: typeof o.ac === 'number' ? [o.ac] : o.ac, action, summonedByClass: `${by[1]}|${by[2]}`, isObject: true }];
  });
}

/**
 * A criatura inteira, pronta para o jogo.
 * @param {object} m  o bloco do 5etools
 * @param {{spellLevel?:number, classLevel?:number, mods?:object, pb?:number, spellAttack?:number, spellDc?:number, variant?:string}} [ctx]
 */
export function creatureStats(m, ctx = {}) {
  const summoned = !!(m?.summonedBySpell || m?.summonedByClass);
  const pb = summoned ? ctx.pb ?? null : crPb(m?.cr);
  const full = { ...ctx, pb };
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, Number(m?.[a] ?? 10)]));
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityMod(scores[a])]));
  const ac0 = (m?.ac ?? [])[0];
  const ac = typeof ac0 === 'number' ? { value: ac0, text: String(ac0), variants: [], unknown: false }
    : ac0?.special ? { ...templateValue(ac0.special, full), text: ac0.special }
      : { value: ac0?.ac ?? null, text: String(ac0?.ac ?? ''), variants: [], unknown: ac0?.ac == null };
  const hp = m?.hp?.special ? { ...templateValue(m.hp.special, full), text: m.hp.special, formula: null }
    : { value: m?.hp?.average ?? null, text: String(m?.hp?.average ?? ''), formula: m?.hp?.formula ?? null, variants: [], unknown: m?.hp?.average == null };
  const list = (k) => (m?.[k] ?? []).map((e) => parseAction(e, full));
  return {
    name: m?.name ?? '',
    source: m?.source ?? '',
    size: (m?.size ?? []).map((s) => SIZE[s] ?? s),
    type: typeof m?.type === 'object' && m.type ? m.type.type : m?.type ?? '',
    cr: typeof m?.cr === 'object' && m.cr ? m.cr.cr : m?.cr ?? null,
    pb,
    ac,
    hp,
    speed: m?.speed ?? {},
    scores,
    mods,
    saves: m?.save ?? {},
    skills: m?.skill ?? {},
    senses: m?.senses ?? [],
    passive: m?.passive ?? null,
    traits: m?.trait ?? [],
    actions: list('action'),
    bonus: list('bonus'),
    reactions: list('reaction'),
    variants: [...new Set([...ac.variants, ...hp.variants, ...[...(m?.action ?? []), ...(m?.bonus ?? [])].flatMap((e) => parseAction(e, full).variants)])],
  };
}
