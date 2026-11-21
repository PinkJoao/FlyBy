// =============================================================================
// itemEffects: o que um item mágico ativo muda na ficha
// =============================================================================
// O QUE FAZ
//   Lê os campos estruturados do 5etools dos itens ATIVOS (equipados; atunados quando pedem
//   atunamento) e devolve o que a derivação aplica: os atributos (`ability`: "fixa em N" e
//   "+N"), o bônus no ataque e na CD de magia (`bonusSpellAttack`, `bonusSpellSaveDc`, por
//   classe quando o texto restringe), o bônus nos testes de atributo (`bonusAbilityCheck`) e
//   os deslocamentos sempre ligados (`modifySpeed`). Puro: quem chama é o resolve e o catálogo
//   do jogo (DDL-0256).
//
// FUNÇÕES
//   isActiveItem(entry): o item vale agora (atunado; ou equipado se não pede atunamento)?
//   bonusOf(value): o número de "+2", 2 ou "-1".
//   plainItemText(raw): o texto do item sem as tags (a classe vem como "{@filter warlock spells|...}").
//   abilityCapOf(raw): o teto do "+N" pelo texto ("to a maximum of 24"), ou 20.
//   itemAbilityEffects(entries): os aumentos `{ ability, amount, max, source }` e os pisos
//     `{ ability, set, source }` dos itens ativos.
//   spellClassOf(raw): a classe a que o texto restringe o bônus de magia ("your warlock spells"), ou null.
//   itemSpellBonuses(entries): os bônus de ataque e CD de magia `{ source, attack, dc, cls }`.
//   itemCheckBonus(entries): o bônus plano nos testes de atributo `{ bonus, sources, skills }`; `skills` é o bônus
//     por perícia que só o texto dá (itemSkillBonuses).
//   itemSkillBonuses(raw): "you gain a +5 bonus to Dexterity (Sleight of Hand) checks." sem condição depois: Gloves
//     of Thievery, Eyes of Deceit, Ring of Candor. A frase que segue ("made to climb", "you make to find your way")
//     fica de fora: o bônus é da situação (oráculo `numbers`, DDL-0277).
//   speedActivated(raw): o deslocamento do item só vale ao ativar (cargas, consumível, multiplicar)?
//   itemSpeeds(entries, walk): os deslocamentos sempre ligados `{ mode: { feet, note } }`.
//   weaponExtraDamage(raw): o dano extra que o texto da arma dá ("the target takes an extra 1d6 Cold damage"):
//     `{ formula, type, condition, charge }`, a condição sendo a frase quando ela tem uma (DDL-0258).
//   boundSpellRule(raw): o item "Enspelled" ("Bound into this staff is a level 2 spell"): `{ level, schools }`, ou null.
//   storeRuleOf(raw): o item que guarda magias lançadas nele (Ring of Spell Storing, Spell Bottle, Spell Gem):
//     `{ cap, one, maxLevel }` (`cap` em círculos somados; `one` = uma magia por vez), ou null.
//   storedLevels(entry): os círculos que o item já guarda.
//   itemChargeMax(raw): as cargas do item: o campo numérico, o máximo do dado ("{@dice 1d3}") ou o número do texto
//     ("1 of its 3 charges", "begins existence with 1d4 + 1 charges"), ou 0 (DDL-0262).
//   numOf(word): o número de "3" ou "three".
//   chargeCostOf(text): quantas cargas o texto diz que o lançamento gasta (`{ cost, any }`), ou null.
//
// DECISÕES E ARMADILHAS
//   - "Fixa em N" (Amulet of Health, os Belts of Giant Strength) é um PISO: o texto diz que não faz nada
//     se o atributo já é N ou mais; vai em `set` e o finalScores aplica depois dos aumentos.
//   - "+N" (Ioun Stones, Belt of Dwarvenkind) respeita o teto que o texto dá; sem teto no texto, 20.
//   - A escolha de atributo de item (`choose`: Ashen Band, Book of Vile Darkness, os baralhos) não tem onde
//     ficar guardada; fica fora (o texto diz) até ter uma escolha no inventário.
//   - O bônus de magia restrito ("the spell attack rolls and saving throw DCs of your warlock spells", Rod of
//     the Pact Keeper) vale só na origem daquela classe; sem classe no texto, em toda origem.
//   - Deslocamento de ativação (Boots of Speed multiplica ao bater os calcanhares, Winged Boots gasta cargas,
//     a poção é consumível) NÃO entra na ficha: é estado de jogo, e o item já tem o seu Use ou as cargas.
//   - O dano extra da arma (weaponExtraDamage, DDL-0258): cada "extra NdM [tipo] damage" do texto vira um extra
//     do diálogo de dano. Sem condição na frase ("When you hit with an attack using it, the target takes an extra
//     2d10 Cold damage"; "on a hit") vem LIGADO; com uma (o tipo de criatura, "while ablaze", "if", o ataque à
//     distância, o crítico, "can", a carga) vem desligado com a frase como nota. "Expend 1 charge" e "for each
//     charge you expend" gastam UMA carga por extra ligado (o "up to 3" se repete à mão). A frase com "or an
//     extra" (Dwarven Thrower) dá os dois desligados: só a mesa sabe qual vale. O dano que o alvo toma ao falhar
//     uma salvaguarda no acerto ("must succeed on a 15 Constitution saving throw or take 2d10 Poison damage", Dagger
//     of Venom depois de untada) também é extra desligado, com a CD na nota.
//   - Enspelled (DDL-0258): o texto diz o círculo ("a level 2 spell", "a cantrip") e a tag do filtro diz as escolas
//     (`{@filter ...|school=A;I|level=1}`, lida no JSON CRU, antes de tirar as tags); sem a tag, qualquer escola. A
//     magia escolhida mora na entrada do inventário (`boundSpell: 'Name|Source'`).
//   - Guardar magia (DDL-0258): "store up to 5 levels worth of spells" soma círculos (o anel, a Ioun Stone Reserve);
//     "store one spell of up to 5th level" e "contain one spell" guardam uma (a garrafa, as Spell Gems). O teto do
//     círculo vem de "1st through 5th level" ou "up to 8th level". O guardado mora na entrada (`stored`), com o
//     círculo, a CD e o ataque de quem lançou (o anel usa os de quem lançou; a gema tem os seus no texto).
//   - Cargas sem número no campo (DDL-0262): o Ring of Three Wishes e as Luck Weapons só dão as cargas no texto ou
//     num dado; o máximo do dado é o teto (o contador do jogo ajusta o máximo à mão, DDL-0209).
//   - O export escreve o atributo SEM os itens (`baseScores` no resolve): o item no Foundry leva o próprio
//     efeito, e somar os dois duplicaria o "+2".
// -----------------------------------------------------------------------------

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const CLASS_WORDS = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];

/** O item vale agora? Atunado; ou equipado, se não pede atunamento. */
export function isActiveItem(entry) {
  if (!entry?.raw) return false;
  if (entry.attuned) return true;
  if (entry.required || entry.raw.reqAttune) return false;
  return !!entry.equipped;
}

/** O número de "+2", 2 ou "-1". */
export function bonusOf(value) {
  if (typeof value === 'number') return value;
  const n = parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** O texto do item sem as tags do 5etools ("{@filter warlock spells|...}" vira "warlock spells"). */
export function plainItemText(raw) {
  return JSON.stringify(raw?.entries ?? []).replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1');
}

/** O teto do "+N" pelo texto do item ("to a maximum of 24"), ou 20. */
export function abilityCapOf(raw) {
  const m = plainItemText(raw).match(/to a maximum of (\d+)/i);
  return m ? Number(m[1]) : 20;
}

/** Os aumentos e os pisos de atributo dos itens ativos. */
export function itemAbilityEffects(entries = []) {
  const out = [];
  for (const e of entries) {
    const ab = e?.raw?.ability;
    if (!ab || !isActiveItem(e)) continue;
    const source = e.raw.name;
    for (const [a, v] of Object.entries(ab.static ?? {})) if (ABILITY_KEYS.includes(a)) out.push({ ability: a, set: Number(v) || 0, source });
    const cap = abilityCapOf(e.raw);
    for (const a of ABILITY_KEYS) if (typeof ab[a] === 'number') out.push({ ability: a, amount: ab[a], max: cap, source });
  }
  return out;
}

/** A classe a que o texto do item restringe o bônus de magia, ou null. */
export function spellClassOf(raw) {
  const text = plainItemText(raw).toLowerCase();
  const m = text.match(new RegExp(`\\byour (${CLASS_WORDS.join('|')}) spells\\b`));
  return m ? m[1] : null;
}

/** Os bônus de ataque e CD de magia dos itens ativos. */
export function itemSpellBonuses(entries = []) {
  const out = [];
  for (const e of entries) {
    const r = e?.raw;
    if (!r || (!r.bonusSpellAttack && !r.bonusSpellSaveDc) || !isActiveItem(e)) continue;
    out.push({ source: r.name, attack: bonusOf(r.bonusSpellAttack), dc: bonusOf(r.bonusSpellSaveDc), cls: spellClassOf(r) });
  }
  return out;
}

/** O bônus plano nos testes de atributo dos itens ativos. */
export function itemCheckBonus(entries = []) {
  let bonus = 0;
  const sources = [];
  const skills = {};
  for (const e of entries) {
    if (!isActiveItem(e)) continue;
    const b = bonusOf(e?.raw?.bonusAbilityCheck);
    if (b) {
      bonus += b;
      sources.push({ name: e.raw.name, value: b });
    }
    for (const s of itemSkillBonuses(e.raw)) (skills[s.skill] ??= []).push({ name: e.raw.name, value: s.value });
  }
  return { bonus, sources, skills };
}

const SKILL_IDS = {
  acrobatics: 'acr', 'animal handling': 'ani', arcana: 'arc', athletics: 'ath', deception: 'dec', history: 'his',
  insight: 'ins', intimidation: 'itm', investigation: 'inv', medicine: 'med', nature: 'nat', perception: 'prc',
  performance: 'prf', persuasion: 'per', religion: 'rel', 'sleight of hand': 'slt', stealth: 'ste', survival: 'sur',
};

/** O bônus fixo do texto numa perícia ("you gain a +5 bonus to Dexterity (Sleight of Hand) checks."), sem condição. */
export function itemSkillBonuses(raw) {
  const out = [];
  const text = plainItemText(raw);
  for (const m of text.matchAll(/you gain a \+(\d+) bonus to \w+ \(([A-Za-z ]+)\) checks\./g)) {
    const skill = SKILL_IDS[m[2].trim().toLowerCase()];
    if (skill) out.push({ skill, value: Number(m[1]) });
  }
  return out;
}

/** O deslocamento do item só vale ao ativar (cargas, consumível, multiplicar)? */
export function speedActivated(raw) {
  return !!(raw?.charges || raw?.type === 'P' || String(raw?.type ?? '').startsWith('P|') || raw?.modifySpeed?.multiply);
}

/** Os deslocamentos sempre ligados dos itens ativos: { mode: { feet, note } }. */
export function itemSpeeds(entries = [], walk = 0) {
  const out = {};
  const put = (mode, feet, note) => {
    if (feet > 0 && !(out[mode]?.feet >= feet)) out[mode] = { feet, note };
  };
  for (const e of entries) {
    const ms = e?.raw?.modifySpeed;
    if (!ms || !isActiveItem(e) || speedActivated(e.raw)) continue;
    for (const [mode, v] of Object.entries(ms.equal ?? {})) if (v === 'walk') put(mode, walk, e.raw.name);
    for (const [mode, v] of Object.entries(ms.static ?? {})) put(mode, Number(v) || 0, e.raw.name);
    if (ms.bonus) for (const [mode, v] of Object.entries(ms.bonus)) put(mode === '*' ? 'walk' : mode, walk + (Number(v) || 0), e.raw.name);
  }
  return out;
}

const DAMAGE_WORDS = 'acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder';
const EXTRA_DAMAGE = new RegExp(`\\bextra (\\d+d\\d+(?: \\+ \\d+)?)(?: (${DAMAGE_WORDS}))? damage`, 'gi');
const CONDITION = /\b(if|while|unless|against|instead|can|may|expend|charges?|critical|roll(?:s|ed)? a 20|ranged attack|thrown|aberrations?|beasts?|celestials?|constructs?|dragons?|elementals?|fey|fiends?|giants?|monstrosit(?:y|ies)|oozes?|plants?|undead|good|evil|aligned|attuned|soul|illithid|transformed|ablaze|glowing|bloodied|first time)\b/i;
const SAVE_DAMAGE = new RegExp(`succeed on a (?:DC )?(\\d+) (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw or take (\\d+d\\d+(?: \\+ \\d+)?) (${DAMAGE_WORDS}) damage`, 'gi');
const CHARGE = /\bexpend (?:1|one|up to \w+) (?:of its )?charges?\b|\bfor each charge you expend\b/i;

/** O dano extra que o texto da arma dá: `[{ formula, type, condition, charge }]` (condition null = sempre). */
export function weaponExtraDamage(raw) {
  if (!raw) return [];
  const text = plainItemText(raw).replace(/\\"/g, '"');
  const out = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|","|"\]|\["/)) {
    const hits = [...sentence.matchAll(EXTRA_DAMAGE)];
    if (!hits.length && !SAVE_DAMAGE.test(sentence)) continue;
    SAVE_DAMAGE.lastIndex = 0;
    const clean = sentence.replace(/^["[\s]+|["\]\s]+$/g, '').trim();
    const conditional = CONDITION.test(clean) || /\bor an extra\b/i.test(clean);
    const charge = CHARGE.test(clean) && Number(raw.charges) > 0;
    for (const m of hits) {
      out.push({ formula: m[1], type: m[2] ? m[2].toLowerCase() : null, condition: conditional ? clean : null, charge });
    }
    for (const m of sentence.matchAll(SAVE_DAMAGE)) {
      out.push({ formula: m[3], type: m[4].toLowerCase(), condition: `DC ${m[1]} ${m[2][0].toUpperCase()}${m[2].slice(1)} save, on a failure: ${clean}`, charge });
    }
  }
  return out;
}

const ORDINAL = '(\\d)(?:st|nd|rd|th)?';

/** O item "Enspelled": o círculo e as escolas (códigos do 5etools) da magia que ele guarda, ou null. */
export function boundSpellRule(raw) {
  if (!raw) return null;
  const text = plainItemText(raw);
  const m = text.match(/\bBound into this \w+ is (?:a level (\d) spell|a cantrip)/i);
  if (!m) return null;
  const tag = JSON.stringify(raw.entries ?? []).match(/school=([A-Z;]+)/);
  return { level: m[1] ? Number(m[1]) : 0, schools: tag ? tag[1].split(';') : null };
}

/** O item que guarda magias lançadas nele: `{ cap, one, maxLevel }`, ou null. */
export function storeRuleOf(raw) {
  if (!raw) return null;
  const text = plainItemText(raw);
  const levels = text.match(/\bstore up to (\d+) levels? worth of spells/i);
  const through = text.match(new RegExp(`spell of 1st through ${ORDINAL} level`, 'i'));
  if (levels) return { cap: Number(levels[1]), one: false, maxLevel: through ? Number(through[1]) : Number(levels[1]) };
  const one = text.match(new RegExp(`\\bstore one spell of up to ${ORDINAL} level`, 'i'));
  if (one) return { cap: null, one: true, maxLevel: Number(one[1]) };
  const gem = /\bcan contain one spell\b/i.test(text) && text.match(new RegExp(`\\bstore up to ${ORDINAL} level spells`, 'i'));
  if (gem) return { cap: null, one: true, maxLevel: Number(gem[1]) };
  return null;
}

/** Os círculos que o item já guarda. */
export function storedLevels(entry) {
  return (entry?.stored ?? []).reduce((s, x) => s + (Number(x.level) || 0), 0);
}

const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const numOf = (w) => WORD_NUM[String(w).toLowerCase()] ?? Number(w);
const DICE_MAX = /(\d+)d(\d+)(?:\s*\+\s*(\d+))?/;

/** As cargas do item: o campo, o máximo do dado do campo, ou o número do texto; 0 sem cargas. */
export function itemChargeMax(raw) {
  const n = Number(raw?.charges);
  if (n > 0) return n;
  const dice = String(raw?.charges ?? '').match(DICE_MAX);
  if (dice) return Number(dice[1]) * Number(dice[2]) + Number(dice[3] ?? 0);
  const text = plainItemText(raw);
  const rolled = text.match(/(?:has|with) (\d+d\d+(?:\s*\+\s*\d+)?) charges/i)?.[1]?.match(DICE_MAX);
  if (rolled) return Number(rolled[1]) * Number(rolled[2]) + Number(rolled[3] ?? 0);
  const m = text.match(/\b(?:has|of its|with) (\d+|one|two|three|four|five|six|seven|eight|nine|ten) charges\b/i);
  return m ? numOf(m[1]) : 0;
}

/** As cargas que o texto diz que o lançamento gasta: `{ cost, any }` ("expend 1 charge", "any number of charges"), ou null. */
export function chargeCostOf(text) {
  const m = String(text ?? '').match(/\b(?:expend|spend|use)s? (\d+|one|two|three|four|five|any number) (?:of )?(?:(?:its|the [\w' ]+?) )?charges?\b/i);
  if (!m) return null;
  return /any/i.test(m[1]) ? { cost: 1, any: true } : { cost: numOf(m[1]) || 1, any: false };
}
