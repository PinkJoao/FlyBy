// =============================================================================
// grantedSpells: as magias CONCEDIDAS por espécie, subclasse e talento (Fase B2.3)
// =============================================================================
// O QUE FAZ
//   Lê o `additionalSpells` do 5etools e devolve as magias que o personagem ganha
//   de graça no nível: as "always prepared" (R12), fora do limite e não
//   removíveis. Desde o TC-0011, também os descritores das ESCOLHAS de magia e o
//   consumo dos picks do bag.
//
//   Forma do dado (levantada de todo o dataset, 2026-07-09):
//     additionalSpells: [{ name?, ability?: 'con' | { choose: [...] },
//       known?, prepared?, innate?, expanded?: { <nível|'_'>: <valor> } }]
//   <valor> é uma LISTA de magias ou um mapa por TIPO DE CONJURAÇÃO ({ daily: {
//   '1': [...] }, rest, will, ritual, resource, _ }). A magia é "faerie
//   fire|xphb", com `#c` (como cantrip) ou `#2` (no 2º círculo).
//
// FUNÇÕES
//   parseSpellRef(str): { name, source, castLevel }.
//   levelReached(key, level): a chave de nível foi alcançada?
//   parseUsesKey(key): a CHAVE de usos ('2', '1e', 'pb', 'cha').
//   walkLevelValue(value, castMode, push): cada folha de um nível.
//   groupFallbackLabel(group, index): o nome de um grupo sem `name`.
//   parseSpellChooseFilter(expr): a expressão de filtro de um `{choose}`.
//   spellChooseLabel(pool, count): "Choose 2 Cleric cantrips".
//   grantedSpells(additionalSpells, level, opts): magias, atributo, escolhas.
//   additionalSpellChoices(additionalSpells, level, bag, idPrefix): só os
//     descritores de escolha (o que parseChoices consome).
//   resolveGrantedUses(entry, ctx): o NÚMERO de usos (mínimo 1 para "igual ao
//     modificador").
//   castTypeLabel(entry): "3/Day", "1/Rest", "At Will", "Ritual", "Innate".
//
// DECISÕES E ARMADILHAS
//   - Buckets: known, prepared e innate concedem; `expanded` só amplia a lista
//     (spellListWidening). `{all}` também só amplia.
//   - A chave de usos nem sempre é número: '1e' é um CADA, 'pb' é o bônus de
//     proficiência, 'cha' é o modificador (o Misty Step do Archfey). Só a
//     derivação, que conhece prof e mods, faz a conta.
//   - Lista CRUA sob `innate` NÃO diz a frequência (o Aarakocra é 1 por descanso
//     longo, o Yuan-Ti à vontade): vira `castType: 'innate'` e a frequência fica
//     no texto, ou no overlay curado (grantedSpellUses, DDL-0011). 'restLong' só
//     vem do overlay; o 5etools não distingue curto de longo aqui.
//   - Entradas MÚLTIPLAS são ALTERNATIVAS (Magic Initiate, Path of the Giant;
//     levantado em 2026-07-16): só o grupo ESCOLHIDO concede; sem pick, nada
//     (antes fundíamos todos, um bug). Sem grupo ativo, as opções de atributo do
//     primeiro grupo aparecem, para a UI não esconder o select.
//   - UMA entrada por magia: o Archfey dá Misty Step `prepared` E `innate`
//     diário; é uma magia com duas propriedades, e o modo `prepared` manda.
//   - `{choose}` vira escolha (filtro ou lista fechada), e os picks feitos entram
//     como concedidas com o modo e a frequência da folha. O `idPrefix` ('class:',
//     'sub:') evita colisão no bag da classe.
//   - O filtro aceita `source=`: é a única condição de Chronurgy e Graviturgy
//     (EGW), e ignorá-la casava o catálogo inteiro. Condição desconhecida é
//     ignorada (permissivo).
// -----------------------------------------------------------------------------

const GRANTING_BUCKETS = ['known', 'prepared', 'innate'];

/**
 * Interpreta uma string de magia do 5etools.
 * @param {string} str
 * @returns {{ name: string, source: string|null, castLevel: number|null }|null}
 */
export function parseSpellRef(str) {
  if (typeof str !== 'string' || !str) return null;
  const [ref, marker] = str.split('#');
  const [name, source] = ref.split('|');
  if (!name) return null;
  let castLevel = null;
  if (marker === 'c') castLevel = 0;
  else if (marker && !Number.isNaN(Number(marker))) castLevel = Number(marker);
  return { name: name.trim(), source: source ? source.toUpperCase() : null, castLevel };
}

/** Uma chave de nível já foi alcançada? */
function levelReached(key, level) {
  if (key === '_') return true;
  const n = Number(key);
  return Number.isFinite(n) && level >= n;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Interpreta a chave de contagem de daily, rest e resource.
 * @param {string} key
 * @returns {{ count: number|null, scale: 'pb'|string|null, each: boolean }}
 */
export function parseUsesKey(key) {
  const str = String(key);
  const each = /^\d+e$/.test(str);
  const n = Number(each ? str.slice(0, -1) : str);
  if (Number.isFinite(n)) return { count: n, scale: null, each };
  if (str === 'pb') return { count: null, scale: 'pb', each: false };
  if (ABILITY_KEYS.includes(str)) return { count: null, scale: str, each: false };
  return { count: null, scale: null, each: false };
}

/** Chama `push(spellLeaf, meta)` para cada folha de um nível. */
function walkLevelValue(value, castMode, push) {
  const bare = castMode === 'innate' ? 'innate' : null;
  if (Array.isArray(value)) {
    for (const leaf of value) push(leaf, { castType: bare, count: null, scale: null });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [castType, inner] of Object.entries(value)) {
    const type = castType === '_' ? bare : castType;
    if (Array.isArray(inner)) {
      for (const leaf of inner) push(leaf, { castType: type, count: null, scale: null });
    } else if (inner && typeof inner === 'object') {
      for (const [key, list] of Object.entries(inner)) {
        const { count, scale } = parseUsesKey(key);
        for (const leaf of list ?? []) push(leaf, { castType: type, count, scale });
      }
    }
  }
}

/** O nome de um grupo sem `name`: a primeira magia fixa, senão "Option N". */
function groupFallbackLabel(group, index) {
  for (const castMode of GRANTING_BUCKETS) {
    const bucket = group[castMode];
    if (!bucket || typeof bucket !== 'object') continue;
    for (const value of Object.values(bucket)) {
      let found = null;
      walkLevelValue(value, castMode, (leaf) => {
        if (found == null && typeof leaf === 'string') found = leaf;
      });
      if (found) {
        const name = parseSpellRef(found)?.name ?? found;
        return name.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
  }
  return `Option ${index + 1}`;
}

/**
 * Interpreta a expressão de filtro de um `{choose}` de magia.
 * @returns {{ levels:number[]|null, classes:string[]|null, schools:string[]|null,
 *   ritual:boolean, attack:string[]|null, sources:string[]|null }}
 */
export function parseSpellChooseFilter(expr) {
  const out = { levels: null, classes: null, schools: null, ritual: false, attack: null, sources: null };
  for (const cond of String(expr ?? '').split('|')) {
    const eq = cond.indexOf('=');
    if (eq < 0) continue;
    const key = cond.slice(0, eq).trim().toLowerCase();
    const vals = cond.slice(eq + 1).split(';').map((v) => v.trim()).filter(Boolean);
    if (key === 'level') out.levels = vals.map(Number).filter(Number.isFinite);
    else if (key === 'class') out.classes = vals;
    else if (key === 'school') out.schools = vals.map((v) => v.toUpperCase());
    else if (key === 'spell attack') out.attack = vals.map((v) => v.toUpperCase());
    else if (key === 'components & miscellaneous') out.ritual = vals.some((v) => v.toLowerCase() === 'ritual');
    else if (key === 'source') out.sources = vals.map((v) => v.toUpperCase());
  }
  return out;
}

/** O rótulo humano de uma escolha de magia. */
function spellChooseLabel(pool, count) {
  const f = pool.filter != null ? parseSpellChooseFilter(pool.filter) : null;
  const parts = [];
  if (f?.classes?.length) parts.push(f.classes.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join('/'));
  if (f?.ritual) parts.push('ritual');
  let noun = count > 1 ? 'spells' : 'spell';
  if (f?.levels && f.levels.length === 1) {
    noun = f.levels[0] === 0 ? (count > 1 ? 'cantrips' : 'cantrip') : `level-${f.levels[0]} ${noun}`;
  } else if (f?.levels && f.levels.every((l) => l === 0)) {
    noun = count > 1 ? 'cantrips' : 'cantrip';
  }
  const detail = parts.length ? `${parts.join(' ')} ` : '';
  return `Choose ${count > 1 ? count : 'a'} ${detail}${noun}`;
}

/**
 * As magias concedidas no nível, os descritores de escolha e o consumo dos picks.
 * @param {object[]|null|undefined} additionalSpells
 * @param {number} level
 * @param {{ bag?: object|null, idPrefix?: string }} [opts]
 * @returns {{
 *   spells: Array<{ name: string, source: string|null, castMode: string,
 *   castType: string|null, uses: number|null, castLevel: number|null }>,
 *   ability: string|null,          // atributo de conjuração, quando fixo
 *   abilityChoices: string[],      // opções, quando o dado manda escolher
 *   pendingChoices: number,        // escolhas de magia ainda não feitas
 *   choices: object[],             // descritores Choice (spellSet + spell)
 *   }}
 */
export function grantedSpells(additionalSpells, level, opts = {}) {
  const bag = opts.bag ?? null;
  const p = opts.idPrefix ?? '';
  let ability = null;
  let abilityChoices = [];
  let pendingChoices = 0;
  const choices = [];
  const byName = new Map();
  const MODE_RANK = { prepared: 2, known: 1, innate: 0 };

  const merge = (ref, castMode, meta) => {
    const key = ref.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...ref, castMode, castType: meta.castType, count: meta.count, scale: meta.scale });
      return;
    }
    if (MODE_RANK[castMode] > MODE_RANK[existing.castMode]) existing.castMode = castMode;
    if (existing.castType == null && meta.castType != null) {
      existing.castType = meta.castType;
      existing.count = meta.count;
      existing.scale = meta.scale;
    }
  };

  const groups = (additionalSpells ?? []).filter((g) => g && typeof g === 'object');
  if (groups.length === 0) return { spells: [], ability: null, abilityChoices: [], pendingChoices: 0, choices: [] };

  let active = groups;
  if (groups.length > 1) {
    const setId = `${p}spellSet-0`;
    const options = groups.map((g, i) => ({
      value: g.name ?? `#${i}`,
      label: g.name ?? groupFallbackLabel(g, i),
    }));
    choices.push({ id: setId, kind: 'spellSet', count: 1, label: 'Spell List', level: 1, pool: { type: 'spellSet', options } });
    const pick = bag?.[setId]?.picks?.[0];
    const idx = options.findIndex((o) => o.value === pick);
    if (idx >= 0) {
      active = [groups[idx]];
    } else {
      active = [];
      pendingChoices += 1;
      if (Array.isArray(groups[0].ability?.choose)) abilityChoices = [...groups[0].ability.choose];
    }
  }

  let chooseN = 0;
  for (const group of active) {
    if (typeof group.ability === 'string') ability ??= group.ability;
    else if (Array.isArray(group.ability?.choose)) {
      if (abilityChoices.length === 0) abilityChoices = [...group.ability.choose];
    }

    for (const castMode of GRANTING_BUCKETS) {
      const bucket = group[castMode];
      if (!bucket || typeof bucket !== 'object') continue;

      for (const [levelKey, value] of Object.entries(bucket)) {
        if (!levelReached(levelKey, level)) continue;
        walkLevelValue(value, castMode, (leaf, meta) => {
          if (leaf && typeof leaf === 'object') {
            if (!leaf.choose) return;
            const count = leaf.count ?? 1;
            const id = `${p}spell-${chooseN++}`;
            const pool = {
              type: 'spell',
              filter: typeof leaf.choose === 'string' ? leaf.choose : null,
              from: Array.isArray(leaf.choose?.from) ? leaf.choose.from.map((s) => parseSpellRef(s)?.name ?? s) : null,
              castMode,
              castType: meta.castType,
            };
            const numLevel = Number(levelKey);
            choices.push({
              id,
              kind: 'spell',
              count,
              label: spellChooseLabel(pool, count),
              level: Number.isFinite(numLevel) ? numLevel : 1,
              pool,
            });
            const picks = bag?.[id]?.picks ?? [];
            for (const pk of picks) {
              const ref = parseSpellRef(pk);
              if (ref) merge(ref, castMode, meta);
            }
            pendingChoices += Math.max(0, count - picks.length);
            return;
          }
          const ref = parseSpellRef(leaf);
          if (ref) merge(ref, castMode, meta);
        });
      }
    }
  }

  const spells = [...byName.values()];

  return { spells, ability, abilityChoices, pendingChoices, choices };
}

/** Só os descritores de escolha de um `additionalSpells`. */
export function additionalSpellChoices(additionalSpells, level, bag, idPrefix = '') {
  return grantedSpells(additionalSpells, level, { bag, idPrefix }).choices;
}

const ABILITY_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/**
 * O número de usos de uma magia concedida.
 * @param {{count: number|null, scale: string|null}} entry
 * @param {{ profBonus?: number, modifiers?: Record<string, number> }} ctx
 * @returns {{ uses: number|null, usesNote: string|null }}
 */
export function resolveGrantedUses(entry, { profBonus = 0, modifiers = {} } = {}) {
  if (!entry?.scale) return { uses: entry?.count ?? null, usesNote: null };
  if (entry.scale === 'pb') return { uses: profBonus, usesNote: 'Proficiency Bonus' };
  const mod = modifiers[entry.scale] ?? 0;
  return { uses: Math.max(1, mod), usesNote: `${ABILITY_NAME[entry.scale] ?? entry.scale} modifier` };
}

/** O rótulo de como a magia é conjurada, ou null. */
export function castTypeLabel(entry) {
  if (!entry?.castType) return null;
  const n = entry.uses;
  switch (entry.castType) {
    case 'daily':
      return n ? `${n}/Day` : 'Daily';
    case 'rest':
      return n ? `${n}/Rest` : 'Per Rest';
    case 'restLong':
      return n ? `${n}/Long Rest` : 'Per Long Rest';
    case 'will':
      return 'At Will';
    case 'ritual':
      return 'Ritual';
    case 'resource':
      return n ? `${n} Charges` : 'Resource';
    case 'innate':
      return 'No Spell Slot';
    default:
      return entry.castType;
  }
}
