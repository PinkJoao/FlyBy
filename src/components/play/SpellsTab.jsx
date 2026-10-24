// =============================================================================
// SpellsTab: os slots e as magias do play mode
// =============================================================================
// O QUE FAZ
//   A aba "Spells" da tela do play mode: os slots de cada círculo e os de pacto
//   (com o ajuste à mão), e as magias de cada origem (classe, espécie, talento)
//   com a CD, o ataque e o botão de lançar. Mostra só as PREPARADAS; "Show
//   unprepared" traz o resto do grimório, só para consulta.
//
// FUNÇÕES
//   SpellsTab(props): a aba.
//     tagsOf(spell): as marcas de uma magia (ritual, concentração, usos).
//
// DECISÕES E ARMADILHAS
//   - Preparar e trocar magia é decisão de build: fica no builder (pergunta 7 do
//     plano). Aqui a magia não preparada aparece desligada.
//   - O botão de lançar abre o painel de formas (engine/playCast); a magia sem
//     escolha (cantrip) lança direto.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { remainingOf } from '../../engine/playState';
import { ABILITY_SHORT } from '../builder/labels';
import { Pips } from './FeaturesTab';
import styles from './PlayTabs.module.css';

/**
 * A aba de magias.
 * @param {{ catalog: object, state: object, onCast: Function, onAdjust: Function }} props
 */
export default function SpellsTab({ catalog, state, onCast, onAdjust }) {
  const [showAll, setShowAll] = useState(false);
  const slots = (catalog.resources ?? []).filter((r) => r.kind === 'slot' || r.kind === 'pact');
  const origins = catalog.spells.filter((o) => o.spells.length);

  /** As marcas de uma magia: ritual, concentração e os usos que sobram. */
  const tagsOf = (spell) => [
    spell.ritual ? 'Ritual' : null,
    spell.concentration ? 'Concentration' : null,
    spell.castType === 'will' ? 'At will' : null,
    spell.uses ? `${remainingOf(state, spell.uses, (catalog.resources ?? []).find((r) => r.key === spell.uses)?.max ?? 0)} free` : null,
  ].filter(Boolean);

  if (!origins.length) return <section className={styles.panel}><p className={styles.empty}>This character has no spells.</p></section>;

  return (
    <section className={styles.panel}>
      {slots.length > 0 && (
        <>
          <h2 className={styles.heading}>Spell slots</h2>
          <ul className={styles.list}>
            {slots.map((s) => {
              const left = remainingOf(state, s.key, s.max);
              return (
                <li key={s.key} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{s.kind === 'pact' ? `Pact (level ${s.level})` : `Level ${s.level}`}</span>
                  </span>
                  <Pips left={left} max={s.max} />
                  <span className={styles.adjust}>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(s.key, 1)} disabled={left <= 0} aria-label="Spend one slot">-</button>
                    <button type="button" className={styles.smallBtn} onClick={() => onAdjust(s.key, -1)} disabled={left >= s.max} aria-label="Regain one slot">+</button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {origins.map((o) => {
        const list = o.spells.filter((s) => showAll || s.prepared !== false).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
        return (
          <div key={o.key} className={styles.group}>
            <h2 className={styles.heading}>
              {o.label}
              {o.saveDc != null && <span className={styles.headNote}> · DC {o.saveDc} · attack {o.attackBonus >= 0 ? '+' : ''}{o.attackBonus}</span>}
            </h2>
            <ul className={styles.list}>
              {list.map((s) => (
                <li key={s.key} className={s.prepared === false ? `${styles.row} ${styles.off}` : styles.row}>
                  <span className={styles.level}>{s.level === 0 ? 'C' : s.level}</span>
                  <span className={styles.rowMain}>
                    <span className={styles.name}>{s.name}</span>
                    <span className={styles.sub}>
                      {[
                        ...tagsOf(s),
                        s.mechanics?.save ? `${ABILITY_SHORT[s.mechanics.save] ?? s.mechanics.save} save` : null,
                        s.mechanics?.attack ? 'Spell attack' : null,
                        s.mechanics?.damage?.dice ? `${s.mechanics.damage.dice} ${(s.mechanics.damage.types ?? []).join('/')}` : null,
                        s.mechanics?.heal?.dice ? `Heals ${s.mechanics.heal.dice}` : null,
                        s.prepared === false ? 'Not prepared' : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <button type="button" className={styles.useBtn} disabled={s.prepared === false} onClick={() => onCast(o, s)}>
                    Cast
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <label className={styles.toggle}>
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        <span>Show unprepared spells</span>
      </label>
    </section>
  );
}
