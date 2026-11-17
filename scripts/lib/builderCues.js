// =============================================================================
// builderCues: a escolha duradoura que a prosa pede, e se o builder a guarda
// =============================================================================
// O QUE FAZ
//   As regras do survey-builder-choices, divididas com o gerador do registro de features
//   (scripts/feature-audit.js, DDL-0228): a pista de escolha duradoura do texto, as escolhas
//   guardadas de um personagem e o veredito "a escolha que a prosa pede está guardada?".
//
// FUNÇÕES
//   cueOf(text): a pista de escolha duradoura do texto: { kind } ou null.
//   bagEntries(character): cada escolha guardada como { where, key, kind, picks }.
//   pendingChoice(f, character, entries): o tipo da escolha que a prosa pede e o builder não
//     guarda, ou null.
//
// DECISÕES E ARMADILHAS
//   - "Of your choice" sozinho NÃO é pista: quase sempre é escolha na hora ("a creature
//     of your choice"). Só conta perto de proficiency, language, skill, tool, resistance,
//     damage type ou cantrip.
//   - O saco de escolhas é a prova do builder porque o autoBuild preenche tudo o que as
//     telas oferecem (choicesComplete, a mesma régua do guia).
//   - A escolha de uma feature de SUBCLASSE tem de ser `sub:` (a da classe não prova a dela:
//     a perícia do Student of Arcana passava pela escolha de perícia do clérigo, DDL-0228).
//   - O Spellcasting e o Pact Magic guardam as magias em `classes[].spells`, não no saco;
//     "Fighting Style" de subclasse guarda em `feat@fs` (`ALIASES`); "skills or tools"
//     é uma escolha `mixed`.
//   - `NOT_A_CHOICE` nomeia, com o motivo, a candidata que foi lida e não é escolha
//     guardada (a escolha é a cada uso, ou outra feature a guarda). Predicado estreito,
//     pelo nome (§6.2).
// -----------------------------------------------------------------------------

const PER_REST = 'a escolha vale até o próximo descanso: é de jogo, não de ficha';
const PER_USE = 'a escolha é a cada uso';
export const NOT_A_CHOICE = {
  trance: PER_REST,
  'astral trance': PER_REST,
  'severed from dreams': PER_REST,
  'bestial soul': PER_REST,
  'mystic brew': PER_REST,
  'dread allegiance': PER_REST,
  'steps of the fey': PER_USE,
  'master transmuter': PER_USE,
  'master brewer': PER_USE,
  'elemental burst': PER_USE,
  'aspect of the wyrm': PER_USE,
  'breath of the dragon': PER_USE,
  'drake companion': 'o tipo de dano se escolhe ao invocar o drake',
  'aura of elemental shielding': 'o tipo muda no começo de cada turno',
  'mystic arcanum': 'as magias ficam em classes[].spells, acima do teto dos espaços (DDL-0010)',
  'tools of the trade': 'só se já tiver a ferramenta: conditionalArtisanTool cria a escolha na hora',
  "reanimator's skill set": 'só se já tiver a ferramenta: conditionalArtisanTool cria a escolha na hora',
  'bonus proficiencies': 'só se já tiver a perícia: conditionalSkillAlt cria a escolha na hora',
  'arcane archer lore': 'só se já tiver Arcana ou Nature: conditionalSkillAlt cria a escolha na hora',
  visage: 'aparência, sem mecânica',
  'vestige companion': 'o tipo de criatura do bloco, escolhido ao invocar',
};
const ALIASES = { 'fighting style': 'feat@fs' };

const KIND_CUES = [
  ['skill', /\b(?:proficiency|proficient) (?:in|with) (?:one|two|three|four|a|an)\b[^.]{0,60}\bskills?\b[^.]{0,40}\bof your choice|\bskills? of your choice/],
  ['tool', /\btools? of your choice|\bproficiency with (?:one|two|a) [^.]{0,40}\btools?\b[^.]{0,30}\bof your choice/],
  ['language', /\blanguages? of your choice|\blearn (?:one|two|three) (?:additional |extra )?languages?/],
  ['resist', /\bresistance to [^.]{0,60}\bdamage types? (?:of your choice|you choose)|\bchoose (?:a|one) damage type\b/],
  ['spell', /\b(?:learn|know) (?:one|two|three|an?) (?:\w+ )?(?:cantrips?|spells?)\b[^.]{0,40}\bof your choice|\bcantrip of your choice/],
  ['spell', /\bchoose (?:a|one|two|three) level \d+ (?:and a level \d+ )?[^.]{0,30}spells?\b/],
  ['ability', /\bincrease (?:one|an) ability score of your choice/],
];
const ABILITY_CUE = /(?:intelligence|wisdom|charisma|strength|constitution)[^.]{0,90}\(choose|\bchoose the ability when/;
const NAMED_CUE = /\bchoose (?:one|two|three|an?) (?:of the following|\w+ (?:option|benefit|form|type|kind|element|aspect|enhancement))s?\b|\bwhen you (?:take|gain|choose) this (?:feat|feature|trait)[^.]{0,20}\bchoose\b|\bchoose (?:one|two|a|an) of the \w+(?: \w+)?:|\b(?:choose|chosen?) (?:the [a-z]+ )?when you (?:gain|select|choose|take) this\b/;

/** A pista de escolha duradoura do texto: { kind } ou null. */
export function cueOf(text) {
  const t = text.toLowerCase();
  for (const [kind, re] of KIND_CUES) if (re.test(t)) return { kind };
  if (ABILITY_CUE.test(t)) return { kind: 'spellAbility' };
  return NAMED_CUE.test(t) ? { kind: 'named' } : null;
}

/** Cada escolha guardada: { where, key, kind, picks }. */
export function bagEntries(c) {
  const out = [];
  const walk = (bag, where) => {
    for (const [key, v] of Object.entries(bag ?? {})) {
      out.push({ where: where === 'class' && key.startsWith('sub:') ? 'subclass' : where, key: key.toLowerCase(), kind: v?.kind, picks: (v?.picks ?? []).map((p) => String(p).toLowerCase()) });
      for (const sub of Object.values(v?.sub ?? {})) walk(sub, where);
    }
  };
  for (const cls of c.classes ?? []) walk(cls.choices, 'class');
  walk(c.species?.choices, 'species');
  walk(c.origin?.choices, 'origin');
  walk(c.origin?.originFeat?.choices, 'feat');
  return out;
}

const WANT_WHERE = { class: ['class'], subclass: ['subclass'], species: ['species'], feat: ['feat', 'class'] };

/** O tipo da escolha que a prosa pede e o builder não guarda, ou null. */
export function pendingChoice(f, character, entries, text) {
  const name = f.name.toLowerCase();
  if (NOT_A_CHOICE[name]) return null;
  const cue = cueOf(text);
  if (!cue) return null;
  const named = entries.some((e) => e.key.includes(name) || (ALIASES[name] && e.key.includes(ALIASES[name])) || e.picks.some((p) => p.startsWith(`${name}|`)));
  const typed = cue.kind !== 'named' && entries.some((e) => (WANT_WHERE[f.kind] ?? []).includes(e.where) && (e.kind === cue.kind || (cue.kind === 'spell' && /spell/.test(e.kind ?? '')) || ((cue.kind === 'skill' || cue.kind === 'tool') && e.kind === 'mixed')));
  const spells = cue.kind === 'spell' && /^(?:spellcasting|pact magic)$/.test(name) && (character.classes ?? []).some((c) => Object.keys(c.spells ?? {}).length || (c.spells?.length ?? 0));
  return named || typed || spells ? null : cue.kind;
}
