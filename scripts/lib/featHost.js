// =============================================================================
// featHost: o hospedeiro de um talento (a T3 e o registro de talentos)
// =============================================================================
// O QUE FAZ
//   Monta, pelo autoBuild, o personagem que recebe um talento no lugar REAL dele (o espaço
//   da categoria, a classe e o nível do pré-requisito, a espécie, o talento exigido antes),
//   e a cópia dele SEM o talento, para medir o que o talento muda pela diferença. Usado por
//   `scripts/sweep-t3.js` (T3, DDL-0170) e por `scripts/feature-audit.js --tier=feats`.
//
// FUNÇÕES
//   classRowFor(db, classId): a primeira linha de classe (com subclasse) da matriz.
//   withAbility(c, ability, min): troca os valores do standard array para o
//     atributo chegar ao mínimo de um pré-requisito.
//   speciesFor(db, races): a linha de espécie (e linhagem) da primeira raça do
//     pré-requisito que existe na matriz ("gnome / deep" é a espécie Deep Gnome).
//   featHost(db, row, feat, species): classe, nível, espaço, espécie e o talento
//     exigido de um talento (o talento do Fighting Style de uma classe que o app não oferece, o
//     Void Warrior do Demon Hunter: não aplicável, DDL-0240).
//   buildFeatHost(db, row, host, { level? }): o autoBuild do hospedeiro com o talento.
//   withoutFeat(character, row, host): a cópia sem o talento (o espaço vazio, ou sem talento de origem).
//
// DECISÕES E ARMADILHAS
//   - O espaço do talento segue a categoria (o que o seletor oferece em cada
//     escolha da classe, medido): origem no talento de origem; G e sem categoria no
//     `feat@4` (ou no ASI do nível do pré-requisito); FS no `feat@1` do Fighter, FS:P
//     e FS:R no `feat@2` do Paladino e do Ranger; EB no `feat@19`. Pré-requisito de
//     conjuração (ou feature Spellcasting ou Pact Magic) leva o hospedeiro para o
//     Mago; classe no nível 1 vira a classe do hospedeiro; raça com sub-raça vira a
//     linhagem; talento exigido entra antes (origem, ou o `feat@4` com a unidade no
//     `feat@8`). Só a PRIMEIRA alternativa do pré-requisito (as outras são OU).
//     Dragonmark (D, EFA) entra como talento de ORIGEM: é o que os antecedentes de
//     herdeiro dão no lugar dele (DDL-0172), e o Dragonmark que outro talento exige
//     (Greater Mark, ou a categoria do Potent Dragonmark, que leva o Mark of Healing)
//     também vai na origem. Dark Gift (DG, RHW) vai no espaço de talento geral.
//   - `level` em buildFeatHost sobe o hospedeiro (o registro usa o nível 20, para o pool e a
//     escala do talento aparecerem no tamanho final); o espaço continua o mesmo.
//   - A cópia sem o talento deixa o espaço vazio (uma pendência, que a derivação aceita) em vez
//     de trocar por outro talento: outro talento mudaria a ficha também.
// -----------------------------------------------------------------------------

import { classMatrix, speciesMatrix } from './matrix';
import { autoBuild } from './autoBuild';

const ASI_LEVELS = [4, 8, 12, 16, 19];
const SLOT = {
  G: ['fighter', 4, 'feat@4'],
  FS: ['fighter', 1, 'feat@1'],
  'FS:P': ['paladin', 2, 'feat@2'],
  'FS:R': ['ranger', 2, 'feat@2'],
  EB: ['fighter', 19, 'feat@19'],
};

export function classRowFor(db, classId) {
  return classMatrix(db).find((r) => r.classId === classId) ?? { classId, classSource: 'XPHB' };
}

export function withAbility(c, ability, min) {
  if ((c.scores[ability] ?? 0) >= min) return;
  const [best] = Object.entries(c.scores).sort((a, b) => b[1] - a[1]);
  const keep = c.scores[ability];
  c.scores[ability] = best[1];
  c.scores[best[0]] = keep;
}

export function speciesFor(db, races) {
  const all = speciesMatrix(db);
  const lc = (x) => String(x ?? '').toLowerCase();
  for (const race of races ?? []) {
    const name = lc(race?.name);
    const sub = lc(race?.subrace);
    const rows = all.filter((s) => s.speciesId === name);
    const hit = (sub ? rows.find((s) => lc(s.lineage).includes(sub)) : null)
      ?? (sub ? all.find((s) => s.speciesId === `${sub} ${name}`) : null)
      ?? rows[0]
      ?? all.find((s) => lc(s.lineage) === name);
    if (hit) return { speciesId: hit.speciesId, speciesSource: hit.speciesSource, lineage: hit.lineage ?? null };
  }
  return null;
}

export function featHost(db, row, feat, species) {
  const alt = (feat.prerequisite ?? [])[0] ?? {};
  const styleOf = String(alt.otherSummary?.entry ?? '').match(/When Gaining the Level \d+ (.+?) "Fighting Style"/i)?.[1];
  if (styleOf && !classMatrix(db).some((r) => r.classId === styleOf.toLowerCase().replace(/ /g, ''))) return { skip: `estilo do Fighting Style de uma classe que o app não oferece (${styleOf})` };
  const caster = alt.spellcasting || alt.spellcasting2020 || alt.spellcastingFeature || alt.spellcastingPrepared
    || (alt.feature ?? []).some((x) => /spellcasting|pact magic/i.test(String(x)));
  const minLevel = typeof alt.level === 'number' ? alt.level : (alt.level?.level ?? 0);
  let [classId, level, slot] = row.category === 'O' || row.category === 'D' ? ['fighter', 1, 'origin'] : (SLOT[row.category] ?? SLOT.G);
  const levelClass = alt.level?.class?.name ? String(alt.level.class.name).toLowerCase() : null;
  if (levelClass && !row.category.startsWith('FS')) classId = levelClass;
  else if (caster && classId === 'fighter') classId = 'wizard';
  if (slot !== 'origin' && minLevel > level && !row.category.startsWith('FS')) {
    level = ASI_LEVELS.find((l) => l >= minLevel) ?? 19;
    slot = `feat@${level}`;
  }
  let required = null;
  const reqRef = (alt.feat ?? [])[0];
  if (reqRef) {
    const [rn, rs] = String(reqRef).split('|');
    const lc = (x) => String(x ?? '').toLowerCase();
    const rf = (db.feats?.feat ?? []).find((x) => lc(x.name) === lc(rn) && (!rs || lc(x.source) === lc(rs)));
    if (rf) {
      required = { id: `${rf.name}|${rf.source}`, origin: rf.category === 'O' || rf.category === 'D' };
      if (!required.origin && slot === 'feat@4') {
        level = Math.max(level, 8);
        slot = 'feat@8';
        required.slot = 'feat@4';
      } else if (!required.origin) {
        required.slot = 'feat@4';
        level = Math.max(level, 8);
      }
    }
  }
  if (!required && (alt.featCategory ?? []).includes('D')) required = { id: 'Mark of Healing|EFA', origin: true };
  const host = alt.race?.length ? (speciesFor(db, alt.race) ?? species) : species;
  const abilities = (alt.ability ?? []).flatMap((o) => Object.entries(o));
  return { classId, level, slot, species: host, abilities, required };
}

/** O autoBuild do hospedeiro com o talento no espaço dele; `level` sobe o nível sem mudar o espaço. */
export function buildFeatHost(db, row, host, { level } = {}) {
  const id = `${row.name}|${row.source}`;
  const crow = classRowFor(db, host.classId);
  return autoBuild(db, {
    id: row.id,
    classId: host.classId,
    classSource: crow.classSource,
    subclassId: crow.subclassId,
    subclassSource: crow.subclassSource,
    level: Math.max(host.level, level ?? 0),
    ...host.species,
    seed: 7,
    ...(host.slot === 'origin' ? { originFeat: { id: row.name, source: row.source } } : {}),
    ...(host.required?.origin ? { originFeat: { id: host.required.id.split('|')[0], source: host.required.id.split('|')[1] } } : {}),
    preset: (c) => {
      for (const [ab, min] of host.abilities) withAbility(c, ab, Number(min) || 13);
      if (host.required?.slot) c.classes[0].choices[host.required.slot] = { kind: 'feat', picks: [host.required.id], sub: {} };
      if (host.slot !== 'origin') c.classes[0].choices[host.slot] = { kind: 'feat', picks: [id], sub: {} };
    },
  });
}

/** A cópia do personagem sem o talento: o espaço fica vazio, ou o talento de origem sai. */
export function withoutFeat(character, row, host) {
  const base = structuredClone(character);
  if (host.slot === 'origin') base.origin = { ...base.origin, originFeat: null };
  else base.classes[0].choices[host.slot] = { kind: 'feat', picks: [], sub: {} };
  return base;
}
