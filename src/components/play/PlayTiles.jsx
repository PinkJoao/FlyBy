// =============================================================================
// PlayTiles: os quatro cards grandes do topo do play mode
// =============================================================================
// O QUE FAZ
//   Os tiles da ficha (o mesmo CSS, StatsHeader.module.css) no lugar da antiga faixa
//   de números: Hit points (expande com Heal, Hurt e Hit dice), Roll initiative (o
//   bônus; rolar começa o combate), Move (expande com os deslocamentos e os botões
//   Move e Dash) e Armor Class (expande com as peças, como na ficha). Em combate, a
//   iniciativa mostra o valor rolado e a rodada, e o Move os pés que sobram no turno.
//
// FUNÇÕES
//   PlayTiles(props): os quatro tiles.
//   RollTile(props): o tile que rola (a iniciativa).
//   ExpandTile(props): um tile que expande ali mesmo (HP, movimento, CA).
//   ActButton(props): um botão do tile aberto (ícone, rótulo, valor e tom).
//
// DECISÕES E ARMADILHAS
//   - A ORDEM é HP, Initiative, Move, Armor Class (DDL-0119), a mesma no desktop
//     (uma linha) e no celular (2x2, lida em linhas): o .playTiles anula a
//     reordenação que o CSS da ficha faz no celular.
//   - `data-flip` marca cada tile pela identidade (tile-hp, tile-ac são os mesmos da
//     ficha): na troca de modo eles deslizam até o lugar novo, e os outros aparecem.
//   - O ícone do canto diz o que o toque faz: o dado rola, a seta para baixo expande
//     ali mesmo. HP e Move expandem como a CA (DDL-0120), e os botões de dentro
//     abrem os painéis. Cada botão tem ícone e um TOM (DDL-0121): a cura verde, o
//     dano vermelho, o resto na cor de destaque; o tom é a variável `--tone`. O
//     botão é Move, não Walk (DDL-0121, adendo): o movimento pode ser a nado, em voo.
//   - Move e Dash só valem em combate (o movimento do turno nasce no Roll
//     initiative); fora dele ficam desativados, sem aviso (o title diz por quê).
//   - Um número mudado por condição ou efeito (CA, deslocamento) leva a cor de
//     destaque, como na antiga faixa de números.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { formatBonus } from '../../engine/math';
import Icon from '../common/Icon';
import Collapse from '../common/Collapse';
import AnimatedNumber from '../common/AnimatedNumber';
import RollButton from './RollButton';
import sheet from '../builder/StatsHeader.module.css';
import styles from './PlayTiles.module.css';

const SPEED_LABEL = { walk: 'Walk', fly: 'Fly', swim: 'Swim', climb: 'Climb', burrow: 'Burrow' };

/** O tile que rola: o dado no canto, o valor e o rótulo. */
function RollTile({ value, label, onRoll, title, flip }) {
  return (
    <div className={sheet.tile} data-flip={flip}>
      <RollButton className={sheet.tileHead} title={title} onRoll={onRoll}>
        <span className={`${sheet.tileChevron} ${styles.icon}`}><Icon name="dice" /></span>
        <span className={sheet.value}>{value}</span>
        <span className={sheet.label}>{label}</span>
      </RollButton>
    </div>
  );
}

/** Um tile que expande ali mesmo, com o corpo dado. */
function ExpandTile({ value, label, note, changed, flip, title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? `${sheet.tile} ${sheet.open}` : sheet.tile} data-flip={flip}>
      <button type="button" className={sheet.tileHead} onClick={() => setOpen((v) => !v)} aria-expanded={open} title={title}>
        <span className={sheet.tileChevron}><Icon name="chevron" /></span>
        <span className={changed ? `${sheet.value} ${styles.changed}` : sheet.value}>{value}</span>
        <span className={sheet.label}>{label}</span>
        {note && <span className={styles.note}>{note}</span>}
      </button>
      <Collapse open={open}>
        <div className={sheet.tileBody}>{children}</div>
      </Collapse>
    </div>
  );
}

/** Um botão do tile aberto: o ícone, o rótulo, o valor à direita e o tom. */
function ActButton({ icon, label, value, tone = 'neutral', onClick, disabled, title }) {
  return (
    <button type="button" className={`${styles.act} ${styles[tone]}`} onClick={onClick} disabled={disabled} title={title}>
      <span className={styles.actIcon} aria-hidden="true"><Icon name={icon} /></span>
      <span className={styles.actLabel}>{label}</span>
      {value != null && <span className={styles.actValue}>{value}</span>}
    </button>
  );
}

/**
 * Os quatro tiles do topo.
 * @param {{ hp: object, hitDice: object[], initiative: number, combat: object|null, ac: number|null, baseAc: number|null, acBreakdown: object[], acEffects: object[], speed: number|null, baseSpeed: number|null, speeds: object, moveLeft: number|null, onInitiative: Function, onHeal: Function, onHurt: Function, onHitDice: Function, onMove: Function, onDash: Function, dataTour?: string }} props
 */
export default function PlayTiles({
  hp, hitDice, initiative, combat, ac, baseAc, acBreakdown, acEffects, speed, baseSpeed, speeds, moveLeft,
  onInitiative, onHeal, onHurt, onHitDice, onMove, onDash, dataTour,
}) {
  const diceLeft = hitDice.reduce((s, d) => s + d.left, 0);
  const diceMax = hitDice.reduce((s, d) => s + d.max, 0);
  const modes = Object.keys(SPEED_LABEL).filter((m) => speeds?.[m]);
  return (
    <div className={`${sheet.tiles} ${styles.playTiles}`} data-tour={dataTour}>
      <ExpandTile
        flip="tile-hp"
        value={<><AnimatedNumber value={hp.current} /><span className={styles.max}>/{hp.max}</span></>}
        label="Hit Points"
        note={hp.temp > 0 ? `+${hp.temp} temporary` : null}
        title="Heal, hurt or spend hit dice"
      >
        <div className={styles.acts}>
          <ActButton icon="heal" tone="heal" label="Heal" onClick={onHeal} title="Heal, temporary hit points or a higher maximum" />
          <ActButton icon="hurt" tone="hurt" label="Hurt" onClick={onHurt} title="Damage taken" />
          <ActButton icon="hitDice" label="Hit dice" value={diceMax ? `${diceLeft}/${diceMax}` : null} onClick={onHitDice} title="Spend hit dice to heal, or give spent ones back" />
        </div>
      </ExpandTile>
      <RollTile
        flip="tile-init"
        value={combat ? combat.initiative : formatBonus(initiative)}
        label={combat ? `Initiative · round ${combat.round}` : 'Roll initiative'}
        title={combat ? 'Roll initiative again (combat goes on)' : 'Roll initiative and start combat'}
        onRoll={onInitiative}
      />
      <ExpandTile
        flip="tile-move"
        value={speed == null ? '-' : `${combat ? moveLeft : speed} ft`}
        label={combat ? 'Move · left this turn' : 'Move'}
        changed={speed !== baseSpeed || (combat && moveLeft < 0)}
        title="Your speeds, and your movement this turn in combat"
      >
        {modes.length === 0 && <p className={sheet.emptyNote}>No speed on the sheet yet (it comes from the species).</p>}
        {modes.map((m) => (
          <div className={sheet.breakRow} key={m}>
            <span className={sheet.bName}>{SPEED_LABEL[m]}</span>
            <span className={speeds[m].feet !== speeds[m].base ? `${sheet.bVal} ${styles.changed}` : sheet.bVal}>{speeds[m].feet} ft</span>
          </div>
        ))}
        <div className={styles.acts}>
          <ActButton icon="move" label="Move" value={combat ? `${moveLeft} ft` : null} onClick={onMove} disabled={!combat} title={combat ? 'Move this turn (any speed)' : 'In combat (roll initiative first)'} />
          <ActButton icon="dash" label="Dash" value={combat && speed ? `+${speed}` : null} onClick={onDash} disabled={!combat} title={combat ? 'Dash: one more move this turn (uses your action)' : 'In combat (roll initiative first)'} />
        </div>
      </ExpandTile>
      <ExpandTile flip="tile-ac" value={ac ?? '-'} label="Armor Class" changed={ac !== baseAc}>
        {acBreakdown.length === 0 && acEffects.length === 0 && <p className={sheet.emptyNote}>Equip armor or a shield in the sheet to change AC.</p>}
        {acBreakdown.map((b, i) => (
          <div className={sheet.breakRow} key={`${b.label}-${i}`}>
            <span className={sheet.bName}>{b.label}</span>
            <span className={sheet.bVal}>{b.note === 'dex' || b.note === 'item' ? formatBonus(b.value) : b.value}</span>
          </div>
        ))}
        {acEffects.map((e) => (
          <div className={sheet.breakRow} key={e.label}>
            <span className={sheet.bName}>{e.label}</span>
            <span className={`${sheet.bVal} ${styles.changed}`}>{formatBonus(e.value)}</span>
          </div>
        ))}
      </ExpandTile>
    </div>
  );
}
