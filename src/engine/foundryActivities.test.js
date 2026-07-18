import { describe, it, expect } from 'vitest';
import { featureActivities } from './foundryActivities';

/** Única activity de uma feature (objeto indexado por _id → o valor). */
function only(acts) {
  const vals = Object.values(acts);
  return vals[0];
}

describe('featureActivities', () => {
  it('Second Wind → heal (bonus) que cura 1d10 + nível e consome 1 uso', () => {
    const acts = featureActivities('Second Wind', 'fighter');
    const a = only(acts);
    expect(Object.keys(acts)[0]).toMatch(/^[A-Za-z0-9]{16}$/); // keyed por _id
    expect(a.type).toBe('heal');
    expect(a.activation.type).toBe('bonus');
    expect(a.consumption.targets).toEqual([{ type: 'itemUses', value: '1', target: '', scaling: {} }]);
    expect(a.healing).toMatchObject({ number: 1, denomination: 10, bonus: '@classes.fighter.levels', types: ['healing'] });
  });

  it('Action Surge → utility (special) consumindo 1 uso', () => {
    const a = only(featureActivities('Action Surge', 'fighter'));
    expect(a.type).toBe('utility');
    expect(a.activation.type).toBe('special');
    expect(a.consumption.targets[0]).toMatchObject({ type: 'itemUses', value: '1' });
  });

  it('Rage → utility "Expend Rage" (bonus), duração 10 min', () => {
    const a = only(featureActivities('Rage', 'barbarian'));
    expect(a).toMatchObject({ type: 'utility', name: 'Expend Rage' });
    expect(a.activation).toMatchObject({ type: 'bonus', value: 1 });
    expect(a.duration).toMatchObject({ value: '10', units: 'minute' });
  });

  it('feature sem activity curada → {} (case-insensitive p/ as curadas)', () => {
    expect(featureActivities('Extra Attack', 'fighter')).toEqual({});
    expect(Object.keys(featureActivities('SECOND WIND', 'fighter'))).toHaveLength(1);
  });

  it('Lay on Hands → heal por POOL (@scaling) + Remove Poison a 5 usos', () => {
    const acts = Object.values(featureActivities('Lay on Hands', 'paladin'));
    expect(acts).toHaveLength(2);
    const [pool, poison] = acts;
    expect(pool.type).toBe('heal');
    expect(pool.healing.custom).toEqual({ enabled: true, formula: '@scaling' });
    expect(pool.consumption.scaling).toEqual({ allowed: true, max: '5 * @classes.paladin.levels - @item.uses.spent' });
    expect(pool.consumption.targets[0].scaling).toEqual({ mode: 'amount', formula: '' });
    expect(pool.target.affects).toMatchObject({ count: '1', type: 'creature' });
    expect(poison).toMatchObject({ type: 'utility', name: 'Remove Poison' });
    expect(poison.consumption.targets[0].value).toBe('5');
  });

  it('Channel Divinity: paladin → Divine Sense; outras classes sem cura → sem activities', () => {
    const pal = Object.values(featureActivities('Channel Divinity', 'paladin'));
    expect(pal.map((a) => a.name)).toEqual(['Divine Sense']);
    expect(featureActivities('Channel Divinity', 'wizard')).toEqual({});
  });

  it('Channel Divinity: clérigo → Divine Spark (cura + save) e Turn Undead, gastando o próprio pool', () => {
    const acts = Object.values(featureActivities('Channel Divinity', 'cleric'));
    expect(acts.map((a) => a.name)).toEqual(['Divine Spark: Heal', 'Divine Spark: Save', 'Turn Undead']);
    const sparkFormula = '(@scale.cleric.divine-spark)d8 + @abilities.wis.mod';
    const [heal, save, turn] = acts;
    expect(heal).toMatchObject({ type: 'heal', range: { units: 'ft', value: '30' } });
    expect(heal.healing.custom).toEqual({ enabled: true, formula: sparkFormula });
    expect(heal.consumption.targets[0]).toMatchObject({ type: 'itemUses', value: '1', target: '' });
    expect(save).toMatchObject({ type: 'save' });
    expect(save.save).toEqual({ ability: ['con'], dc: { calculation: 'spellcasting', formula: '' } });
    expect(save.damage).toEqual({ onSave: 'half', parts: [{ number: null, denomination: null, bonus: '', types: ['necrotic', 'radiant'], custom: { enabled: true, formula: sparkFormula } }] });
    expect(turn).toMatchObject({ type: 'save', name: 'Turn Undead' });
    expect(turn.save.ability).toEqual(['wis']);
    expect(turn.damage).toEqual({ onSave: 'none', parts: [] });
    expect(turn.target.affects).toMatchObject({ type: 'creature', special: 'Undead of your choice' });
  });

  it('Sear Undead (Clérigo nv5) → save de dano radiante gastando o pool da Channel Divinity', () => {
    const a = only(featureActivities('Sear Undead', 'cleric'));
    expect(a).toMatchObject({ type: 'save', name: 'Channel Divinity: Turn Undead' });
    expect(a.consumption.targets[0]).toEqual({ type: 'itemUses', value: '1', target: 'feat:channel-divinity', scaling: {} });
    expect(a.damage).toEqual({ onSave: 'none', parts: [{ number: null, denomination: null, bonus: '', types: ['radiant'], custom: { enabled: true, formula: '(@abilities.wis.mod)d8' } }] });
  });

  it('Preserve Life (Domínio da Vida) → heal por pool (5×nível), gastando o pool da Channel Divinity', () => {
    const a = only(featureActivities('Preserve Life', 'cleric'));
    expect(a).toMatchObject({ type: 'heal', name: 'Channel Divinity: Preserve Life' });
    expect(a.consumption.targets[0]).toMatchObject({ type: 'itemUses', value: '1', target: 'feat:channel-divinity' });
    expect(a.healing.custom).toEqual({ enabled: true, formula: '5 * @classes.cleric.levels' });
    expect(a.target.affects).toMatchObject({ type: 'creature', choice: true, special: 'Bloodied creatures' });
  });

  it('Wild Shape → transform com 3 perfis (CR ¼/½/1) por faixa de nível, preset wildshape', () => {
    const a = only(featureActivities('Wild Shape', 'druid'));
    expect(a.type).toBe('transform');
    expect(a.activation.type).toBe('bonus');
    expect(a.transform).toEqual({ customize: false, identifier: 'druid', preset: 'wildshape' });
    expect(a.target.prompt).toBe(true);
    expect(a.profiles).toHaveLength(3);
    expect(a.profiles.map((p) => p.cr)).toEqual(['0.25', '0.5', '1']);
    expect(a.profiles[0].level).toEqual({ min: null, max: 3 });
    expect(a.profiles[2].movement).toEqual([]);
    expect(a.profiles.every((p) => /^[A-Za-z0-9]{16}$/.test(p._id))).toBe(true);
  });

  it('Font of Magic → conversões ponto⇄slot com consumo composto', () => {
    const [slot, points] = Object.values(featureActivities('Font of Magic', 'sorcerer'));
    expect(slot.name).toBe('Regain Spell Slot');
    expect(slot.consumption.targets.map((x) => x.type)).toEqual(['itemUses', 'spellSlots']);
    expect(points.name).toBe('Regain Sorcery Points');
    expect(points.consumption.targets[1].value).toBe('0 - @scaling');
  });

  it("Monk's Focus → 3 opções gastando 1 ponto + Patient Defense grátis", () => {
    const acts = Object.values(featureActivities("Monk's Focus", 'monk'));
    expect(acts.map((a) => a.name)).toEqual([
      'Flurry of Blows', 'Patient Defense (Focus Point)', 'Patient Defense', 'Step of the Wind',
    ]);
    expect(acts[2].consumption.targets).toEqual([]); // versão sem gasto
    expect(acts[0].consumption.targets[0]).toMatchObject({ type: 'itemUses', value: '1' });
  });

  it('utilities simples do batch: Indomitable/Innate Sorcery/Arcane Recovery', () => {
    expect(Object.values(featureActivities('Indomitable', 'fighter'))[0].activation.type).toBe('action');
    expect(Object.values(featureActivities('Innate Sorcery', 'sorcerer'))[0].name).toBe('Innate Sorcery');
    const rec = Object.values(featureActivities('Arcane Recovery', 'wizard'))[0];
    expect(rec).toMatchObject({ name: 'Recover' });
    expect(rec.activation.type).toBe('shortRest');
  });
});
