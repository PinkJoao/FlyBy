// =============================================================================
// feature-audit: o registro de cada feature de classe e subclasse no app
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/feature-audit.js [--tier=srd|xphb|post|legacy] [--review] [--only=<classId>]
//   O registro do DDL-0228: cada feature de classe e de subclasse que o seletor oferece, numa
//   camada (srd: as 12 classes do XPHB e as 12 subclasses do SRD 5.2; xphb: as outras do XPHB;
//   post: os livros depois de 2024; legacy: as antigas sem reprint), com o que o app faz
//   com ela, montado sozinho:
//   - Builder: as escolhas guardadas que citam a feature (o saco, as magias, as formas);
//   - Ficha: o que muda na derivação no nível dela (CA, salvaguardas, perícias, armas e
//     armaduras, ferramentas, idiomas, resistências) e os registros do motor que a citam;
//   - Jogo: use, log ou passive, o custo do turno, o pool, as activities, o registro curado;
//   - Export: o item no ator do Foundry (activities, efeitos, usos);
//   - Pistas: o que os levantamentos acham e ninguém explica (jogo, escolha, concessão).
//   O veredito de quem revisa (ok, lacuna, explicada, com uma nota) vem de
//   testing/feature-audit/verdicts.json; a assinatura das facetas guardada com ele avisa
//   quando a feature mudou depois. Escreve testing/feature-audit/<CAMADA>.md, por livro >
//   classe > subclasse > nível. `--review` lista só as que ainda não têm veredito válido.
//
// FUNÇÕES
//   norm(s): o nome normalizado.
//   tierOfSubclass(sub), tierOfClass(classObj): a camada.
//   registryIndex(): os textos do motor (sem os gerados e os testes) para achar quem cita.
//   mentions(name, classId, short): os arquivos do motor que citam a feature como chave.
//   snapshot(derived), diff(a, b): o que a derivação muda de um nível para o outro.
//   levelDiffs(character): a mudança de cada nível (1 a 20) da classe do personagem.
//   choiceOwners(db, character): a feature dona de cada escolha, pelos descritores do builder.
//   builderOf(f, level, character, entries, owners): as escolhas que guardam a feature.
//   playOf(f, catalog, bridged): o que o modo de jogo faz.
//   exportOf(name, level, actor): o item do ator.
//   facetsOf(...): todas as facetas de uma feature, e a assinatura delas.
//   stateOf(row): o estado do veredito (sem veredito, ok, lacuna, explicada, ou "mudou").
//   bookOf(): o texto do livro.
//
// DECISÕES E ARMADILHAS
//   - O universo é o da lista de features da classe e da subclasse (resolveClassFeatures,
//     resolveSubclassFeatures), não o ator: a feature que não vira item também aparece.
//     As opções de uma escolha (Divine Order: Protector) ficam na guarda-chuva.
//   - O diff de nível é da CLASSE, não da feature: todas as features do nível o recebem, e o
//     revisor atribui. Quem diz qual feature muda o quê são os registros que a citam.
//   - A assinatura cobre as facetas, não o texto: um veredito antigo vira "mudou" quando o
//     app passa a tratar a feature de outro jeito, e o revisor confere de novo.
//   - Nada de texto de livro no registro: só nomes e o que o app faz (`testing/` é privado).
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, defaultSpecies } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed } from './lib/rng.js';
import { bagEntries, pendingChoice } from './lib/builderCues.js';
import { grantsOf, missingOf, EXPLAINED as GRANT_EXPLAINED } from './lib/proseGrants.js';
import { classify, cuesOf, unexplainedCues } from './lib/playCoverage.js';
import { derivePlayCatalog, safeActor } from '../src/engine/playCatalog.js';
import { plainText, featureCosts } from '../src/engine/playFeatures.js';
import { featureRollOf } from '../src/engine/playFeatureRolls.js';
import { isSummonFeature } from '../src/engine/playSummons.js';
import { transformRuleOf } from '../src/engine/playForms.js';
import { deriveFromDb, resolveClassObj, resolveSubclassObj } from '../src/engine/resolve.js';
import { resolveClassFeatures, resolveSubclassFeatures } from '../src/engine/foundryItems.js';
import { buildClassChoices } from '../src/components/builder/classChoices.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const TIER = args.tier ?? 'srd';
const TIER_LABEL = { srd: 'SRD 5.2', xphb: 'XPHB fora do SRD', post: 'Livros depois de 2024', legacy: 'Legado sem reprint' };
const OUT_DIR = 'testing/feature-audit';
const VERDICTS = path.join(OUT_DIR, 'verdicts.json');
const norm = (s) => String(s ?? '').trim().toLowerCase();

/** A camada de uma subclasse. */
function tierOfSubclass(sub) {
  if (sub.edition === 'classic') return 'legacy';
  if (sub.source === 'XPHB') return sub.srd52 ? 'srd' : 'xphb';
  return 'post';
}

/** A camada das features de uma classe. */
function tierOfClass(classObj) {
  return classObj.source === 'XPHB' ? 'srd' : 'post';
}

/** Os textos do motor (sem os gerados e os testes). */
function registryIndex() {
  const dir = 'src/engine';
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && !/Data\.js$/.test(f))
    .map((f) => ({ file: f.replace(/\.js$/, ''), text: fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase() }));
}
const INDEX = registryIndex();
const NOT_REGISTRY = new Set(['playFeatures', 'resolve', 'classData', 'foundryItems']);

/** Os arquivos do motor que citam a feature como chave de registro. */
function mentions(name, classId, short) {
  const n = norm(name).replace(/'/g, "\\'");
  const keys = [`'${n}'`, `"${n}"`, `'${norm(classId)}|${n}'`, `|${n}'`, `'${n}|`];
  if (short) keys.push(`'${norm(short)}|${n}'`);
  return INDEX.filter((e) => !NOT_REGISTRY.has(e.file) && keys.some((k) => e.text.includes(k))).map((e) => e.file);
}

/** O que a ficha mostra que pode mudar com um nível. */
function snapshot(d) {
  const skills = Object.entries(d.skills ?? {}).filter(([, v]) => v?.proficiency).map(([k, v]) => (v.proficiency >= 2 ? `${k}*` : k));
  return {
    CA: [String(d.armorClass?.total ?? '')],
    salvaguardas: d.proficientSaves ?? [],
    pericias: skills,
    armaduras: d.armor ?? [],
    armas: [...(d.weapons ?? []), ...(d.weaponNames ?? [])],
    ferramentas: d.tools ?? [],
    idiomas: d.languages ?? [],
    resistencias: d.damageTraits?.resist ?? [],
    imunidades: d.damageTraits?.immune ?? [],
    sintonia: [String(d.attunementMax ?? '')],
    'magias sempre preparadas': (d.spellcasting?.origins ?? []).flatMap((o) => (o.alwaysPrepared ?? []).map((x) => x.name)),
  };
}

/** O que mudou de `a` para `b`. */
function diff(a, b) {
  const out = [];
  for (const k of Object.keys(b)) {
    if (k === 'CA' || k === 'sintonia') {
      if (a[k][0] !== b[k][0]) out.push(`${k} ${a[k][0]}->${b[k][0]}`);
      continue;
    }
    const added = b[k].filter((x) => !a[k].includes(x));
    if (added.length) out.push(`${k} +${added.join(',')}`);
  }
  return out;
}

/** A mudança de cada nível da classe do personagem (1 a 20). */
function levelDiffs(character, db) {
  const out = {};
  let prev = null;
  for (let level = 1; level <= 20; level++) {
    const c = structuredClone(character);
    c.classes[0].level = level;
    let snap;
    try {
      snap = snapshot(deriveFromDb(c, db));
    } catch {
      snap = null;
    }
    out[level] = prev && snap ? diff(prev, snap) : [];
    prev = snap ?? prev;
  }
  return out;
}

const ALIASES = {
  'weapon mastery': ['weaponmastery'],
  'fighting style': ['feat@fs', 'feat@1', 'feat@2'],
  'ability score improvement': ['feat@'],
  'epic boon': ['feat@19'],
  expertise: ['expertise@'],
  'eldritch invocations': ['optfeat@ei'],
  'pact of the magic': ['optfeat@ei'],
  metamagic: ['optfeat@mm'],
  scholar: ['expertise@scholar'],
  "thieves' cant": ['classgrant-lang'],
};

/** O nome da feature dona de cada escolha do builder, pela id (os descritores do builder). */
function choiceOwners(db, character) {
  const out = new Map();
  try {
    for (const ch of buildClassChoices(db, character.classes[0], character)) out.set(norm(ch.id), norm(ch.feature?.name ?? ch.label));
  } catch {
    /* sem descritores, só o nome na id */
  }
  return out;
}

/** As escolhas guardadas que citam a feature. */
function builderOf(f, level, character, entries, owners) {
  const name = norm(f.name);
  const keys = ALIASES[name] ?? [];
  const hit = entries.filter((e) => e.key.includes(name) || keys.some((k) => e.key.startsWith(k)) || e.picks.some((p) => p.startsWith(`${name}|`)) || (owners.get(e.key) ?? '').startsWith(name));
  const out = [...new Set(hit.map((e) => e.key.replace(/@\d+$/, '')))];
  const cls = character.classes[0];
  if (/^(?:spellcasting|pact magic)$/.test(name) && (cls.spells?.length ?? Object.keys(cls.spells ?? {}).length)) out.push(`magias (${cls.spells.length ?? Object.keys(cls.spells).length})`);
  if (name === 'wild shape' && character.wildShapeForms?.length) out.push(`formas (${character.wildShapeForms.length})`);
  return out;
}

/** O que o modo de jogo faz. */
function playOf(f, catalog, bridged) {
  if (!f) return { cat: 'fora do ator', parts: [] };
  const action = (catalog.actions ?? []).find((a) => a.key === f.actionKey);
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool' && r.item === f.name);
  const cat = classify(f, action, pools, bridged.has(f.name));
  const parts = [];
  const costs = featureCosts(f, action);
  if (costs.length) parts.push(costs.join('/'));
  for (const p of pools) parts.push(`pool ${p.max}${p.recovery?.length ? ` ${p.recovery.map((r) => r.period).join('/')}` : ''}`);
  const acts = (action?.activities ?? []).map((a) => `${a.type}${a.consumes?.length ? '+gasta' : ''}`);
  if (acts.length) parts.push(`activities ${acts.join(',')}`);
  const reg = featureRollOf(f.name);
  if (reg) parts.push(`registro ${reg.kind}`);
  if (f.spendItem) parts.push(`gasta ${f.spendItem}`);
  if (bridged.has(f.name)) parts.push('efeito na rolagem');
  if (isSummonFeature(f.name)) parts.push('summon');
  if (transformRuleOf(f.name)) parts.push('forma');
  return { cat, parts };
}

/** O item do ator. */
function exportOf(name, level, actor) {
  const items = (actor?.items ?? []).filter((i) => i.type === 'feat' && norm(i.name) === norm(name));
  const item = items.find((i) => (i.flags?.builder5e?.level ?? null) === level) ?? items[0];
  if (!item) return '-';
  const acts = Object.values(item.system?.activities ?? {}).length;
  const effects = (item.effects ?? []).length;
  const uses = item.system?.uses?.max;
  const parts = ['item'];
  if (acts) parts.push(`${acts} activit${acts > 1 ? 'ies' : 'y'}`);
  if (effects) parts.push(`${effects} efeito${effects > 1 ? 's' : ''}`);
  if (uses) parts.push(`usos ${uses}`);
  return parts.join(', ');
}

/** Todas as facetas de uma feature, e a assinatura delas. */
function facetsOf({ feature, f, level, character, entries, owners, catalog, bridged, derived, actor, levelDiff, classId, short }) {
  const text = plainText(f?.entries ?? feature.entries ?? []);
  const play = playOf(f, catalog, bridged);
  const choice = f ? pendingChoice(f, character, entries, text) : null;
  const grants = GRANT_EXPLAINED[norm(feature.name)] ? [] : missingOf(grantsOf(text), derived).map((g) => g.label);
  const playCues = f ? unexplainedCues(f, play.cat, cuesOf(text)) : [];
  const facets = {
    builder: builderOf(feature, level, character, entries, owners).join('; ') || '-',
    ficha: [...(levelDiff ?? []), ...mentions(feature.name, classId, short).map((m) => `reg:${m}`)].join('; ') || '-',
    jogo: [play.cat, ...play.parts].join('; '),
    export: exportOf(feature.name, level, actor),
    pistas: [...playCues.map((c) => `jogo:${c}`), ...(choice ? [`escolha:${choice}`] : []), ...grants.map((g) => `falta:${g}`)].join('; ') || '-',
  };
  const sig = crypto.createHash('sha1').update(JSON.stringify(facets)).digest('hex').slice(0, 10);
  return { facets, sig };
}

const db = loadDb();
const species = defaultSpecies(db);
const verdicts = fs.existsSync(VERDICTS) ? JSON.parse(fs.readFileSync(VERDICTS, 'utf8')) : {};
const rows = [];
const doneClasses = new Set();

for (const row of classMatrix(db)) {
  if (args.only && row.classId !== args.only) continue;
  const classObj = resolveClassObj(db, row.classId, row.classSource);
  const sub = row.subclassId ? resolveSubclassObj(db, row.classId, row.subclassId, row.subclassSource) : null;
  const wantClass = !doneClasses.has(row.classId) && tierOfClass(classObj) === TIER;
  const wantSub = sub && tierOfSubclass(sub) === TIER;
  if (!wantClass && !wantSub) continue;
  const built = autoBuild(db, { ...row, level: 20, ...species, seed: hashSeed(row.id, 1) });
  const character = built.character;
  const catalog = derivePlayCatalog(character, db);
  const derived = deriveFromDb(character, db);
  const actor = safeActor(character, db);
  const entries = bagEntries(character);
  const bridged = new Set([...(catalog.actorEffects ?? []), ...(catalog.proseEffects ?? [])].map((e) => e.name));
  const diffs = levelDiffs(character, db);
  const ctx = { character, entries, owners: choiceOwners(db, character), catalog, bridged, derived, actor, classId: row.classId };
  const listed = (name, level, kind) => (catalog.featureList ?? []).find((x) => norm(x.name) === norm(name) && (x.level ?? null) === level && x.kind === kind)
    ?? (catalog.featureList ?? []).find((x) => norm(x.name) === norm(name) && x.kind === kind);
  if (wantClass) {
    doneClasses.add(row.classId);
    for (const feature of resolveClassFeatures(db, row.classId, classObj, 20)) {
      const f = listed(feature.name, feature.level, 'class');
      const { facets, sig } = facetsOf({ ...ctx, feature, f, level: feature.level, levelDiff: diffs[feature.level], short: null });
      rows.push({ id: `${TIER}|${row.classId}|-|${feature.level}|${feature.name}`, book: classObj.source, className: classObj.name, sub: '(classe)', level: feature.level, name: feature.name, facets, sig, text: plainText(feature.entries ?? []) });
    }
  }
  if (wantSub) {
    for (const feature of resolveSubclassFeatures(sub, row.classId, db, { max: 20 })) {
      const f = listed(feature.name, feature.level, 'subclass') ?? listed(feature.name, feature.level, 'class');
      const { facets, sig } = facetsOf({ ...ctx, feature, f, level: feature.level, levelDiff: diffs[feature.level], short: sub.shortName });
      rows.push({ id: `${TIER}|${row.classId}|${sub.shortName}|${feature.level}|${feature.name}`, book: sub.source, className: classObj.name, sub: sub.name, level: feature.level, name: feature.name, facets, sig, text: plainText(feature.entries ?? []) });
    }
  }
}

/** O estado do veredito de uma linha. */
function stateOf(r) {
  const v = verdicts[r.id];
  if (!v) return 'sem veredito';
  return v.sig === r.sig ? v.v : `${v.v} (mudou)`;
}

/** O texto do livro. */
function bookOf() {
  const count = {};
  for (const r of rows) count[stateOf(r)] = (count[stateOf(r)] ?? 0) + 1;
  const lines = [
    `# Registro de features: ${TIER_LABEL[TIER]}`,
    '',
    `Gerado por \`npx vite-node scripts/feature-audit.js --tier=${TIER}\` (DDL-0228). Os vereditos ficam em`,
    '`testing/feature-audit/verdicts.json`; "mudou" quer dizer que o app passou a tratar a feature de outro',
    'jeito depois do veredito. Ficha: o que a derivação muda no nível (da classe inteira) e os registros que',
    'citam a feature. Jogo: use (o app gasta, rola ou aplica), log (vai ao histórico), passive (texto).',
    '',
    `${rows.length} features: ${Object.entries(count).map(([k, n]) => `${n} ${k}`).join(', ')}.`,
    '',
  ];
  const tree = new Map();
  for (const r of rows) {
    const key = `${r.book}|${r.className}|${r.sub}`;
    if (!tree.has(key)) tree.set(key, []);
    tree.get(key).push(r);
  }
  let book = null;
  let cls = null;
  for (const [key, list] of [...tree.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [b, c, s] = key.split('|');
    if (b !== book) { lines.push(`## ${b}`, ''); book = b; cls = null; }
    if (c !== cls) { lines.push(`### ${c}`, ''); cls = c; }
    lines.push(`#### ${s}`, '', '| Nível | Feature | Builder | Ficha | Jogo | Export | Pistas | Veredito |', '|---|---|---|---|---|---|---|---|');
    for (const r of list.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name))) {
      const v = verdicts[r.id];
      const cell = (t) => String(t).replace(/\|/g, '/');
      lines.push(`| ${r.level} | ${cell(r.name)} | ${cell(r.facets.builder)} | ${cell(r.facets.ficha)} | ${cell(r.facets.jogo)} | ${cell(r.facets.export)} | ${cell(r.facets.pistas)} | ${cell(stateOf(r))}${v?.note ? `: ${cell(v.note)}` : ''} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, `${TIER.toUpperCase()}.md`), bookOf());
const pending = rows.filter((r) => !verdicts[r.id] || verdicts[r.id].sig !== r.sig);
console.log(`${rows.length} features na camada ${TIER}; ${rows.length - pending.length} com veredito válido, ${pending.length} a revisar.`);
if (args.dump) fs.writeFileSync(args.dump, JSON.stringify(rows.map((r) => ({ id: r.id, sig: r.sig, facets: r.facets }))));
if (args.compact) {
  for (const r of pending) {
    const f = r.facets;
    const bare = f.builder === '-' && f.ficha === '-' && /^passive$/.test(f.jogo) && f.pistas === '-';
    console.log(`${bare ? 'TEXTO ' : f.pistas !== '-' ? 'PISTA ' : '      '}${r.id.replace(/^\w+\|/, '')} | B ${f.builder} | F ${f.ficha} | J ${f.jogo} | E ${f.export}${f.pistas !== '-' ? ` | P ${f.pistas}` : ''}`);
    if (bare && args.text) console.log(`       ${r.text.slice(0, 260)}`);
  }
}
if (args.review) {
  for (const r of pending) {
    console.log(`${r.id} [${r.sig}]\n  B: ${r.facets.builder}\n  F: ${r.facets.ficha}\n  J: ${r.facets.jogo}\n  E: ${r.facets.export}\n  P: ${r.facets.pistas}`);
  }
}
