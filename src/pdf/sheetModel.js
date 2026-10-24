// =============================================================================
// sheetModel: personagem e derivação como valores prontos para a ficha PDF
// =============================================================================
// O QUE FAZ
//   Puro (character, derived, db e as opções viram dados): o CharacterSheetDoc só
//   desenha. A ficha é PRÓPRIA do app desde o DDL-0105: um documento só, também no
//   multiclasse, com o texto completo quando o jogador pede. O modelo traz:
//     header       nome, linha de classes, espécie, tendência, nível, retrato
//     abilities    os seis atributos com a salvaguarda
//     combat       CA, iniciativa, deslocamento, tamanho, PB, PV, dados de vida,
//                  passivas, visão no escuro e defesas
//     skills       as 18 perícias (0, 1 ou 2 de proficiência)
//     attacks      armas e cantrips de ataque
//     resources    os pools de uso (Channel Divinity, Rage) com a recuperação
//     proficiencies armadura, armas, ferramentas e idiomas
//     featureGroups um grupo por classe, subclasse, espécie e talentos
//     spellcasting  slots, um bloco por origem e os cartões de magia
//     inventory    os itens por contêiner, moedas, peso e sintonia
//     biography    aparência, personalidade, história e detalhes
//
// FUNÇÕES
//   signed(n), timeAbbrev(spell), speciesLabel(raceObj, fallback), norm(s): texto.
//   weaponRows(character, derived, opts): a tabela de armas (equipadas primeiro).
//   cantripAttackRows(spellcasting, level): os cantrips de ataque, com o dado do
//     nível.
//   asiText(subBag), pickName(p): os picks em texto.
//   featureAnnotations(cls, classObj, subObj, db): as escolhas do bag anotadas na
//     feature que as concedeu.
//   findOptionalFeature(db, pick): a optional feature escolhida.
//   findRefFeature(db, e), inlineRefs(entries, db, depth): as refs de feature
//     trocadas pelo texto delas (Divine Spark dentro de Channel Divinity).
//   umbrellaFlavor(subObj, classId, db), subclassFlavor(db, classId, subObj),
//     classFlavor(db, classId, source): o flavour de subclasse e classe.
//   classFeatureGroups(cls, db, opts): os grupos de classe e subclasse.
//   speciesGroup(raceObj, db, opts, label): o grupo da espécie.
//   featGroup(character, db, opts): o grupo dos talentos.
//   spellRow(entry, note), byLevelName(a, b), originSpellRows(origin, tag),
//     grantedOriginTag(origin), spellCard(raw), buildSpellcasting(character,
//     derived, opts): a conjuração.
//   slotTotals(spellcasting): os slots por círculo, com o pacto somado.
//   foreignText(html): a descrição de um item importado, sem HTML nem enrichers.
//   isMagicItem(e), itemRow(e, db, opts), buildInventory(character, derived, db,
//     opts): o inventário.
//   resourceRows(actor, derived), characterResources(character, derived, db): os
//     recursos com usos e a recuperação deles.
//   buildSheetModel(character, derived, db, options): o modelo.
//   evalUses e recoveryText são reexportados do engine/playCatalog.
//
// DECISÕES E ARMADILHAS
//   - featureAnnotations lê os ids do bag (featopt@, optfeat@, feat@fs@,
//     expertise@, feat@<nível>...) e anota a feature por nome e nível ("Weapon
//     Mastery (Cleave, Graze)", "Ability Score Improvement (+2 Str)"); sem feature
//     correspondente, vira uma linha própria. As optional features escolhidas
//     (Invocations, Metamagic) entram com o texto delas no modo completo. Sem
//     feature para anotar, o talento de nível vira a linha "Ability Score
//     Improvement" (ou "Epic Boon" no 19) do nível, com o talento escolhido.
//   - A feature que só CITA outra (refClassFeature) ganha o texto da citada,
//     senão o Divine Spark sairia só com o nome.
//   - O flavour de subclasse vem do fluff quando ele tem texto; no XPHB o fluff
//     só traz a arte e o texto mora na feature GUARDA-CHUVA de mesmo nome (que o
//     export pula), em tudo antes da primeira referência: as listas também (os
//     dogmas da Oath of Devotion saíam cortados quando só as strings entravam).
//   - Os traços e a lore da espécie vêm do raceEntity, o mesmo da tela (linhagem,
//     `_copy` e a edição da base resolvidos, DDL-0071).
//   - Cada linha de magia concedida leva o DC e o ataque da PRÓPRIA origem
//     ("Drow (DC 13/+5)"). Os slots do pacto ficam numa linha própria agora que a
//     ficha é nossa; slotTotals (o pacto somado) segue para quem quiser o total.
//   - Ataques, recursos, iniciativa e dados de vida vêm do CATÁLOGO DE JOGO
//     (engine/playCatalog, DDL-0108): a ficha impressa e o play mode leem a mesma
//     fonte, e aqui só se formata o texto das linhas.
//   - Item custom vem de ator importado com a descrição em HTML do Foundry
//     (`@UUID[...]{Nome}`, `&Reference[Nome]`, `[[/r 1d4]]`): sai como texto, com
//     o nome e o dado; enricher sem rótulo (`@Embed[...]`, `@UUID[...]` puro) some,
//     senão o caminho do compêndio vazava na ficha.
//   - Os recursos NÃO têm regra própria aqui: o catálogo os lê do `system.uses`
//     do ator montado (registro curado, SRD, overlay; foundryFeatureUses), e
//     resourceRows só tira o nome repetido e escreve a recuperação. Fórmula com o
//     que não resolve fica de fora, em vez de um número inventado. Quando o SRD
//     guarda o pool na ACTIVITY (Natural Recovery, Tireless), a linha sai dela.
//   - Dados de vida agregados por face ("Cleric 5 + Warlock 1" dá "6d8").
// -----------------------------------------------------------------------------

import { resolveClassObj, resolveSubclassObj, resolveRaceObj, resolveFeat } from '../engine/resolve';
import { parseSpecies, effectiveSizeCodes, sizePick, sizeLabel } from '../engine/speciesData';
import {
  classDisplayName, rangeLabel, isRitual, isConcentration, schoolName, castingTimeLabel,
  componentsText, materialText, ordinalLevel,
} from '../engine/spells';
import { castTypeLabel } from '../engine/grantedSpells';
import { optionalFeatureChoices } from '../engine/classFeatureChoices';
import { collectAbilityPicks } from '../engine/choices';
import { resolveClassFeatures, resolveSubclassFeatures } from '../engine/foundryItems';
import { htmlToText } from '../engine/foundryImport';
import {
  DAMAGE_NAME, weaponAttacks, cantripAttacks, actorResources, safeActor, recoveryText, initiativeBonus, hitDiceByFace,
} from '../engine/playCatalog';
export { evalUses, recoveryText } from '../engine/playCatalog';
import { SKILL_ABILITY } from '../engine/proficiency';
import { SKILL_LABEL, ABILITY_SHORT } from '../components/builder/labels';
import raceEntity from '../selector/entities/race';
import { durationLabel } from '../selector/entities/spell';
import { toBlocks } from './entries';
import { normalizePdfOptions } from './pdfOptions';

const ABILITY_NAME = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

const ALIGNMENT_NAME = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
};

/** Um modificador com sinal. */
export function signed(n) {
  if (n == null || Number.isNaN(n)) return '';
  return n >= 0 ? `+${n}` : `${n}`;
}

/** A abreviação do tempo de conjuração (A, BA, R...). */
export function timeAbbrev(spell) {
  const t = spell?.time?.[0];
  if (!t) return '';
  const map = { action: 'A', bonus: 'BA', reaction: 'R' };
  if (map[t.unit]) return map[t.unit];
  if (t.unit === 'minute') return `${t.number} Min`;
  if (t.unit === 'hour') return `${t.number} Hr`;
  return `${t.number ?? ''} ${t.unit ?? ''}`.trim();
}

/** "Elf; Drow Lineage" vira "Elf (Drow)". */
export function speciesLabel(raceObj, fallback = '') {
  const name = raceObj?.name ?? fallback;
  const parts = String(name).split(';').map((s) => s.trim());
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} (${parts[1].replace(/\s+lineage$/i, '')})`;
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** As linhas de armas, equipadas primeiro (os ataques do catálogo de jogo). */
export function weaponRows(character, derived, { max = 12 } = {}) {
  return weaponAttacks(character, derived).slice(0, max).map((w) => {
    const notes = [];
    if (w.mastery) notes.push(`Mastery: ${w.mastery}`);
    if (w.thrown) notes.push('Thrown');
    if (w.versatile) notes.push(`Versatile ${w.versatile}`);
    if (w.distance) notes.push(`${w.distance} ft`);
    return {
      name: w.name,
      bonus: signed(w.toHit.total),
      damage: w.damage
        ? `${w.damage.dice}${w.damage.bonus ? signed(w.damage.bonus) : ''} ${w.damage.types.join('/')}`.trim()
        : '-',
      notes: notes.join(', '),
      equipped: w.equipped,
    };
  });
}

/** Os cantrips que atacam ou pedem salvaguarda e causam dano, como linhas. */
function cantripAttackRows(spellcasting, level) {
  return cantripAttacks(spellcasting, level).map((c) => ({
    name: c.name,
    bonus: c.attack ? signed(c.attack.bonus) : `DC ${c.save.dc ?? ''} ${ABILITY_SHORT[c.save.ability] ?? c.save.ability}`.trim(),
    damage: `${c.damage.dice} ${c.damage.types.join('/')}`.trim(),
    notes: [c.rangeText.replace(/ feet/, ' ft'), 'Cantrip'].filter(Boolean).join(', '),
    equipped: false,
  }));
}

/** "+2 Str, +1 Con" a partir do sub-bag de um ASI. */
function asiText(subBag) {
  const picks = collectAbilityPicks(subBag);
  return picks.map((p) => `+${p.amount} ${ABILITY_SHORT[p.ability] ?? p.ability}`).join(', ');
}

/** O nome legível de um pick. */
const pickName = (p) => String(typeof p === 'object' ? p.value : p).split('|')[0];

/**
 * As escolhas do bag da classe, anotadas na feature que as concedeu.
 * @returns {{ target: string|null, level: number|null, label: string, text: string, kind?: string, picks?: string[] }[]}
 */
export function featureAnnotations(cls, classObj, subObj, db) {
  const out = [];
  const ofLabels = new Map(
    optionalFeatureChoices(classObj, subObj, cls.level).map((c) => [c.id, c.label]),
  );

  for (const [id, entry] of Object.entries(cls.choices ?? {})) {
    if (!entry || !Array.isArray(entry.picks) || entry.picks.length === 0) continue;
    const bare = id.startsWith('sub:') ? id.slice(4) : id;
    const parts = bare.split('@');
    const names = entry.picks.map(pickName);
    const grantTarget = parts.length >= 3 ? parts[1].split('|').pop() : null;
    const level = Number(parts[parts.length - 1]);

    switch (entry.kind) {
      case 'featureoption':
        out.push({ target: parts[1], level, label: parts[1], text: names.join(', ') });
        break;
      case 'weapon':
        out.push({ target: 'Weapon Mastery', level: null, label: 'Weapon Mastery', text: names.join(', ') });
        break;
      case 'expertise': {
        const skills = entry.picks.map((p) => SKILL_LABEL[p] ?? p);
        out.push({ target: grantTarget ?? 'Expertise', level: Number.isFinite(level) ? level : null, label: 'Expertise', text: skills.join(', ') });
        break;
      }
      case 'optionalfeature': {
        const label = ofLabels.get(id) ?? 'Options';
        out.push({ target: label, level: null, label, text: names.join(', '), kind: 'optionalfeature', picks: entry.picks });
        break;
      }
      case 'feat': {
        if (ofLabels.has(id)) {
          const label = ofLabels.get(id);
          out.push({ target: label, level: null, label, text: names.join(', ') });
          break;
        }
        if (grantTarget) {
          out.push({ target: grantTarget, level, label: grantTarget, text: names.join(', ') });
          break;
        }
        const texts = entry.picks.map((p) => {
          const name = pickName(p);
          if (norm(name) === 'ability score improvement') return asiText(entry.sub?.[p]) || name;
          return name;
        });
        const featData = resolveFeat(db, entry.picks[0]);
        const isFs = String(featData?.category ?? '').startsWith('FS');
        const targets = isFs ? ['Fighting Style'] : ['Ability Score Improvement', 'Epic Boon'];
        out.push({ targets, level: Number.isFinite(level) ? level : null, label: `Level ${level} Feat`, text: texts.join(', ') });
        break;
      }
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

/** A optional feature de um pick "Nome|Fonte". */
function findOptionalFeature(db, pick) {
  const [name, source] = String(pick).split('|');
  const list = db?.optionalfeatures?.optionalfeature ?? [];
  return list.find((o) => o.name === name && (!source || o.source === source)) ?? list.find((o) => o.name === name) ?? null;
}

/** A feature citada por uma ref de classe ou de subclasse. */
function findRefFeature(db, e) {
  if (e.type === 'refClassFeature') {
    const [name, className, classSource, level, source] = String(e.classFeature).split('|');
    return (db?.[`class-${norm(className)}`]?.classFeature ?? []).find(
      (f) => f.name === name && norm(f.className) === norm(className)
        && String(f.level) === String(level) && norm(f.source) === norm(source || classSource),
    ) ?? null;
  }
  const [name, className, , shortName, scSource, level, source] = String(e.subclassFeature).split('|');
  return (db?.[`class-${norm(className)}`]?.subclassFeature ?? []).find(
    (f) => f.name === name && norm(f.subclassShortName) === norm(shortName)
      && String(f.level) === String(level) && norm(f.source) === norm(source || scSource),
  ) ?? null;
}

/** As refs de feature trocadas pelo texto da feature citada. */
function inlineRefs(entries, db, depth = 0) {
  if (depth > 3 || !Array.isArray(entries)) return entries;
  return entries.map((e) => {
    if (!e || typeof e !== 'object') return e;
    if (e.type === 'refClassFeature' || e.type === 'refSubclassFeature') {
      const f = findRefFeature(db, e);
      return f ? { type: 'entries', name: f.name, entries: inlineRefs(f.entries, db, depth + 1) } : e;
    }
    if (Array.isArray(e.entries)) return { ...e, entries: inlineRefs(e.entries, db, depth + 1) };
    if (Array.isArray(e.items)) return { ...e, items: inlineRefs(e.items, db, depth + 1) };
    return e;
  });
}

/** O texto da feature guarda-chuva da subclasse (tudo antes das refs). */
function umbrellaFlavor(subObj, classId, db) {
  const names = new Set([norm(subObj.name), norm(subObj.shortName)]);
  const src = norm(subObj.source);
  const umbrella = (db?.[`class-${classId}`]?.subclassFeature ?? []).find(
    (f) => norm(f.subclassShortName) === norm(subObj.shortName)
      && norm(f.subclassSource ?? f.source) === src
      && names.has(norm(f.name)),
  );
  const intro = [];
  for (const e of umbrella?.entries ?? []) {
    if (e && typeof e === 'object' && String(e.type).startsWith('ref')) break;
    intro.push(e);
  }
  return intro;
}

/** O flavour da subclasse: o fluff com texto, ou a guarda-chuva. */
function subclassFlavor(db, classId, subObj) {
  const names = new Set([norm(subObj.name), norm(subObj.shortName)]);
  const fluff = (db?.[`fluff-class-${classId}`]?.subclassFluff ?? []).filter(
    (e) => names.has(norm(e.name)) && e.entries?.length,
  );
  const entry = fluff.find((e) => norm(e.source) === norm(subObj.source)) ?? fluff[fluff.length - 1];
  const entries = entry?.entries ?? umbrellaFlavor(subObj, classId, db);
  return entries.length ? toBlocks(entries) : null;
}

/** O flavour da classe, do fluff da mesma edição. */
function classFlavor(db, classId, source) {
  const list = (db?.[`fluff-class-${classId}`]?.classFluff ?? []).filter((e) => e.entries?.length);
  const entry = list.find((e) => norm(e.source) === norm(source)) ?? list[list.length - 1];
  return entry ? toBlocks(entry.entries) : null;
}

/** Os grupos de features de uma classe e da sua subclasse. */
function classFeatureGroups(cls, db, opts) {
  const classObj = resolveClassObj(db, cls.classId, cls.source);
  if (!classObj) return [];
  const classId = norm(classObj.name);
  const subObj = cls.subclassId
    ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
    : null;
  const full = { class: opts.detail.classFeatures === 'full', sub: opts.detail.subclassFeatures === 'full' };

  const asItem = (f, isSub) => ({
    name: f.name,
    level: f.level ?? 0,
    tag: f.level ? `Level ${f.level}` : null,
    notes: [],
    options: [],
    blocks: (isSub ? full.sub : full.class) ? toBlocks(inlineRefs(f.entries, db)) : null,
  });
  const classItems = resolveClassFeatures(db, classId, classObj, cls.level || 1).map((f) => asItem(f, false));
  const subItems = subObj
    ? resolveSubclassFeatures(subObj, classId, db, { max: cls.level }).map((f) => asItem(f, true))
    : [];
  const all = [...classItems, ...subItems];

  for (const ann of featureAnnotations(cls, classObj, subObj, db)) {
    const targetNames = (ann.targets ?? [ann.target]).filter(Boolean).map(norm);
    let hit =
      all.find((f) => targetNames.includes(norm(f.name)) && ann.level != null && f.level === ann.level) ??
      all.find((f) => targetNames.includes(norm(f.name)));
    if (!hit) {
      const lvl = ann.level ?? 0;
      const name = ann.targets ? (lvl >= 19 && ann.targets.includes('Epic Boon') ? 'Epic Boon' : ann.targets[0]) : ann.label;
      hit = { name, level: lvl, tag: lvl ? `Level ${lvl}` : null, notes: [], options: [], blocks: full.class ? [] : null };
      classItems.push(hit);
    }
    hit.notes.push(ann.text);
    if (ann.kind === 'optionalfeature' && hit.blocks) {
      for (const pick of ann.picks ?? []) {
        const opt = findOptionalFeature(db, pick);
        if (opt) hit.options.push({ name: opt.name, blocks: toBlocks(opt.entries) });
      }
    }
  }

  const byLevel = (a, b) => a.level - b.level;
  const groups = [];
  if (opts.detail.classFeatures !== 'off') {
    groups.push({
      id: `class-${cls.uid ?? cls.classId}`,
      kind: 'class',
      title: `${classDisplayName(cls.classId)} Features`,
      subtitle: `Level ${cls.level}`,
      detail: opts.detail.classFeatures,
      flavor: opts.flavor.classes ? classFlavor(db, classId, classObj.source) : null,
      items: classItems.sort(byLevel),
    });
  }
  if (subObj && opts.detail.subclassFeatures !== 'off') {
    groups.push({
      id: `subclass-${cls.uid ?? cls.classId}`,
      kind: 'subclass',
      title: subObj.name,
      subtitle: `${classDisplayName(cls.classId)} subclass`,
      detail: opts.detail.subclassFeatures,
      flavor: opts.flavor.subclasses ? subclassFlavor(db, classId, subObj) : null,
      items: subItems.sort(byLevel),
    });
  }
  return groups;
}

/** O grupo dos traços da espécie, com a lore quando pedida. */
function speciesGroup(raceObj, db, opts, label) {
  if (!raceObj || opts.detail.speciesTraits === 'off') return null;
  const full = opts.detail.speciesTraits === 'full';
  const entries = raceEntity.entries?.(raceObj, db) ?? raceObj.entries ?? [];
  const items = entries
    .filter((e) => e && typeof e === 'object' && e.name && (e.type === 'entries' || !e.type))
    .map((e) => ({ name: e.name, level: 0, tag: null, notes: [], options: [], blocks: full ? toBlocks(e.entries) : null }));
  const fluff = opts.flavor.species ? raceEntity.fluff?.(raceObj, db) : null;
  return {
    id: 'species',
    kind: 'species',
    title: `${label} Traits`,
    subtitle: 'Species',
    detail: opts.detail.speciesTraits,
    flavor: fluff?.entries?.length ? toBlocks(fluff.entries) : null,
    items,
  };
}

/** O grupo dos talentos: de origem, de espécie e de classe. */
function featGroup(character, db, opts) {
  if (opts.detail.feats === 'off') return null;
  const full = opts.detail.feats === 'full';
  const found = [];
  const add = (id, note) => {
    const feat = resolveFeat(db, id);
    if (!feat || norm(feat.name) === 'ability score improvement') return;
    if (found.some((f) => f.feat.name === feat.name && f.feat.source === feat.source)) return;
    found.push({ feat, note });
  };
  const of = character.origin?.originFeat;
  if (of?.id) add(`${of.id}|${of.source}`, 'Origin feat');
  for (const entry of Object.values(character.species?.choices ?? {})) {
    if (entry?.kind === 'feat') (entry.picks ?? []).forEach((p) => add(p, 'Species'));
  }
  for (const cls of character.classes ?? []) {
    for (const [id, entry] of Object.entries(cls.choices ?? {})) {
      if (entry?.kind !== 'feat') continue;
      const lvl = Number(id.slice(id.lastIndexOf('@') + 1));
      const where = `${classDisplayName(cls.classId)}${Number.isFinite(lvl) ? ` ${lvl}` : ''}`;
      (entry.picks ?? []).forEach((p) => add(p, where));
    }
  }
  if (!found.length) return null;
  return {
    id: 'feats',
    kind: 'feats',
    title: 'Feats',
    subtitle: null,
    detail: opts.detail.feats,
    flavor: null,
    items: found.map(({ feat, note }) => ({
      name: feat.name, level: 0, tag: note, notes: [], options: [], blocks: full ? toBlocks(feat.entries) : null,
    })),
  };
}

/** Uma linha da tabela de magias. */
function spellRow(entry, note, prepared) {
  const raw = entry.raw;
  if (!raw) return null;
  return {
    key: `${raw.name}|${raw.source}`,
    level: raw.level === 0 ? 'C' : String(raw.level),
    name: raw.name,
    time: timeAbbrev(raw),
    range: rangeLabel(raw).replace(/-foot/g, '-ft').replace(/\bfeet\b/g, 'ft'),
    c: isConcentration(raw),
    r: isRitual(raw),
    m: !!raw.components?.m,
    prepared,
    notes: note ?? '',
    _rank: raw.level,
  };
}

/** Ordena por círculo e nome. */
const byLevelName = (a, b) => a._rank - b._rank || a.name.localeCompare(b.name);

/** As linhas de magia de uma origem. */
function originSpellRows(origin, tag) {
  const withTag = (label) => [tag, label].filter(Boolean).join(', ');
  const rows = [
    ...(origin.cantrips ?? []).map((s) => spellRow(s, withTag(castTypeLabel(s)), null)),
    ...(origin.prepared ?? []).map((s) => spellRow(s, withTag(null), 'yes')),
    ...(origin.unprepared ?? []).map((s) => spellRow(s, withTag(null), 'no')),
    ...(origin.alwaysPrepared ?? []).map((s) => spellRow(s, withTag(castTypeLabel(s)), s.raw?.level === 0 ? null : 'always')),
    ...(origin.arcanumSpells ?? []).map((s) => spellRow(s, withTag('Arcanum 1/LR'), 'always')),
  ];
  return rows.filter(Boolean).sort(byLevelName);
}

/** A tag de uma origem concedida, com o DC e o ataque dela. */
function grantedOriginTag(origin) {
  if (origin.saveDc == null) return origin.label;
  return `${origin.label} (DC ${origin.saveDc}/${signed(origin.attackBonus)})`;
}

/** O cartão de uma magia, com o texto completo. */
function spellCard(raw) {
  const material = materialText(raw);
  const levelLine = raw.level === 0
    ? `${schoolName(raw.school)} Cantrip`
    : `${ordinalLevel(raw.level)}-level ${schoolName(raw.school)}`;
  return {
    key: `${raw.name}|${raw.source}`,
    name: raw.name,
    level: raw.level,
    levelLine: `${levelLine}${isRitual(raw) ? ' (Ritual)' : ''}`,
    time: castingTimeLabel(raw),
    range: rangeLabel(raw),
    components: [componentsText(raw), material ? `(${material})` : null].filter(Boolean).join(' '),
    duration: durationLabel(raw),
    blocks: toBlocks(raw.entries),
    higher: raw.entriesHigherLevel?.length ? toBlocks(raw.entriesHigherLevel) : null,
  };
}

/** Os slots totais por círculo (o pacto somado no círculo dele). */
export function slotTotals(spellcasting) {
  const totals = { ...(spellcasting?.slots ?? {}) };
  const pact = spellcasting?.pactSlots;
  if (pact?.slots) totals[pact.level] = (totals[pact.level] ?? 0) + pact.slots;
  return totals;
}

/** A conjuração: slots, um bloco por origem e os cartões. */
function buildSpellcasting(character, derived, opts) {
  const sc = derived.spellcasting ?? { origins: [] };
  const classes = character.classes ?? [];
  const origins = (sc.origins ?? []).map((o) => {
    const isClass = o.kind === 'class';
    const cls = isClass ? classes.find((c) => c.uid === o.uid) : null;
    const rows = originSpellRows(o, null);
    return {
      id: isClass ? `class-${o.uid}` : `${o.kind}-${o.label}`,
      kind: o.kind,
      title: isClass ? `${classDisplayName(cls?.classId ?? o.classId ?? '')} Spells`.trim() : o.label,
      ability: o.ability ? ABILITY_NAME[o.ability] : '',
      mod: o.ability ? signed(o.abilityMod) : '',
      dc: o.saveDc != null ? String(o.saveDc) : '',
      attack: o.attackBonus != null ? signed(o.attackBonus) : '',
      note: isClass ? null : grantedOriginTag(o),
      rows,
    };
  }).filter((o) => o.rows.length);

  const slots = Object.entries(sc.slots ?? {})
    .map(([lvl, n]) => ({ level: Number(lvl), total: n }))
    .filter((s) => s.total > 0)
    .sort((a, b) => a.level - b.level);
  const pact = sc.pactSlots?.slots ? { level: sc.pactSlots.level, total: sc.pactSlots.slots } : null;

  let cards = null;
  if (opts.detail.spells === 'cards') {
    const seen = new Map();
    for (const o of sc.origins ?? []) {
      for (const bucket of ['cantrips', 'prepared', 'unprepared', 'alwaysPrepared', 'arcanumSpells']) {
        for (const s of o[bucket] ?? []) {
          if (!s.raw) continue;
          const key = `${s.raw.name}|${s.raw.source}`;
          if (!seen.has(key)) seen.set(key, spellCard(s.raw));
        }
      }
    }
    cards = [...seen.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return { slots, pact, origins, cards };
}

/** O texto de um ator importado (HTML e os enrichers do Foundry) em parágrafos. */
function foreignText(html) {
  const text = htmlToText(String(html ?? ''))
    .replace(/[@&]\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
    .replace(/&Reference\[([^\]|]*)[^\]]*\]/g, '$1')
    .replace(/@\w+\[[^\]]*\]/g, '')
    .replace(/\[\[\/\w+ ([^\]]+)\]\]/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/** O item é mágico (raridade, sintonia ou bônus)? */
const isMagicItem = (e) => !!(e.rarity || e.raw?.reqAttune || e.raw?.bonusWeapon || e.raw?.bonusAc || e.raw?.wondrous);

/** Uma linha de inventário, com o texto conforme as opções. */
function itemRow(e, db, opts) {
  const name = e.raw?.name ?? e.custom?.name ?? e.itemId;
  const mode = opts.detail.items;
  const wantsText = mode === 'all' || (mode === 'magic' && (isMagicItem(e) || e.isCustom));
  let blocks = null;
  if (wantsText) {
    const entries = e.raw?.entries ?? (e.custom?.description ? foreignText(e.custom.description) : null);
    blocks = entries?.length ? toBlocks(entries) : null;
  }
  let flavor = null;
  if (opts.flavor.items && e.raw) {
    const f = (db?.['fluff-items']?.itemFluff ?? []).find((x) => x.name === e.raw.name && x.source === e.raw.source);
    flavor = f?.entries?.length ? toBlocks(f.entries) : null;
  }
  const tags = [];
  if (e.equipped) tags.push('Equipped');
  if (e.attuned) tags.push('Attuned');
  else if (e.required) tags.push('Requires attunement');
  if (e.rarity) tags.push(e.rarity.replace(/\b\w/g, (c) => c.toUpperCase()));
  return {
    uid: e.uid,
    name,
    quantity: e.quantity ?? 1,
    weight: e.lineWeight ? `${+e.lineWeight.toFixed(2)} lb` : '',
    tags,
    blocks,
    flavor,
  };
}

/** O inventário por contêiner, com moedas, peso e sintonia. */
function buildInventory(character, derived, db, opts) {
  const entries = derived.inventory ?? [];
  const top = entries.filter((e) => !e.container);
  const groups = [{ id: 'carried', title: 'Carried', items: top.map((e) => itemRow(e, db, opts)) }];
  for (const c of entries.filter((e) => e.isContainer)) {
    const inside = entries.filter((e) => e.container === c.uid);
    if (!inside.length) continue;
    groups.push({
      id: c.uid,
      title: c.raw?.name ?? c.custom?.name ?? c.itemId,
      items: inside.map((e) => itemRow(e, db, opts)),
    });
  }
  return {
    groups: groups.filter((g) => g.items.length),
    coins: { ...character.currency },
    totalWeight: derived.encumbrance?.totalWeight ?? null,
    capacity: derived.encumbrance?.capacity ?? null,
    attuned: entries.filter((e) => e.attuned).map((e) => e.raw?.name ?? e.itemId),
  };
}

/** Os recursos com usos (Channel Divinity, Rage...), lidos do ator do export. */
export function resourceRows(actor, derived) {
  const rows = [];
  for (const r of actorResources(actor, derived)) {
    if (rows.some((x) => x.name === r.name)) continue;
    rows.push({ name: r.name, max: r.max, recovery: recoveryText(r.recovery) });
  }
  return rows;
}

/** Os recursos do personagem, sem derrubar a ficha se a montagem do ator falhar. */
function characterResources(character, derived, db) {
  const actor = safeActor(character, db);
  return actor ? resourceRows(actor, derived) : [];
}

/**
 * O modelo da ficha.
 * @param {import('../schema/character').Character} character
 * @param {object} derived
 * @param {object} db
 * @param {object} [options] as opções do pdfOptions (normalizadas aqui)
 */
export function buildSheetModel(character, derived, db, options) {
  const opts = normalizePdfOptions(options);
  const raceObj = character.species
    ? resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage)
    : null;
  const species = parseSpecies(raceObj);
  const speciesText = speciesLabel(raceObj, character.species?.id ?? '');

  const abilities = Object.keys(ABILITY_NAME).map((code) => ({
    code,
    name: ABILITY_NAME[code],
    short: ABILITY_SHORT[code] ?? code.toUpperCase(),
    score: derived.scores?.[code] ?? '',
    mod: signed(derived.modifiers?.[code]),
    save: signed(derived.saves?.[code]),
    saveProf: (derived.proficientSaves ?? []).includes(code),
  }));

  const skills = Object.entries(SKILL_ABILITY)
    .map(([code, ab]) => {
      const sk = derived.skills?.[code];
      return {
        code,
        name: SKILL_LABEL[code] ?? code,
        ability: ABILITY_SHORT[ab] ?? ab,
        value: signed(sk?.bonus),
        prof: (sk?.proficiency ?? 0) >= 2 ? 2 : (sk?.proficiency ?? 0) >= 1 ? 1 : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const hitDice = hitDiceByFace(derived).map((h) => `${h.count}d${h.faces}`).join(' + ');
  const initiative = initiativeBonus(character, derived);

  const speed = species?.speed ?? {};
  const otherSpeeds = ['fly', 'swim', 'climb', 'burrow']
    .filter((k) => speed[k])
    .map((k) => `${k} ${speed[k] === true ? speed.walk : speed[k]} ft.`);
  const dt = derived.damageTraits ?? {};
  const named = (list) => (list ?? []).map((v) => DAMAGE_NAME[v] ?? v);

  const classes = (character.classes ?? []).filter((c) => c.classId);
  const classLine = classes.map((cls) => {
    const subObj = cls.subclassId
      ? resolveSubclassObj(db, cls.classId, cls.subclassId, cls.subclassSource)
      : null;
    const sub = subObj?.name ?? cls.subclassId;
    return `${classDisplayName(cls.classId)} ${cls.level}${sub ? ` (${sub})` : ''}`;
  }).join(' / ');

  const portrait = character.meta?.portrait;
  const id = character.identity ?? {};

  const featureGroups = [
    ...classes.flatMap((cls) => classFeatureGroups(cls, db, opts)),
    speciesGroup(raceObj, db, opts, speciesText || 'Species'),
    featGroup(character, db, opts),
  ].filter(Boolean);

  return {
    options: opts,
    header: {
      name: character.meta?.name ?? '',
      classLine,
      species: speciesText,
      alignment: ALIGNMENT_NAME[id.alignment] ?? id.alignment ?? '',
      level: derived.level || '',
      portrait: typeof portrait === 'string' && /^data:image\/(png|jpe?g);/i.test(portrait) ? portrait : null,
    },
    abilities,
    combat: {
      ac: derived.armorClass?.total ?? '',
      shield: !!derived.armorClass?.hasShield,
      initiative: signed(initiative),
      speed: speed.walk ? `${speed.walk} ft.` : '',
      otherSpeeds,
      size: raceObj
        ? sizeLabel(effectiveSizeCodes(raceObj, {
            chosen: sizePick(character.species?.choices),
            level: derived.level,
          }))
        : '',
      profBonus: signed(derived.proficiencyBonus),
      hpMax: derived.maxHp ?? '',
      hitDice,
      passives: {
        perception: 10 + (derived.skills?.prc?.bonus ?? 0),
        insight: 10 + (derived.skills?.ins?.bonus ?? 0),
        investigation: 10 + (derived.skills?.inv?.bonus ?? 0),
      },
      darkvision: species?.darkvision ? `${species.darkvision} ft.` : '',
      defenses: { resist: named(dt.resist), immune: named(dt.immune), vulnerable: named(dt.vulnerable) },
    },
    skills,
    attacks: [...weaponRows(character, derived), ...cantripAttackRows(derived.spellcasting, derived.level || 1)],
    resources: opts.fields.resources ? characterResources(character, derived, db) : [],
    proficiencies: {
      armor: (derived.armor ?? []).join(', '),
      weapons: (derived.weapons ?? []).join(', '),
      tools: (derived.tools ?? []).join(', '),
      languages: (derived.languages ?? []).join(', '),
    },
    featureGroups,
    spellcasting: buildSpellcasting(character, derived, opts),
    inventory: buildInventory(character, derived, db, opts),
    biography: {
      appearance: id.appearance ?? '',
      personality: id.personality ?? '',
      ideals: id.ideals ?? '',
      bonds: id.bonds ?? '',
      flaws: id.flaws ?? '',
      backstory: id.backstory ?? '',
      details: [
        ['Age', id.age], ['Height', id.height], ['Weight', id.weight], ['Eyes', id.eyes],
        ['Hair', id.hair], ['Skin', id.skin], ['Gender', id.gender], ['Faith', id.faith],
      ].filter(([, v]) => v).map(([label, value]) => ({ label, value })),
    },
  };
}
