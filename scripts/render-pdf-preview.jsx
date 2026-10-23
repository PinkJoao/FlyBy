// =============================================================================
// render-pdf-preview: a ficha PDF renderizada fora do browser
// =============================================================================
// O QUE FAZ
//   Uso: npx vite-node scripts/render-pdf-preview.jsx (ou npm run pdf:preview).
//   Gera pdf-preview/sheet.pdf (template em branco) e pdf-preview/sheet-filled.pdf
//   (personagem de teste preenchido). Depois, `python scripts/pdf_to_png.py
//   <arquivo>` converte em PNGs para inspecionar o layout sem abrir o app. O
//   compêndio vem do snapshot in-repo, lido por scripts/lib/loadDb.js (DDL-0037).
//
// FUNÇÕES
//   previewCharacter(): o personagem de teste, um multiclasse conjurador com de
//     tudo um pouco.
//
// DECISÕES E ARMADILHAS
//   - O personagem é escolhido para exercitar a ficha: Aasimar XPHB dá magia
//     racial (Light, CHA fixo, então DC e ataque da origem racial), tamanho À
//     ESCOLHA e o Celestial Revelation com sub-opções nomeadas (os PARÁGRAFOS com
//     negrito do card de Species Traits); a tendência vai como código, como o
//     builder salva; há uma sub-feature e uma Invocation escolhidas, anotadas na
//     lista de features da ficha.
// -----------------------------------------------------------------------------

import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToFile } from '@react-pdf/renderer';
import CharacterSheet from '../src/pdf/CharacterSheetDoc';
import { createCharacter, createClassEntry, createInventoryItem } from '../src/schema/character';
import { deriveFromDb } from '../src/engine/resolve';
import { buildSheetModel } from '../src/pdf/sheetModel';
import { loadDb } from './lib/loadDb';
import { registerPdfFonts } from '../src/pdf/fonts';
import { applyPreset } from '../src/pdf/pdfOptions';
import { foundryToCharacter } from '../src/engine/foundryImport';

const ROOT = join(import.meta.dirname, '..');

function previewCharacter() {
  const c = createCharacter({ name: 'Lyra of the Vale' });
  c.scores = { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 13 };
  c.scoreMethod = { type: 'manual' };
  c.species = {
    id: 'aasimar',
    source: 'XPHB',
    lineage: null,
    choices: {
      'size-0': { kind: 'size', picks: ['S'] },
    },
  };
  c.origin = {
    abilityBoosts: [{ ability: 'wis', amount: 2 }, { ability: 'cha', amount: 1 }],
    originFeat: { id: 'Alert|XPHB', source: 'XPHB', subtype: 'origin', choices: {} },
    skillProficiencies: ['ins', 'med'],
    toolProficiencies: ["herbalism supplies"],
    languages: ['common', 'elvish', 'celestial'],
    choices: {},
  };
  c.identity.alignment = 'NG';
  c.identity.appearance = 'Silver hair, moss-green eyes; carries a battered holy symbol.';
  c.identity.personality = 'Soft-spoken, but immovable when the weak are threatened.';
  c.identity.backstory = 'Raised in a roadside shrine, Lyra heard the whisper of two patrons: one divine, one fey.';

  const cleric = createClassEntry(true);
  cleric.classId = 'cleric';
  cleric.source = 'XPHB';
  cleric.level = 5;
  cleric.subclassId = 'Life';
  cleric.subclassSource = 'XPHB';
  cleric.choices = {
    skill: { kind: 'skill', picks: ['his', 'rel'] },
    'featopt@Divine Order@1': { kind: 'featureoption', picks: ['Thaumaturge|XPHB'] },
    'feat@4': { kind: 'feat', picks: ['War Caster|XPHB'] },
  };
  cleric.spells = [
    { id: 'Guidance', source: 'XPHB' },
    { id: 'Sacred Flame', source: 'XPHB' },
    { id: 'Thaumaturgy', source: 'XPHB' },
    { id: 'Bless', source: 'XPHB' },
    { id: 'Cure Wounds', source: 'XPHB' },
    { id: 'Aid', source: 'XPHB' },
    { id: 'Spirit Guardians', source: 'XPHB' },
  ];

  const warlock = createClassEntry(false);
  warlock.classId = 'warlock';
  warlock.source = 'XPHB';
  warlock.level = 1;
  warlock.choices = {
    'optfeat@EI': { kind: 'optionalfeature', picks: ['Pact of the Blade|XPHB'] },
  };
  warlock.spells = [
    { id: 'Eldritch Blast', source: 'XPHB' },
    { id: 'Hex', source: 'XPHB' },
  ];

  c.classes = [cleric, warlock];

  const equipped = (id, src = 'XPHB') => ({ ...createInventoryItem(id, src), equipped: true });
  c.inventory = [
    equipped('Mace'),
    equipped('Chain Shirt'),
    equipped('Shield'),
    { ...createInventoryItem('Ring of Protection', 'XDMG'), attuned: true, equipped: true },
    { ...createInventoryItem('Rations (1 day)', 'XPHB'), quantity: 5 },
    createInventoryItem('Rope, Hempen (50 feet)', 'PHB'),
  ];
  c.currency = { cp: 0, sp: 30, ep: 0, gp: 125, pp: 2 };
  return c;
}

registerPdfFonts((url) => join(ROOT, url));
mkdirSync('pdf-preview', { recursive: true });

const db = loadDb();
const character = previewCharacter();
const derived = deriveFromDb(character, db);
const variants = [
  ['sheet-parchment-complete', { ...applyPreset({}, 'complete'), theme: 'parchment' }],
  ['sheet-white-compact', { ...applyPreset({}, 'compact'), theme: 'white' }],
  ['sheet-default', {}],
];
for (const [name, options] of variants) {
  const model = buildSheetModel(character, derived, db, options);
  await renderToFile(<CharacterSheet model={model} />, `pdf-preview/${name}.pdf`);
  console.log(`OK: pdf-preview/${name}.pdf`);
}

const premade = join(ROOT, 'DnD Source Material/Character Sheets in JSON/Standard Premade Characters/fvtt-Actor-zanna-ZannaLv170000000.json');
if (existsSync(premade)) {
  const imported = foundryToCharacter(JSON.parse(readFileSync(premade, 'utf8')), db);
  const zanna = imported.character ?? imported;
  const model = buildSheetModel(zanna, deriveFromDb(zanna, db), db, { ...applyPreset({}, 'complete'), theme: 'white' });
  await renderToFile(<CharacterSheet model={model} />, 'pdf-preview/premade-zanna17-complete.pdf');
  console.log('OK: pdf-preview/premade-zanna17-complete.pdf');
}
