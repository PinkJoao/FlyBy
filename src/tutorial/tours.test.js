import { describe, it, expect } from 'vitest';
import { TOURS, ALL_TOUR_IDS, getTour } from './tours';
import { TUT } from './anchors';

const ANCHOR_VALUES = new Set(Object.values(TUT));

describe('tours (dados)', () => {
  it('getTour resolve os ids conhecidos e nada mais', () => {
    for (const id of ALL_TOUR_IDS) expect(getTour(id)).toBe(TOURS[id]);
    expect(getTour('nope')).toBe(null);
  });

  it('todo tour tem passos e todo passo e valido', () => {
    for (const id of ALL_TOUR_IDS) {
      const tour = TOURS[id];
      expect(tour.id).toBe(id);
      expect(Array.isArray(tour.steps)).toBe(true);
      expect(tour.steps.length).toBeGreaterThan(0);
      for (const step of tour.steps) {
        // body obrigatorio (string ou { desktop|mobile }).
        if (typeof step.body === 'string') {
          expect(step.body.length).toBeGreaterThan(0);
        } else {
          expect(typeof step.body).toBe('object');
          expect(step.body.desktop || step.body.mobile).toBeTruthy();
        }
        // anchor, quando presente, e uma chave conhecida do TUT.
        if (step.anchor != null) expect(ANCHOR_VALUES.has(step.anchor)).toBe(true);
        // only, quando presente, e mobile|desktop.
        if (step.only != null) expect(['mobile', 'desktop']).toContain(step.only);
      }
    }
  });

  it('cada tour tem ao menos um passo em cada dispositivo', () => {
    for (const id of ALL_TOUR_IDS) {
      const steps = TOURS[id].steps;
      const desktop = steps.filter((s) => !s.only || s.only === 'desktop');
      const mobile = steps.filter((s) => !s.only || s.only === 'mobile');
      expect(desktop.length).toBeGreaterThan(0);
      expect(mobile.length).toBeGreaterThan(0);
    }
  });
});
