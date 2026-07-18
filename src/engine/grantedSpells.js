// =============================================================================
// grantedSpells - magias CONCEDIDAS por espécie/subclasse/talento (Fase B2.3)
// =============================================================================
// Puro: sem rede/DOM. Lê o campo `additionalSpells` do 5etools (presente em
// raça/linhagem, subclasse, talento e background) e devolve as magias que o
// personagem ganha DE GRAÇA no nível atual - as "always prepared" (R12): não
// contam contra o limite de preparadas e não podem ser removidas.
//
// Forma do dado (levantada de todo o dataset, 2026-07-09):
//
//   additionalSpells: [{
//     name?, ability?: 'con' | { choose: ['int','wis','cha'] },
//     known?:    { <nívelDoPersonagem|'_'>: <valor> },
//     prepared?: { … },   innate?: { … },   expanded?: { … }
//   }]
//
// onde <valor> é ou uma LISTA de magias, ou um mapa por TIPO DE CONJURAÇÃO:
//   { daily: { '1': [magias] }, rest: { '1': [...] }, will: [...], ritual: [...],
//     resource: {...}, _: [...] }
//
// A CHAVE de `daily`/`rest`/`resource` é a quantidade de usos, e nem sempre é um
// número (levantado do dataset inteiro): `'1'`, `'1e'` (um CADA), `'pb'` (bônus
// de proficiência) e uma abreviação de atributo - `'cha'`, `'int'` - para o
// clássico "um número de vezes igual ao seu modificador de X (mínimo 1)", como o
// Misty Step do Archfey Patron. Aqui só interpretamos a chave; o NÚMERO final é
// resolvido na derivação (`resolveGrantedUses`), que conhece prof/modificadores.
//
// Uma LISTA crua sob `innate` (sem tipo de recarga) NÃO diz a frequência: o
// Aarakocra conjura Gust of Wind 1×/descanso longo, mas o Yuan-Ti conjura Animal
// Friendship à vontade - mesma forma no dado. Marcamos como `castType: 'innate'`
// ("conjura sem gastar espaço") e deixamos a frequência para o texto do traço,
// em vez de inventar um limite.
//
// Uma magia é uma string `"faerie fire|xphb"`, com sufixo opcional `#c`
// (conjurada como cantrip) ou `#2` (conjurada no 2º círculo). Também aparecem
// folhas `{ choose: 'level=0|class=Wizard' }` (uma ESCOLHA - vai pro choice-bag
// na B2.4) e `{ all: 'level=0|class=Wizard' }` (expande a lista, não concede).
// Ambas são ignoradas aqui e apenas CONTADAS (`pendingChoices`).
//
// Buckets: `known`/`prepared`/`innate` concedem; `expanded` só amplia a lista de
// magias da classe (filtro do seletor, R10) e NÃO é uma concessão.
// -----------------------------------------------------------------------------

/** Buckets que representam uma magia concedida (mode → como ela é conjurada). */
const GRANTING_BUCKETS = ['known', 'prepared', 'innate'];

/**
 * Interpreta uma string de magia do 5etools.
 * "dancing lights|xphb#c" → { name: 'dancing lights', source: 'XPHB', castLevel: 0 }
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

/** Uma chave de nível (`'3'` ou `'_'`) já foi alcançada pelo personagem? */
function levelReached(key, level) {
  if (key === '_') return true;
  const n = Number(key);
  return Number.isFinite(n) && level >= n;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Interpreta a CHAVE de contagem de `daily`/`rest`/`resource`.
 *   '2'   → 2 usos              '1e'  → 1 uso CADA (mesma etiqueta por magia)
 *   'pb'  → bônus de proficiência        'cha' → modificador de Carisma (mín. 1)
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

/**
 * Percorre o <valor> de uma chave de nível (lista ou mapa por tipo de conjuração)
 * chamando `push(spellLeaf, meta)` para cada folha.
 * Uma lista CRUA (sem tipo de recarga) sob `innate` vira `castType: 'innate'`:
 * conjura sem gastar espaço, com a frequência descrita no traço.
 */
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
      // { daily: { '1': [magias] } } → a chave diz QUANTOS usos.
      for (const [key, list] of Object.entries(inner)) {
        const { count, scale } = parseUsesKey(key);
        for (const leaf of list ?? []) push(leaf, { castType: type, count, scale });
      }
    }
  }
}

/** Nome legível de um grupo sem `name`: a primeira magia fixa que ele concede
 * ("Dancing Lights" no Astral Elf), senão "Option N". */
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

/** Interpreta a expressão de filtro de um `{choose}` de magia
 * ("level=0;1|class=Cleric;Druid|school=A|spell attack=m;r|components &
 * miscellaneous=ritual"). Condições desconhecidas são ignoradas (permissivo).
 * @returns {{ levels:number[]|null, classes:string[]|null, schools:string[]|null,
 *             ritual:boolean, attack:string[]|null }} */
export function parseSpellChooseFilter(expr) {
  const out = { levels: null, classes: null, schools: null, ritual: false, attack: null };
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
  }
  return out;
}

/** Rótulo humano de uma escolha de magia: "Choose 2 Cleric cantrips",
 * "Choose a level-1 ritual spell"… */
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
 * Magias concedidas por um `additionalSpells` no nível dado - e, desde o
 * TC-0011, também os DESCRITORES de escolha (folhas `{choose}` e o seletor de
 * grupo quando há mais de uma entrada) e o CONSUMO dos picks do choice-bag.
 *
 * Entradas MÚLTIPLAS são ALTERNATIVAS ("escolha uma lista" - Magic Initiate:
 * Cleric/Druid/Wizard; Path of the Giant: Druidcraft OU Thaumaturgy; levantado
 * do dataset inteiro 2026-07-16): só o grupo ESCOLHIDO concede/gera escolhas -
 * sem pick, nada é concedido (antes fundíamos todos os grupos, um bug).
 *
 * @param {object[]|null|undefined} additionalSpells  campo cru do 5etools
 * @param {number} level  nível relevante (do personagem p/ raça/talento; da
 *                        classe p/ subclasse)
 * @param {{ bag?: object|null, idPrefix?: string }} [opts]
 *   bag: choice-bag da entidade dona (lê `spellSet-0`/`spell-N` e funde os
 *   picks como magias concedidas); idPrefix: prefixo dos ids ('class:'/'sub:'
 *   quando as escolhas moram no bag da CLASSE, evitando colisão).
 * @returns {{
 *   spells: Array<{ name: string, source: string|null, castMode: string,
 *                   castType: string|null, uses: number|null, castLevel: number|null }>,
 *   ability: string|null,          // atributo de conjuração, quando fixo
 *   abilityChoices: string[],      // opções, quando o dado manda escolher
 *   pendingChoices: number,        // escolhas de magia ainda não feitas
 *   choices: object[],             // descritores Choice (spellSet + spell)
 * }}
 */
export function grantedSpells(additionalSpells, level, opts = {}) {
  const bag = opts.bag ?? null;
  const p = opts.idPrefix ?? '';
  let ability = null;
  let abilityChoices = [];
  let pendingChoices = 0;
  const choices = [];
  // UMA entrada por magia. A mesma magia pode ser concedida por mais de um
  // bucket - o Archfey Patron dá Misty Step como `prepared` (gasta espaço) E
  // como `innate` diário grátis. Isso é UMA magia com duas propriedades, não
  // duas linhas: fundimos, com `prepared` mandando no modo.
  const byName = new Map();
  const MODE_RANK = { prepared: 2, known: 1, innate: 0 };

  const merge = (ref, castMode, meta) => {
    const key = ref.name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...ref, castMode, castType: meta.castType, count: meta.count, scale: meta.scale });
      return;
    }
    // Modo mais "preparado" vence; o tipo de conjuração/usos vem de quem tiver.
    if (MODE_RANK[castMode] > MODE_RANK[existing.castMode]) existing.castMode = castMode;
    if (existing.castType == null && meta.castType != null) {
      existing.castType = meta.castType;
      existing.count = meta.count;
      existing.scale = meta.scale;
    }
  };

  const groups = (additionalSpells ?? []).filter((g) => g && typeof g === 'object');
  if (groups.length === 0) return { spells: [], ability: null, abilityChoices: [], pendingChoices: 0, choices: [] };

  // --- Grupos múltiplos = alternativas: um seletor de "qual lista" ------------
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
      // Sem grupo ativo ainda: expõe as opções de atributo do primeiro grupo
      // (idênticas entre grupos no dataset) p/ a UI não esconder o select.
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
          // `{all}` só expande a lista de magias da classe - não concede.
          if (leaf && typeof leaf === 'object') {
            if (!leaf.choose) return;
            // `{choose}` é uma ESCOLHA do jogador (TC-0011): vira um descritor
            // (filtro em string OU lista fechada `{from}`) e os picks já feitos
            // no bag são fundidos como magias concedidas, com o MESMO modo/
            // frequência da folha (Magic Initiate: cantrips `known`, a magia
            // de nível 1 `innate` 1/dia).
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

/**
 * Só os DESCRITORES de escolha de um `additionalSpells` (o seletor de lista +
 * as escolhas de magia do grupo ativo) - a fatia que parseChoices/ChoiceList
 * consomem. Mesmos ids que grantedSpells consome ao derivar.
 */
export function additionalSpellChoices(additionalSpells, level, bag, idPrefix = '') {
  return grantedSpells(additionalSpells, level, { bag, idPrefix }).choices;
}

const ABILITY_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/**
 * Resolve o NÚMERO de usos de uma magia concedida. Chaves escaladas (`pb`, `cha`…)
 * só viram número aqui, onde proficiência e modificadores existem. A regra 5e para
 * "vezes igual ao seu modificador de X" tem mínimo de 1.
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

/**
 * Rótulo do "como se conjura": "3/Day", "1/Rest", "At Will", "Ritual",
 * "Innate" (sem espaço, frequência no traço) ou null (conjuração normal).
 */
export function castTypeLabel(entry) {
  if (!entry?.castType) return null;
  const n = entry.uses;
  switch (entry.castType) {
    case 'daily':
      return n ? `${n}/Day` : 'Daily';
    case 'rest':
      return n ? `${n}/Rest` : 'Per Rest';
    // Só o overlay curado produz 'restLong' (DDL-0011): o 5etools não distingue
    // descanso curto de longo em `additionalSpells`.
    case 'restLong':
      return n ? `${n}/Long Rest` : 'Per Long Rest';
    case 'will':
      return 'At Will';
    case 'ritual':
      return 'Ritual';
    case 'resource':
      return n ? `${n} Charges` : 'Resource';
    // Lista crua sob `innate`: o dado não diz a frequência (Aarakocra é
    // 1×/descanso longo, Yuan-Ti é à vontade - mesma forma). Não inventamos.
    case 'innate':
      return 'No Spell Slot';
    default:
      return entry.castType;
  }
}
