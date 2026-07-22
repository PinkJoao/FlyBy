// =============================================================================
// classFeatureChoices - escolhas POR NÍVEL das features de classe (Fase 6)
// =============================================================================
// As features 2024 (XPHB) são texto puro - não há dados estruturados de escolha.
// Detectamos pelo NOME da feature (como o Plutonium faz) e geramos descritores
// `Choice` (mesmo formato de engine/choices) para o ChoiceList:
//
//   Ability Score Improvement → talento (categoria G; o próprio feat "Ability
//                               Score Improvement" é um deles, repetível)
//   Epic Boon                 → talento (categoria EB)
//   Fighting Style            → talento (categoria FS; paladin/ranger têm
//                               variantes FS:P / FS:R)
//   Expertise                 → 2 perícias DAS QUE JÁ É PROFICIENTE
//   Weapon Mastery            → N armas (N vem da coluna "Weapon Mastery" da
//                               tabela da classe; sem coluna = 2 fixo)
//
// Os ids embutem o nível (ex: 'feat@4') p/ permitir PODAR o choice-bag quando o
// nível desce. Weapon Mastery tem id fixo (o count cresce com o nível, mas as
// escolhas persistem).
// -----------------------------------------------------------------------------

/** Variantes de Fighting Style por classe (além da categoria FS comum). */
const FS_EXTRA = { paladin: 'FS:P', ranger: 'FS:R' };

const EXPERTISE_COUNT = 2; // XPHB: toda feature Expertise concede 2 perícias.

// Tokens de escolha de ferramenta (startingProficiencies.toolProficiencies) →
// categoria do tool entity (AT/INS/GS) p/ restringir o seletor; null = qualquer.
const TOOL_CHOICE_TOKEN = {
  anyArtisansTool: { category: 'AT', label: "Artisan's Tools" },
  anyMusicalInstrument: { category: 'INS', label: 'Musical Instruments' },
  anyGamingSet: { category: 'GS', label: 'Gaming Sets' },
  anyTool: { category: null, label: 'Tool Proficiency' },
  anyToolProficiency: { category: null, label: 'Tool Proficiency' },
};

// Features cujos GRANTS de escolha (skill/tool/language/expertise) vivem só na
// PROSA e cujo nome NÃO é auto-descritivo - o match-por-nome não os pega. Curado
// (parsear prosa é frágil); cresce junto com a camada de efeitos (Fase 6+).
// Formato do grant: { kind, count, from?, category? }
//   from: array de códigos de perícia | 'classSkills' (lista de perícias de nível
//         1 da classe) | ausente (qualquer)
//   category: p/ tool - categoria do tool entity (AT/INS/GS) | ausente (qualquer)
const NAMED_FEATURE_GRANTS = {
  'deft explorer': [ // Ranger XPHB L2
    { kind: 'expertise', count: 1 },
    { kind: 'language', count: 2 },
  ],
  scholar: [ // Wizard XPHB L2 - expertise restrita a uma lista de perícias
    { kind: 'expertise', count: 1, from: ['arc', 'his', 'inv', 'med', 'nat', 'rel'] },
  ],
  'primal knowledge': [ // Barbarian XPHB L3 - perícia da lista de nível 1
    { kind: 'skill', count: 1, from: 'classSkills' },
  ],
};

// Grants em features de SUBCLASSE, chaveados por "shortName|nome" (minúsculo),
// pois nomes como "Bonus Proficiencies" se repetem entre subclasses. O valor é
// uma lista de grants OU, quando versões de fontes diferentes divergem (ex:
// Blessings of Knowledge PHB × FRHoF), uma lista de { source, grants } - a
// entrada casa pela `source` da feature (fallback: entrada sem `source`).
// Registro completado 2026-07-16 por varredura de todos os class-*.json
// (TC-0012); os grants FIXOS correspondentes vivem em engine/subclassGrants.
const SUBCLASS_FEATURE_GRANTS = {
  'lore|bonus proficiencies': [{ kind: 'skill', count: 3 }], // Bard XPHB - 3 quaisquer
  'battle master|student of war': [
    { source: 'PHB', grants: [{ kind: 'tool', count: 1, category: 'AT' }] },
    // Fighter XPHB - 1 ferramenta de artesão + 1 perícia da lista da classe
    { grants: [
      { kind: 'tool', count: 1, category: 'AT' },
      { kind: 'skill', count: 1, from: 'classSkills' },
    ] },
  ],
  'fey wanderer|otherworldly glamour': [{ kind: 'skill', count: 1, from: ['dec', 'prf', 'per'] }], // Ranger TCE/XPHB
  'order|bonus proficiencies': [{ kind: 'skill', count: 1, from: ['itm', 'per'] }], // Cleric TCE
  'peace|implement of peace': [{ kind: 'skill', count: 1, from: ['ins', 'prf', 'per'] }], // Cleric TCE
  'champion|additional fighting style': [{ kind: 'feat', count: 1, category: ['FS'] }], // Fighter XPHB L7
  'knowledge|blessings of knowledge': [
    // Cleric PHB L1: 2 idiomas + 2 perícias da lista; FRHoF L3: 1 ferramenta de
    // artesão + as mesmas 2 perícias. Nas DUAS versões as perícias escolhidas
    // vêm COM expertise ("Your proficiency bonus is doubled…" / "You have
    // Expertise in those two skills") - `expertise: true` no grant de skill.
    { source: 'FRHoF', grants: [
      { kind: 'tool', count: 1, category: 'AT' },
      { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
    ] },
    { grants: [
      { kind: 'language', count: 2 },
      { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
    ] },
  ],
  // Cleric PSA L1 (mesmo texto do PHB, MAS inline na feature guarda-chuva
  // "Knowledge Domain (PSA)" - o PSA não tem uma feature própria "Blessings of
  // Knowledge" no pool, então a chave casa o guarda-chuva).
  'knowledge (psa)|knowledge domain (psa)': [
    { kind: 'language', count: 2 },
    { kind: 'skill', count: 2, from: ['arc', 'his', 'nat', 'rel'], expertise: true },
  ],
  'nature|acolyte of nature': [{ kind: 'skill', count: 1, from: ['ani', 'nat', 'sur'] }], // Cleric PHB
  'strength (psa)|acolyte of strength': [{ kind: 'skill', count: 1, from: ['ani', 'ath', 'nat', 'sur'] }],
  'arcane archer|arcane archer lore': [{ kind: 'skill', count: 1, from: ['arc', 'nat'] }], // Fighter XGE
  // Cavalier/Samurai XGE: 1 perícia da lista OU 1 idioma qualquer (pool misto).
  'cavalier|bonus proficiency': [{ kind: 'mixed', count: 1, of: ['skill', 'language'], fromByKind: { skill: ['ani', 'his', 'ins', 'prf', 'per'] } }],
  'samurai|bonus proficiency': [{ kind: 'mixed', count: 1, of: ['skill', 'language'], fromByKind: { skill: ['his', 'ins', 'prf', 'per'] } }],
  'banneret|knightly envoy': [{ kind: 'skill', count: 1, from: ['ins', 'itm', 'per', 'prf'] }], // Fighter FRHoF
  'noble genies|genie\'s splendor': [{ kind: 'skill', count: 1, from: ['acr', 'itm', 'prf', 'per'] }], // Paladin FRHoF
  'moon|primal lore': [{ kind: 'skill', count: 1, from: ['ani', 'ins', 'med', 'nat', 'prc', 'sur'] }], // Bard FRHoF
  // Monk XGE: calligrapher's OU painter's supplies (lista restrita).
  // Monk XGE: Way of the Brush (ferramenta) + Kensei Weapons - proficiência de
  // ARMA INDIVIDUAL (o único caso alcançável no dataset atual: Hobgoblin VGM e
  // Weapon Master PHB são reprint-ocultos; Bladesinging TCE idem, e o herdeiro
  // FRHoF concede um grant fixo). No nível 3: uma corpo-a-corpo + uma à
  // distância (simples/marcial sem Heavy/Special; Longbow é exceção válida);
  // nos níveis 6/11/17: mais uma de qualquer tipo (`level` no grant destrava).
  'kensei|path of the kensei': [
    { kind: 'tool', count: 1, from: ["Calligrapher's Supplies", "Painter's Supplies"] },
    { kind: 'weaponProf', count: 1, tag: 'melee', label: 'Kensei Weapon (Melee)', weaponFilter: { kind: 'melee', noProps: ['H', 'S'] } },
    { kind: 'weaponProf', count: 1, tag: 'ranged', label: 'Kensei Weapon (Ranged)', weaponFilter: { kind: 'ranged', noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l6', level: 6, label: 'Kensei Weapon (Level 6)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l11', level: 11, label: 'Kensei Weapon (Level 11)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
    { kind: 'weaponProf', count: 1, tag: 'l17', level: 17, label: 'Kensei Weapon (Level 17)', weaponFilter: { noProps: ['H', 'S'], allow: ['Longbow'] } },
  ],
  'mastermind|master of intrigue': [
    { kind: 'tool', count: 1, category: 'GS' },
    { kind: 'language', count: 2 },
  ],
  'bladesinger|training in war and song': [{ kind: 'skill', count: 1, from: ['acr', 'ath', 'prf', 'per'] }], // Wizard FRHoF
};

const KIND_LABEL = { skill: 'Skill', tool: 'Tool', language: 'Language', expertise: 'Expertise', feat: 'Feat', weaponProf: 'Weapon' };

/** Resolve o `from` de um grant em códigos de perícia (ou null = qualquer). */
function resolveFrom(from, classSkills) {
  if (from === 'classSkills') return classSkills ?? [];
  if (Array.isArray(from)) return from;
  return null;
}

/**
 * Converte uma lista de grants curados em Choices. `keyTag` deve terminar em
 * `@<nível>` (p/ o prune por nível); `idPrefix` distingue grants de subclasse.
 * Choices skill/expertise com `from` saem com pool provisório 'any' + o campo
 * `from`; o ClassTab finaliza o pool (rotula e, no expertise, intersecta com as
 * perícias proficientes). `subclassShortName` marca grants de subclasse - vai
 * no campo `feature` (a UI resolve o texto da feature p/ o popup do glossário).
 */
function grantChoices(grants, { featureName, keyTag, classSkills, idPrefix = '', subclassShortName }) {
  const out = [];
  // Nível vem do fim do keyTag (`…@<nível>`) - usado p/ ORDENAR os seletores.
  const level = Number(String(keyTag).slice(String(keyTag).lastIndexOf('@') + 1)) || undefined;
  const feature = { name: featureName, level, ...(subclassShortName ? { subclass: subclassShortName } : {}) };
  for (const g of grants ?? []) {
    const count = g.count ?? 1;
    // `g.label` sobrepõe o rótulo padrão (Kensei distingue Melee/Ranged/níveis);
    // `g.tag` desambigua o id quando a MESMA feature tem vários grants do mesmo
    // kind; `g.level` destrava o grant num nível posterior ao da feature (as
    // armas kensei extras de 6/11/17 vivem na feature de nível 3).
    // 'mixed' descreve as alternativas ("Skill or Language") em vez de vazar o
    // nome interno do kind no título do seletor (achado da sessão T1a Fighter).
    const kindLabel = g.kind === 'mixed'
      ? (g.of ?? ['skill', 'language']).map((k) => KIND_LABEL[k] ?? k).join(' or ')
      : (KIND_LABEL[g.kind] ?? g.kind);
    const label = g.label ? `${featureName} - ${g.label}` : `${featureName} - ${kindLabel}`;
    const id = `${idPrefix}${g.kind}@${keyTag}${g.tag ? `:${g.tag}` : ''}`;
    const base = { id, count, label, level: g.level ?? level, feature };
    if (g.kind === 'skill') {
      const from = resolveFrom(g.from, classSkills);
      // `expertise: true` = a perícia escolhida vem proficiente E com expertise
      // (Blessings of Knowledge). Vira kind 'expertise' (o pick deriva nível 2
      // em collectSkillProficiencies) com `newProf` - o pool NÃO intersecta com
      // as perícias já proficientes (é proficiência nova, não upgrade).
      if (g.expertise) {
        out.push({ ...base, kind: 'expertise', newProf: true, from: from ?? undefined, pool: { type: 'expertise' } });
      } else {
        out.push({ ...base, kind: 'skill', from: from ?? undefined, pool: { type: 'any', of: 'skill' } });
      }
    } else if (g.kind === 'expertise') {
      const from = resolveFrom(g.from, classSkills);
      out.push({ ...base, kind: 'expertise', from: from ?? undefined, pool: { type: 'expertise' } });
    } else if (g.kind === 'tool') {
      // `from` (lista de NOMES, ex: Kensei calligrapher's/painter's) restringe a
      // uma lista fechada; senão `category` (AT/INS/GS) restringe o pool aberto.
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
      // Pool misto (Cavalier/Samurai: perícia da lista OU idioma). `fromByKind`
      // restringe as opções de um dos tipos (a UI e o autoBuild o aplicam).
      out.push({ ...base, kind: 'mixed', fromByKind: g.fromByKind ?? undefined, pool: { type: 'any', of: g.of ?? ['skill', 'language'] } });
    } else if (g.kind === 'weaponProf') {
      // Proficiência de ARMA INDIVIDUAL (Kensei). `weaponFilter` restringe o
      // seletor (melee/ranged, sem propriedades H/S, exceções) - ver
      // weaponFilterAllows em engine/choices; os picks derivam como armas
      // proficientes em deriveFromDb.
      out.push({ ...base, kind: 'weaponProf', pool: { type: 'any', of: 'weapon', weaponFilter: g.weaponFilter ?? null } });
    }
  }
  return out;
}

/**
 * Quantas armas o Weapon Mastery cobre neste nível: coluna "Weapon Mastery" da
 * tabela da classe (fighter/barbarian escalam), senão 2 (paladin/ranger/rogue).
 * @param {object} classObj  objeto de classe 5etools (com classTableGroups)
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

// Restrição RAW do pool do Weapon Mastery por classe (TC-0021): o texto de cada
// classe limita os tipos elegíveis. Barbarian XPHB = "Simple or Martial MELEE
// weapons" (`kind: 'melee'`). Rogue XPHB = "Simple weapons and Martial weapons
// that have the Finesse or Light property" - a semântica CONDICIONAL
// `martialRequiresAnyProp` (simple: qualquer; martial: só F/L) de
// weaponFilterAllows. Fighter/Paladin/Ranger não restringem (sem entrada).
const MASTERY_FILTERS = {
  barbarian: { kind: 'melee' },
  rogue: { martialRequiresAnyProp: ['F', 'L'] },
};

/**
 * Gera os descritores de escolha por nível de uma classe.
 * @param {object} parsed    parseClass(classObj) - features com {name, level}
 * @param {object} classObj  objeto cru (p/ tabela do Weapon Mastery)
 * @param {number} level     nível atual da classe
 * @returns {import('./choices').Choice[]}
 */
export function classLevelChoices(parsed, classObj, level) {
  const out = [];
  let weaponMasteryLevel = null;

  for (const f of parsed?.features ?? []) {
    if (f.level > level) continue;
    switch (f.name) {
      // RAW ("or another feat of your choice for which you qualify"): o slot de
      // ASI admite feats de Origem e Epic Boons, e o de Epic Boon admite G/O
      // (TC-0029). `category` segue sendo o PADRÃO (filtro pré-marcado no
      // seletor, e o pool do autoBuild); `extraCategories` entram na lista mas
      // só aparecem quando o jogador remove o filtro - os avisos de
      // pré-requisito continuam valendo (um boon fora do nível 19 confirma).
      case 'Ability Score Improvement':
        out.push({
          id: `feat@${f.level}`,
          kind: 'feat',
          count: 1,
          level: f.level,
          label: `Level ${f.level} - Feat`,
          feature: { name: f.name, level: f.level },
          pool: { type: 'feat', category: ['G'], extraCategories: ['O', 'EB'] },
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
          pool: { type: 'feat', category: ['EB'], extraCategories: ['G', 'O'] },
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
          pool: { type: 'expertise' }, // opções (perícias proficientes) vêm da UI
        });
        break;
      case 'Weapon Mastery':
        weaponMasteryLevel = f.level;
        break;
      default:
        break;
    }

    // Grants de escolha em features de nome não auto-descritivo (Deft Explorer,
    // Scholar, Primal Knowledge…). Ids embutem nome+nível → únicos e podáveis.
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
 * Escolhas de ferramenta das proficiências INICIAIS da classe. Lê o campo
 * ESTRUTURADO `startingProficiencies.toolProficiencies`: entradas `{nome:true}`
 * são grants fixos (vão p/ autoProficiencies) e os tokens `any*` viram seletores
 * restritos por categoria. Só faz sentido na classe original (multiclasse não
 * concede proficiência inicial de ferramenta) - o chamador aplica esse gate.
 * ENTRADAS SEPARADAS do array são ALTERNATIVAS (a forma como o 5etools codifica
 * o "ou"): o Monk lista `[{anyArtisansTool:1},{anyMusicalInstrument:1}]` = UMA
 * escolha "artesão OU instrumento" (único caso no dataset, levantado 2026-07-16)
 * → um seletor só, com as categorias unidas (fecha o deferred da DDL-0002).
 * @param {object} classObj
 * @returns {import('./choices').Choice[]}
 */
export function classToolChoices(classObj) {
  // Colhe os tokens por ENTRADA do array (a posição diz o que é alternativa).
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

  // Tokens espalhados por MAIS de uma entrada = alternativas ("ou"): um seletor
  // único, categorias unidas, escolhe UM (Monk).
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

  // Uma entrada só: cada token é uma escolha independente (Artificer, Bard).
  return (perEntry[0] ?? []).map(({ token, count }, n) => ({
    id: `tool@start-${n}`,
    kind: 'tool',
    count,
    level: 1, // proficiências INICIAIS = nível 1
    label: token.label,
    pool: { type: 'any', of: 'tool', category: token.category },
  }));
}

/**
 * Escolhas concedidas por features de SUBCLASSE (via SUBCLASS_FEATURE_GRANTS):
 * perícias/ferramentas/idiomas/expertise que a subclasse dá à escolha (Bard Lore,
 * Battle Master, Fey Wanderer, Cleric Order/Peace…). Ids começam com `sub:` p/
 * serem podados quando a subclasse muda.
 * @param {object} db
 * @param {string} classId
 * @param {object} subclass   objeto de subclasse (com shortName + subclassFeatures)
 * @param {number} level
 * @param {string[]} classSkills  lista de perícias de nível 1 da classe (p/ 'classSkills')
 * @returns {import('./choices').Choice[]}
 */
export function subclassFeatureChoices(db, classId, subclass, level, classSkills = []) {
  if (!subclass) return [];
  const short = (subclass.shortName ?? '').toLowerCase();
  // Itera o pool CRU de subclassFeature (cada feature achatada, com
  // subclassShortName/level/name). No padrão XPHB a feature "guarda-chuva" da
  // subclasse inlina as reais via refSubclassFeature, então NÃO dá p/ usar a
  // lista montada por subclassFeatureList - precisamos do pool bruto.
  const out = [];
  const seen = new Set(); // dedup por nome@nível (XPHB + reprints coexistem no pool)
  for (const f of db?.[`class-${classId}`]?.subclassFeature ?? []) {
    if ((f.subclassShortName ?? '').toLowerCase() !== short) continue;
    if ((f.level ?? 0) > level) continue;
    // A feature usada é a da VERSÃO da subclasse escolhida (mesma fonte); sem
    // isso, uma subclasse com reprint geraria a escolha das duas versões.
    if (subclass.source && f.subclassSource && f.subclassSource !== subclass.source) continue;
    const key = `${short}|${(f.name ?? '').toLowerCase()}`;
    const spec = SUBCLASS_FEATURE_GRANTS[key];
    if (!spec) continue;
    // Formato com desambiguação por fonte: [{source?, grants}] - casa a fonte
    // da feature; fallback: a entrada sem `source`. Formato simples: lista direta.
    const bySource = spec.some((e) => Array.isArray(e.grants));
    const grants = bySource
      ? (spec.find((e) => e.source && e.source === f.source) ?? spec.find((e) => !e.source))?.grants
      : spec;
    if (!grants) continue;
    // Dedup por CHAVE (não por nível): a mesma feature pode existir no pool nos
    // DOIS anexos da classe (PHB@1 + XPHB@3 - ex: o guarda-chuva "Knowledge
    // Domain (PSA)"); com dedup por nome@nível ela emitiria os grants duas vezes.
    if (seen.has(key)) continue;
    seen.add(key);
    const tag = `${key}@${f.level}`;
    // Grants com `level` próprio (Kensei 6/11/17) só entram quando alcançado.
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

// --- Optional features (invocations, metamagic, maneuvers, infusions…) --------

/** Nº de opções conhecidas neste nível. `progression` pode ser ARRAY (índice =
 * nível-1, ex: warlock) ou OBJETO {nível: total} (ex: Battle Master). */
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

/** Primeiro nível em que a progression concede algo (>0) - p/ ORDENAR o seletor. */
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

/**
 * Escolhas de OPTIONAL FEATURES por nível - o mecanismo genérico do 5etools
 * (optionalfeatureProgression na classe E na subclasse). Cobre invocations,
 * metamagic, maneuvers, infusions, arcane shots, runes, disciplines, fighting
 * styles de subclasse e pact boons - um único caminho para todos.
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
    // O nome da progression costuma coincidir com a feature que a concede
    // (Eldritch Invocations, Metamagic, Pact Boon…) - quando a UI não achar uma
    // feature homônima, o título simplesmente não vira link (nunca um link morto).
    const feature = ofp.name
      ? { name: ofp.name, level: ofpLevel, ...(subShort ? { subclass: subShort } : {}) }
      : undefined;
    // 2024: os Fighting Styles viraram FEATS (as optional features FS:* estão
    // `reprintedAs` feats, e o `latestOnly` as remove → o seletor de optional
    // feature sairia VAZIO, ex: Bard College of Swords). Emite um seletor de FEAT
    // categoria FS; o pré-requisito "Fighting Style" é concedido pela própria feature.
    if (types.length && types.every((t) => t.startsWith('FS'))) {
      out.push({
        id: `feat@fs@${types.join(',')}`,
        kind: 'feat',
        count,
        level: ofpLevel,
        label: ofp.name ?? 'Fighting Style',
        ...(feature ? { feature } : {}),
        // `fsTypes` deixa a UI restringir aos fighting styles daquele tipo (o
        // bardo, FS:B, só pode Dueling/Two-Weapon Fighting) - resolvido no ClassTab.
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
 * Poda um choice-bag quando o nível DESCE: remove entradas cujo id embute um
 * nível maior que o novo (ex: 'feat@8' com nível 6). Ids sem '@' ficam.
 * IMPORTANTE: ids como 'optfeat@EI' têm '@' mas o texto após NÃO é número -
 * esses NÃO são podados por nível (o count cai sozinho ao recomputar).
 * @param {object} bag
 * @param {number} level
 * @returns {object}
 */
export function pruneChoicesAboveLevel(bag, level) {
  const out = {};
  for (const [id, entry] of Object.entries(bag ?? {})) {
    // Usa o ÚLTIMO '@' - ids como 'featopt@Divine Order@1' têm o nível no fim;
    // 'optfeat@EI' tem texto não-numérico após o @ (→ NaN → não poda).
    const at = id.lastIndexOf('@');
    const lvl = at >= 0 ? Number(id.slice(at + 1)) : null;
    if (lvl != null && Number.isFinite(lvl) && lvl > level) continue;
    out[id] = entry;
  }
  return out;
}

/** Remove os picks concedidos por uma SUBCLASSE (ids `sub:`). */
const dropSubclassGrants = (bag) =>
  Object.fromEntries(Object.entries(bag ?? {}).filter(([id]) => !id.startsWith('sub:')));

/**
 * Limpa uma entrada de classe para o seu nível ATUAL - usado em QUALQUER mudança
 * de nível (level-down do topo OU da aba Class), de forma centralizada, para que
 * escolhas de níveis perdidos não persistam nem "voltem selecionadas" ao subir.
 * Poda escolhas de níveis acima; apara Weapon Mastery e optional features que
 * excedem o count do nível; e reverte a subclasse (com seus grants `sub:`) se o
 * nível caiu abaixo do nível dela. Recebe os objetos JÁ resolvidos (sem importar
 * `resolve` → sem ciclo).
 * @param {object} cls   entrada de classe (com o `level` já no alvo)
 * @param {{ classObj: object|null, subclassObj: object|null, subclassLevel?: number }} ctx
 * @returns {object}  a entrada limpa
 */
export function cleanupClassEntry(cls, { classObj, subclassObj, subclassLevel = 3 }) {
  const level = cls.level;
  let choices = pruneChoicesAboveLevel(cls.choices, level);

  // Subclasse abaixo do nível dela → reverte (e derruba os grants `sub:`).
  let subclassId = cls.subclassId;
  let subclassSource = cls.subclassSource;
  if (level < subclassLevel) {
    subclassId = null;
    subclassSource = null;
    choices = dropSubclassGrants(choices);
  }
  const effSub = subclassId ? subclassObj : null;

  // Weapon Mastery: apara ao count do nível.
  if (choices.weaponMastery?.picks && classObj) {
    const max = weaponMasteryCount(classObj, level);
    if (choices.weaponMastery.picks.length > max) {
      choices = { ...choices, weaponMastery: { ...choices.weaponMastery, picks: choices.weaponMastery.picks.slice(0, max) } };
    }
  }
  // Optional features (invocations, maneuvers…): apara picks que excedem o count.
  if (classObj) {
    for (const oc of optionalFeatureChoices(classObj, effSub, level)) {
      const e = choices[oc.id];
      if (e?.picks && e.picks.length > oc.count) {
        choices = { ...choices, [oc.id]: { ...e, picks: e.picks.slice(0, oc.count) } };
      }
    }
  }

  return { ...cls, choices, subclassId, subclassSource };
}
