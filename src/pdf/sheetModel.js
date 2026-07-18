// =============================================================================
// sheetModel - traduz personagem+derivação em VALORES prontos para a ficha PDF
// =============================================================================
// Puro (character + derived + db → objeto de dados), sem JSX: o
// CharacterSheetDoc só posiciona os valores que este módulo calcula.
//
// Regras de preenchimento fixadas com o usuário (2026-07-14):
//   - Features de classe/espécie e feats: SÓ os nomes (o jogador consulta os
//     livros), como já fazemos com magias.
//   - Multiclasse: uma ficha (2 páginas) POR CLASSE no mesmo arquivo, quase
//     idênticas - mudam classe/subclasse, a lista de features daquela classe e
//     o bloco de conjuração daquela classe (magias de espécie/talento aparecem
//     em todas).
//   - Ficam EM BRANCO para preencher à mão: background (usamos customizados),
//     current/temp HP, spent hit dice, XP, death saves, heroic inspiration e
//     os pips de slot gastos.
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj, resolveRaceObj, resolveFeat } from '../engine/resolve';
import { parseSpecies, effectiveSizeCodes, sizePick, sizeLabel } from '../engine/speciesData';
import { classDisplayName, rangeLabel, isRitual, isConcentration } from '../engine/spells';
import { castTypeLabel } from '../engine/grantedSpells';
import { optionalFeatureChoices } from '../engine/classFeatureChoices';
import { collectAbilityPicks } from '../engine/choices';
import {
  buildClassFeatureItems,
  buildSubclassFeatureItems,
  buildClassChosenFeats,
  buildOriginFeatItem,
  buildSpeciesFeatItems,
} from '../engine/foundryItems';
import { SKILL_ABILITY } from '../engine/proficiency';
import { SKILL_LABEL, ABILITY_SHORT } from '../components/builder/labels';

const ABILITY_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

/** Código de alinhamento ('NG') → por extenso na ficha. Texto livre (fixtures/
 *  imports antigos) passa como está. */
const ALIGNMENT_NAME = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
};

/** Formata um modificador com sinal: 3 → "+3", -1 → "-1". */
export function signed(n) {
  if (n == null || Number.isNaN(n)) return '';
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Abreviação do tempo de conjuração (como o exemplo preenchido: A / BA / R…). */
export function timeAbbrev(spell) {
  const t = spell?.time?.[0];
  if (!t) return '';
  const map = { action: 'A', bonus: 'BA', reaction: 'R' };
  if (map[t.unit]) return map[t.unit];
  if (t.unit === 'minute') return `${t.number} Min`;
  if (t.unit === 'hour') return `${t.number} Hr`;
  return `${t.number ?? ''} ${t.unit ?? ''}`.trim();
}

/** "Elf; Drow Lineage" → "Elf (Drow)". Sem linhagem, devolve o nome como está. */
export function speciesLabel(raceObj, fallback = '') {
  const name = raceObj?.name ?? fallback;
  const parts = String(name).split(';').map((s) => s.trim());
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} (${parts[1].replace(/\s+lineage$/i, '')})`;
}

/** Primeiro código de propriedade de arma ("F|XPHB" → "F"). */
const propCodes = (raw) =>
  (raw?.property ?? []).map((p) => String(typeof p === 'string' ? p : p?.uid ?? '').split('|')[0]);

/** O personagem é proficiente com a arma? (categoria "Simple/Martial Weapons"
 *  na lista derivada, ou a arma citada nominalmente, ex: "Longsword"). */
function weaponProficient(entry, weaponProfs) {
  const profs = (weaponProfs ?? []).map((w) => w.toLowerCase());
  const cat = entry.category ? `${entry.category} weapons`.toLowerCase() : null;
  const name = (entry.raw?.name ?? '').toLowerCase();
  return profs.some((p) => p === cat || p === name || p === `${name}s`);
}

/** Linhas da tabela Weapons & Damage: equipadas primeiro, no máximo `max`. */
export function weaponRows(character, derived, { max = 8 } = {}) {
  const weapons = (derived.inventory ?? []).filter((e) => e.group === 'weapon' && e.raw);
  weapons.sort((a, b) => (b.equipped === true) - (a.equipped === true));

  // Weapon Mastery escolhidas (choice-bags kind 'weapon' de qualquer classe).
  const masteryPicks = new Set();
  for (const cls of character.classes ?? []) {
    for (const entry of Object.values(cls.choices ?? {})) {
      if (entry?.kind !== 'weapon') continue;
      for (const p of entry.picks ?? []) masteryPicks.add(String(p).split('|')[0].toLowerCase());
    }
  }

  const rows = [];
  for (const e of weapons.slice(0, max)) {
    const raw = e.raw;
    const props = propCodes(raw);
    const finesse = props.includes('F');
    const { str = 0, dex = 0 } = derived.modifiers ?? {};
    const mod = e.kind === 'ranged' ? dex : finesse ? Math.max(str, dex) : str;
    const magic = Number(raw.bonusWeapon ?? 0) || 0;
    const prof = weaponProficient(e, derived.weapons) ? derived.proficiencyBonus : 0;

    const dmgBonus = mod + magic;
    const dmg = raw.dmg1
      ? `${raw.dmg1}${dmgBonus ? signed(dmgBonus) : ''} ${raw.dmgType ?? ''}`.trim()
      : '-';

    const notes = [];
    if (masteryPicks.has(raw.name.toLowerCase()) && raw.mastery?.length) {
      notes.push(`Mastery: ${String(raw.mastery[0]).split('|')[0]}`);
    }
    if (props.includes('T')) notes.push('Thrown');
    if (raw.dmg2) notes.push(`Versatile ${raw.dmg2}`);

    rows.push({
      name: raw.name,
      bonus: signed(mod + magic + prof),
      damage: dmg,
      notes: notes.join(', '),
    });
  }
  return rows;
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** "+2 Str, +1 Con" a partir dos picks de atributo do sub-bag de um feat ASI. */
function asiText(subBag) {
  const picks = collectAbilityPicks(subBag);
  return picks.map((p) => `+${p.amount} ${ABILITY_SHORT[p.ability] ?? p.ability}`).join(', ');
}

/** Nome legível de um pick "Nome|Fonte" (ou código de perícia). */
const pickName = (p) => String(typeof p === 'object' ? p.value : p).split('|')[0];

/**
 * Anotações das ESCOLHAS do jogador no choice-bag da classe: weapon mastery,
 * fighting style, invocations/metamagic/maneuvers, sub-features (Divine/Primal
 * Order…), expertise e feats de nível. Cada anotação aponta a FEATURE que a
 * concedeu (`target`, casado por nome ± nível na lista de features) - sem
 * feature correspondente, vira uma linha extra "Label: picks".
 * @returns {{ target: string|null, level: number|null, label: string, text: string }[]}
 */
export function featureAnnotations(cls, classObj, subObj, db) {
  const out = [];
  // Rótulos dos seletores de optional feature (invocations, metamagic, maneuvers,
  // fighting style de subclasse) - os ids `optfeat@…`/`feat@fs@…` vêm daqui.
  const ofLabels = new Map(
    optionalFeatureChoices(classObj, subObj, cls.level).map((c) => [c.id, c.label]),
  );

  for (const [id, entry] of Object.entries(cls.choices ?? {})) {
    if (!entry || !Array.isArray(entry.picks) || entry.picks.length === 0) continue;
    const bare = id.startsWith('sub:') ? id.slice(4) : id;
    const parts = bare.split('@');
    const names = entry.picks.map(pickName);
    // Ids de grant curado embutem "nome da feature@nível" (3 segmentos); o nome
    // pode vir prefixado da subclasse ("champion|additional fighting style").
    const grantTarget = parts.length >= 3 ? parts[1].split('|').pop() : null;
    const level = Number(parts[parts.length - 1]);

    switch (entry.kind) {
      case 'featureoption': // featopt@<Feature>@<lvl> - Divine Order, Blessed Strikes…
        out.push({ target: parts[1], level, label: parts[1], text: names.join(', ') });
        break;
      case 'weapon': // weaponMastery
        out.push({ target: 'Weapon Mastery', level: null, label: 'Weapon Mastery', text: names.join(', ') });
        break;
      case 'expertise': { // expertise@<lvl> | expertise@<feature>@<lvl>
        const skills = entry.picks.map((p) => SKILL_LABEL[p] ?? p);
        out.push({ target: grantTarget ?? 'Expertise', level: Number.isFinite(level) ? level : null, label: 'Expertise', text: skills.join(', ') });
        break;
      }
      case 'optionalfeature': { // optfeat@<types> - invocations, metamagic, maneuvers…
        const label = ofLabels.get(id) ?? 'Options';
        out.push({ target: label, level: null, label, text: names.join(', ') });
        break;
      }
      case 'feat': {
        if (ofLabels.has(id)) { // feat@fs@<types> - fighting style via optional feature
          const label = ofLabels.get(id);
          out.push({ target: label, level: null, label, text: names.join(', ') });
          break;
        }
        if (grantTarget) { // feat@<feature>@<lvl> - ex: Champion "Additional Fighting Style"
          out.push({ target: grantTarget, level, label: grantTarget, text: names.join(', ') });
          break;
        }
        // feat@<lvl> - o slot de ASI/feat/estilo do nível. O feat "Ability Score
        // Improvement" cru mostra os aumentos escolhidos em vez do nome.
        const texts = entry.picks.map((p) => {
          const name = pickName(p);
          if (norm(name) === 'ability score improvement') return asiText(entry.sub?.[p]) || name;
          return name;
        });
        const featData = resolveFeat(db, entry.picks[0]);
        const isFs = String(featData?.category ?? '').startsWith('FS');
        // O alvo por nome+nível: Fighting Style (feats FS) ou o slot de ASI/Epic Boon.
        const targets = isFs ? ['Fighting Style'] : ['Ability Score Improvement', 'Epic Boon'];
        out.push({ targets, level: Number.isFinite(level) ? level : null, label: `Level ${level} Feat`, text: texts.join(', ') });
        break;
      }
      // skill/tool/language de features nomeadas (Primal Knowledge, Student of
      // War…) anotam a feature; os das proficiências iniciais já estão nas listas.
      case 'skill':
      case 'tool':
      case 'language': {
        if (!grantTarget) break;
        const labels = entry.picks.map((p) => {
          const v = pickName(p);
          return entry.kind === 'skill' ? (SKILL_LABEL[v] ?? v) : v;
        });
        out.push({ target: grantTarget, level, label: grantTarget, text: labels.join(', ') });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

/** Linhas de feature (classe + subclasse) em ordem de nível, com as escolhas do
 *  jogador anotadas: "Weapon Mastery (Cleave, Graze)", "Divine Order (Thaumaturge)",
 *  "Ability Score Improvement (+2 Str)". Escolhas sem feature na lista viram
 *  linhas extras "Label: picks". */
function classFeatureLines(cls, db) {
  const classObj = resolveClassObj(db, cls.classId, cls.source);
  if (!classObj) return [];
  const items = buildClassFeatureItems(cls, classObj, db);
  const subObj = cls.subclassId
    ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
    : null;
  if (subObj) items.push(...buildSubclassFeatureItems(subObj, cls.classId, db, cls.level));
  const features = items
    .map((i) => ({ name: i.name, level: i.flags?.builder5e?.level ?? 0, notes: [] }))
    .sort((a, b) => a.level - b.level);

  const extras = [];
  for (const ann of featureAnnotations(cls, classObj, subObj, db)) {
    const targetNames = (ann.targets ?? [ann.target]).filter(Boolean).map(norm);
    const hit =
      // nome + nível exato primeiro (ASI repete em vários níveis)…
      features.find((f) => targetNames.includes(norm(f.name)) && ann.level != null && f.level === ann.level) ??
      // …senão só o nome.
      features.find((f) => targetNames.includes(norm(f.name)));
    if (hit) hit.notes.push(ann.text);
    else extras.push(`${ann.label}: ${ann.text}`);
  }

  return [
    ...features.map((f) => (f.notes.length ? `${f.name} (${f.notes.join('; ')})` : f.name)),
    ...extras,
  ];
}

/** Nomes de todos os talentos do personagem (origem + espécie + slots de ASI). */
function featNames(character, db) {
  const names = [];
  const origin = buildOriginFeatItem(character, db);
  if (origin) names.push(origin.name);
  for (const it of buildSpeciesFeatItems(character, db)) names.push(it.name);
  for (const cls of character.classes ?? []) {
    for (const it of buildClassChosenFeats(cls, db).items) names.push(it.name);
  }
  return [...new Set(names)];
}

/** Uma linha da tabela de magias a partir de uma entrada resolvida de origem. */
function spellRow(entry, note) {
  const raw = entry.raw;
  if (!raw) return null;
  return {
    level: raw.level === 0 ? 'C' : String(raw.level),
    name: raw.name,
    time: timeAbbrev(raw),
    // Alcance compactado p/ caber na coluna ("60 feet" → "60 ft").
    range: rangeLabel(raw).replace(/-foot/g, '-ft').replace(/\bfeet\b/g, 'ft'),
    c: isConcentration(raw),
    r: isRitual(raw),
    m: !!raw.components?.m,
    notes: note ?? '',
    _rank: raw.level,
  };
}

/** Ordena por círculo (cantrips primeiro) e nome. */
const byLevelName = (a, b) => a._rank - b._rank || a.name.localeCompare(b.name);

/** Linhas de magia de UMA origem: escolhidas (cantrips+preparadas) e depois as
 *  concedidas/arcanum, cada grupo ordenado por círculo e nome. */
function originSpellRows(origin, tag) {
  const withTag = (label) => [tag, label].filter(Boolean).join(', ');
  const chosen = [
    ...(origin.cantrips ?? []).map((s) => spellRow(s, withTag(castTypeLabel(s)))),
    ...(origin.prepared ?? []).map((s) => spellRow(s, withTag(null))),
  ];
  const granted = [
    ...(origin.alwaysPrepared ?? []).map((s) => spellRow(s, withTag(castTypeLabel(s)))),
    ...(origin.arcanumSpells ?? []).map((s) => spellRow(s, withTag('Arcanum 1/LR'))),
  ];
  return [
    ...chosen.filter(Boolean).sort(byLevelName),
    ...granted.filter(Boolean).sort(byLevelName),
  ];
}

/** Tag de origem concedida (raça/talento) com o DC/ataque DAQUELA origem -
 *  ex: "Drow (DC 13/+5)". A habilidade vem do dado ou da escolha do jogador
 *  (spellAbility), exatamente como a aba Spellbook mostra. */
function grantedOriginTag(origin) {
  if (origin.saveDc == null) return origin.label;
  return `${origin.label} (DC ${origin.saveDc}/${signed(origin.attackBonus)})`;
}

/** Remove tags 5etools ({@spell x|src} → "x") de um texto de traço. */
const stripTags = (s) => String(s).replace(/\{@\w+ ([^|}]+)[^}]*\}/g, '$1');

/**
 * Converte as `entries` de UM traço em PARÁGRAFOS `{ lead, text }` - a mesma
 * estrutura que a tela de Species mostra, só que compactada: sub-entradas
 * nomeadas e itens de lista viram parágrafos próprios (o `lead` sai em negrito
 * na ficha), sem caixas, marcadores ou tamanhos de fonte distintos.
 * Ex. (Aasimar): "Celestial Revelation." intro… + um parágrafo por opção
 * ("Heavenly Wings.", "Inner Radiance.", "Necrotic Shroud.").
 */
function traitParagraphs(name, entries) {
  const paras = [];
  let cur = { lead: name, parts: [] };
  const flush = () => {
    const text = cur.parts.join(' ').trim();
    if (cur.lead || text) paras.push({ lead: cur.lead ?? null, text });
    cur = { lead: null, parts: [] };
  };
  const open = (lead) => {
    flush();
    cur.lead = lead;
  };
  const walk = (e) => {
    if (typeof e === 'string') {
      cur.parts.push(stripTags(e));
    } else if (Array.isArray(e)) {
      e.forEach(walk);
    } else if (e && typeof e === 'object') {
      if (e.type === 'list') {
        // Cada item numa linha própria (sem marcador); itens nomeados em negrito.
        for (const item of e.items ?? []) {
          if (typeof item === 'string') {
            open(null);
            cur.parts.push(stripTags(item));
          } else if (item && typeof item === 'object') {
            open(item.name ? stripTags(item.name) : null);
            walk(item.entries ?? item.entry ?? []);
          }
        }
        open(null); // texto seguinte volta a ser parágrafo sem negrito
      } else if (e.name) {
        open(stripTags(e.name));
        walk(e.entries ?? e.entry ?? []);
        open(null);
      } else {
        if (e.entries) walk(e.entries);
        if (e.items) walk(e.items);
        if (e.entry) walk(e.entry);
      }
    }
  };
  walk(entries ?? []);
  flush();
  return paras.filter((p) => p.lead || p.text);
}

/** Todos os traços da espécie como uma lista de parágrafos `{ lead, text }`
 *  (o card da ficha escala a fonte p/ ocupar a caixa inteira). Exportado p/ teste. */
export function speciesTraitParagraphs(raceObj) {
  return (raceObj?.entries ?? [])
    .filter((e) => e && e.type === 'entries' && e.name)
    .flatMap((e) => traitParagraphs(e.name, e.entries));
}

/** Slots totais por círculo (leveled compartilhado + pacto somado no círculo
 *  dele - a ficha não tem linha própria de Pact Magic). */
export function slotTotals(spellcasting) {
  const totals = { ...(spellcasting?.slots ?? {}) };
  const pact = spellcasting?.pactSlots;
  if (pact?.slots) totals[pact.level] = (totals[pact.level] ?? 0) + pact.slots;
  return totals;
}

/**
 * Monta o modelo da ficha: uma entrada em `sheets` por classe (ou uma única,
 * incompleta, se o personagem ainda não tem classe).
 * @param {import('../schema/character').Character} character
 * @param {object} derived  saída de `deriveFromDb(character, db)`
 * @param {object} db
 */
export function buildSheetModel(character, derived, db) {
  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  const species = parseSpecies(raceObj);

  // --- blocos IGUAIS em todas as fichas ---------------------------------------
  const abilities = {};
  for (const ab of Object.keys(ABILITY_NAME)) {
    abilities[ab] = {
      score: derived.scores?.[ab] ?? '',
      mod: signed(derived.modifiers?.[ab]),
      save: signed(derived.saves?.[ab]),
      saveProf: (derived.proficientSaves ?? []).includes(ab),
      skills: {},
    };
  }
  for (const [code, ab] of Object.entries(SKILL_ABILITY)) {
    const sk = derived.skills?.[code];
    abilities[ab].skills[code] = { value: signed(sk?.bonus), prof: (sk?.proficiency ?? 0) > 0 };
  }

  const armorProfs = (derived.armor ?? []).map((a) => a.toLowerCase());
  const has = (word) => armorProfs.some((a) => a.startsWith(word));
  // Dados de vida agregados por face ("Cleric 5 + Warlock 1" → "6d8").
  const dieCount = {};
  for (const c of derived.classBreakdown ?? []) {
    if (c.hitDie) dieCount[c.hitDie] = (dieCount[c.hitDie] ?? 0) + c.level;
  }
  const hitDice = Object.keys(dieCount)
    .sort((a, b) => b - a)
    .map((d) => `${dieCount[d]}d${d}`)
    .join(' / ');

  const spellcasting = derived.spellcasting ?? { origins: [] };
  const grantedOrigins = spellcasting.origins.filter((o) => o.kind !== 'class');
  // Cada linha concedida carrega o DC/ataque da PRÓPRIA origem (raça/talento).
  const grantedRows = grantedOrigins.flatMap((o) => originSpellRows(o, grantedOriginTag(o)));
  // Fallback do bloco de conjuração: numa ficha SEM origem de classe (Fighter com
  // Magic Initiate, ficha sem classe), mostra a primeira origem concedida com
  // habilidade definida - as linhas desambiguam quando houver mais de uma.
  const grantedCaster = grantedOrigins.find((o) => o.ability) ?? null;
  const spellBlock = (origin) => ({
    spellAbilityName: origin?.ability ? ABILITY_NAME[origin.ability] : '',
    spellAbilityCode: origin?.ability ? origin.ability.toUpperCase() : '',
    spellMod: origin?.ability ? signed(origin.abilityMod) : '',
    spellDc: origin?.saveDc != null ? String(origin.saveDc) : '',
    spellAtk: origin?.attackBonus != null ? signed(origin.attackBonus) : '',
  });

  const base = {
    name: character.meta?.name ?? '',
    background: '', // customizado - o jogador preenche à mão
    speciesText: speciesLabel(raceObj, character.species?.id ?? ''),
    level: derived.level || '',
    ac: derived.armorClass?.total ?? '',
    shield: !!derived.armorClass?.hasShield,
    hpMax: derived.maxHp ?? '',
    hitDice,
    profBonus: signed(derived.proficiencyBonus),
    initiative: signed(derived.modifiers?.dex),
    speed: species?.speed?.walk ? `${species.speed.walk} ft.` : '',
    // Por extenso; escolha do jogador e nível (Verdan) aplicados. Sem escolha em
    // raça Small/Medium, imprime as duas ("Small/Medium").
    size: raceObj
      ? sizeLabel(effectiveSizeCodes(raceObj, {
          chosen: sizePick(character.species?.choices),
          level: derived.level,
        }))
      : '',
    passivePerception: 10 + (derived.skills?.prc?.bonus ?? 0),
    abilities,
    armorTraining: {
      light: has('light'), medium: has('medium'), heavy: has('heavy'), shields: has('shield'),
    },
    weaponProfs: (derived.weapons ?? []).join(', '),
    toolProfs: (derived.tools ?? []).join(', '),
    weaponRows: weaponRows(character, derived),
    // Traços como PARÁGRAFOS {lead, text} (negrito + quebras de linha); o card
    // da ficha escala a fonte para ocupar a caixa inteira sem estourar (E5).
    speciesTraits: speciesTraitParagraphs(raceObj),
    feats: featNames(character, db),
    languages: (derived.languages ?? []).join(', '),
    appearance: character.identity?.appearance ?? '',
    backstory: [character.identity?.personality, character.identity?.backstory]
      .filter(Boolean)
      .join('\n\n'),
    // Código ('NG') vira por extenso; texto livre (imports antigos) passa como está.
    alignment: ALIGNMENT_NAME[character.identity?.alignment] ?? character.identity?.alignment ?? '',
    equipmentLines: (derived.inventory ?? []).map(
      (e) => `${e.raw?.name ?? e.itemId}${(e.quantity ?? 1) > 1 ? ` (x${e.quantity})` : ''}`,
    ),
    attunedNames: (derived.inventory ?? [])
      .filter((e) => e.attuned)
      .slice(0, 3)
      .map((e) => e.raw?.name ?? e.itemId),
    coins: { ...character.currency },
    slotTotals: slotTotals(spellcasting),
  };

  // --- uma ficha por classe (o que muda: classe/subclasse/features/conjuração) --
  const classes = (character.classes ?? []).filter((c) => c.classId);
  if (classes.length === 0) {
    return { sheets: [{ ...base, classText: '', subclassText: '', classFeatures: [], ...spellBlock(grantedCaster), spellRows: grantedRows }] };
  }

  const sheets = classes.map((cls) => {
    const subObj = cls.subclassId
      ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
      : null;
    const origin = spellcasting.origins.find((o) => o.kind === 'class' && o.uid === cls.uid);
    return {
      ...base,
      classText: `${classDisplayName(cls.classId)} ${cls.level}`,
      subclassText: subObj?.name ?? cls.subclassId ?? '',
      classFeatures: classFeatureLines(cls, db),
      // Classe sem conjuração própria: o bloco mostra a origem concedida
      // (raça/talento) para o jogador não ficar sem DC na ficha.
      ...spellBlock(origin?.ability ? origin : grantedCaster),
      spellRows: [...(origin ? originSpellRows(origin, null) : []), ...grantedRows],
    };
  });

  return { sheets };
}
