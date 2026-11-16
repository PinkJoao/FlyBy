// =============================================================================
// classFeatureChoices: as escolhas por nível das features de classe
// =============================================================================
// O QUE FAZ
//   As features XPHB são texto puro, sem escolha estruturada. Elas são detectadas
//   pelo NOME (como o Plutonium faz) e viram descritores Choice para o ChoiceList:
//     Ability Score Improvement: talento (categoria G; o próprio ASI é um deles).
//     Epic Boon: talento (EB). Fighting Style: talento (FS; FS:P e FS:R para
//       Paladino e Ranger).
//     Expertise: 2 perícias das que já são proficientes.
//     Weapon Mastery: N armas (coluna da tabela da classe; sem coluna, 2).
//   Mais os grants curados em prosa, as ferramentas iniciais, as optional
//   features e a limpeza do bag quando o nível muda.
//
// FUNÇÕES
//   capWord(s), resolveFrom(from, classSkills): rótulo e pool de um grant.
//   grantChoices(grants, opts): grants curados como Choices.
//   weaponMasteryCount(classObj, level): quantas armas o Weapon Mastery cobre.
//   classLevelChoices(parsed, classObj, level): as escolhas por nível da classe.
//   classToolChoices(classObj): as ferramentas das proficiências iniciais.
//   planFilter(text), planNames(db, name, source), planAllows(pool, raw),
//     planChoices(db, classId, classObj, level): os planos do Replicate Magic Item
//     (Artificer do EFA) como escolha `plan` de itens concretos.
//   subclassFeatureChoices(db, classId, subclass, level, classSkills): as
//     escolhas concedidas por features de subclasse.
//   optionalFeatureCount(progression, level), firstOfpLevel(progression): a
//     contagem e o primeiro nível de uma progressão de optional features.
//   optionalFeatureChoices(classObj, subclass, level): invocations, metamagic,
//     maneuvers e afins, na classe e na subclasse.
//   curatedFightingStyle(subShort): a subclasse já dá um estilo de luta pelo registro? Então
//     o `optionalfeatureProgression` de estilo da subclasse é a mesma escolha: o Champion do
//     PHB no chassi de 2024 recebia DOIS estilos no nível 10 (passe ao vivo, DDL-0221).
//   pruneChoicesAboveLevel(bag, level), dropSubclassGrants(bag): podas do bag.
//   isOptionalFeatureId(id): o id é de uma escolha de optional feature?
//   cleanupClassEntry(cls, ctx): a limpeza central em toda mudança de nível.
//
// DECISÕES E ARMADILHAS
//   - Os ids embutem o nível ('feat@4') para PODAR o bag quando o nível desce.
//     Weapon Mastery tem id fixo: o count cresce, as escolhas persistem.
//   - Slot de ASI admite talentos de Origem e Epic Boons, e o de Epic Boon admite
//     G e O (RAW "or another feat of your choice", TC-0029). `category` é o
//     PADRÃO (filtro pré-marcado e pool do autoBuild); `extraCategories` só
//     aparecem quando o jogador tira o filtro, com os avisos de pré-requisito.
//   - NAMED_FEATURE_GRANTS: grants de escolha em features de nome NÃO
//     auto-descritivo (Deft Explorer, Scholar, Primal Knowledge). Formato { kind,
//     count, from?, category? }, com `from` em códigos ou 'classSkills'.
//   - SUBCLASS_FEATURE_GRANTS, chave "shortName|nome" (nomes como "Bonus
//     Proficiencies" se repetem). Quando versões divergem (Blessings of Knowledge
//     PHB x FRHoF) o valor é [{ source, grants }] e casa pela fonte. Completado em
//     2026-07-16 varrendo todos os class-*.json (TC-0012); os grants FIXOS vivem no
//     subclassGrants. Destaques: Blessings of Knowledge dá as perícias COM
//     expertise (`expertise: true`, proficiência NOVA, o pool não intersecta); o
//     PSA inlina o texto no guarda-chuva "Knowledge Domain (PSA)"; Cavalier e
//     Samurai são pool MISTO (perícia OU idioma, com `fromByKind`); Kensei é
//     proficiência de ARMA individual (kind 'weaponProf', uma melee e uma ranged no
//     3, mais uma em 6, 11 e 17 via `level`); Elemental Affinity é resistência
//     PERMANENTE à escolha (kind 'resist').
//   - Giant Power e Draconic Disciple (TC-0128): "Giant (Draconic) or one other language of
//     your choice" é uma escolha de idioma livre, com a sugestão no rótulo; o jogador que já
//     fala o idioma escolhe outro, como o texto manda.
//   - grantChoices: o nível sai do fim do keyTag e ordena os seletores. `label`
//     sobrepõe o rótulo, `tag` desambigua vários grants do mesmo kind na mesma
//     feature. Pool 'mixed' descreve as alternativas ("Skill or Language") em vez de
//     vazar o nome interno (achado da sessão T1a Fighter).
//   - Os planos do Artificer (TC-0128, DDL-0212) são uma escolha `plan` só: o count vem da
//     coluna Plans Known; o pool vem das tabelas "Magic Item Plans (Artificer Level N+)" da
//     própria feature, as de nível alcançado. Cada plano é um ITEM concreto ("Nome|Fonte", o
//     id da entity de item). A linha `{@item}` aceita o item, os membros do seu grupo (Armor
//     of Resistance) e as variantes geradas do genérico (+1 Armor, pelo `_variantName`). A
//     linha `{@filter}` aceita qualquer item da raridade e do tipo dela, quantas vezes
//     couber, um item diferente por plano: é a nota da tabela, e a primeira versão, que fazia
//     dela um plano só, estava errada (vista na tela em 2026-11-15).
//     Sem casa nativa no dnd5e: vai na flag residual da classe, como as outras.
//   - Weapon Mastery restrito por classe (TC-0021): Bárbaro só melee; Ladino com a
//     regra condicional de weaponFilterAllows. Fighter, Paladino e Ranger livres.
//   - Ferramentas iniciais: entradas SEPARADAS do array são alternativas. O Monge
//     ([{anyArtisansTool:1},{anyMusicalInstrument:1}]) é UM seletor com as
//     categorias unidas (único caso, levantado em 2026-07-16); uma entrada só é
//     escolha independente por token. Só na classe original.
//   - Subclasse: itera o pool CRU de subclassFeature (o guarda-chuva XPHB inlina
//     as reais), usa só a VERSÃO da subclasse escolhida, e deduplica por CHAVE, não
//     por nível: a mesma feature pode existir nos dois anexos da classe (PHB@1 e
//     XPHB@3).
//   - Optional features: Fighting Styles 2024 viraram FEATS (as optional features
//     FS:* estão reprintedAs e o latestOnly as remove), então sai um seletor de
//     talento FS, com `fsTypes` restringindo (o Bardo FS:B). O título só vira link
//     se houver feature homônima: nunca um link morto.
//   - cleanupClassEntry roda em QUALQUER mudança de nível, para escolhas de
//     níveis perdidos não "voltarem selecionadas": poda acima do nível, apara
//     Weapon Mastery e optional features ao count, e reverte a subclasse (com os
//     grants `sub:`) abaixo do nível dela. Recebe objetos resolvidos para não
//     importar o resolve (ciclo).
//   - Os ids de optional feature (`optfeat@MV:B`, `feat@fs@FS:B`) não têm nível
//     nem o prefixo `sub:`, então nem a poda por nível nem a da subclasse os veem.
//     A regra é a da OFERTA: a escolha que optionalFeatureChoices não oferece mais
//     no nível novo sai inteira, com o sub-bag (TC-0096). Varrido em 2026-10-24
//     sobre as 135 linhas de classe: Battle Master, Arcane Archer, Rune Knight e
//     College of Swords abaixo do nível da subclasse, e a Metamagic do Sorcerer
//     no nível 1; nenhuma escolha oferecida é tocada.
// -----------------------------------------------------------------------------

const FS_EXTRA = { paladin: 'FS:P', ranger: 'FS:R' };

const EXPERTISE_COUNT = 2;

const TOOL_CHOICE_TOKEN = {
  anyArtisansTool: { category: 'AT', label: "Artisan's Tools" },
  anyMusicalInstrument: { category: 'INS', label: 'Musical Instruments' },
  anyGamingSet: { category: 'GS', label: 'Gaming Sets' },
  anyTool: { category: null, label: 'Tool Proficiency' },
  anyToolProficiency: { category: null, label: 'Tool Proficiency' },
};

const NAMED_FEATURE_GRANTS = {
  'deft explorer': [
    { kind: 'expertise', count: 1 },
    { kind: 'language', count: 2 },
  ],
  scholar: [
    { kind: 'expertise', count: 1, from: ['arc', 'his', 'inv', 'med', 'nat', 'rel'] },
  ],
  'primal knowledge': [
    { kind: 'skill', count: 1, from: 'classSkills' },
  ],
};

const SUBCLASS_FEATURE_GRANTS = {
  'lore|bonus proficiencies': [{ kind: 'skill', count: 3 }],
  'battle master|student of war': [
    { source: 'PHB', grants: [{ kind: 'tool', count: 1, category: 'AT' }] },
    { grants: [
      { kind: 'tool', count: 1, category: 'AT' },
      { kind: 'skill', count: 1, from: 'classSkills' },
    ] },
  ],
  'fey wanderer|otherworldly glamour': [{ kind: 'skill', count: 1, from: ['dec', 'prf', 'per'] }],
  'order|bonus proficiencies': [{ kind: 'skill', count: 1, from: ['itm', 'per'] }],
  'peace|implement of peace': [{ kind: 'skill', count: 1, from: ['ins', 'prf', 'per'] }],
  'champion|additional fighting style': [{ kind: 'feat', count: 1, category: ['FS'] }],
  'knowledge|blessings of knowledge': [
    { source: 'FRHoF', grants: [
      { kind: 'tool', count: 1, category: 'AT' },
      { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
    ] },
    { grants: [
      { kind: 'language', count: 2 },
      { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
    ] },
  ],
  'knowledge (psa)|knowledge domain (psa)': [
    { kind: 'language', count: 2 },
    { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
  ],
  'nature|acolyte of nature': [{ kind: 'skill', count: 1, from: ['ani', 'nat', 'sur'] }],
  'strength (psa)|acolyte of strength': [{ kind: 'skill', count: 1, from: ['ani', 'ath', 'nat', 'sur'] }],
  'arcane archer|arcane archer lore': [{ kind: 'skill', count: 1, from: ['arc', 'nat'] }],
  'cavalier|bonus proficiency': [{ kind: 'mixed', count: 1, of: ['skill', 'language'], fromByKind: { skill: ['ani', 'his', 'ins', 'prf', 'per'] } }],
  'samurai|bonus proficiency': [{ kind: 'mixed', count: 1, of: ['skill', 'language'], fromByKind: { skill: ['his', 'ins', 'prf', 'per'] } }],
  'banneret|knightly envoy': [{ kind: 'skill', count: 1, from: ['ins', 'itm', 'per', 'prf'] }],
  'noble genies|genie\'s splendor': [{ kind: 'skill', count: 1, from: ['acr', 'itm', 'prf', 'per'] }],
  'moon|primal lore': [{ kind: 'skill', count: 1, from: ['ani', 'ins', 'med', 'nat', 'prc', 'sur'] }],
  'kensei|path of the kensei': [
    { kind: 'tool', count: 1, from: ["Calligrapher's Supplies", "Painter's Supplies"] },
    { kind: 'weaponProf', count: 1, tag: 'melee', label: 'Kensei Weapon (Melee)', weaponFilter: { kind: 'melee', noProps: ['H', 'S'] } },
    { kind: 'weaponProf', count: 1, tag: 'ranged', label: 'Kensei Weapon (Ranged)', weaponFilter: { kind: 'ranged', noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l6', level: 6, label: 'Kensei Weapon (Level 6)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l11', level: 11, label: 'Kensei Weapon (Level 11)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l17', level: 17, label: 'Kensei Weapon (Level 17)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
  ],
  'draconic|elemental affinity': [
    { kind: 'resist', count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'poison'] },
  ],
  'mastermind|master of intrigue': [
    { kind: 'tool', count: 1, category: 'GS' },
    { kind: 'language', count: 2 },
  ],
  'bladesinger|training in war and song': [{ kind: 'skill', count: 1, from: ['acr', 'ath', 'prf', 'per'] }],
  'giant|giant power': [{ kind: 'language', count: 1, label: 'Language (Giant, or another if you know Giant)' }],
  'ascendant dragon|draconic disciple': [{ kind: 'language', count: 1, label: 'Language (Draconic, or another)' }],
  'drakewarden|draconic gift': [{ kind: 'language', count: 1, label: 'Language (Draconic, or another)' }],
  'arcana|student of arcana': [{ kind: 'skill', count: 1, from: ['arc', 'his', 'ins', 'med', 'per', 'rel'], label: 'Skill (Arcana, or a Cleric skill)' }],
  'enchanter|enchanting conversationalist': [{ kind: 'skill', count: 1, from: ['dec', 'itm', 'per'] }],
};

const KIND_LABEL = { skill: 'Skill', tool: 'Tool', language: 'Language', expertise: 'Expertise', feat: 'Feat', weaponProf: 'Weapon', resist: 'Damage Resistance' };

/** Rótulo de um tipo de dano (uma palavra). */
const capWord = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

/** O `from` de um grant em códigos de perícia, ou null (qualquer). */
function resolveFrom(from, classSkills) {
  if (from === 'classSkills') return classSkills ?? [];
  if (Array.isArray(from)) return from;
  return null;
}

/** Grants curados como Choices; `keyTag` termina em `@<nível>`. */
function grantChoices(grants, { featureName, keyTag, classSkills, idPrefix = '', subclassShortName }) {
  const out = [];
  const level = Number(String(keyTag).slice(String(keyTag).lastIndexOf('@') + 1)) || undefined;
  const feature = { name: featureName, level, ...(subclassShortName ? { subclass: subclassShortName } : {}) };
  for (const g of grants ?? []) {
    const count = g.count ?? 1;
    const kindLabel = g.kind === 'mixed'
      ? (g.of ?? ['skill', 'language']).map((k) => KIND_LABEL[k] ?? k).join(' or ')
      : (KIND_LABEL[g.kind] ?? g.kind);
    const label = g.label ? `${featureName} - ${g.label}` : `${featureName} - ${kindLabel}`;
    const id = `${idPrefix}${g.kind}@${keyTag}${g.tag ? `:${g.tag}` : ''}`;
    const base = { id, count, label, level: g.level ?? level, feature };
    if (g.kind === 'skill') {
      const from = resolveFrom(g.from, classSkills);
      if (g.expertise) {
        out.push({ ...base, kind: 'expertise', newProf: true, from: from ?? undefined, pool: { type: 'expertise' } });
      } else {
        out.push({ ...base, kind: 'skill', from: from ?? undefined, pool: { type: 'any', of: 'skill' } });
      }
    } else if (g.kind === 'expertise') {
      const from = resolveFrom(g.from, classSkills);
      out.push({ ...base, kind: 'expertise', from: from ?? undefined, pool: { type: 'expertise' } });
    } else if (g.kind === 'tool') {
      out.push(
        g.from
          ? { ...base, kind: 'tool', pool: { type: 'list', options: g.from.map((n) => ({ value: n, label: n })) } }
          : { ...base, kind: 'tool', pool: { type: 'any', of: 'tool', category: g.category ?? null } },
      );
    } else if (g.kind === 'language') {
      out.push({ ...base, kind: 'language', pool: { type: 'any', of: 'language' } });
    } else if (g.kind === 'feat') {
      out.push({ ...base, kind: 'feat', pool: { type: 'feat', category: g.category ?? ['FS'] } });
    } else if (g.kind === 'mixed') {
      out.push({ ...base, kind: 'mixed', fromByKind: g.fromByKind ?? undefined, pool: { type: 'any', of: g.of ?? ['skill', 'language'] } });
    } else if (g.kind === 'resist') {
      out.push({
        ...base,
        kind: 'resist',
        pool: { type: 'list', options: (g.from ?? []).map((v) => ({ value: v, label: capWord(v) })) },
      });
    } else if (g.kind === 'weaponProf') {
      out.push({ ...base, kind: 'weaponProf', pool: { type: 'any', of: 'weapon', weaponFilter: g.weaponFilter ?? null } });
    }
  }
  return out;
}

/**
 * Quantas armas o Weapon Mastery cobre neste nível.
 * @param {object} classObj
 * @param {number} level
 */
export function weaponMasteryCount(classObj, level) {
  for (const g of classObj?.classTableGroups ?? []) {
    const col = (g.colLabels ?? []).findIndex((l) => String(l).includes('Weapon Mastery'));
    if (col >= 0) {
      const row = g.rows?.[level - 1];
      const n = Number(row?.[col]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 2;
}

const MASTERY_FILTERS = {
  barbarian: { kind: 'melee' },
  rogue: { martialRequiresAnyProp: ['F', 'L'] },
};

/**
 * Os descritores de escolha por nível de uma classe.
 * @param {object} parsed
 * @param {object} classObj
 * @param {number} level
 * @returns {import('./choices').Choice[]}
 */
export function classLevelChoices(parsed, classObj, level) {
  const out = [];
  let weaponMasteryLevel = null;

  for (const f of parsed?.features ?? []) {
    if (f.level > level) continue;
    switch (f.name) {
      case 'Ability Score Improvement':
        out.push({
          id: `feat@${f.level}`,
          kind: 'feat',
          count: 1,
          level: f.level,
          label: `Level ${f.level} - Feat`,
          feature: { name: f.name, level: f.level },
          pool: { type: 'feat', category: ['G'], extraCategories: ['O', 'EB', 'D'] },
        });
        break;
      case 'Epic Boon':
        out.push({
          id: `feat@${f.level}`,
          kind: 'feat',
          count: 1,
          level: f.level,
          label: `Level ${f.level} - Epic Boon`,
          feature: { name: f.name, level: f.level },
          pool: { type: 'feat', category: ['EB'], extraCategories: ['G', 'O', 'D'] },
        });
        break;
      case 'Fighting Style': {
        const cats = ['FS'];
        if (FS_EXTRA[parsed.id]) cats.push(FS_EXTRA[parsed.id]);
        out.push({
          id: `feat@${f.level}`,
          kind: 'feat',
          count: 1,
          level: f.level,
          label: `Level ${f.level} - Fighting Style`,
          feature: { name: f.name, level: f.level },
          pool: { type: 'feat', category: cats },
        });
        break;
      }
      case 'Expertise':
        out.push({
          id: `expertise@${f.level}`,
          kind: 'expertise',
          count: EXPERTISE_COUNT,
          level: f.level,
          label: `Level ${f.level} - Expertise`,
          feature: { name: f.name, level: f.level },
          pool: { type: 'expertise' },
        });
        break;
      case 'Weapon Mastery':
        weaponMasteryLevel = f.level;
        break;
      default:
        break;
    }

    out.push(
      ...grantChoices(NAMED_FEATURE_GRANTS[f.name.toLowerCase()], {
        featureName: f.name,
        keyTag: `${f.name.toLowerCase()}@${f.level}`,
        classSkills: parsed?.skillChoice?.from ?? [],
      }),
    );
  }

  if (weaponMasteryLevel != null) {
    const n = weaponMasteryCount(classObj, level);
    out.push({
      id: 'weaponMastery',
      kind: 'weapon',
      count: n,
      level: weaponMasteryLevel,
      label: `Weapon Mastery`,
      feature: { name: 'Weapon Mastery', level: weaponMasteryLevel },
      pool: { type: 'weapon', weaponFilter: MASTERY_FILTERS[String(classObj?.name ?? '').toLowerCase()] ?? null },
    });
  }

  return out;
}

/**
 * As escolhas de ferramenta das proficiências iniciais.
 * @param {object} classObj
 * @returns {import('./choices').Choice[]}
 */
export function classToolChoices(classObj) {
  const perEntry = [];
  for (const entry of classObj?.startingProficiencies?.toolProficiencies ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const tokens = [];
    for (const [k, v] of Object.entries(entry)) {
      const token = TOOL_CHOICE_TOKEN[k];
      const count = Number(v);
      if (token && Number.isFinite(count) && count > 0) tokens.push({ token, count });
    }
    if (tokens.length) perEntry.push(tokens);
  }

  if (perEntry.length > 1) {
    const all = perEntry.flat();
    return [{
      id: 'tool@start-0',
      kind: 'tool',
      count: 1,
      level: 1,
      label: all.map((t) => t.token.label).join(' or '),
      pool: { type: 'any', of: 'tool', category: all.map((t) => t.token.category).filter(Boolean) },
    }];
  }

  return (perEntry[0] ?? []).map(({ token, count }, n) => ({
    id: `tool@start-${n}`,
    kind: 'tool',
    count,
    level: 1,
    label: token.label,
    pool: { type: 'any', of: 'tool', category: token.category },
  }));
}

const PLAN_FEATURE = 'replicate magic item';
const PLAN_TYPE_CODES = { potion: 'P', scroll: 'SC' };

/** Um `{@filter ...|items|k=v|...}` como filtro de plano { label, rarity, notTypes, wondrous, notCursed }. */
function planFilter(text) {
  const parts = text.split('|');
  const out = { label: `Any ${parts[0].charAt(0).toLowerCase()}${parts[0].slice(1)}`, notTypes: [], wondrous: false, notCursed: false, rarity: null };
  for (const kv of parts.slice(2)) {
    const [k, v = ''] = kv.split('=');
    const values = v.split(';').filter(Boolean);
    if (k === 'rarity' && values.length) out.rarity = values[0].toLowerCase();
    if (k === 'miscellaneous' && values.includes('!cursed')) out.notCursed = true;
    if (k === 'type') {
      for (const t of values) {
        const neg = t.startsWith('!');
        const name = t.replace(/^!/, '').toLowerCase();
        if (neg && PLAN_TYPE_CODES[name]) out.notTypes.push(PLAN_TYPE_CODES[name]);
        if (!neg && name === 'wondrous item') out.wondrous = true;
      }
    }
  }
  return out;
}

/** Os nomes "nome|fonte" de um `{@item}` da tabela, com os membros quando é um grupo de itens. */
function planNames(db, name, source) {
  const id = `${name}|${source}`.toLowerCase();
  const group = (db?.items?.itemGroup ?? []).find((g) => `${g.name}|${g.source}`.toLowerCase() === id);
  return [id, ...(group?.items ?? []).map((m) => String(m).toLowerCase())];
}

/** Se o item (cru, da entity de item) pode ser um plano desse pool. */
export function planAllows(pool, raw) {
  if (!pool || !raw) return false;
  const source = String(raw.source ?? '').toLowerCase();
  const name = String(raw.name ?? '').toLowerCase();
  if (pool.names.includes(`${name}|${source}`)) return true;
  const generic = String(raw._variantName ?? '').toLowerCase().replace(/\s*\(\*\)$/, '');
  if (generic && pool.names.includes(`${generic}|${source}`)) return true;
  const type = String(raw.type ?? '').split('|')[0];
  return pool.filters.some((f) =>
    String(raw.rarity ?? '').toLowerCase() === f.rarity &&
    !f.notTypes.includes(type) &&
    (!f.wondrous || raw.wondrous === true) &&
    (!f.notCursed || !raw.curse));
}

/**
 * Os planos do Replicate Magic Item (Artificer do EFA): quantos (a coluna Plans Known
 * da tabela da classe) e quais (as tabelas da feature cujo nível mínimo já chegou).
 */
export function planChoices(db, classId, classObj, level) {
  const raw = db?.[`class-${classId}`]?.classFeature ?? [];
  const feature = raw.find((f) => String(f.name).toLowerCase() === PLAN_FEATURE && f.classSource === classObj?.source && f.level <= level);
  if (!feature) return [];
  let count = 0;
  for (const g of classObj?.classTableGroups ?? []) {
    const col = (g.colLabels ?? []).findIndex((l) => /plans known/i.test(String(l)));
    const n = col >= 0 ? Number(g.rows?.[level - 1]?.[col]) : NaN;
    if (Number.isFinite(n)) count = n;
  }
  const names = new Set();
  const filters = [];
  const walk = (e) => {
    if (Array.isArray(e)) return e.forEach(walk);
    if (!e || typeof e !== 'object') return;
    if (e.type === 'table' && Number(String(e.caption ?? '').match(/Level (\d+)\+/)?.[1] ?? 0) <= level) {
      for (const row of e.rows ?? []) {
        const cell = typeof row[0] === 'string' ? row[0] : JSON.stringify(row[0]);
        const item = cell.match(/\{@item ([^|}]+)(?:\|([^|}]*))?/);
        const filter = cell.match(/\{@filter ([^}]+)\}/);
        if (item) planNames(db, item[1], item[2] || 'XDMG').forEach((n) => names.add(n));
        else if (filter) filters.push(planFilter(filter[1]));
      }
    }
    for (const k of ['entries', 'items']) if (e[k]) walk(e[k]);
  };
  walk(feature.entries);
  if (!count || (!names.size && !filters.length)) return [];
  return [{
    id: `plan@${PLAN_FEATURE}@${feature.level}`,
    kind: 'plan',
    count,
    level: feature.level,
    label: `${feature.name} - Plans`,
    feature: { name: feature.name, level: feature.level },
    pool: { type: 'plan', names: [...names], filters },
  }];
}

/**
 * As escolhas concedidas por features de subclasse (ids com `sub:`).
 * @param {object} db
 * @param {string} classId
 * @param {object} subclass
 * @param {number} level
 * @param {string[]} classSkills
 * @returns {import('./choices').Choice[]}
 */
export function subclassFeatureChoices(db, classId, subclass, level, classSkills = []) {
  if (!subclass) return [];
  const short = (subclass.shortName ?? '').toLowerCase();
  const out = [];
  const seen = new Set();
  for (const f of db?.[`class-${classId}`]?.subclassFeature ?? []) {
    if ((f.subclassShortName ?? '').toLowerCase() !== short) continue;
    if ((f.level ?? 0) > level) continue;
    if (subclass.source && f.subclassSource && f.subclassSource !== subclass.source) continue;
    const key = `${short}|${(f.name ?? '').toLowerCase()}`;
    const spec = SUBCLASS_FEATURE_GRANTS[key];
    if (!spec) continue;
    const bySource = spec.some((e) => Array.isArray(e.grants));
    const grants = bySource
      ? (spec.find((e) => e.source && e.source === f.source) ?? spec.find((e) => !e.source))?.grants
      : spec;
    if (!grants) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const tag = `${key}@${f.level}`;
    const active = grants.filter((g) => (g.level ?? f.level ?? 0) <= level);
    out.push(
      ...grantChoices(active, {
        featureName: f.name,
        keyTag: tag,
        classSkills,
        idPrefix: 'sub:',
        subclassShortName: subclass.shortName,
      }),
    );
  }
  return out;
}

/** Opções conhecidas neste nível (progression em array ou objeto). */
export function optionalFeatureCount(progression, level) {
  if (Array.isArray(progression)) return progression[level - 1] ?? 0;
  let bestKey = -1;
  let count = 0;
  for (const [k, v] of Object.entries(progression ?? {})) {
    const kk = Number(k);
    if (kk <= level && kk > bestKey) {
      bestKey = kk;
      count = v;
    }
  }
  return count;
}

/** O primeiro nível em que a progressão concede algo. */
function firstOfpLevel(progression) {
  if (Array.isArray(progression)) {
    const i = progression.findIndex((v) => v > 0);
    return i >= 0 ? i + 1 : 1;
  }
  const levels = Object.entries(progression ?? {})
    .filter(([, v]) => v > 0)
    .map(([k]) => Number(k));
  return levels.length ? Math.min(...levels) : 1;
}

/** A subclasse já dá um estilo de luta por SUBCLASS_FEATURE_GRANTS (o Additional Fighting Style do Champion)? */
function curatedFightingStyle(subShort) {
  const key = `${String(subShort).toLowerCase()}|`;
  return Object.entries(SUBCLASS_FEATURE_GRANTS).some(([k, v]) => k.startsWith(key) && v.some((g) => g.kind === 'feat' && (g.category ?? []).includes('FS')));
}

/**
 * As escolhas de optional features por nível.
 * @param {object} classObj
 * @param {object} [subclass]
 * @param {number} level
 * @returns {import('./choices').Choice[]}
 */
export function optionalFeatureChoices(classObj, subclass, level) {
  const out = [];
  const sources = [
    ...(classObj?.optionalfeatureProgression ?? []).map((ofp) => [ofp, null]),
    ...(subclass?.optionalfeatureProgression ?? []).map((ofp) => [ofp, subclass.shortName]),
  ];
  for (const [ofp, subShort] of sources) {
    const count = optionalFeatureCount(ofp.progression, level);
    if (count <= 0) continue;
    const types = ofp.featureType ?? [];
    const ofpLevel = firstOfpLevel(ofp.progression);
    const feature = ofp.name
      ? { name: ofp.name, level: ofpLevel, ...(subShort ? { subclass: subShort } : {}) }
      : undefined;
    if (types.length && types.every((t) => t.startsWith('FS'))) {
      if (subShort && curatedFightingStyle(subShort)) continue;
      out.push({
        id: `feat@fs@${types.join(',')}`,
        kind: 'feat',
        count,
        level: ofpLevel,
        label: ofp.name ?? 'Fighting Style',
        ...(feature ? { feature } : {}),
        pool: { type: 'feat', category: ['FS'], fsTypes: types },
      });
      continue;
    }
    out.push({
      id: `optfeat@${types.join(',')}`,
      kind: 'optionalfeature',
      count,
      level: ofpLevel,
      label: ofp.name ?? 'Options',
      ...(feature ? { feature } : {}),
      pool: { type: 'optionalfeature', featureType: types },
    });
  }
  return out;
}

/**
 * Poda o bag quando o nível desce.
 * @param {object} bag
 * @param {number} level
 * @returns {object}
 */
export function pruneChoicesAboveLevel(bag, level) {
  const out = {};
  for (const [id, entry] of Object.entries(bag ?? {})) {
    // ATENÇÃO: o nível é o texto após o ÚLTIMO @; "optfeat@EI" não é número e não é podado.
    const at = id.lastIndexOf('@');
    const lvl = at >= 0 ? Number(id.slice(at + 1)) : null;
    if (lvl != null && Number.isFinite(lvl) && lvl > level) continue;
    out[id] = entry;
  }
  return out;
}

/** O id é de uma escolha de optional feature (`optfeat@`, `feat@fs@`)? */
const isOptionalFeatureId = (id) => id.startsWith('optfeat@') || id.startsWith('feat@fs@');

/** Remove os picks concedidos pela subclasse (ids `sub:`). */
const dropSubclassGrants = (bag) =>
  Object.fromEntries(Object.entries(bag ?? {}).filter(([id]) => !id.startsWith('sub:')));

/**
 * Limpa uma entrada de classe para o nível atual.
 * @param {object} cls
 * @param {{ classObj: object|null, subclassObj: object|null, subclassLevel?: number }} ctx
 * @returns {object}
 */
export function cleanupClassEntry(cls, { classObj, subclassObj, subclassLevel = 3 }) {
  const level = cls.level;
  let choices = pruneChoicesAboveLevel(cls.choices, level);

  let subclassId = cls.subclassId;
  let subclassSource = cls.subclassSource;
  if (level < subclassLevel) {
    subclassId = null;
    subclassSource = null;
    choices = dropSubclassGrants(choices);
  }
  const effSub = subclassId ? subclassObj : null;

  if (choices.weaponMastery?.picks && classObj) {
    const max = weaponMasteryCount(classObj, level);
    if (choices.weaponMastery.picks.length > max) {
      choices = { ...choices, weaponMastery: { ...choices.weaponMastery, picks: choices.weaponMastery.picks.slice(0, max) } };
    }
  }
  if (classObj) {
    const offered = optionalFeatureChoices(classObj, effSub, level);
    const offeredIds = new Set(offered.map((oc) => oc.id));
    choices = Object.fromEntries(Object.entries(choices).filter(([id]) => !isOptionalFeatureId(id) || offeredIds.has(id)));
    for (const oc of offered) {
      const e = choices[oc.id];
      if (e?.picks && e.picks.length > oc.count) {
        choices = { ...choices, [oc.id]: { ...e, picks: e.picks.slice(0, oc.count) } };
      }
    }
  }

  return { ...cls, choices, subclassId, subclassSource };
}
