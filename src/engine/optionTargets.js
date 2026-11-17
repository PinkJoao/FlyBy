// =============================================================================
// optionTargets: a cantrip que uma invocação melhora, e as opções repetíveis
// =============================================================================
// O QUE FAZ
//   O Agonizing Blast, o Eldritch Spear e o Repelling Blast (XPHB) dizem "Choose one of your known
//   Warlock cantrips that deals damage" (e "has a range of 10+ feet", "requires an attack roll") e
//   "You can gain this invocation more than once. Each time you do so, choose a different eligible
//   cantrip". Aqui a escolha vira uma sub-escolha da opção (`cantripTarget`, uma lista das cantrips
//   da classe que o personagem conhece e passam no filtro do texto), e a opção repetível pode entrar
//   mais de uma vez no saco, cada vez com o seu `sub` (DDL-0240).
//
// FUNÇÕES
//   norm(s), textOf(raw): o nome normalizado e o texto corrido de uma entidade.
//   isRepeatableOption(raw): a opção pode ser escolhida mais de uma vez (flag ou texto)?
//   subKeyOf(picks, index): a chave do `sub` da ocorrência (a primeira é o próprio pick, as outras "#2", "#3").
//   cantripTargetChoice(raw): a sub-escolha da cantrip que o texto pede, ou null.
//   cantripPasses(spell, filter): a magia passa no filtro (cantrip, dano, ataque, alcance)?
//   knownCantrips(character, db, className): as cantrips da classe que o personagem conhece.
//   withTargetOptions(choices, ctx): as sub-escolhas com as opções do personagem (e sem as já tomadas
//     pelas outras ocorrências da mesma opção).
//   optionTargets(character): { "agonizing blast": ["Eldritch Blast", ...] }, as cantrips escolhidas.
//
// DECISÕES E ARMADILHAS
//   - "Known" é a lista da CLASSE no personagem (`classes[].spells`), resolvida no compêndio; uma cantrip
//     concedida por outra via (o Pact of the Tome) não entra: o texto diz "Warlock cantrips".
//   - A escolha guarda o NOME da magia (a lista do jogo compara pelo nome da magia lançada).
//   - Sem escolha feita (personagem antigo), o jogo segue valendo para toda cantrip de dano.
// -----------------------------------------------------------------------------

import { allSpells } from './spells';

const norm = (s) => String(s ?? '').trim().toLowerCase();
const textOf = (raw) => JSON.stringify(raw?.entries ?? []).replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1');
const TARGET = /Choose one of your known (\w+) cantrips( that deals damage)?( and has a range of 10\+ feet)?( that requires an attack roll)?/i;
const REPEATABLE = /\b(?:can gain|can take|can choose) this (?:invocation|feat|option|feature) more than once\b/i;

/** A opção pode ser escolhida mais de uma vez (a flag do dado ou o texto)? */
export function isRepeatableOption(raw) {
  return !!raw?.isRepeatable || REPEATABLE.test(textOf(raw));
}

/** A chave do `sub` da ocorrência `index` de um pick: a primeira é o próprio id, as outras "id#2", "id#3". */
export function subKeyOf(picks, index) {
  const id = picks[index];
  const n = picks.slice(0, index).filter((p) => p === id).length;
  return n ? `${id}#${n + 1}` : id;
}

/** A sub-escolha da cantrip que o texto da opção pede, ou null. */
export function cantripTargetChoice(raw) {
  const m = textOf(raw).match(TARGET);
  if (!m) return null;
  return {
    id: 'cantripTarget',
    kind: 'cantripTarget',
    count: 1,
    label: 'Cantrip',
    pool: { type: 'list', options: [], cantripFilter: { className: m[1], damage: !!m[2], range10: !!m[3], attack: !!m[4] } },
  };
}

/** A magia passa no filtro (cantrip, dano, rolagem de ataque, alcance de 10 pés ou mais)? */
export function cantripPasses(spell, filter) {
  if (!spell || spell.level !== 0) return false;
  if (filter.damage && !(spell.damageInflict ?? []).length) return false;
  if (filter.attack && !(spell.spellAttack ?? []).length) return false;
  if (filter.range10) {
    const d = spell.range?.distance;
    if (!d || d.type !== 'feet' || !(Number(d.amount) >= 10)) return false;
  }
  return true;
}

/** As cantrips da classe que o personagem conhece, resolvidas no compêndio. */
export function knownCantrips(character, db, className) {
  const all = allSpells(db);
  return (character?.classes ?? [])
    .filter((c) => !className || norm(c.classId) === norm(className))
    .flatMap((c) => c.spells ?? [])
    .map((s) => all.find((x) => x.name === s.id && x.source === s.source) ?? all.find((x) => x.name === s.id))
    .filter((x) => x && x.level === 0);
}

/**
 * As sub-escolhas com as opções vindas do personagem; `taken` são as cantrips já escolhidas pelas outras
 * ocorrências da mesma opção ("choose a different eligible cantrip").
 */
export function withTargetOptions(choices, { character, db, taken = [] }) {
  return (choices ?? []).map((ch) => {
    const f = ch.pool?.cantripFilter;
    if (!f) return ch;
    const options = knownCantrips(character, db, f.className)
      .filter((s) => cantripPasses(s, f) && !taken.includes(s.name))
      .map((s) => ({ value: s.name, label: s.name }));
    return { ...ch, pool: { ...ch.pool, options } };
  });
}

/** As cantrips escolhidas por opção: { "agonizing blast": ["Eldritch Blast"] }. */
export function optionTargets(character) {
  const out = {};
  for (const cls of character?.classes ?? []) {
    for (const entry of Object.values(cls.choices ?? {})) {
      if (entry?.kind !== 'optionalfeature') continue;
      const picks = entry.picks ?? [];
      picks.forEach((pick, i) => {
        const chosen = entry.sub?.[subKeyOf(picks, i)]?.cantripTarget?.picks ?? [];
        if (!chosen.length) return;
        const key = norm(String(pick).split('|')[0]);
        out[key] = [...(out[key] ?? []), ...chosen];
      });
    }
  }
  return out;
}
