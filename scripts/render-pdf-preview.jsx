// =============================================================================
// render-pdf-preview - renderiza a ficha PDF fora do browser (modo de testagem)
// =============================================================================
// Uso:  npx vite-node scripts/render-pdf-preview.jsx   (ou npm run pdf:preview)
// Gera  pdf-preview/sheet.pdf         (template em branco)
//       pdf-preview/sheet-filled.pdf  (personagem de teste preenchido)
// Em seguida converta em PNGs com  python scripts/pdf_to_png.py <arquivo>
// para inspecionar o layout visualmente sem precisar abrir o app.
//
// O compêndio vem da pasta-irmã `../DnD Source Material/5etools Source Code/
// data` (mesmos arquivos que o app baixa do mirror), lida direto do disco.
// -----------------------------------------------------------------------------

import { mkdirSync } from 'node:fs';
import { renderToFile } from '@react-pdf/renderer';
import CharacterSheet from '../src/pdf/CharacterSheetDoc';
import { createCharacter, createClassEntry, createInventoryItem } from '../src/schema/character';
import { deriveFromDb } from '../src/engine/resolve';
import { buildSheetModel } from '../src/pdf/sheetModel';
// Compêndio local: mesmo manifest do app, lido do snapshot sibling (extraído
// para scripts/lib/loadDb.js e compartilhado com o sweep da Fase T).
import { loadDb } from './lib/loadDb';

// --- personagem de teste: multiclasse conjurador com de tudo um pouco ---------
function previewCharacter() {
  const c = createCharacter({ name: 'Lyra of the Vale' });
  c.scores = { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 13 };
  c.scoreMethod = { type: 'manual' };
  c.species = {
    // Aasimar XPHB: magias raciais (Light, CHA fixo) → DC/ataque da origem
    // racial; tamanho Small/Medium À ESCOLHA (size pick abaixo); e o traço
    // Celestial Revelation com sub-opções nomeadas → exercita os PARÁGRAFOS
    // com negrito do card de Species Traits.
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
  c.identity.alignment = 'NG'; // código, como o builder salva → "Neutral Good" na ficha
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
    // Sub-feature escolhida (anotada na lista de features da ficha).
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
  // Invocation escolhida (anotada em "Eldritch Invocations" na ficha do Warlock).
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

mkdirSync('pdf-preview', { recursive: true });
await renderToFile(<CharacterSheet />, 'pdf-preview/sheet.pdf');
console.log('OK: pdf-preview/sheet.pdf (blank)');

const db = loadDb();
const character = previewCharacter();
const derived = deriveFromDb(character, db);
const model = buildSheetModel(character, derived, db);
console.log('sheets:', model.sheets.map((s) => s.classText || '(no class)').join(' | '));
await renderToFile(<CharacterSheet model={model} />, 'pdf-preview/sheet-filled.pdf');
console.log('OK: pdf-preview/sheet-filled.pdf');
