// =============================================================================
// gen-srd-activities - gera src/engine/srdActivitiesData.js
// =============================================================================
// Lê o SOURCE do sistema dnd5e (`DnD Source Material/DnD 5e System Source Code/
// packs/_source`, MIT + SRD 2024 sob CC-BY-4.0, git-ignored - DDL-0003/0037) e
// extrai as ACTIVITIES de cada feature de classe/subclasse/espécie, junto dos
// Active Effects que elas referenciam.
//
// POR QUE ISTO EXISTE. Uma activity é o que dá o BOTÃO DE ROLAGEM na ficha do
// Foundry (o teste de Stunning Strike, o dano do Potent Spellcasting, o Favored
// Enemy que lança Hunter's Mark). Não é derivável do 5etools, que só tem a prosa,
// e o overlay `foundry-*.json` cobre uma fatia pequena: das 133 features do SRD
// que TÊM activity, tínhamos 13 curadas à mão (TC-0070). É o mesmo padrão do
// TC-0066 (EQUIPMENT_TYPES) e do TC-0068 (FEATURE_USES): quando a informação é do
// SISTEMA DE DESTINO e não do 5etools, o SRD é a fonte.
//
// AS DUAS SAEM JUNTAS, e isso é obrigatório: uma activity referencia os effects do
// próprio item por `_id` (`effects: [{_id: 'dnd5eeffect000'}]`). Emitir a activity
// sem o effect deixaria a referência apontando para o vazio - o defeito que o
// TC-0068/DDL-0074 mandou nunca repetir.
//
// Uso: `npm run gen:srd` (só quando o sistema dnd5e atualizar). A SAÍDA é
// commitada; o material de referência não é.
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseYaml } from './lib/yamlLite';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const OUT = join(ROOT, 'src', 'engine', 'srdActivitiesData.js');

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

/** Todos os .yml de uma pasta (recursivo), sem os marcadores `_folder`. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.yml') && e !== '_folder.yml') out.push(p);
  }
  return out;
}

/**
 * Poda o que é VAZIO (string vazia, null, array/objeto sem nada) - o DataModel do
 * dnd5e preenche esses campos com o mesmo vazio ao importar, então guardá-los só
 * inflaria o arquivo. Booleanos e números ficam: `false`/`0` são valores.
 */
function prune(v) {
  if (Array.isArray(v)) {
    const out = v.map(prune).filter((x) => x !== undefined);
    return out.length ? out : undefined;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      const p = prune(val);
      if (p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
}

if (!existsSync(PACKS)) {
  console.error(`Pack do dnd5e não encontrado em ${PACKS}\nColoque o "DnD Source Material" na raiz do projeto (DDL-0037).`);
  process.exit(1);
}

// `classId|feature` (features de classe e de subclasse - o nome não colide dentro
// da classe) e `feature` (traços de espécie e talentos do origins24).
const byClass = {};
const flat = {};
// Itens de INVENTÁRIO que o documento da classe concede por advancement (hoje só
// o "Unarmed Strike" do Bárbaro e do Monge). Ver SRD_CLASS_WEAPON_GRANTS.
const weaponGrants = {};
let files = 0;

/** `_id` → documento, para saber se um uuid de ItemGrant aponta para um ITEM de
 * inventário ou para uma feature, e para copiar a ficha do item quando for. */
const docs = new Map();
for (const dir of ['classes24', 'equipment24']) {
  for (const f of walk(join(PACKS, dir))) {
    const doc = parseYaml(readFileSync(f, 'utf8'));
    if (doc._id && doc.type) docs.set(doc._id, doc);
  }
}

const record = (bucket, key, doc) => {
  const activities = prune(doc.system?.activities ?? {});
  if (!activities) return false;
  const entry = { activities };
  // Só os effects REFERENCIADOS por alguma activity: os demais já vêm do registro
  // curado ou do overlay, e duplicá-los aplicaria o efeito duas vezes.
  const referenced = new Set(
    Object.values(activities).flatMap((a) => (a.effects ?? []).map((e) => e?._id ?? e).filter(Boolean)),
  );
  const effects = (doc.effects ?? []).filter((e) => referenced.has(e?._id));
  const pruned = prune(effects);
  if (pruned) entry.effects = pruned;
  if (!bucket[key]) bucket[key] = entry;
  return true;
};

for (const classDir of readdirSync(join(PACKS, 'classes24'))) {
  const dir = join(PACKS, 'classes24', classDir);
  if (!statSync(dir).isDirectory()) continue;
  const classId = norm(classDir);
  for (const f of walk(dir)) {
    const doc = parseYaml(readFileSync(f, 'utf8'));
    if (doc.type === 'class') {
      // Itens de INVENTÁRIO concedidos pelo advancement da classe. É a única
      // fonte que diz QUAL uuid usar: o Bárbaro aponta para a cópia do
      // `equipment24` e o Monge para a do `classes24`, então nem o nome nem a
      // pasta bastam.
      for (const adv of Object.values(doc.system?.advancement ?? {})) {
        if (adv?.type !== 'ItemGrant') continue;
        for (const it of adv.configuration?.items ?? []) {
          const id = String(it?.uuid ?? '').split('.').pop();
          const item = docs.get(id);
          if (!item || item.type !== 'weapon') continue;
          // A ficha do item vem do PRÓPRIO documento do SRD - nada é inventado.
          (weaponGrants[classId] ??= []).push({
            name: item.name,
            uuid: it.uuid,
            level: adv.level ?? 1,
            system: prune(item.system) ?? {},
          });
        }
      }
      continue;
    }
    if (doc.type !== 'feat' || !doc.name) continue;
    files += record(byClass, `${classId}|${norm(doc.name)}`, doc) ? 1 : 0;
  }
}

for (const f of walk(join(PACKS, 'origins24'))) {
  const doc = parseYaml(readFileSync(f, 'utf8'));
  if (doc.type !== 'feat' || !doc.name) continue;
  files += record(flat, norm(doc.name), doc) ? 1 : 0;
}

/** Literal de objeto ordenado por chave (diff estável entre regerações). */
const literal = (obj) =>
  `{\n${Object.keys(obj).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`).join('\n')}\n}`;

const out = `// =============================================================================
// srdActivitiesData - GERADO por \`npm run gen:srd\`. NÃO EDITE À MÃO.
// =============================================================================
// Activities (e os Active Effects que elas referenciam) das features do SRD 2024
// do sistema dnd5e - MIT + CC-BY-4.0, © Wizards of the Coast. É a mecânica do
// SISTEMA DE DESTINO, que o dado do 5etools não tem: sem ela a feature chega ao
// Foundry sem botão de rolagem. Consumido por engine/foundryActivities.js.
//
// Cobertura: ${Object.keys(byClass).length} features de classe/subclasse e ${Object.keys(flat).length} de espécie/origem.
// -----------------------------------------------------------------------------

/** \`classId|nomeDaFeature\` → \`{activities, effects?}\` (pacote classes24). */
export const SRD_ACTIVITIES_BY_CLASS = ${literal(byClass)};

/** \`nomeDoTraço\` → \`{activities, effects?}\` (pacote origins24). */
export const SRD_ACTIVITIES_FLAT = ${literal(flat)};

/** \`classId\` → itens de INVENTÁRIO que o advancement da classe concede
 *  (\`{name, uuid, level, system}\`). Hoje só o "Unarmed Strike" do Bárbaro e do
 *  Monge, que é o que dá o botão de ataque desarmado na ficha do Foundry - sem
 *  ele um Monge criado no app chega lá sem a arma principal da classe. A ficha do
 *  item é copiada do próprio documento do SRD; o uuid também, porque nem o nome
 *  nem a pasta bastam (o Bárbaro aponta para a cópia do equipment24 e o Monge
 *  para a do classes24). */
export const SRD_CLASS_WEAPON_GRANTS = ${literal(weaponGrants)};
`;

writeFileSync(OUT, out);
console.log(
  `srdActivitiesData.js gerado: ${Object.keys(byClass).length} features de classe, `
  + `${Object.keys(flat).length} de espécie/origem (${files} documentos com activity, `
  + `${Math.round(out.length / 1024)} KB).`,
);
