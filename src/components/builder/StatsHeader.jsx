// =============================================================================
// StatsHeader - tiles (Level / HP / Alignment) + atributos editáveis
// =============================================================================
// - Level e Hit Points são tiles EXPANSÍVEIS (breakdown por classe).
// - Alignment é expansível com as 9 opções (seleção funcional).
// - Cada atributo mostra o nome POR EXTENSO, o TOTAL grande e o modificador
//   (accent) menor; ao expandir traz o Base (legenda + stepper − +), Bonus e
//   Modifier (o valor base não é repetido).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { ABILITIES } from '../../schema/character';
import { formatBonus } from '../../engine/math';
import Stepper from '../common/Stepper';
import { ABILITY_FULL } from './labels';
import styles from './StatsHeader.module.css';

// Estilo do Stepper no tile de HP: pílula que PREENCHE a largura do bloco (o
// número flexiona no meio, então 3 dígitos cabem à vontade e a borda nunca vaza
// do card em telas estreitas), sem borda própria - o card já delimita. O tile de
// HP é largo (2-up no mobile), então botões maiores cabem confortavelmente.
const TILE_STEPPER = {
  bg: 'var(--bg-soft)',
  buttonSize: 30,
  fontSize: 17,
  numberColor: 'var(--text-h)',
  style: { width: '100%' },
};

// Ability cards são 6-up no desktop / 3-up no mobile - MUITO mais estreitos que
// o tile de HP. Com os botões de largura fixa do HP (30px), o número (flex) era
// espremido a zero em telas estreitas e sumia. Botões e fonte menores devolvem
// espaço ao número (que ainda tem um piso no CSS via --stp-num-min).
const ABILITY_STEPPER = {
  bg: 'var(--bg-soft)',
  buttonSize: 24,
  fontSize: 15,
  numberColor: 'var(--text-h)',
  style: { width: '100%' },
};

const MIN_SCORE = 1;
const MAX_SCORE = 30;

const ALIGNMENT_LABEL = {
  LG: 'Lawful Good', NG: 'Neutral Good', CG: 'Chaotic Good',
  LN: 'Lawful Neutral', N: 'True Neutral', CN: 'Chaotic Neutral',
  LE: 'Lawful Evil', NE: 'Neutral Evil', CE: 'Chaotic Evil',
};
const ALIGNMENT_ORDER = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'];
// Eixo moral → classe de cor (bons azuis, neutros roxos, maus vermelhos).
const ALIGNMENT_GROUP = {
  LG: 'alignGood', NG: 'alignGood', CG: 'alignGood',
  LN: 'alignNeutral', N: 'alignNeutral', CN: 'alignNeutral',
  LE: 'alignEvil', NE: 'alignEvil', CE: 'alignEvil',
};

export default function StatsHeader({
  derived,
  character,
  onChangeBaseScore,
  onChangeAlignment,
  onRollHp,
  onAverageHp,
  onChangeHpBonus,
  hpRolled,
}) {
  return (
    <div className={styles.header}>
      <div className={styles.tiles}>
        <LevelTile level={derived.level} classBreakdown={derived.classBreakdown} />
        <HpTile
          maxHp={derived.maxHp}
          classBreakdown={derived.classBreakdown}
          hpBonus={character.hpBonus ?? 0}
          rolled={hpRolled}
          onRoll={onRollHp}
          onAverage={onAverageHp}
          onChangeHpBonus={onChangeHpBonus}
        />
        <AcTile ac={derived.armorClass} />
        <AlignmentTile current={character.identity.alignment} onSelect={onChangeAlignment} />
      </div>

      <div className={styles.abilities}>
        {ABILITIES.map((a) => (
          <AbilityCard
            key={a}
            ability={a}
            total={derived.scores[a]}
            base={character.scores[a]}
            mod={derived.modifiers[a]}
            onStep={(delta) =>
              onChangeBaseScore(a, clamp(character.scores[a] + delta, MIN_SCORE, MAX_SCORE))
            }
          />
        ))}
      </div>
    </div>
  );
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// --- Tiles -------------------------------------------------------------------

function ExpandableTile({ label, value, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? `${styles.tile} ${styles.open}` : styles.tile}>
      <button type="button" className={styles.tileHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.tileChevron}>▾</span>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </button>
      {open && <div className={styles.tileBody}>{children}</div>}
    </div>
  );
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function LevelTile({ level, classBreakdown }) {
  const named = classBreakdown.filter((c) => c.classId);
  return (
    <ExpandableTile label="Level" value={level || '-'}>
      {named.length === 0 ? (
        <p className={styles.emptyNote}>No classes yet.</p>
      ) : (
        named.map((c, i) => (
          <div className={styles.breakRow} key={`${c.classId}-${i}`}>
            <span className={styles.bName}>
              {cap(c.classId)}
              {c.subclassId && <em className={styles.bSub}>{c.subclassId}</em>}
            </span>
            <span className={styles.bVal}>{c.level}</span>
          </div>
        ))
      )}
    </ExpandableTile>
  );
}

function HpTile({ maxHp, classBreakdown, hpBonus, rolled, onRoll, onAverage, onChangeHpBonus }) {
  const named = classBreakdown.filter((c) => c.classId && c.hitDie);
  // HP base = dados de vida (sem CON) + ajuste manual (hpBonus). O stepper edita
  // ESSE valor; internamente vira o offset hpBonus (base − dados). O "Bônus" é a
  // Constituição (e, no futuro, feats como Tough/Draconic Resilience).
  const hitDiceBase = named.reduce((s, c) => s + (c.base ?? 0), 0);
  const conBonus = named.reduce((s, c) => s + (c.con ?? 0), 0);
  const baseValue = hitDiceBase + (hpBonus ?? 0);
  return (
    <ExpandableTile label="Hit Points" value={maxHp ?? '0'}>
      {named.length === 0 ? (
        <p className={styles.emptyNote}>Add a class to track hit points.</p>
      ) : (
        <>
          {/* Base HP: dados + ajuste manual. Stepper edita o valor base direto. */}
          <div className={styles.stepperBlock}>
            <span className={styles.stepLabel}>Base</span>
            <Stepper
              value={baseValue}
              min={0}
              maxDigits={3}
              onChange={(n) => onChangeHpBonus(n - baseValue)}
              ariaLabel="Base hit points"
              {...TILE_STEPPER}
            />
          </div>
          {/* Bônus: quanto do HP vem da Constituição (+ feats no futuro). */}
          <div className={styles.detailRow}>
            <span className={styles.rowLabel}>Constitution</span>
            <span className={styles.rowValue}>{formatBonus(conBonus)}</span>
          </div>
          {named.map((c, i) => (
            <div className={styles.breakRow} key={`${c.classId}-${i}`}>
              <span className={styles.bName}>{cap(c.classId)}</span>
              <span className={styles.die}>
                {c.level}d{c.hitDie}
              </span>
            </div>
          ))}
          <div className={styles.hpButtons}>
            <button
              type="button"
              className={rolled ? styles.hpBtn : `${styles.hpBtn} ${styles.hpBtnActive}`}
              onClick={onAverage}
            >
              Reset
            </button>
            <button
              type="button"
              className={rolled ? `${styles.hpBtn} ${styles.hpBtnActive}` : styles.hpBtn}
              onClick={onRoll}
            >
              Roll
            </button>
          </div>
        </>
      )}
    </ExpandableTile>
  );
}

function AcTile({ ac }) {
  const breakdown = ac?.breakdown ?? [];
  return (
    <ExpandableTile label="Armor Class" value={ac ? ac.total : '-'}>
      {breakdown.length === 0 ? (
        <p className={styles.emptyNote}>Equip armor or a shield to change AC.</p>
      ) : (
        breakdown.map((b, i) => {
          const signed = b.note === 'dex' || b.note === 'item';
          return (
            <div className={styles.breakRow} key={`${b.label}-${i}`}>
              <span className={styles.bName}>{b.label}</span>
              <span className={styles.bVal}>{signed ? formatBonus(b.value) : b.value}</span>
            </div>
          );
        })
      )}
    </ExpandableTile>
  );
}

function AlignmentTile({ current, onSelect }) {
  const [open, setOpen] = useState(false);
  const value = ALIGNMENT_LABEL[current] || 'Unaligned';
  return (
    <div className={open ? `${styles.tile} ${styles.open}` : styles.tile}>
      <button type="button" className={styles.tileHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.tileChevron}>▾</span>
        <span className={`${styles.value} ${styles.small}`}>{value}</span>
        <span className={styles.label}>Alignment</span>
      </button>
      {open && (
        <div className={styles.tileBody}>
          <div className={styles.alignGrid}>
            {ALIGNMENT_ORDER.map((code) => {
              const group = styles[ALIGNMENT_GROUP[code]];
              const cls = `${styles.alignBtn} ${group}${current === code ? ` ${styles.alignSel}` : ''}`;
              // Cada alinhamento é sempre "Eixo1 Eixo2" ("Lawful Good"…) - quebra em
              // 2 linhas quando há espaço (desktop); em telas estreitas mostra só o
              // código (LG…), como antes.
              const [word1, word2] = ALIGNMENT_LABEL[code].split(' ');
              return (
                <button
                  key={code}
                  type="button"
                  title={ALIGNMENT_LABEL[code]}
                  className={cls}
                  onClick={() => onSelect(current === code ? '' : code)}
                >
                  <span className={styles.alignCode}>{code}</span>
                  <span className={styles.alignFull}>
                    <span>{word1}</span>
                    <span>{word2}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Ability card ------------------------------------------------------------

function AbilityCard({ ability, total, base, mod, onStep }) {
  const [open, setOpen] = useState(false);
  const bonus = total - base;

  return (
    <div className={open ? `${styles.ability} ${styles.open}` : styles.ability}>
      <button type="button" className={styles.abilityHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.chevron}>▾</span>
        <span className={styles.name}>{ABILITY_FULL[ability]}</span>
        <span className={styles.total}>{total}</span>
        <span className={styles.mod}>{formatBonus(mod)}</span>
      </button>

      {open && (
        <div className={styles.detail}>
          <div className={styles.stepperBlock}>
            <span className={styles.stepLabel}>Base</span>
            <Stepper
              value={base}
              min={MIN_SCORE}
              max={MAX_SCORE}
              maxDigits={2}
              onChange={(n) => onStep(n - base)}
              ariaLabel={`Base ${ABILITY_FULL[ability]}`}
              {...ABILITY_STEPPER}
            />
          </div>
          <div className={styles.detailRow}>
            <span className={styles.rowLabel}>Bonus</span>
            <span className={styles.rowValue}>{formatBonus(bonus)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.rowLabel}>Modifier</span>
            <span className={styles.rowValue}>{formatBonus(mod)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
