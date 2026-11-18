// =============================================================================
// release-bar: a régua do lançamento do play mode, numa porcentagem só
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/release-bar.js [--sample=<n>] [--no-write] [--list]
//   A pergunta do dono (DDL-0249, DDL-0250): que parte dos personagens possíveis é buildável
//   E jogável? O universo é o produto classe x subclasse x espécie (com a linhagem) que os
//   seletores oferecem (scripts/lib/matrix.js), cada combinação com o mesmo peso. Uma
//   combinação passa quando as duas metades passam:
//   - a linha de CLASSE: o autoBuild termina sem pendência do guia nos níveis LEVELS, e
//     toda feature de classe e de subclasse até o 20 tem veredito `ok` ou `explained` no
//     registro de features (testing/feature-audit/verdicts.json, DDL-0228) e nenhuma pista
//     de mecânica sem conta (scripts/lib/playCoverage.js);
//   - a linha de ESPÉCIE: o autoBuild termina sem pendência num guerreiro Champion (`HOST`,
//     com a subclasse: sem ela todo nível 3 ficava pendente pela subclasse) nos níveis LEVELS, e nenhum traço tem pista sem conta.
//   Depois sorteia `--sample` combinações de verdade (classe, subclasse, espécie e nível
//   ao acaso) e confere que o build termina e o catálogo do jogo deriva: o produto só vale
//   se a mistura não quebra o que as metades provam sozinhas.
//   Escreve testing/RELEASE-BAR.md (privado): as porcentagens no SRD e no 5e.tools, por
//   camada, e cada linha que não passa com o motivo.
//
// FUNÇÕES
//   tierOfSubclass(sub), tierOfClass(classObj): a camada do registro (a mesma do feature-audit).
//   featureVerdict(id): 'ok', 'gap' ou 'unreviewed' pelo verdicts.json.
//   classRow(row): o estado de uma linha de classe { status, reasons, tier, srd }.
//   speciesRow(row): o estado de uma linha de espécie.
//   cueReasons(catalog, kinds): as features do catálogo com pista sem conta.
//   pct(n, d): a porcentagem com uma casa.
//
// DECISÕES E ARMADILHAS
//   - Três estados por linha: `playable`, `gap` (pendência no builder, veredito `gap`, pista
//     sem conta, erro) e `unreviewed` (alguma feature sem veredito: a camada legado). A
//     porcentagem CERTIFICADA conta só `playable`; o teto conta `unreviewed` também. A
//     diferença é o trabalho de revisão que falta, nunca é chute.
//   - A espécie não tem registro de vereditos: a prova dela é o builder e as pistas da prosa
//     (survey-play-coverage). Fica escrito no relatório.
//   - O veredito é lido pela chave, sem conferir a assinatura das facetas: "mudou" é trabalho
//     do feature-audit, que reconstrói as facetas. Rode o feature-audit antes se o app mudou.
//   - O peso é uniforme por combinação, como o dono disse ("personagens possíveis"); uma
//     classe com 20 subclasses pesa mais que uma com 4. O relatório mostra também por classe.
//   - O SRD é a combinação da camada `srd` (classe do XPHB com subclasse do SRD 5.2) com a
//     espécie de flag `srd52` ou `srd`.
//   - Nada de texto de livro no relatório: só nomes e motivos.
// -----------------------------------------------------------------------------
import fs from 'node:fs';
import process from 'node:process';
import { loadDb } from './lib/loadDb.js';
import { classMatrix, speciesMatrix, defaultSpecies } from './lib/matrix.js';
import { autoBuild } from './lib/autoBuild.js';
import { hashSeed, mulberry32 } from './lib/rng.js';
import { classify, cuesOf, unexplainedCues } from './lib/playCoverage.js';
import { derivePlayCatalog } from '../src/engine/playCatalog.js';
import { plainText } from '../src/engine/playFeatures.js';
import { resolveClassObj, resolveSubclassObj } from '../src/engine/resolve.js';
import { resolveClassFeatures, resolveSubclassFeatures } from '../src/engine/foundryItems.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const LEVELS = [1, 3, 5, 11, 20];
const SAMPLE = Number(args.sample ?? 300);
const OUT = 'testing/RELEASE-BAR.md';
const db = loadDb();
const species = defaultSpecies(db);
const verdicts = JSON.parse(fs.readFileSync('testing/feature-audit/verdicts.json', 'utf8'));
const HOST = classMatrix(db).find((r) => r.classId === 'fighter' && r.classSource === 'XPHB' && r.subclassSource === 'XPHB' && /champion/i.test(r.subclassId ?? ''));
if (!HOST) throw new Error('o hospedeiro das espécies (Fighter / Champion do XPHB) não está na matriz');

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

/** 'ok', 'gap' ou 'unreviewed'. */
function featureVerdict(id) {
  const v = verdicts[id]?.v;
  if (v === 'ok' || v === 'explained') return 'ok';
  return v ? 'gap' : 'unreviewed';
}

/** As features do catálogo com pista de mecânica sem conta e sem motivo. */
function cueReasons(catalog, kinds) {
  const actions = new Map((catalog.actions ?? []).map((a) => [a.key, a]));
  const pools = (catalog.resources ?? []).filter((r) => r.kind === 'pool');
  const bridged = new Set([...(catalog.actorEffects ?? []), ...(catalog.proseEffects ?? [])].map((e) => e.name));
  const out = [];
  for (const f of catalog.featureList ?? []) {
    if (!kinds.includes(f.kind)) continue;
    const cat = classify(f, actions.get(f.actionKey), pools.filter((p) => p.item === f.name), bridged.has(f.name));
    const left = unexplainedCues(f, cat, cuesOf(plainText(f.entries)));
    if (left.length) out.push(`${f.name}: pista sem conta (${left.join(', ')})`);
  }
  return out;
}

/** O estado de uma linha de classe. */
function classRow(row) {
  const classObj = resolveClassObj(db, row.classId, row.classSource);
  const sub = row.subclassId ? resolveSubclassObj(db, row.classId, row.subclassId, row.subclassSource) : null;
  const tier = sub ? tierOfSubclass(sub) : tierOfClass(classObj);
  const reasons = [];
  let unreviewed = 0;
  for (const level of LEVELS) {
    try {
      const built = autoBuild(db, { ...row, level, ...species, seed: hashSeed(row.id, level) });
      if (!built.ok) reasons.push(`builder com pendência no nível ${level} (${built.pendencies.total})`);
      if (level === 20) reasons.push(...cueReasons(derivePlayCatalog(built.character, db), ['class', 'subclass']));
    } catch (e) {
      reasons.push(`erro no nível ${level}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  const classTier = tierOfClass(classObj);
  for (const f of resolveClassFeatures(db, row.classId, classObj, 20)) {
    const state = featureVerdict(`${classTier}|${row.classId}|-|${f.level}|${f.name}`);
    if (state === 'gap') reasons.push(`${f.name}: veredito de lacuna`);
    if (state === 'unreviewed') unreviewed++;
  }
  if (sub) {
    for (const f of resolveSubclassFeatures(sub, row.classId, db, { max: 20 })) {
      const state = featureVerdict(`${tier}|${row.classId}|${sub.shortName}|${f.level}|${f.name}`);
      if (state === 'gap') reasons.push(`${f.name}: veredito de lacuna`);
      if (state === 'unreviewed') unreviewed++;
    }
  }
  const status = reasons.length ? 'gap' : unreviewed ? 'unreviewed' : 'playable';
  if (unreviewed) reasons.push(`${unreviewed} feature(s) sem veredito no registro`);
  return { id: row.id, label: `${classObj.name}${sub ? ` / ${sub.name} (${sub.source})` : ''}`, className: classObj.name, status, reasons, tier, srd: tier === 'srd' };
}

/** O estado de uma linha de espécie. */
function speciesRow(row) {
  const race = (db.races?.race ?? []).find((r) => r.name === row.speciesName && r.source === row.speciesSource);
  const reasons = [];
  for (const level of LEVELS) {
    try {
      const built = autoBuild(db, { ...HOST, level, speciesId: row.speciesId, speciesSource: row.speciesSource, lineage: row.lineage, seed: hashSeed(row.id, level) });
      if (!built.ok) reasons.push(`builder com pendência no nível ${level} (${built.pendencies.total})`);
      if (level === 5) reasons.push(...cueReasons(derivePlayCatalog(built.character, db), ['species']));
    } catch (e) {
      reasons.push(`erro no nível ${level}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }
  return { id: row.id, label: `${row.speciesName}${row.lineage ? ` (${row.lineage})` : ''} [${row.speciesSource}]`, status: reasons.length ? 'gap' : 'playable', reasons, srd: !!(race?.srd52 || race?.srd) };
}

/** A porcentagem com uma casa. */
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a');

const classes = classMatrix(db).map(classRow);
const speciesRows = speciesMatrix(db).map(speciesRow);

const rng = mulberry32(20261118);
const classList = classMatrix(db);
const speciesList = speciesMatrix(db);
const sampleFails = [];
for (let i = 0; i < SAMPLE; i++) {
  const c = classList[Math.floor(rng() * classList.length)];
  const s = speciesList[Math.floor(rng() * speciesList.length)];
  const level = 1 + Math.floor(rng() * 20);
  const id = `${c.id} + ${s.id} @${level}`;
  try {
    const built = autoBuild(db, { ...c, level, speciesId: s.speciesId, speciesSource: s.speciesSource, lineage: s.lineage, seed: hashSeed(id, 1) });
    if (!built.ok) sampleFails.push(`${id}: builder com pendência (${built.pendencies.total})`);
    else derivePlayCatalog(built.character, db);
  } catch (e) {
    sampleFails.push(`${id}: erro ${String(e?.message ?? e).slice(0, 120)}`);
  }
}

/** As contas de um recorte. */
function bar(cs, ss) {
  const total = cs.length * ss.length;
  const okC = cs.filter((r) => r.status === 'playable').length;
  const upC = cs.filter((r) => r.status !== 'gap').length;
  const okS = ss.filter((r) => r.status === 'playable').length;
  return { total, certified: okC * okS, ceiling: upC * okS, classes: cs.length, okC, upC, species: ss.length, okS };
}
const all = bar(classes, speciesRows);
const srd = bar(classes.filter((r) => r.srd), speciesRows.filter((r) => r.srd));
const tiers = ['srd', 'xphb', 'post', 'legacy'].map((t) => [t, bar(classes.filter((r) => r.tier === t), speciesRows)]);

const lines = [
  '# A régua do lançamento do play mode',
  '',
  'Gerado por `npx vite-node scripts/release-bar.js` (DDL-0250). Universo: classe x subclasse x espécie (com a',
  'linhagem) que os seletores oferecem, cada combinação com o mesmo peso. Certificado: as duas metades passam',
  `(o builder termina sem pendência nos níveis ${LEVELS.join(', ')}, toda feature de classe e subclasse com veredito`,
  '`ok` ou `explained` no registro, nenhuma pista sem conta). Teto: conta também as linhas com features ainda sem',
  'veredito (a revisão que falta). A espécie não tem registro de vereditos: a prova dela é o builder e as pistas.',
  '',
  '| Recorte | Combinações | Certificado | Teto (com as sem veredito) | Linhas de classe ok / sem veredito / total | Espécies ok / total |',
  '|---|---|---|---|---|---|',
  ...[['SRD', srd], ['5e.tools inteiro', all], ...tiers.map(([t, b]) => [`camada ${t}`, b])]
    .map(([name, b]) => `| ${name} | ${b.total} | ${pct(b.certified, b.total)} | ${pct(b.ceiling, b.total)} | ${b.okC} / ${b.upC - b.okC} / ${b.classes} | ${b.okS} / ${b.species} |`),
  '',
  `Amostra de ${SAMPLE} combinações reais (classe, subclasse, espécie e nível ao acaso): ${SAMPLE - sampleFails.length} sem problema.`,
  ...sampleFails.map((x) => `- ${x}`),
  '',
  '## Por classe',
  '',
  '| Classe | Linhas | Certificadas | Sem veredito | Com lacuna |',
  '|---|---|---|---|---|',
  ...[...new Set(classes.map((r) => r.className))].sort().map((name) => {
    const rs = classes.filter((r) => r.className === name);
    return `| ${name} | ${rs.length} | ${rs.filter((r) => r.status === 'playable').length} | ${rs.filter((r) => r.status === 'unreviewed').length} | ${rs.filter((r) => r.status === 'gap').length} |`;
  }),
  '',
  '## Linhas que não passam',
  '',
  ...[...classes, ...speciesRows].filter((r) => r.status !== 'playable').map((r) => `- **${r.label}** (${r.status}): ${r.reasons.join('; ')}`),
  '',
];
if (!args['no-write']) fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(lines.slice(8, 16 + sampleFails.length).join('\n'));
if (args.list) for (const r of [...classes, ...speciesRows].filter((x) => x.status !== 'playable')) console.log(`${r.status.padEnd(10)} ${r.label}: ${r.reasons.join('; ')}`);
