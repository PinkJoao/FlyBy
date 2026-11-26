// =============================================================================
// backgrounds: os backgrounds prontos de 2024 em diante (DDL-0327, DDL-0328)
// =============================================================================
// O QUE FAZ
//   Lê um background pronto do 5etools (`edition: "one"`) e o aplica na origem do
//   personagem. A origem custom continua a de sempre; o background pronto é um atalho
//   que preenche os mesmos campos (`origin.abilityBoosts`, `origin.originFeat`,
//   `origin.choices`) e marca `origin.background` com `{ id, source }`.
//
// FUNÇÕES
//   Exporta ORIGIN_CHOICES: as escolhas da origem custom (2 perícias, 1 ferramenta e
//     2 idiomas; o XPHB dá "Common plus two languages", DDL-0328, antes era 1).
//   isReadyBackground(raw): o background está no formato 2024?
//   readyBackgrounds(db): os oferecidos, com as correções de dado.
//   resolveBackground(db, ref): o background da ficha (`{ id, source }`), ou null.
//   backgroundOf(character, db): o background pronto do personagem, ou null.
//   backgroundAbilities(bg): os três atributos que o background pode aumentar.
//   backgroundSkills(bg): os códigos das duas perícias fixas.
//   lower(s): a comparação sem caixa.
//   toolName(db, key): a ferramenta na grafia do item.
//   backgroundFixedTool(db, bg): o nome da ferramenta fixa, ou null.
//   backgroundToolCategory(bg): a categoria da ferramenta a escolher ('AT', 'INS',
//     'GS'), ou null.
//   featRef(db, key): o talento de "nome; preset|fonte", sem diferença de caixa.
//   backgroundFeat(db, bg): o talento: `{ fixed }` (com `preset`) ou `{ options,
//     categories }` quando há escolha (os do Ravenloft).
//   presetFeatChoices(db, feat, preset): o bag que o background já decide no talento
//     (a lista do Magic Initiate) e os ids travados.
//   originChoicesFor(origin, db): as escolhas de proficiência que sobram.
//   allowedBoostAbilities(origin, db): os atributos que os bônus aceitam.
//   fitBoosts(boosts, allowed, classId): os bônus ajustados aos atributos aceitos.
//   keptFeatChoices(choices, presetBag): o que o mesmo talento guarda na troca.
//   applyBackground(origin, bg, db, opts): a origem com o background aplicado.
//   toCustomOrigin(origin): a origem custom com tudo que o background deu.
//   clearOrigin(origin, opts): o X do seletor: custom e os campos limpos.
//   backgroundSwitchLosses(origin, next, db): o que a troca apaga, para o aviso.
//
// DECISÕES E ARMADILHAS
//   - Só `edition: "one"` (os 74 de hoje e os próximos livros sozinhos, sem lista):
//     o formato é o da origem custom. Os de 2014 nunca são oferecidos (§6.2).
//   - As concessões fixas (as duas perícias, a ferramenta fixa, o talento) são
//     gravadas como os PICKS da origem, não derivadas do background: todo leitor da
//     origem (ficha, export, PDF, jogo, o autoBuild) já lê os picks, e voltar ao custom
//     mantém tudo como estava (resposta B4 do dono). A interface trava o que o
//     background decide; `applyBackground` reescreve os picks a cada troca.
//   - O mesmo talento em dois backgrounds (Acolyte e Sage: Magic Initiate) guarda as
//     escolhas, menos as magias quando a lista muda (`keptFeatChoices`): as de clérigo
//     ficavam sob a lista de mago sem aviso. O aviso diz "the Magic Initiate spells"
//     (DDL-0329).
//   - O feats do 5etools é uma lista de ALTERNATIVAS: `[{ "survivor|rhw": true },
//     { anyFromCategory: { category: ["DG"] } }]` é "Survivor ou um Dark Gift". A
//     chave "magic initiate; cleric|xphb" fixa a lista do talento (o `spellSet-0`).
//   - KNOWN_DATA_FIXES: o Genie Touched (FRHoF) veio sem `feats`, e o texto dele dá
//     "Magic Initiate (Wizard)". O Noble escreve "Skilled|xphb": as chaves são
//     comparadas em minúsculas.
//   - O bônus +2/+1 ou +1/+1/+1 é o mesmo da origem custom, só que nos três atributos
//     do background (o 5etools o escreve como `choose.weighted`, que o parseChoices
//     não lê: por isso este módulo lê o `ability` sozinho).
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { skillCode } from './classData';
import { titleCase } from './choices';
import { recommendedBoosts } from './abilityMethods';

export const ORIGIN_CHOICES = [
  { id: 'skill', kind: 'skill', count: 2, label: 'Skill Proficiencies', pool: { type: 'any', of: 'skill' } },
  { id: 'tool', kind: 'tool', count: 1, label: 'Tool Proficiency', pool: { type: 'any', of: 'tool' } },
  { id: 'language', kind: 'language', count: 2, label: 'Languages', pool: { type: 'any', of: 'language' } },
];

const KNOWN_DATA_FIXES = {
  'genie touched|frhof': { feats: [{ 'magic initiate; wizard|xphb': true }] },
};

const TOOL_CATEGORIES = {
  anyArtisansTool: { category: 'AT', label: "Artisan's Tools" },
  anyMusicalInstrument: { category: 'INS', label: 'Musical Instrument' },
  anyGamingSet: { category: 'GS', label: 'Gaming Set' },
};

const lower = (s) => String(s ?? '').toLowerCase();

/** O background está no formato 2024? */
export function isReadyBackground(raw) {
  return raw?.edition === 'one';
}

/** Os backgrounds oferecidos, com as correções de dado. */
export function readyBackgrounds(db) {
  return (db?.backgrounds?.background ?? [])
    .filter((b) => isReadyBackground(b) && !b.reprintedAs?.length)
    .map((b) => {
      const fix = KNOWN_DATA_FIXES[lower(`${b.name}|${b.source}`)];
      return fix ? { ...b, ...fix } : b;
    });
}

/** O background da ficha, ou null. */
export function resolveBackground(db, ref) {
  if (!ref?.id) return null;
  return readyBackgrounds(db).find((b) => b.name === ref.id && b.source === ref.source) ?? null;
}

/** O background pronto do personagem, ou null. */
export function backgroundOf(character, db) {
  return resolveBackground(db, character?.origin?.background);
}

/** Os três atributos que o background pode aumentar. */
export function backgroundAbilities(bg) {
  const from = bg?.ability?.[0]?.choose?.weighted?.from ?? bg?.ability?.[0]?.choose?.from ?? [];
  return ABILITIES.filter((a) => from.includes(a));
}

/** Os códigos das duas perícias fixas. */
export function backgroundSkills(bg) {
  const entry = bg?.skillProficiencies?.[0] ?? {};
  return Object.keys(entry).filter((k) => entry[k] === true).map(skillCode);
}

/** O nome da ferramenta, na grafia do item. */
function toolName(db, key) {
  const k = lower(key);
  const pools = [db?.['items-base']?.baseitem, db?.items?.item];
  for (const pool of pools) {
    const hit = (pool ?? []).find((i) => lower(i.name) === k && (i.source === 'XPHB' || i.source === 'XDMG'))
      ?? (pool ?? []).find((i) => lower(i.name) === k);
    if (hit) return hit.name;
  }
  return titleCase(key);
}

/** A ferramenta fixa, ou null. */
export function backgroundFixedTool(db, bg) {
  const entry = bg?.toolProficiencies?.[0] ?? {};
  const key = Object.keys(entry).find((k) => entry[k] === true);
  return key ? toolName(db, key) : null;
}

/** A categoria da ferramenta a escolher, ou null. */
export function backgroundToolCategory(bg) {
  const entry = bg?.toolProficiencies?.[0] ?? {};
  const key = Object.keys(entry).find((k) => TOOL_CATEGORIES[k]);
  return key ? TOOL_CATEGORIES[key] : null;
}

/** Um talento citado por "nome; preset|fonte", resolvido sem diferença de caixa. */
function featRef(db, key) {
  const [left, source = 'XPHB'] = String(key).split('|');
  const [name, preset = null] = left.split(';').map((s) => s.trim());
  const hit = (db?.feats?.feat ?? []).find((f) => lower(f.name) === lower(name) && lower(f.source) === lower(source));
  return hit ? { id: hit.name, source: hit.source, preset } : null;
}

/** O talento do background: fixo, ou opções e categorias. */
export function backgroundFeat(db, bg) {
  const options = [];
  const categories = [];
  for (const alt of bg?.feats ?? []) {
    if (alt?.anyFromCategory) {
      categories.push(...(alt.anyFromCategory.category ?? []));
      continue;
    }
    for (const [k, v] of Object.entries(alt ?? {})) {
      if (v !== true) continue;
      const ref = featRef(db, k);
      if (ref) options.push(ref);
    }
  }
  if (options.length === 1 && categories.length === 0) return { fixed: options[0], options, categories };
  return { fixed: null, options, categories };
}

/** O que o background já decide dentro do talento (a lista do Magic Initiate). */
export function presetFeatChoices(db, feat, preset) {
  if (!preset) return { bag: {}, locked: [] };
  const raw = (db?.feats?.feat ?? []).find((f) => f.name === feat.id && f.source === feat.source);
  const groups = (raw?.additionalSpells ?? []).filter((g) => g?.name);
  const hit = groups.find((g) => lower(g.name).startsWith(lower(preset)));
  if (!hit) return { bag: {}, locked: [] };
  return { bag: { 'spellSet-0': { kind: 'spellSet', picks: [hit.name] } }, locked: ['spellSet-0'] };
}

/** As escolhas de proficiência que sobram para o jogador. */
export function originChoicesFor(origin, db) {
  const bg = resolveBackground(db, origin?.background);
  if (!bg) return ORIGIN_CHOICES;
  const out = [];
  const cat = backgroundToolCategory(bg);
  if (cat) out.push({ id: 'tool', kind: 'tool', count: 1, label: `Tool Proficiency (${cat.label})`, pool: { type: 'any', of: 'tool', category: cat.category } });
  out.push(ORIGIN_CHOICES.find((c) => c.kind === 'language'));
  return out;
}

/** Os atributos que os bônus aceitam. */
export function allowedBoostAbilities(origin, db) {
  const bg = resolveBackground(db, origin?.background);
  const abs = bg ? backgroundAbilities(bg) : [];
  return abs.length ? abs : ABILITIES;
}

/** Os bônus ajustados aos atributos aceitos (mantém os que cabem). */
export function fitBoosts(boosts, allowed, classId = null) {
  const list = boosts ?? [];
  const mode = list.some((b) => b.amount === 2) || list.length === 0 ? '2-1' : '1-1-1';
  const fits = list.length > 0 && list.every((b) => allowed.includes(b.ability));
  if (fits) return list;
  return recommendedBoosts(classId, mode, allowed) ?? [];
}

/** As escolhas do mesmo talento que sobrevivem à troca: as magias só com a mesma lista. */
function keptFeatChoices(choices, presetBag) {
  const out = { ...(choices ?? {}) };
  const listChanged = Object.entries(presetBag).some(([id, e]) => (out[id]?.picks ?? []).join() !== (e.picks ?? []).join());
  if (listChanged) for (const [id, e] of Object.entries(out)) if (e?.kind === 'spell') delete out[id];
  return out;
}

/**
 * A origem com o background aplicado.
 * @param {object} origin
 * @param {object} bg  o background (de readyBackgrounds)
 * @param {object} db
 * @param {{ classId?: string|null }} [opts]
 */
export function applyBackground(origin, bg, db, { classId = null } = {}) {
  const prev = origin ?? {};
  const choices = {};
  if (prev.choices?.language) choices.language = prev.choices.language;
  const skills = backgroundSkills(bg);
  if (skills.length) choices.skill = { kind: 'skill', picks: skills };
  const tool = backgroundFixedTool(db, bg);
  if (tool) choices.tool = { kind: 'tool', picks: [tool] };

  const feat = backgroundFeat(db, bg);
  const sameFeat = (ref) => prev.originFeat && ref && prev.originFeat.id === ref.id && prev.originFeat.source === ref.source;
  let originFeat = null;
  if (feat.fixed) {
    const preset = presetFeatChoices(db, feat.fixed, feat.fixed.preset);
    const kept = sameFeat(feat.fixed) ? keptFeatChoices(prev.originFeat.choices, preset.bag) : {};
    originFeat = { id: feat.fixed.id, source: feat.fixed.source, subtype: 'origin', choices: { ...kept, ...preset.bag } };
  } else if (prev.originFeat) {
    const raw = (db?.feats?.feat ?? []).find((f) => f.name === prev.originFeat.id && f.source === prev.originFeat.source);
    const inCat = raw && feat.categories.includes(raw.category);
    if (inCat || feat.options.some(sameFeat)) originFeat = prev.originFeat;
  }

  return {
    ...prev,
    background: { id: bg.name, source: bg.source },
    abilityBoosts: fitBoosts(prev.abilityBoosts, backgroundAbilities(bg), classId),
    originFeat,
    choices,
  };
}

/** A origem custom com tudo que o background deu (resposta B4). */
export function toCustomOrigin(origin) {
  const next = { ...(origin ?? {}) };
  delete next.background;
  return next;
}

/** O X do seletor: volta ao custom e limpa os campos. */
export function clearOrigin(origin, { classId = null } = {}) {
  const boosts = recommendedBoosts(classId, '2-1') ?? [{ ability: '', amount: 2 }, { ability: '', amount: 1 }];
  const next = { ...(origin ?? {}), abilityBoosts: boosts, originFeat: null, choices: {} };
  delete next.background;
  return next;
}

/** O que a troca apaga (nomes curtos para o aviso). */
export function backgroundSwitchLosses(origin, next) {
  const out = [];
  const a = origin ?? {};
  if (a.originFeat && (!next.originFeat || next.originFeat.id !== a.originFeat.id || next.originFeat.source !== a.originFeat.source)) {
    if (Object.keys(a.originFeat.choices ?? {}).length > 0 || !a.background) out.push(`the ${a.originFeat.id} feat`);
  } else if (a.originFeat) {
    const lost = Object.entries(a.originFeat.choices ?? {})
      .some(([id, e]) => e?.kind === 'spell' && e.picks?.length && !next.originFeat.choices?.[id]?.picks?.length);
    if (lost) out.push(`the ${a.originFeat.id} spells`);
  }
  const picks = (bag, kind) => (bag?.[kind]?.picks ?? []).join(',');
  if (!a.background) {
    if (picks(a.choices, 'skill') && picks(a.choices, 'skill') !== picks(next.choices, 'skill')) out.push('the skills');
    if (picks(a.choices, 'tool') && picks(a.choices, 'tool') !== picks(next.choices, 'tool')) out.push('the tool');
  }
  return out;
}
