// =============================================================================
// attunement.test: o limite de atunement e o requisito de quem pode atunar
// =============================================================================
// O QUE FAZ
//   O limite de atunement (`unmetAttunement`: sem item, no limite, o aviso de prosa sem quem) e o
//   requisito de quem pode atunar (`attunementRequirement`, DDL-0345) com os modelos do SRD: a classe (o Rod of
//   the Pact Keeper num bruxo e num mago), alternativas e critérios juntos (o clérigo mau), a
//   tendência por eixo, o conjurador, o atributo e o que só a prosa diz.
//
// FUNÇÕES
//   model(id): um personagem modelo do SRD.
//   who(c): o personagem com o db e a derivação, como o InventoryTab passa.
//
// DECISÕES E ARMADILHAS
//   - O bastão é escrito com as tags do 5e.tools (`[{ class: 'warlock' }]`): o pacote do SRD não
//     traz as variantes geradas dele.
// -----------------------------------------------------------------------------
import { describe, it, expect } from 'vitest';
import bundle from '../data/srdBundle.json';
import models from '../dev/playModels.json';
import { prepareDb } from './prepareDb';
import { deriveFromDb } from './resolve';
import { attunementRequirement, unmetAttunement, alignmentAxes, ATTUNEMENT_MAX } from './attunement';

const plainItem = { name: 'Longsword', reqAttune: undefined };
const needsAttune = { name: 'Cloak of Protection', reqAttune: true };
const needsSpellcaster = { name: 'Ring of Protection', reqAttune: 'by a Spellcaster' };

describe('unmetAttunement', () => {
  it('item sem reqAttune → sempre null (nada a atunar)', () => {
    expect(unmetAttunement(0, plainItem)).toBeNull();
    expect(unmetAttunement(ATTUNEMENT_MAX, plainItem)).toBeNull();
  });

  it('reqAttune true, dentro do limite, sem pré-requisito de prosa → null', () => {
    expect(unmetAttunement(0, needsAttune)).toBeNull();
    expect(unmetAttunement(ATTUNEMENT_MAX - 1, needsAttune)).toBeNull();
  });

  it('no limite → mensagem de limite', () => {
    expect(unmetAttunement(ATTUNEMENT_MAX, needsAttune)).toMatch(/already attuned to 3/i);
  });

  it('reqAttune com texto de pré-requisito → mensagem "não verificável" mesmo dentro do limite', () => {
    expect(unmetAttunement(0, needsSpellcaster)).toMatch(/by a Spellcaster/);
  });

  it('sem item resolvido (raw null) → null (não quebra)', () => {
    expect(unmetAttunement(0, null)).toBeNull();
  });
});

const db = prepareDb(bundle);
const model = (id) => models.find((m) => m.id === id);
const who = (c) => ({ character: c, db, derived: deriveFromDb(c, db) });
const rod = { name: '+1 Rod of the Pact Keeper', reqAttune: 'by a warlock', reqAttuneTags: [{ class: 'warlock' }] };

describe('o requisito de quem pode atunar (reqAttuneTags)', () => {
  it('a classe: o bastão do bruxo num bruxo e num mago', () => {
    expect(attunementRequirement(rod, who(model('model-m24-warlock-11')))).toBe('ok');
    expect(attunementRequirement(rod, who(model('model-m24-wizard-11')))).toBe('bad');
    expect(unmetAttunement(0, rod, 3, who(model('model-m24-warlock-11')))).toBeNull();
    expect(unmetAttunement(0, rod, 3, who(model('model-m24-wizard-11')))).toBe(`Requires attunement ${rod.reqAttune}`);
  });

  it('o limite vem antes do requisito, e sem quem (o chamador antigo) o aviso de antes', () => {
    expect(unmetAttunement(3, rod, 3, who(model('model-m24-warlock-11')))).toMatch(/maximum/);
    expect(unmetAttunement(0, rod, 3)).toMatch(/can't be checked automatically/);
  });

  it('alternativas (OU) e critérios (E): o clérigo ou paladino mau', () => {
    const raw = { reqAttune: 'by an evil cleric or paladin', reqAttuneTags: [{ class: 'cleric', alignment: ['E'] }, { class: 'paladin', alignment: ['E'] }] };
    const cleric = model('model-m24-cleric-11');
    expect(attunementRequirement(raw, who({ ...cleric, identity: { ...cleric.identity, alignment: 'NE' } }))).toBe('ok');
    expect(attunementRequirement(raw, who({ ...cleric, identity: { ...cleric.identity, alignment: 'LG' } }))).toBe('bad');
    expect(attunementRequirement(raw, who({ ...cleric, identity: { ...cleric.identity, alignment: '' } }))).toBe('unknown');
    expect(attunementRequirement(raw, who(model('model-m24-wizard-11')))).toBe('bad');
  });

  it('a tendência por eixo', () => {
    expect(alignmentAxes('LG')).toEqual(['L', 'G']);
    expect(alignmentAxes('N')).toEqual(['NX', 'NY']);
    expect(alignmentAxes('CN')).toEqual(['C', 'NY']);
    const nonEvil = { reqAttune: 'by a creature of non-evil alignment', reqAttuneTags: [{ alignment: ['L', 'NX', 'C', 'G', 'NY'] }] };
    const c = model('model-m24-wizard-11');
    expect(attunementRequirement(nonEvil, who({ ...c, identity: { ...c.identity, alignment: 'CG' } }))).toBe('ok');
    expect(attunementRequirement(nonEvil, who({ ...c, identity: { ...c.identity, alignment: 'CE' } }))).toBe('bad');
  });

  it('conjurador, atributo e o que só a prosa diz', () => {
    const caster = { reqAttune: 'by a spellcaster', reqAttuneTags: [{ spellcasting: true }] };
    expect(attunementRequirement(caster, who(model('model-m24-wizard-11')))).toBe('ok');
    const int = { reqAttune: 'by a creature with an intelligence score of 3 or higher', reqAttuneTags: [{ int: 3 }] };
    expect(attunementRequirement(int, who(model('model-m24-wizard-11')))).toBe('ok');
    expect(attunementRequirement({ reqAttune: 'by a creature missing a hand' }, who(model('model-m24-wizard-11')))).toBe('unknown');
    expect(attunementRequirement({ reqAttune: true }, who(model('model-m24-wizard-11')))).toBeNull();
  });
});
