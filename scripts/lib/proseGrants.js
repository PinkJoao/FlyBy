// =============================================================================
// proseGrants: o que a prosa concede de forma fixa, e se a ficha tem
// =============================================================================
// O QUE FAZ
//   As regras do survey-prose-grants, divididas com o gerador do registro de features
//   (scripts/feature-audit.js, DDL-0228): perícia, ferramenta, idioma, armadura e resistência
//   que a prosa dá sem escolha, e quais delas a ficha derivada não tem.
//
// FUNÇÕES
//   sentencesOf(text): as frases do texto.
//   grantsOf(text): as concessões fixas das frases que não são condicionais nem escolha.
//   missingOf(grants, derived): as que a ficha derivada não tem.
//
// DECISÕES E ARMADILHAS
//   - A frase com escolha, condição ou duração ("of your choice", "if you already", "while",
//     "until", "when you") não conta: a concessão dela não é fixa, ou é de jogo.
//   - A perícia vale pelo nome inteiro na frase de proficiência, e não numa lista com "or"
//     (o Keen Senses do elfo é escolha); a ferramenta, pelo nome com "Tools", "Supplies",
//     "Kit" ou "Set" (o subtítulo "Skill Set" não conta); a resistência, só a tipos de dano
//     de verdade (DAMAGE) e nunca em "ignores resistance".
//   - `EXPLAINED` nomeia, com o motivo, a candidata lida que não é lacuna.
// -----------------------------------------------------------------------------

const SKILLS = {
  acrobatics: 'acr', 'animal handling': 'ani', arcana: 'arc', athletics: 'ath', deception: 'dec', history: 'his', insight: 'ins',
  intimidation: 'itm', investigation: 'inv', medicine: 'med', nature: 'nat', perception: 'prc', performance: 'prf', persuasion: 'per',
  religion: 'rel', 'sleight of hand': 'slt', stealth: 'ste', survival: 'sur',
};
const DAMAGE = new Set(['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']);
const NOT_FIXED = /\b(?:of your choice|your choice|choose|if you already|if you don't|ignores?|or (?:one|two|another)|one of the following|such as|while|until|when you|whenever|for the duration|for \d+ (?:minute|hour)|temporar|this turn|instead)\b/i;
export const EXPLAINED = {
  grit: 'Goblin (Ixalan): a sub-raça tira `resist` de propósito (resist: null) e só herda o texto do Grit; sem prova no texto dela',
  bouncy: 'resistência só na queda: condicional, de jogo',
  darkflight: 'resistência só na forma bestial: condicional, de jogo',
  "reanimator's skill set": "o subtítulo \"Reanimator's Tools\" colado na frase; o Alchemist's Supplies está na ficha",
};

/** As frases do texto. */
export function sentencesOf(text) {
  return String(text).split(/(?<=[.!?])\s+/);
}

/** As concessões fixas das frases que não são condicionais nem escolha. */
export function grantsOf(text) {
  const out = [];
  for (const s of sentencesOf(text)) {
    if (NOT_FIXED.test(s)) continue;
    const low = s.toLowerCase();
    if (/\bproficien(?:cy|t) (?:in|with)\b/.test(low) && /\bskills?\b/.test(low)) {
      const named = Object.entries(SKILLS).filter(([name]) => new RegExp(`\\b${name}\\b`).test(low));
      if (!(named.length > 1 && /,? or /.test(low))) for (const [name, code] of named) out.push({ kind: 'skill', value: code, label: name });
    }
    if (/\bproficien(?:cy|t) with\b/.test(low)) {
      for (const m of s.matchAll(/\b((?:[A-Z][\w']*\s){1,3}(?:Tools|Supplies|Kit|Set))\b/g)) if (!/Skill Set$/.test(m[1].trim())) out.push({ kind: 'tool', value: m[1].trim(), label: m[1].trim() });
    }
    const lang = s.match(/\bspeak, read, and write ([A-Z][\w-]+)(?:,? and ([A-Z][\w-]+))?/);
    if (lang) for (const l of [lang[1], lang[2]].filter(Boolean)) out.push({ kind: 'language', value: l, label: l });
    const armor = low.match(/\b(light|medium|heavy) armor training\b|\btraining with (light|medium|heavy) armor\b|\bproficiency with (light|medium|heavy) armor\b/);
    if (armor) out.push({ kind: 'armor', value: armor[1] ?? armor[2] ?? armor[3], label: `${armor[1] ?? armor[2] ?? armor[3]} armor` });
    for (const m of low.matchAll(/\bresistance to ([a-z]+) damage\b/g)) if (DAMAGE.has(m[1]) && !/\bor\b/.test(low.slice(m.index, m.index + 60))) out.push({ kind: 'resist', value: m[1], label: `${m[1]} resistance` });
  }
  return out;
}

/** As concessões que a ficha derivada não tem. */
export function missingOf(grants, d) {
  const tools = (d.tools ?? []).map((t) => String(t).toLowerCase());
  const langs = (d.languages ?? []).map((t) => String(t).toLowerCase());
  const armor = (d.armor ?? []).map((t) => String(t).toLowerCase());
  const resist = (d.damageTraits?.resist ?? []).map((t) => String(t).toLowerCase());
  return grants.filter((g) => {
    if (g.kind === 'skill') return !d.skills?.[g.value]?.proficiency;
    if (g.kind === 'tool') return !tools.some((t) => t === g.value.toLowerCase() || t.includes(g.value.toLowerCase()));
    if (g.kind === 'language') return !langs.includes(g.value.toLowerCase());
    if (g.kind === 'armor') return !armor.some((a) => a.includes(g.value));
    if (g.kind === 'resist') return !resist.includes(g.value);
    return false;
  });
}
