// =============================================================================
// playProseEffects: o que só a prosa da feature declara, lido na hora para o jogo
// =============================================================================
// O QUE FAZ
//   As camadas G2 e G3 da Fase P (docs/PLAY-MODE-CERT-PLAN.md, DDL-0213 e DDL-0214). Lê o
//   texto de cada feature do catálogo e acha as frases que mexem numa rolagem do próprio
//   personagem, e cada uma vira um extra do diálogo da rolagem:
//   - vantagem ou desvantagem: "You have Advantage on <alvo> <condição>" (Fey Ancestry,
//     Brave, Hippo Build);
//   - uma parte somada: "you gain a +2 bonus to <alvo>", "a bonus to the check equal to your
//     Wisdom modifier", "Add your Wisdom modifier to the damage you deal with any Cleric
//     cantrip" (Thrown Weapon Fighting, Elegant Courtier, Potent Spellcasting);
//   - rolar de novo o 1 do d20: "When you roll a 1 on the d20 of a D20 Test, you can reroll
//     the die" (o Luck das linhagens antigas, Kor, Khenra);
//   - o piso do d20: "you can treat a d20 roll of 9 or lower as a 10" (Silver Tongue);
//   - um dado somado ao teste: "When you make a Wisdom (Perception or Survival) check, you can roll
//     1d4 and add the number rolled to the ability check" (as marcas de dragão do EFA, DDL-0239),
//     com "or an ability check using Thieves' Tools" como alvo de FERRAMENTA (o grupo `tools`,
//     nunca todo teste); o Greater Mark troca o dado ("you can roll 1d6 instead of 1d4", diceUpgrades).
//   LIGADO quando a frase não traz condição, DESLIGADO com a condição do texto na nota
//   quando traz. E a cura ou os PV temporários que a feature dá ("you gain Temporary Hit
//   Points equal to your Charisma modifier plus your Warlock level") viram o "Use" dela.
//
// FUNÇÕES
//   sentencesOf(entries): as frases do texto, sem os nomes dos blocos e sem as tags.
//   kindOf(noun): o substantivo do alvo como tipo de rolagem.
//   parseTarget(rest): os alvos do começo de um trecho (checks, saves, ataques...) e o resto.
//   clauseTail(rest): o resto da oração depois do alvo, até o fim dela.
//   autoCondition(lead): a condição que o app confere sozinho ('bloodied', 'rage',
//     'concentrating' ou uma condição).
//   leadingCondition(lead): a condição escrita antes do sujeito, ou null.
//   leadTarget(lead): o alvo que a condição da frente nomeia ("When you make a Charisma
//     (Persuasion) check"), para o "the check" da frase.
//   termFormula(term), exprFormula(text): um termo e uma expressão do texto ("1d10 plus your
//     Ranger level", "twice your Wizard level") como fórmula, ou null.
//   readClause(sentence, m, at): o alvo, a condição da frente e a de trás de uma oração.
//   proseClauses(entries): as orações de vantagem, bônus, reroll, piso e dado somado do próprio personagem.
//   diceUpgrades(features): o dado que uma feature troca no de outra (o Greater Mark, DDL-0239).
//   proseRollEffects(features, opts): as entradas do catálogo (`proseEffects`); o resto que só
//     repete o escopo (`SCOPE_ONLY`, "of that spell" da Empowered Evocation) não vira nota.
//   spellScope(lead): a condição da frente que só diz de que magia é (escola, classe, ou o tipo do dano:
//     "when a spell you cast deals Radiant or Fire damage"): vira `spellOf` e a entrada vale ligada só
//     nessa magia (a Empowered Evocation, DDL-0247; o Radiant Soul, DDL-0249).
//     "When you cast a spell that deals damage of that type" (Elemental Affinity) devolve `chosen`, e o
//     `proseRollEffects` troca pelo tipo escolhido no builder (`chosenTypes`); sem escolha, fica
//     desligada com a condição. "One damage roll of that spell" marca `oncePerCast` (DDL-0250).
//   cantripScope(tail): o resto da oração que só diz o cantrip ("with any Druid cantrip": o Potent
//     Spellcasting do druida e do clérigo); o mesmo `spellOf`, com `cantrip` (DDL-0249).
//   proseUses(features, opts): a cura e os PV temporários do "Use" (`proseUses`).
//   fitsGroup(g, roll), fitsProse(e, roll): um grupo do alvo, e a entrada, valem para esta rolagem?
//   proseEffects(catalog, roll, ctx): os extras, no formato de rollEffects (`ctx`: as
//     condições ativas, as chaves e os nomes com dono, o Bloodied, a Rage e a concentração).
//   noteOf(text), norm(s), slug(s): a nota legível, o nome comparável e o pedaço do id.
//
// DECISÕES E ARMADILHAS
//   - Por PROSA e com assinatura ESTREITA (§6.1): só o sujeito do próprio personagem ("you
//     have", "you gain", "grants you", "giving you", "you and <alguém> have", "you can give
//     yourself", "add your"). "Your allies have", "it has", "give yourself Advantage on one
//     D20 Test" (Tides of Chaos, um uso) e "doesn't impose" ficam fora. Um "you have
//     advantage" dentro de uma condição ("if you have advantage on the attack roll", Rapid
//     Strike) também fica fora.
//   - O alvo é lido por fichas (`parseTarget`): atributos, perícias entre parênteses
//     (pelo `skillCode`), os qualificadores (melee, ranged, weapon, spell) e o substantivo
//     (checks, saving throws, attack rolls, damage rolls, Initiative, D20 Tests; "AC" é
//     lido e ignorado, a CA é da ficha). "Strength and Dexterity checks and saving throws"
//     dá os dois com os dois atributos: o substantivo sem atributo herda os do anterior.
//     "All other" PARA a leitura (o Cloak of Flies fica só com a parte que entende).
//   - "the check", "the roll", "that roll" (`BACKREF`) pegam o alvo da condição da frente
//     (`leadTarget`): "Whenever you make a Charisma (Persuasion) check, you gain a bonus to
//     the check equal to your Wisdom modifier" vale no Persuasion e fica LIGADO. Sem alvo
//     na frente, vale o substantivo do próprio "the attack roll" (Unwavering Mark); "the
//     roll" sozinho não diz qual, e a oração sai.
//   - O bônus precisa de um valor: "+N" ou "equal to <expressão>" (`exprFormula`: dados,
//     atributos, PB, nível de classe, "twice", "half", "(minimum of +1)"). "Per magic item",
//     "for each time" e uma expressão que o leitor não entende tiram a oração: melhor sem o
//     extra do que com um número errado. "As normal" (o ataque natural do Form of the Beast)
//     também sai.
//   - LIGADO só sem condição nenhuma: nada antes do sujeito (fora "Starting at 9th level,"
//     e uma oração coordenada com "and"), nada depois do alvo, e a feature NÃO é ativada.
//     Uma condição no meio da frase ("You have Resistance to that damage type, and when you
//     cast a spell that deals damage of that type, you can add") também conta: a última
//     oração com "when", "if" ou "while" antes do sujeito.
//     Feature com custo do turno, gatilho, activity ou pool (`activated`) vale depois de
//     usada: Vow of Enmity, Shell Defense, Watcher's Will entram desligados, com a nota
//     "After you use X" quando o texto não diz mais (liberdade com aviso, §6.4).
//   - O app confere sozinho: "unless you have the Incapacitated condition", "While
//     Bloodied", "While your Rage is active", "While you maintain concentration" (Durable
//     Magic) e "While Deafened" e as outras condições do estado.
//   - O sujeito "you have" só conta no COMEÇO de uma oração (`CLAUSE_START`: início, vírgula,
//     "and"): "enemies within 5 feet of you have" e "that can hear you gain" ficam fora.
//   - A morte não recebe o extra condicional; a salvaguarda sem atributo e sem condição recebe.
//   - "to maintain that Concentration" (Extended Spell) restringe a salvaguarda à de
//     concentração.
//   - Quem já tem dono não entra: a feature do FEATURE_ROLLS (o registro curado), a do
//     FEATURE_EFFECTS (a Rage traz "Advantage on Strength checks" e é interruptor), a das
//     PASSIVES (Reliable Talent) e a que a ponte do G1 já lê do ator com modo de rolagem
//     (Danger Sense, Feral Instinct, Archery, Hare-Trigger: a feature inteira, o ator já tem
//     a mecânica dela). A primeira sai aqui; as outras, por `skipKeys` e
//     `skipNames` (engine/playEffects) e por `bridged`.
//   - A cura e os temporários têm três formas: "equal to <expressão>" (também depois de "you
//     can take a Bonus Action to gain", o Defensive Field), "10 temporary hit points per
//     warlock level" (Tomb of Levistus), um número ("you and allies ... gain 10 Temporary Hit
//     Points", Boon of the Bright Sun) e "You gain Temporary Hit Points whenever..." com a
//     conta na frase seguinte, "These Temporary Hit Points equal..." (Celestial Resilience).
//   - O "Use" de cura e temporários (`proseUses`) é só da feature SEM activity (a activity
//     já cura) e fora do registro curado; vale para o próprio personagem, e "you or another
//     creature" fica na nota: o jogador dá ao outro pelo painel de HP dele.
// -----------------------------------------------------------------------------

import { featureRollOf } from './playFeatureRolls';
import { skillCode } from './classData';
import { SKILL_ABILITY } from './proficiency';

const ABILITY = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const ABILITY_WORDS = 'strength|dexterity|constitution|intelligence|wisdom|charisma';
const D20 = ['attack', 'check', 'save', 'initiative', 'deathSave', 'concentration'];
const MODE_SUBJECT = /\b(?:(you (?:also |still )?(?:have|gain)|you and [^.,;]{1,40}? (?:have|gain))|grants? you|gives? you|giving you)\s+(advantage|disadvantage) on\s+/gi;
const BONUS_SUBJECT = /\b(?:you (?:also )?(?:gain|have|get)|you all gain|you and [^.,;]{1,40}? gain|you can give yourself|you grant yourself)\s+an?\s+(?:([+-]\d+)\s+)?bonus to\s+/gi;
const ADD_SUBJECT = new RegExp(`(?:\\b(you (?:can |also )*))?\\badd your (${ABILITY_WORDS}|proficiency|rage damage) (?:modifier|bonus) to\\s+`, 'gi');
const REROLL_ONES = /\b(?:when|whenever) you roll an? 1 on (?:the d20 (?:of|for) )?/gi;
const FLOOR = /\b(?:you )?can treat an? d20 roll of (\d+) or lower as an? (\d+)\b/gi;
const ROLL_ADD = /\byou can roll (\d+d\d+) and add the number rolled to the (?:ability check|check|roll)\b/gi;
const TOOL_CHECK = /\s*,?\s*or an ability check using ([^,]+?)(?=,|$)/i;
const UPGRADE = /\bbenefit of your (.+?) feat, you can roll (\d+d\d+) instead of (\d+d\d+)/i;
const HEAL = /\b(?:(you (?:also |can |immediately )*(?:take an? (?:bonus action|action|reaction|magic action) to )?(?:gain|regain))|(granting you)|(you or (?:another|one|a) creature[^.;]{0,70}?(?:gains?|regains?)))\s+(?:a number of\s+)?(temporary hit points|hit points)\s+equal to\s+/gi;
const HEAL_PER_LEVEL = /\byou (?:gain|regain) (\d+) (temporary hit points|hit points) per ([a-z]+) level\b/i;
const HEAL_FIXED = /\byou(?: and [^.;]{1,60}?)? (?:gain|regain) (\d+) (temporary hit points|hit points)\b(?! per)/i;
const HEAL_LATER = /\byou gain (temporary hit points|hit points)\b(?! equal)/i;
const HEAL_THESE = /^these (temporary hit points|hit points) equal\s+/i;
const CLAUSE_START = /(?:^|[,;:]\s*|\b(?:and|then|also|so|but)\s+)$/i;
const TOKEN = new RegExp(`\\s*(?:(,)|\\b(and|or|on|any|all|the|that|your|next|a|an|one|attack's)(?![\\w'])|\\b(${ABILITY_WORDS})(-based)?\\b|\\(([^)]*)\\)|\\b(ability checks?|checks?|saving throws?|saves|attack rolls?|attack(?= and damage rolls?)|initiative rolls?|initiative|d20 tests?|damage rolls?|damage|armor class|ac)\\b|\\b(melee|ranged|weapon|spell(?:'s)?)(?![\\w']))`, 'iy');
const BACKREF = /^(?:the|that|this|its)\s+(?:ability check|check|roll|saving throw|save|attack roll|d20)\b/i;
const SUBORDINATE = /^(?:while|when|whenever|if|until|for|as long as|during|after|once|on a (?:failed|successful) save|as part of)\b/i;
const ACTIVATION = /^as an? (?:action|bonus action|reaction|magic action)$/i;
const TAIL_END = /[.;!]|,\s*(?:and|but)\s+(?=(?:you|your|it|its|the|magic|if|when|this)\b)|,\s+you\s+(?:can|can't|have|are|gain|must)\b|\s+but\s|,?\s+as do\b/i;
const EXPR_END = /[.;]|,\s|\s+(?:if|when|whenever|while|until|for|as long as|to a maximum|which|and you|but)\b/i;
const NO_AMOUNT = /^(?:per|for each|for every|based on)\b/i;
const CONDITION_NAMES = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** As frases do texto, sem os nomes dos blocos e sem as tags do 5etools. */
export function sentencesOf(entries) {
  const out = [];
  const walk = (e) => {
    if (typeof e === 'string') out.push(...e.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1').split(/(?<=[.!?])\s+/));
    else if (Array.isArray(e)) e.forEach(walk);
    else if (e && typeof e === 'object') for (const k of ['entries', 'items', 'entry']) if (e[k] != null) walk(e[k]);
  };
  walk(entries);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** O substantivo do alvo como tipo de rolagem. */
function kindOf(noun) {
  const n = norm(noun);
  if (n.startsWith('saving') || n === 'saves') return 'save';
  if (n.startsWith('attack')) return 'attack';
  if (n.startsWith('initiative')) return 'initiative';
  if (n.startsWith('d20')) return 'd20';
  if (n.startsWith('damage')) return 'damage';
  if (n === 'ac' || n === 'armor class') return 'ac';
  return 'check';
}

/** Os alvos do começo de um trecho e o que sobra depois deles. */
export function parseTarget(rest) {
  const groups = [];
  let abilities = [];
  let skills = [];
  let quals = {};
  let i = 0;
  let end = 0;
  for (;;) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(rest);
    if (!m) break;
    if (m[3]) abilities.push(ABILITY[norm(m[3])]);
    else if (m[5] != null) {
      const codes = m[5].split(/\s*(?:,|\bor\b|\band\b)\s*/).filter(Boolean).map((s) => skillCode(norm(s)));
      if (!codes.length || codes.some((c) => !SKILL_ABILITY[c])) break;
      skills.push(...codes);
    } else if (m[7]) {
      const q = norm(m[7]).replace(/'s$/, '');
      if (q === 'melee' || q === 'ranged') quals.melee = q === 'melee';
      else quals[q] = true;
    } else if (m[6]) {
      const kind = kindOf(m[6]);
      const prev = groups[groups.length - 1];
      const inherit = kind !== 'attack' && kind !== 'damage' && prev && !skills.length;
      const own = { ...(prev && kind === 'damage' && prev.kind === 'attack' ? { melee: prev.melee, weapon: prev.weapon, spell: prev.spell } : {}), ...quals };
      groups.push({ kind, abilities: abilities.length ? abilities : inherit ? prev.abilities : [], skills: kind === 'check' ? skills : [], ...Object.fromEntries(Object.entries(own).filter(([, v]) => v != null)) });
      abilities = [];
      skills = [];
      quals = {};
      end = TOKEN.lastIndex;
    }
    i = TOKEN.lastIndex;
  }
  const rolls = groups.filter((g) => g.kind !== 'ac');
  return rolls.length ? { groups: rolls, tail: rest.slice(end) } : null;
}

/** O resto da oração depois do alvo, até o fim dela. */
export function clauseTail(rest) {
  return rest.split(TAIL_END)[0].trim().replace(/^,\s*/, '');
}

/** A condição que o app confere sozinho: 'bloodied', 'rage', 'concentrating' ou o id de uma condição. */
export function autoCondition(lead) {
  const s = norm(lead);
  if (s === 'while bloodied' || s === 'while you are bloodied') return 'bloodied';
  if (/^while (?:your rage is active|you are raging|raging)$/.test(s)) return 'rage';
  if (/^while you (?:maintain|are maintaining) concentration(?: on a spell)?$/.test(s)) return 'concentrating';
  const m = s.match(/^while (?:you (?:are|have the) )?(\w+)(?: condition)?$/);
  return m && CONDITION_NAMES.includes(m[1]) ? m[1] : null;
}

/** A condição escrita antes do sujeito, ou null. */
export function leadingCondition(lead) {
  const s = lead.trim().replace(/^starting (?:at|when) [^,]*,\s*/i, '').replace(/^(?:in addition|additionally|also),\s*/i, '').trim();
  if (!s) return null;
  const once = s.match(/^(once per turn),\s*((?:when|whenever)\b[^,]*)/i);
  if (once) return `${once[1]}, ${once[2]}`;
  if (SUBORDINATE.test(s)) return s.split(',')[0].trim();
  const inner = s.match(/(?:,\s*|\band\s+)((?:when|whenever|if|while|until)\b[^,]*),?\s*$/i);
  return inner ? inner[1].trim() : null;
}

/** O alvo que a condição da frente nomeia ("When you make a Charisma (Persuasion) check"). */
export function leadTarget(lead) {
  const s = String(lead ?? '').trim().replace(/^starting (?:at|when) [^,]*,\s*/i, '').split(',')[0];
  const m = s.match(/^(?:when|whenever|if)\s+you\b.*?\b(?:make|roll|fail)s?\s+(?:an?\s+|any\s+|one\s+)?(.*)$/i);
  const target = m ? parseTarget(m[1]) : null;
  return target ? { groups: target.groups, tail: clauseTail(target.tail) } : null;
}

/** Um termo do texto como fórmula ("your Wisdom modifier", "half your druid level"), ou null. */
export function termFormula(term) {
  const t = norm(term).replace(/^(?:your|the)\s+/, '');
  let m;
  if ((m = t.match(/^(\d+)d(\d+)$/))) return `${m[1]}d${m[2]}`;
  if ((m = t.match(/^(\d+)$/))) return m[1];
  if ((m = t.match(new RegExp(`^(${ABILITY_WORDS}) modifier$`)))) return `@abilities.${ABILITY[m[1]]}.mod`;
  if (/^proficiency(?: bonus)?$/.test(t)) return '@prof';
  if (/^rage damage(?: bonus)?$/.test(t)) return '@scale.barbarian.rage-damage';
  if ((m = t.match(/^(twice|half|two times|three times|(\d+) times)\s+(.+)$/))) {
    const inner = termFormula(m[3]);
    if (!inner) return null;
    if (m[1] === 'half') return `floor(${inner} / 2)`;
    const n = m[1] === 'twice' || m[1] === 'two times' ? 2 : m[1] === 'three times' ? 3 : Number(m[2]);
    return `${n} * ${inner}`;
  }
  if ((m = t.match(/^([a-z]+) level$/)) && m[1] !== 'spell' && m[1] !== 'character') return `@classes.${m[1]}.levels`;
  return null;
}

/** Uma expressão do texto ("1d10 plus your Ranger level (minimum of 1)") como fórmula, ou null. */
export function exprFormula(text) {
  let min = false;
  const s = norm(text).replace(/\s*\(minimum of \+?1\b[^)]*\)/, () => {
    min = true;
    return '';
  }).trim();
  if (!s) return null;
  const terms = s.split(/\s+(?:plus|\+|and)\s+/).map(termFormula);
  if (terms.some((t) => !t)) return null;
  const sum = terms.join(' + ');
  return min ? `max(1, ${sum})` : sum;
}

/**
 * O alvo, a condição da frente e a de trás de uma oração cujo sujeito termina em `at`.
 * @returns {{ groups: object[], lead: string|null, tail: string, rest: string }|null}
 */
export function readClause(sentence, start, at) {
  const before = sentence.slice(0, start);
  const after = sentence.slice(at);
  const lt = BACKREF.test(after) ? leadTarget(before) : null;
  if (lt) return { groups: lt.groups, lead: lt.tail || null, tail: clauseTail(after.replace(BACKREF, '')), rest: after.replace(BACKREF, '') };
  const target = parseTarget(after);
  if (!target) return null;
  return { groups: target.groups, lead: leadingCondition(before), tail: clauseTail(target.tail), rest: target.tail };
}

/**
 * As orações de vantagem, bônus, reroll do 1 e piso do próprio personagem no texto.
 * @returns {{ effect: object, groups: object[], lead: string|null, tail: string, sentence: string }[]}
 */
export function proseClauses(entries) {
  const out = [];
  for (const sentence of sentencesOf(entries)) {
    const push = (effect, c) => out.push({ effect, groups: c.groups, lead: c.lead, tail: c.tail, sentence });
    let m;

    MODE_SUBJECT.lastIndex = 0;
    while ((m = MODE_SUBJECT.exec(sentence))) {
      if (m[1] && !CLAUSE_START.test(sentence.slice(0, m.index))) continue;
      const c = readClause(sentence, m.index, m.index + m[0].length);
      if (c) push({ mode: norm(m[2]) === 'advantage' ? 'adv' : 'dis' }, c);
    }

    if (/\bas normal\b/i.test(sentence)) continue;
    BONUS_SUBJECT.lastIndex = 0;
    while ((m = BONUS_SUBJECT.exec(sentence))) {
      if (!CLAUSE_START.test(sentence.slice(0, m.index))) continue;
      const c = readClause(sentence, m.index, m.index + m[0].length);
      if (!c) continue;
      let formula = m[1] ? String(Number(m[1])) : null;
      let tail = c.tail;
      const eq = c.rest.trim().replace(/^,\s*/, '').match(/^equal to\s+(.*)$/i);
      if (!formula && eq) {
        const expr = eq[1].split(EXPR_END)[0];
        formula = exprFormula(expr);
        tail = clauseTail(eq[1].slice(expr.length));
      }
      if (!formula || NO_AMOUNT.test(tail)) continue;
      push({ part: formula }, { ...c, tail });
    }

    ADD_SUBJECT.lastIndex = 0;
    while ((m = ADD_SUBJECT.exec(sentence))) {
      const before = sentence.slice(0, m.index);
      if (m[1] ? !CLAUSE_START.test(before) : before.trim() !== '') continue;
      const c = readClause(sentence, m.index, m.index + m[0].length);
      const formula = termFormula(`${m[2]} ${/^(?:proficiency|rage damage)$/i.test(m[2]) ? 'bonus' : 'modifier'}`);
      if (c && formula && !NO_AMOUNT.test(c.tail)) push({ part: formula }, c);
    }

    REROLL_ONES.lastIndex = 0;
    while ((m = REROLL_ONES.exec(sentence))) {
      const target = parseTarget(sentence.slice(m.index + m[0].length));
      if (!target || !/^,?\s*you can reroll the die\b/i.test(target.tail)) continue;
      push({ rerollOnes: true }, { groups: target.groups, lead: leadingCondition(sentence.slice(0, m.index)), tail: '' });
    }

    ROLL_ADD.lastIndex = 0;
    while ((m = ROLL_ADD.exec(sentence))) {
      let lead = sentence.slice(0, m.index);
      const tool = lead.match(TOOL_CHECK);
      if (tool) lead = lead.replace(TOOL_CHECK, '');
      const lt = leadTarget(lead);
      const tools = tool ? tool[1].split(/\s*(?:,|\bor\b)\s*/).map(norm).filter(Boolean) : [];
      const groups = [...(lt?.groups ?? []), ...(tools.length ? [{ kind: 'check', abilities: [], skills: [], tools }] : [])];
      if (groups.length) push({ part: m[1] }, { groups, lead: lt?.tail || null, tail: clauseTail(sentence.slice(m.index + m[0].length)) });
    }

    FLOOR.lastIndex = 0;
    while ((m = FLOOR.exec(sentence))) {
      const lt = leadTarget(sentence.slice(0, m.index));
      if (lt) push({ d20Min: Number(m[2]) }, { groups: lt.groups, lead: lt.tail || null, tail: clauseTail(sentence.slice(m.index + m[0].length)) });
    }
  }
  return out;
}

const SCHOOLS = { abjuration: 'A', conjuration: 'C', divination: 'D', enchantment: 'E', evocation: 'V', illusion: 'I', necromancy: 'N', transmutation: 'T' };
const CLASSES = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
const SPELL_SCOPE = /^(?:whenever|when) you cast an? (?:(\w+) )?spell from the (\w+) school$|^(?:whenever|when) you cast an? (?:(\w+) )?(\w+) spell$/i;
const SPELL_TYPES = /^(once per turn, )?(?:whenever|when) a spell you cast deals (\w+)(?:,? or (\w+))? damage$/i;

const CHOSEN_TYPE = /^(?:whenever|when) you cast a spell that deals damage of that type$/i;

/** A condição da frente que só diz de que magia é ("Whenever you cast a Wizard spell from the Evocation school"): { school, cls }, ou null. */
export function spellScope(lead) {
  const text = String(lead ?? '').trim().replace(/[,\s]+$/, '');
  if (CHOSEN_TYPE.test(text)) return { chosen: true };
  const t = text.match(SPELL_TYPES);
  if (t) return { types: [t[2], t[3]].filter(Boolean).map(norm), ...(t[1] ? { oncePerTurn: true } : {}) };
  const m = text.match(SPELL_SCOPE);
  if (!m) return null;
  const a = norm(m[1] ?? m[3]);
  const b = norm(m[2] ?? m[4]);
  const cls = CLASSES.includes(a) ? a : m[3] && CLASSES.includes(b) ? b : null;
  const school = SCHOOLS[b] ?? (m[3] ? SCHOOLS[a] : null) ?? null;
  if (a && !cls && !SCHOOLS[a]) return null;
  return school || cls ? { school, cls } : null;
}

const CANTRIP_SCOPE = /^(?:you deal )?with (?:any|a|an|one of your) (?:(\w+) )?cantrips?$/i;

/** O resto da oração que só diz o cantrip ("with any Druid cantrip"): { cantrip: true, cls }, ou null. */
export function cantripScope(tail) {
  const m = String(tail ?? '').trim().replace(/[.,\s]+$/, '').match(CANTRIP_SCOPE);
  if (!m) return null;
  const cls = m[1] ? norm(m[1]) : null;
  if (cls && !CLASSES.includes(cls)) return null;
  return { cantrip: true, cls };
}

/** O resto que só repete o escopo da rolagem ("one damage roll of that spell"): não vira nota. */
const SCOPE_ONLY = /^(?:of (?:that|the|this) (?:spell|attack|weapon|roll)|against one of the spell's targets)$/i;

/**
 * As entradas do catálogo: uma por oração, com quando vale e se começa ligada.
 * @param {{ name: string, actionKey?: string, entries?: any[] }[]} features
 * @param {{ activated?: (f: object) => boolean, bridged?: object[] }} [opts]
 */
export function proseRollEffects(features, { activated = () => false, bridged = [], chosenTypes = () => [] } = {}) {
  const owned = new Set(bridged.map((e) => norm(e.name)));
  const upgrades = diceUpgrades(features);
  const out = [];
  const seen = new Set();
  for (const f of features ?? []) {
    if (featureRollOf(f.name)) continue;
    proseClauses(f.entries).forEach((c, i) => {
      if (owned.has(norm(f.name))) return;
      const sig = `${norm(f.name)}|${c.sentence}|${i}`;
      if (seen.has(sig)) return;
      seen.add(sig);
      const concentration = /\bmaintain\b.*\bconcentration\b/i.test(c.tail);
      const incapacitated = /^unless you have the incapacitated condition$/i.test(c.tail);
      const when = c.lead ? autoCondition(c.lead) : null;
      const tailScope = cantripScope(c.tail);
      const leadScope = spellScope(c.lead);
      const picked = leadScope?.chosen ? (chosenTypes(f) ?? []).map(norm) : [];
      const scope = (leadScope?.chosen ? (picked.length ? { types: picked } : null) : leadScope) ?? tailScope;
      const oncePerCast = !!scope && /\bone damage roll\b/i.test(c.sentence);
      const activation = !!c.lead && !scope && ACTIVATION.test(c.lead);
      const active = (!scope && activated(f)) || activation;
      const tail = SCOPE_ONLY.test(c.tail) || tailScope ? '' : c.tail;
      const conditions = [c.lead && !when && !activation && !scope ? c.lead : null, tail && !incapacitated && !concentration ? tail : null].filter(Boolean);
      let note = conditions.map(noteOf).join('; ');
      if (when) note = note ? `${noteOf(c.lead)}; ${note}` : noteOf(c.lead);
      if (!note && active) note = `After you use ${f.name}`;
      if (!note && scope && /\bone damage roll\b/i.test(c.sentence)) note = 'One damage roll each time you cast the spell';
      if (!note && scope?.types && !oncePerCast) note = `${scope.oncePerTurn ? 'Once per turn, a' : 'A'}gainst one of the spell's targets`;
      if (incapacitated) note = note ? `${note}; not while Incapacitated` : 'Not while Incapacitated';
      out.push({
        name: f.name,
        actionKey: f.actionKey ?? null,
        ...(c.effect.mode ? { mode: c.effect.mode } : {}),
        ...(c.effect.part ? { part: { label: upgrades.get(`${norm(f.name)}|${c.effect.part}`) ? `${f.name} (${upgrades.get(`${norm(f.name)}|${c.effect.part}`).by})` : f.name, formula: upgrades.get(`${norm(f.name)}|${c.effect.part}`)?.to ?? c.effect.part } } : {}),
        ...(c.effect.rerollOnes ? { rerollOnes: true } : {}),
        ...(c.effect.d20Min ? { d20Min: c.effect.d20Min } : {}),
        groups: concentration ? c.groups.map((g) => ({ ...g, kind: g.kind === 'save' ? 'concentration' : g.kind })) : scope ? c.groups.map((g) => ({ ...g, spell: true })) : c.groups,
        ...(scope ? { spellOf: scope } : {}),
        ...(oncePerCast ? { oncePerCast: true } : {}),
        defaultOn: !conditions.length && (!!when || !active),
        ...(when ? { when } : {}),
        ...(incapacitated ? { unless: 'incapacitated' } : {}),
        ...(note ? { note } : {}),
        index: i,
      });
    });
  }
  return out;
}

/** O dado que outra feature troca ("When you use the ... benefit of your Mark of Detection feat, you can roll 1d6 instead of 1d4"): "feature|de" -> { to, by }. */
export function diceUpgrades(features) {
  const out = new Map();
  for (const f of features ?? []) {
    for (const sentence of sentencesOf(f.entries)) {
      const m = sentence.match(UPGRADE);
      if (m) out.set(`${norm(m[1])}|${m[3]}`, { to: m[2], by: f.name });
    }
  }
  return out;
}

/**
 * A cura e os PV temporários que o "Use" da feature dá, pela prosa: uma entrada por feature.
 * @param {{ name: string, entries?: any[] }[]} features
 * @param {{ hasActivity?: (f: object) => boolean }} [opts]
 * @returns {{ name: string, apply: 'heal'|'temp', formula: string, label: string, note: string|null }[]}
 */
export function proseUses(features, { hasActivity = () => false } = {}) {
  const out = [];
  for (const f of features ?? []) {
    if (featureRollOf(f.name) || hasActivity(f) || out.some((u) => u.name === f.name)) continue;
    let found = null;
    const sentences = sentencesOf(f.entries);
    for (const [i, sentence] of sentences.entries()) {
      const make = (apply, formula, note = null) => ({ name: f.name, apply, formula, label: apply === 'temp' ? 'Temporary Hit Points' : 'Hit Points regained', note });
      const per = sentence.match(HEAL_PER_LEVEL);
      if (per) {
        found = make(/^temporary/i.test(per[2]) ? 'temp' : 'heal', `${per[1]} * @classes.${norm(per[3])}.levels`);
        break;
      }
      const fixed = sentence.match(HEAL_FIXED);
      if (fixed && CLAUSE_START.test(sentence.slice(0, fixed.index))) {
        found = make(/^temporary/i.test(fixed[2]) ? 'temp' : 'heal', fixed[1]);
        break;
      }
      const later = sentence.match(HEAL_LATER);
      const these = later ? (sentences[i + 1] ?? '').match(HEAL_THESE) : null;
      const theseFormula = these ? exprFormula(sentences[i + 1].slice(these[0].length).split(EXPR_END)[0]) : null;
      if (theseFormula) {
        found = make(/^temporary/i.test(later[1]) ? 'temp' : 'heal', theseFormula);
        break;
      }
      HEAL.lastIndex = 0;
      let m;
      while (!found && (m = HEAL.exec(sentence))) {
        if ((m[1] || m[2]) && !CLAUSE_START.test(sentence.slice(0, m.index).replace(/\bto yourself or another creature[^,]*,\s*$/i, ', '))) continue;
        const rest = sentence.slice(m.index + m[0].length);
        const formula = exprFormula(rest.split(EXPR_END)[0]);
        if (!formula) continue;
        found = make(/^temporary/i.test(m[4]) ? 'temp' : 'heal', formula, m[3] ? 'You or another creature: give it to the other by hand' : null);
      }
      if (found) break;
    }
    if (found) out.push(found);
  }
  return out;
}

/** A nota legível: sem o "you make" da frente, com maiúscula. */
export function noteOf(text) {
  const t = String(text ?? '').trim().replace(/^(?:that )?(?:you make|made|you roll|you deal)\s+/i, '').replace(/[,\s]+$/, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

/** Um grupo do alvo vale para esta rolagem? */
function fitsGroup(g, roll) {
  const has = (a) => !g.abilities.length || g.abilities.includes(a);
  const quals = () => (!g.weapon || roll.weapon) && (!g.spell || roll.spell) && (g.melee == null || (roll.melee !== false) === g.melee);
  switch (g.kind) {
    case 'd20': return D20.includes(roll.kind);
    case 'attack': return roll.kind === 'attack' && quals();
    case 'damage': return roll.kind === 'damage' && quals();
    case 'initiative': return roll.kind === 'initiative';
    case 'concentration': return roll.kind === 'concentration';
    case 'save':
      if (roll.kind === 'save') return has(roll.ability);
      if (roll.kind === 'concentration') return has('con');
      return roll.kind === 'deathSave' && !g.abilities.length;
    case 'check':
      if (g.tools) return roll.kind === 'check' && !!roll.tool && g.tools.includes(norm(roll.tool));
      if (roll.kind === 'check') return has(roll.ability) && (!g.skills.length || g.skills.includes(roll.skill));
      return roll.kind === 'initiative' && !g.skills.length && has('dex');
    default: return false;
  }
}

/** A entrada vale para esta rolagem? */
export function fitsProse(e, roll) {
  if (e.spellOf && (!roll.spell || (e.spellOf.school && roll.school !== e.spellOf.school) || (e.spellOf.cls && roll.spellClass !== e.spellOf.cls))) return false;
  if (e.spellOf?.types && !(roll.types ?? []).some((x) => e.spellOf.types.includes(norm(x)))) return false;
  if (e.spellOf?.cantrip && !roll.cantrip) return false;
  return e.groups.some((g) => fitsGroup(g, roll));
}

/** Os extras da prosa que valem para uma rolagem, no formato de rollEffects. */
export function proseEffects(catalog, roll, { conditionIds = [], skipKeys = [], skipNames = [], bloodied = false, raging = false, concentrating = false } = {}) {
  const out = [];
  for (const e of catalog.proseEffects ?? []) {
    if ((e.actionKey && skipKeys.includes(e.actionKey)) || skipNames.includes(norm(e.name)) || !fitsProse(e, roll)) continue;
    if (roll.kind === 'deathSave' && e.note) continue;
    let on = e.defaultOn;
    if (e.when === 'bloodied') on = on && bloodied;
    else if (e.when === 'rage') on = on && raging;
    else if (e.when === 'concentrating') on = on && concentrating;
    else if (e.when) on = on && conditionIds.includes(e.when);
    if (e.unless && conditionIds.includes(e.unless)) on = false;
    const label = e.rerollOnes ? `${e.name} (reroll a 1)` : e.d20Min ? `${e.name} (${e.d20Min - 1} or lower counts as ${e.d20Min})` : e.name;
    const entry = { id: `prose:${slug(e.name)}:${e.index}`, label, source: e.name, defaultOn: on, ...(e.note ? { note: e.note } : {}), ...(e.oncePerCast ? { oncePerCast: true } : {}) };
    if (e.mode === 'adv') entry.adv = 1;
    else if (e.mode === 'dis') entry.dis = 1;
    else if (e.part) entry.part = e.part;
    else if (e.rerollOnes) entry.rerollOnes = true;
    else if (e.d20Min) entry.d20Min = e.d20Min;
    out.push(entry);
  }
  return out;
}
