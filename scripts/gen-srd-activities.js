// =============================================================================
// gen-srd-activities: gera src/engine/srdActivitiesData.js (npm run gen:srd)
// =============================================================================
// O QUE FAZ
//   Lê o SOURCE do sistema dnd5e (`DnD Source Material/DnD 5e System Source Code/
//   packs/_source`, MIT + SRD 2024 sob CC-BY-4.0, git-ignored, DDL-0003/0037) e
//   extrai as ACTIVITIES de cada feature de classe/subclasse/espécie, junto dos
//   Active Effects que elas referenciam. Rodar só quando o dnd5e atualizar; a SAÍDA
//   é commitada, o material de referência não.
//   Uma activity é o que dá o BOTÃO DE ROLAGEM na ficha do Foundry (o teste do
//   Stunning Strike, o dano do Potent Spellcasting). Não é derivável do 5etools, e o
//   overlay cobre pouco: das 133 features do SRD com activity, 13 eram curadas à mão
//   (TC-0070). Mesmo padrão do TC-0066 e do TC-0068: quando a informação é do
//   SISTEMA DE DESTINO, o SRD é a fonte.
//   Chaves: `classId|feature` (classe e subclasse; o nome não colide dentro da
//   classe) e `feature` (traços de espécie e talentos do origins24). Saem também os
//   itens de INVENTÁRIO que o advancement da classe concede (hoje o Unarmed Strike
//   do Bárbaro e do Monge) e a cópia GENÉRICA deles do equipment24, para toda
//   classe, keyed por nome para deduplicar.
//
// FUNÇÕES
//   norm(s): o nome comparável.
//   walk(dir, out): os .yml de uma pasta (recursivo), sem os marcadores `_folder`.
//   prune(v): poda o VAZIO (string vazia, null, array ou objeto sem nada).
//   record(bucket, key, doc): guarda activities e effects de um documento.
//   literal(obj): literal de objeto ordenado por chave (diff estável).
//
// DECISÕES E ARMADILHAS
//   - Activity e effect saem JUNTOS, obrigatoriamente: a activity referencia os
//     effects do próprio item por `_id`, e emiti-la sem eles deixaria a referência
//     apontando para o vazio (o defeito que o TC-0068/DDL-0074 mandou nunca repetir).
//     Só os effects REFERENCIADOS entram: os demais vêm do registro curado ou do
//     overlay, e duplicá-los aplicaria o efeito duas vezes.
//   - prune: o DataModel do dnd5e preenche os vazios ao importar, então guardá-los
//     só inflaria o arquivo. Booleanos e números ficam (false e 0 são valores).
//   - O advancement da classe é a única fonte que diz QUAL uuid usar para o item
//     concedido: o Bárbaro aponta para a cópia do equipment24 e o Monge para a do
//     classes24, e nem o nome nem a pasta bastam. A ficha do item vem do PRÓPRIO
//     documento do SRD (`docs`, por _id); nada é inventado. `genericIds` marca a
//     cópia do equipment24, que não pertence a classe nenhuma.
//   - O cabeçalho do arquivo gerado já segue o modelo de comentários (DDL-0090).
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseYaml } from './lib/yamlLite';

const ROOT = join(import.meta.dirname, '..');
const PACKS = join(ROOT, 'DnD Source Material', 'DnD 5e System Source Code', 'packs', '_source');
const OUT = join(ROOT, 'src', 'engine', 'srdActivitiesData.js');

const norm = (s) => (s ?? '').toString().trim().toLowerCase().replace(/’/g, "'");

/** Os .yml de uma pasta, recursivo. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.yml') && e !== '_folder.yml') out.push(p);
  }
  return out;
}

/** Poda o que é VAZIO; booleanos e números ficam. */
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

const byClass = {};
const flat = {};
const weaponGrants = {};
const commonByName = {};
let files = 0;

/** `_id` -> documento (item de inventário ou feature). */
const docs = new Map();
/** Os `_id`s do equipment24. */
const genericIds = new Set();
for (const dir of ['classes24', 'equipment24']) {
  for (const f of walk(join(PACKS, dir))) {
    const doc = parseYaml(readFileSync(f, 'utf8'));
    if (!doc._id || !doc.type) continue;
    docs.set(doc._id, doc);
    if (dir === 'equipment24') genericIds.add(doc._id);
  }
}

const record = (bucket, key, doc) => {
  const activities = prune(doc.system?.activities ?? {});
  if (!activities) return false;
  const entry = { activities };
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
      for (const adv of Object.values(doc.system?.advancement ?? {})) {
        if (adv?.type !== 'ItemGrant') continue;
        for (const it of adv.configuration?.items ?? []) {
          const id = String(it?.uuid ?? '').split('.').pop();
          const item = docs.get(id);
          if (!item || item.type !== 'weapon') continue;
          const grant = { name: item.name, uuid: it.uuid, level: adv.level ?? 1, system: prune(item.system) ?? {} };
          (weaponGrants[classId] ??= []).push(grant);
          const generic = [...docs.values()].find(
            (d) => d.type === 'weapon' && d.name === item.name && genericIds.has(d._id),
          );
          if (generic) {
            commonByName[norm(item.name)] ??= {
              name: generic.name,
              uuid: `Compendium.dnd5e.equipment24.Item.${generic._id}`,
              level: adv.level ?? 1,
              system: prune(generic.system) ?? {},
            };
          }
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

/** Literal de objeto ordenado por chave. */
const literal = (obj) =>
  `{\n${Object.keys(obj).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`).join('\n')}\n}`;

const out = `// =============================================================================
// srdActivitiesData: GERADO por npm run gen:srd; não edite à mão
// =============================================================================
// O QUE FAZ
//   Activities (e os Active Effects que elas referenciam) das features do SRD
//   2024 do sistema dnd5e (MIT + CC-BY-4.0, Wizards of the Coast). É a mecânica
//   do SISTEMA DE DESTINO, que o dado do 5etools não tem: sem ela a feature chega
//   ao Foundry sem botão de rolagem. Consumido por engine/foundryActivities.js.
//   Cobertura: ${Object.keys(byClass).length} features de classe/subclasse e ${Object.keys(flat).length} de espécie/origem.
//
//   SRD_ACTIVITIES_BY_CLASS: "classId|feature" -> {activities, effects?}
//     (classes24).
//   SRD_ACTIVITIES_FLAT: traço -> {activities, effects?} (origins24).
//   SRD_CLASS_WEAPON_GRANTS: classId -> itens de INVENTÁRIO que o advancement da
//     classe concede ({name, uuid, level, system}).
//   SRD_COMMON_WEAPON_GRANTS: itens concedidos a QUALQUER classe.
//
// DECISÕES E ARMADILHAS
//   - SRD_CLASS_WEAPON_GRANTS: o SRD só o faz no Bárbaro e no Monge, cujas
//     features citam o Ataque Desarmado. A ficha do item é copiada do próprio
//     documento do SRD; o uuid também, porque nem o nome nem a pasta bastam (o
//     Bárbaro aponta para a cópia do equipment24 e o Monge para a do classes24).
//   - SRD_COMMON_WEAPON_GRANTS é uma divergência deliberada: o SRD não faz isso,
//     mas a regra 2024 diz que toda criatura pode fazer um Ataque Desarmado, e sem
//     o item o personagem chega ao Foundry sem botão nenhum de ataque quando está
//     desarmado; seguir o SRD aqui penalizaria o jogador. Usa a cópia GENÉRICA do
//     equipment24, que é a que não pertence a classe nenhuma.
// -----------------------------------------------------------------------------

export const SRD_ACTIVITIES_BY_CLASS = ${literal(byClass)};

export const SRD_ACTIVITIES_FLAT = ${literal(flat)};

export const SRD_CLASS_WEAPON_GRANTS = ${literal(weaponGrants)};

export const SRD_COMMON_WEAPON_GRANTS = ${JSON.stringify(Object.values(commonByName))};
`;

writeFileSync(OUT, out);
console.log(
  `srdActivitiesData.js gerado: ${Object.keys(byClass).length} features de classe, `
  + `${Object.keys(flat).length} de espécie/origem (${files} documentos com activity, `
  + `${Math.round(out.length / 1024)} KB).`,
);
