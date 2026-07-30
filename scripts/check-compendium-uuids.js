// =============================================================================
// check-compendium-uuids - `npm run check:uuids`
// =============================================================================
// A escada de ItemGrant dos níveis FUTUROS só emite uma feature se o registro
// gerado souber o uuid dela no compêndio do dnd5e. Sem uuid a entrada é DROPADA
// em silêncio, e o efeito só aparece muito depois: quem subir de nível DENTRO do
// Foundry não recebe a feature.
//
// Foi assim que o Monge perdeu Self-Restoration (@10). A causa não era "o SRD não
// publica" - esse caso é decisão tomada (DDL-0056: sem uuid, sem escada) - mas a
// árvore `packs/_source` não trazer o ARQUIVO de um documento que o compêndio
// compilado tem. Os atores premade oficiais provam que o uuid existe.
//
// Esta sonda cruza os uuids de `classes24` que os 48 premades referenciam contra
// o registro. Qualquer um que eles usem e nós não conheçamos é uma escada furada.
//
// Exceção legítima: o que exportamos por OUTRO caminho de propósito. O Unarmed
// Strike do Monge é o único - ele é arma (`equipment24`), não feature, e a nossa
// divergência `universal-unarmed-strike` o concede a toda classe.
//
// Sai com código 1 quando acha alguma.
// -----------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { CLASS_FEATURE_IDS, SUBCLASS_FEATURE_IDS } from '../src/engine/compendiumUuidsData.js';

const PREMADES = join(
  'DnD Source Material', 'Character Sheets in JSON', 'Standard Premade Characters',
);

/** Uuids que NÃO devem estar no registro de features, com o motivo. */
const EXPECTED_ABSENT = {
  phbmnkUnarmedStr: 'Unarmed Strike é ARMA (equipment24), não feature - ver a divergência universal-unarmed-strike',
};

function jsonFiles(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) jsonFiles(p, out);
    else if (e.endsWith('.json')) out.push(p);
  }
  return out;
}

function main() {
  const known = new Set([
    ...Object.values(CLASS_FEATURE_IDS ?? {}),
    ...Object.values(SUBCLASS_FEATURE_IDS ?? {}),
  ]);

  const files = jsonFiles(PREMADES);
  console.log(`Cruzando ${files.length} fichas premade contra ${known.size} uuids do registro.\n`);

  const gaps = new Map(); // id -> {cls, level, sheets:Set}
  for (const file of files) {
    const actor = JSON.parse(readFileSync(file, 'utf8'));
    for (const item of actor.items ?? []) {
      if (item.type !== 'class' && item.type !== 'subclass') continue;
      const adv = item.system?.advancement ?? {};
      for (const step of Array.isArray(adv) ? adv : Object.values(adv)) {
        if (step?.type !== 'ItemGrant') continue;
        for (const entry of step.configuration?.items ?? []) {
          const uuid = entry?.uuid ?? entry;
          if (typeof uuid !== 'string' || !uuid.includes('classes24')) continue;
          const id = uuid.split('.').pop();
          if (known.has(id) || EXPECTED_ABSENT[id]) continue;
          if (!gaps.has(id)) {
            gaps.set(id, { cls: item.name ?? '?', level: step.level, sheets: new Set() });
          }
          gaps.get(id).sheets.add(file.split(/[\\/]/).pop());
        }
      }
    }
  }

  for (const [id, why] of Object.entries(EXPECTED_ABSENT)) {
    console.log(`  ~ ${id.padEnd(18)} ausente DE PROPÓSITO: ${why}`);
  }
  console.log();

  if (!gaps.size) {
    console.log('=== 0 escada(s) furada(s) ===');
    return;
  }
  for (const [id, g] of [...gaps].sort()) {
    console.log(`  ✗ ${id.padEnd(18)} ${g.cls} @${g.level} (${g.sheets.size} fichas)`);
  }
  console.log(`\n=== ${gaps.size} escada(s) furada(s) ===`);
  console.log(
    'Um premade oficial referencia esse uuid e o registro não o tem, então a escada de nível\n'
    + 'FUTURO dropa a feature: quem subir de nível dentro do Foundry não a recebe. Se o documento\n'
    + 'existe mas `packs/_source` não traz o arquivo, registre em SOURCE_GAPS no\n'
    + 'scripts/gen-compendium-uuids.js e rode `npm run gen:uuids`.',
  );
  process.exitCode = 1;
}

main();
