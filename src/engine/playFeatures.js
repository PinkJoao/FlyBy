// =============================================================================
// playFeatures: as features do personagem para a aba Features do play mode
// =============================================================================
// O QUE FAZ
//   Lista toda feature do ator montado em memória (classe, subclasse, opções de
//   classe, espécie, talento de origem, talentos) com o TIPO, a seção onde a aba a
//   mostra, o nível, as chaves da ação e dos pools no catálogo e o texto (entries
//   do 5etools) para o detalhe. A aba Features do jogo agrupa por tipo e só USA
//   (docs/PLAY-MODE-V2-PLAN.md §6 e a resposta P3, DDL-0151).
//
// FUNÇÕES
//   featureList(actor, character, db): as features, na ordem da aba.
//   htmlToEntries(html): o texto de reserva, do HTML que o export guarda no item.
//   namedEntries(entries, out): os blocos com nome de umas entries, achatados.
//   featureIdent(item): a identidade do item, a mesma das chaves do catálogo.
//   FEATURE_KINDS: os tipos, na ordem e com o rótulo das sub-abas.
//   norm(s), slug(s): o nome comparável e o identificador (o mesmo do catálogo).
//   plainText(entries): o texto corrido das entries, com as tags do 5etools soltas.
//   turnCostsOf(entries): os custos de turno que o texto da feature cita (action,
//     bonus, reaction), na ordem de ECONOMY.
//   featureCosts(feature, action): os custos do turno da feature, os das activities
//     da ação do catálogo somados aos do texto.
//   triggerOf(entries): 'free' (no action required), 'rider' (o extra do acerto, o
//     uma vez por turno, o gasto de N pontos) ou null.
//   isActiveFeature(feature, action, pools): se a feature é ATIVA (algo que o jogador
//     usa ou declara) para o alternador da aba.
//
// DECISÕES E ARMADILHAS
//   - O tipo vem do item do ator: `race` é espécie, `feat` com subtype `origin` é o
//     talento de origem, o resto de `feat` é talento; `class` com subtype (invocação,
//     manobra, metamagia) é OPÇÃO de classe, numa seção pelo subtype. Para `class`
//     sem subtype, o resolvedor de cada classe decide classe ou subclasse (pelo nome
//     e nível, `resolveClassFeatures` e `resolveSubclassFeatures`, os mesmos que
//     montam o ator). O que nenhum resolvedor conhece (a opção escolhida, como
//     "Divine Order: Thaumaturge") fica com a classe ou subclasse do item de classe
//     que vem ANTES dele no ator: a montagem põe cada classe e as features dela em
//     sequência (`assembleFoundryActor`), e um teste segura essa ordem.
//   - A opção de classe (invocação, manobra) sai SEM nível: a marca do item é o nível
//     da classe quando foi escolhida (todas as invocações diriam "Level 11").
//   - O texto vem do DADO (as entries do 5etools, desenhadas pelo EntryContent como
//     na ficha); só sem o dado cai no HTML simples do item (`htmlToEntries`), que
//     perde tabelas e listas.
//   - As chaves batem com as do catálogo: a ação é `action:<ident>` e o pool é o do
//     item de mesmo nome (`pool.item`), como `featureActions` e `actorResources`.
//   - As ações básicas do XPHB ficam fora: moram na aba Actions (DDL-0147).
//   - `turnCostsOf` lê o custo pela PROSA (DDL-0203): 181 features da matriz citam um
//     custo de turno e não têm activity nem pool. "Bonus Action" e "Reaction" valem em
//     qualquer forma; a ação só nas formas que gastam ("Magic action", "as an action",
//     "use your action"), porque "when you take the Attack action" é gatilho, não custo.
//     "can't take Reactions" sai antes (a condição que a feature impõe). "No action
//     required" não é custo: a feature vale como as sem custo.
//   - ATIVA x PASSIVA (DDL-0204, o alternador da aba): ativa é a que tem activity, pool,
//     custo de turno, "no action required" ou um GATILHO que o jogador declara
//     (`triggerOf`: "once per turn", "extra damage", "spend 2 points", "expend a use").
//     Medido na matriz: só pelos custos, 536 ativas e 755 passivas, e umas 90 que se usam
//     na mesa (Divine Strike, Hunter's Prey, Stunning Strike, Metamagic, Frenzy) caíam
//     nas passivas. "Expend a/the/your" ficou de fora: pegava o Spellcasting ("expend a
//     spell slot"). O summon e a forma (botões da aba) a tela soma. A feature do
//     registro curado (`roll`, engine/playFeatureRolls, DDL-0205) é ativa sempre:
//     Reckless Attack não tem gatilho no texto. A de `passive` no registro (a que só
//     melhora outra, DDL-0206) é passiva mesmo com gatilho e pool.
// -----------------------------------------------------------------------------

import { isBasicActionItem } from './foundryBasicActions';
import { featureRollOf } from './playFeatureRolls';
import { resolveClassFeatures, resolveSubclassFeatures } from './foundryItems';
import { resolveClassObj, resolveRaceObj, resolveSubclassObj } from './resolve';

export const FEATURE_KINDS = [
  { id: 'class', label: 'Class' },
  { id: 'subclass', label: 'Subclass' },
  { id: 'species', label: 'Species' },
  { id: 'feat', label: 'Feats' },
];

const OPTION_LABELS = {
  eldritchInvocation: 'Eldritch Invocations',
  metamagic: 'Metamagic',
  maneuver: 'Maneuvers',
  artificerInfusion: 'Infusions',
  arcaneShot: 'Arcane Shots',
  rune: 'Runes',
  pactBoon: 'Pact Boon',
  elementalDiscipline: 'Elemental Disciplines',
};

const FEAT_LABELS = { origin: 'Origin feat', fightingStyle: 'Fighting Styles', epicBoon: 'Epic Boons' };

const TURN_CUES = [
  ['action', /\b(?:magic|utilize|study|influence) action\b|\b(?:as|use|uses|using|take|takes|spend|expend) (?:an|your|its|one) action\b/],
  ['bonus', /\bbonus action/],
  ['reaction', /\breaction/],
];
const NOT_A_COST = /\b(?:can(?:no|['’])t|doesn['’]t|don['’]t|without) (?:take |taking |use |using |require |requiring )?(?:a |an |your |any )?(?:actions?|bonus actions?|reactions?)\b/g;

const FREE_CUE = /\bno action required\b/;
const RIDER_CUE = /once (?:per|on each of your|on each) turn|\bextra (?:\d+d\d+|damage)|\b(?:expend|spend)s? (?:\d+|one|two|three|four|five)\b|\bexpend (?:a|one) use\b/;

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A identidade do item, a mesma de `action:<ident>` no catálogo. */
export function featureIdent(item) {
  return item.system?.identifier || slug(item.name);
}

/** O texto corrido das entries, com as tags do 5etools trocadas pelo texto delas. */
export function plainText(entries) {
  const out = [];
  const walk = (e) => {
    if (typeof e === 'string') out.push(e);
    else if (Array.isArray(e)) e.forEach(walk);
    else if (e && typeof e === 'object') {
      if (e.name) out.push(e.name);
      for (const k of ['entries', 'items', 'entry', 'rows']) if (e[k] != null) walk(e[k]);
    }
  };
  walk(entries);
  return out.join(' ').replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1');
}

/** Os custos de turno que o texto cita: ['bonus'], ['action', 'reaction'], []. */
export function turnCostsOf(entries) {
  const text = plainText(entries).toLowerCase().replace(NOT_A_COST, ' ');
  return TURN_CUES.filter(([, re]) => re.test(text)).map(([cost]) => cost);
}

/** Os custos do turno da feature: os das activities e os que o texto cita, em ordem. */
export function featureCosts(feature, action) {
  const all = new Set([...(action?.activities ?? []).map((a) => a.activation?.type), ...(feature?.costs ?? [])]);
  return TURN_CUES.map(([cost]) => cost).filter((c) => all.has(c));
}

/** O gatilho que a prosa declara: 'free', 'rider' ou null. */
export function triggerOf(entries) {
  const text = plainText(entries).toLowerCase();
  if (FREE_CUE.test(text)) return 'free';
  return RIDER_CUE.test(text) ? 'rider' : null;
}

/** A feature é ativa (o jogador a usa ou declara): activity, pool, custo, gatilho ou registro. */
export function isActiveFeature(feature, action, pools = []) {
  if (feature?.roll === 'passive') return false;
  return (action?.activities?.length ?? 0) > 0 || pools.length > 0 || (feature?.costs?.length ?? 0) > 0 || !!feature?.trigger || !!feature?.roll;
}

/** O texto de reserva: os parágrafos do HTML simples do export, sem as tags. */
export function htmlToEntries(html) {
  return String(html ?? '')
    .split('</p>')
    .map((p) => p.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean);
}

/** Os blocos com nome de umas entries, achatados (o traço da espécie é um deles). */
export function namedEntries(entries, out = []) {
  for (const e of entries ?? []) {
    if (!e || typeof e !== 'object') continue;
    if (e.name) out.push(e);
    if (Array.isArray(e.entries)) namedEntries(e.entries, out);
  }
  return out;
}

/**
 * As features do ator, com tipo, seção, nível, chaves do catálogo e texto.
 * @returns {Array<{ key: string, name: string, kind: string, section: string, level: number|null, rank: number, actionKey: string, entries: any[], costs: string[], trigger: string|null, roll: string|null }>}
 */
export function featureList(actor, character, db) {
  const known = new Map();
  const classNames = [];
  for (const cls of character?.classes ?? []) {
    const classObj = cls.classId ? resolveClassObj(db, cls.classId, cls.source) : null;
    if (!classObj) continue;
    classNames.push(classObj.name);
    for (const f of resolveClassFeatures(db, cls.classId, classObj, cls.level || 1)) {
      known.set(`${norm(f.name)}|${f.level}`, { kind: 'class', section: classObj.name, entries: f.entries });
    }
    const subObj = cls.subclassId ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource) : null;
    if (!subObj) continue;
    for (const f of resolveSubclassFeatures(subObj, cls.classId, db, { max: cls.level || 1 })) {
      known.set(`${norm(f.name)}|${f.level}`, { kind: 'subclass', section: subObj.name, entries: f.entries });
    }
  }
  const sp = character?.species;
  const raceObj = sp && db ? resolveRaceObj(db, sp.id, sp.source, sp.lineage) : null;
  const traits = namedEntries(raceObj?.entries);
  const feats = db?.feats?.feat ?? [];
  const options = db?.optionalfeatures?.optionalfeature ?? [];
  const byName = (list, item) => {
    const book = norm(item.system?.source?.book);
    const same = list.filter((x) => norm(x.name) === norm(item.name));
    return (same.find((x) => norm(x.source) === book) ?? same[same.length - 1])?.entries ?? null;
  };

  const out = [];
  let current = { kind: 'class', section: classNames[0] ?? 'Class' };
  let speciesName = raceObj?.name ?? 'Species';
  for (const item of actor?.items ?? []) {
    if (item.type === 'race') speciesName = item.name;
    if (item.type === 'class') current = { kind: 'class', section: item.name };
    if (item.type === 'subclass') current = { kind: 'subclass', section: item.name };
    if (item.type !== 'feat' || isBasicActionItem(item)) continue;
    const type = item.system?.type?.value;
    const subtype = item.system?.type?.subtype || '';
    const level = item.flags?.builder5e?.level ?? null;
    let place;
    if (type === 'race') place = { kind: 'species', section: speciesName, entries: traits.find((t) => norm(t.name) === norm(item.name))?.entries ?? null };
    else if (type === 'feat') place = { kind: 'feat', section: FEAT_LABELS[subtype] ?? 'Feats', entries: byName(feats, item) };
    else if (subtype) place = { kind: 'class', section: OPTION_LABELS[subtype] ?? current.section, entries: byName(options, item), option: true };
    else place = known.get(`${norm(item.name)}|${level}`) ?? { ...current, entries: null };
    const ident = featureIdent(item);
    out.push({
      key: `feature:${ident}|${level ?? ''}`,
      name: item.name,
      kind: place.kind,
      section: place.section,
      level: place.option ? null : level,
      rank: level ?? 0,
      actionKey: `action:${ident}`,
      source: item.system?.source?.book ?? null,
      entries: place.entries?.length ? place.entries : htmlToEntries(item.system?.description?.value),
    });
    const last = out[out.length - 1];
    last.costs = turnCostsOf(last.entries);
    last.trigger = triggerOf(last.entries);
    last.roll = featureRollOf(item.name)?.kind ?? null;
  }
  const order = (f) => FEATURE_KINDS.findIndex((k) => k.id === f.kind);
  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => order(a.f) - order(b.f) || a.f.rank - b.f.rank || a.i - b.i)
    .map(({ f }) => f);
}
