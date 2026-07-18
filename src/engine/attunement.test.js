import { describe, it, expect } from 'vitest';
import { unmetAttunement, ATTUNEMENT_MAX } from './attunement';

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
