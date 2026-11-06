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
// -----------------------------------------------------------------------------

import { isBasicActionItem } from './foundryBasicActions';
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

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A identidade do item, a mesma de `action:<ident>` no catálogo. */
export function featureIdent(item) {
  return item.system?.identifier || slug(item.name);
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
 * @returns {Array<{ key: string, name: string, kind: string, section: string, level: number|null, rank: number, actionKey: string, entries: any[] }>}
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
      entries: place.entries?.length ? place.entries : htmlToEntries(item.system?.description?.value),
    });
  }
  const order = (f) => FEATURE_KINDS.findIndex((k) => k.id === f.kind);
  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => order(a.f) - order(b.f) || a.f.rank - b.f.rank || a.i - b.i)
    .map(({ f }) => f);
}
