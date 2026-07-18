// T1 session helper (TESTING-PLAN §4): dump per-level choice descriptors for one
// class + all its subclasses, so a UI session knows exactly what to expect at each
// decision level. Usage: npx vite-node scripts/t1-choices.js <classId>
// NEW = a choice descriptor first appears; GROW = its pick count increased;
// SPELL = the class origin's cantrip/prepared/max-circle limits changed.
import process from 'node:process';
import { loadDb } from './lib/loadDb';
import { classMatrix } from './lib/matrix';
import { autoBuild } from './lib/autoBuild';
import { hashSeed } from './lib/rng';
import { deriveFromDb, resolveClassObj, resolveSubclassObj } from '../src/engine/resolve';
import { cleanupClassEntry } from '../src/engine/classFeatureChoices';
import { buildClassChoices } from '../src/components/builder/classChoices';

const CLASS_ID = process.argv[2] ?? 'artificer';
const db = await loadDb();
const rows = classMatrix(db).filter((r) => r.classId === CLASS_ID);
for (const row of rows) {
  const seed = hashSeed(row.id, 1);
  const built = autoBuild(db, {
    id: row.id, classId: row.classId, classSource: row.classSource,
    subclassId: row.subclassId, subclassSource: row.subclassSource,
    level: 20, seed,
  });
  const c = built.character;
  console.log(`\n=== ${row.id} (class source ${row.classSource}, subclass source ${row.subclassSource}) ===`);
  const seen = new Map(); // choice id -> last count, to show growth
  for (let k = 1; k <= 20; k++) {
    const cc = structuredClone(c);
    const e = { ...cc.classes[0], level: k };
    const classObj = resolveClassObj(db, e.classId, e.source);
    const subclassObj = e.subclassId ? resolveSubclassObj(db, e.classId, e.subclassId, e.subclassSource) : null;
    cc.classes[0] = cleanupClassEntry(e, { classObj, subclassObj, subclassLevel: cc.rulesConfig.subclassLevel });
    const choices = buildClassChoices(db, cc.classes[0], cc);
    const lines = [];
    for (const ch of choices) {
      const key = ch.id ?? ch.title;
      const count = ch.count ?? ch.picks ?? '?';
      const prev = seen.get(key);
      if (prev === undefined) {
        // Print at FIRST appearance (k ascending), never gated on ch.level: a
        // subclass-granted choice can declare level 1 but only exist from the
        // subclass level on (Giant's spellSet did, and was silently hidden).
        lines.push(`NEW  [${ch.kind}] ${ch.title ?? key} (level ${ch.level}, count ${count})${ch.feature ? ` <feature: ${ch.feature.name}@${ch.feature.level}${ch.feature.subclass ? ' [' + ch.feature.subclass + ']' : ''}>` : ''}`);
        seen.set(key, count);
      } else if (prev !== count) {
        lines.push(`GROW [${ch.kind}] ${ch.title ?? key}: ${prev} -> ${count}`);
        seen.set(key, count);
      }
    }
    const d = deriveFromDb(cc, db);
    const o = d.spellcasting?.origins?.find((x) => x.kind === 'class');
    if (o) {
      const sig = `cantrips ${o.cantripLimit ?? 0} / prepared ${o.prepareLimit ?? 0} / maxLvl ${o.maxPrepareLevel ?? 0}`;
      if (seen.get('__spell') !== sig) {
        lines.push(`SPELL ${sig}`);
        seen.set('__spell', sig);
      }
    }
    if (lines.length) console.log(`L${String(k).padStart(2)}: ${lines.join('\n     ')}`);
  }
}
