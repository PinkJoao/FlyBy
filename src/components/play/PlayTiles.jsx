// =============================================================================
// PlayTiles: os quatro cards grandes do topo do play mode
// =============================================================================
// O QUE FAZ
//   Os tiles da ficha (o mesmo CSS, StatsHeader.module.css) no lugar da antiga faixa
//   de números: Roll initiative (o bônus; rolar começa o combate), Hit points (abre
//   o painel de dano e cura), Armor Class (expande com as peças, como na ficha) e
//   Move (o deslocamento; abre o painel de movimento). Em combate, a iniciativa
//   mostra o valor rolado e a rodada, e o Move os pés que sobram no turno.
//
// FUNÇÕES
//   PlayTiles(props): os quatro tiles.
//   ActionTile(props): um tile que é um botão (iniciativa, HP, movimento).
//   AcTile(props): a CA, expansível com as peças.
//
// DECISÕES E ARMADILHAS
//   - A ORDEM do DOM é a da ficha (Level, HP, AC, Alignment), com a iniciativa no
//     lugar do nível e o Move no do alinhamento: o CSS da ficha põe os dois em cima
//     e HP e CA lado a lado embaixo no celular, sem regra nova.
//   - O ícone do canto diz o que o toque faz: o dado rola, a seta para o lado abre
//     uma janela, a seta para baixo expande ali mesmo.
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

/** Um tile que é um botão: o ícone no canto, o valor e o rótulo. */
function ActionTile({ icon, value, label, note, changed, onClick, onRoll, title }) {
  const content = (
    <>
      <span className={`${sheet.tileChevron} ${styles.icon}`}><Icon name={icon} /></span>
      <span className={changed ? `${sheet.value} ${styles.changed}` : sheet.value}>{value}</span>
      <span className={sheet.label}>{label}</span>
      {note && <span className={styles.note}>{note}</span>}
    </>
  );
  return (
    <div className={sheet.tile}>
      {onRoll ? (
        <RollButton className={sheet.tileHead} title={title} onRoll={onRoll}>{content}</RollButton>
      ) : (
        <button type="button" className={sheet.tileHead} title={title} onClick={onClick}>{content}</button>
      )}
    </div>
  );
}

/** A CA: o valor (com os efeitos) e, aberta, as peças da ficha e dos efeitos. */
function AcTile({ ac, base, breakdown, effects }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? `${sheet.tile} ${sheet.open}` : sheet.tile}>
      <button type="button" className={sheet.tileHead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={sheet.tileChevron}><Icon name="chevron" /></span>
        <span className={ac !== base ? `${sheet.value} ${styles.changed}` : sheet.value}>{ac ?? '-'}</span>
        <span className={sheet.label}>Armor Class</span>
      </button>
      <Collapse open={open}>
        <div className={sheet.tileBody}>
          {breakdown.length === 0 && effects.length === 0 && <p className={sheet.emptyNote}>Equip armor or a shield in the sheet to change AC.</p>}
          {breakdown.map((b, i) => (
            <div className={sheet.breakRow} key={`${b.label}-${i}`}>
              <span className={sheet.bName}>{b.label}</span>
              <span className={sheet.bVal}>{b.note === 'dex' || b.note === 'item' ? formatBonus(b.value) : b.value}</span>
            </div>
          ))}
          {effects.map((e) => (
            <div className={sheet.breakRow} key={e.label}>
              <span className={sheet.bName}>{e.label}</span>
              <span className={`${sheet.bVal} ${styles.changed}`}>{formatBonus(e.value)}</span>
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * Os quatro tiles do topo.
 * @param {{ hp: object, initiative: number, combat: object|null, ac: number|null, baseAc: number|null, acBreakdown: object[], acEffects: object[], speed: number|null, baseSpeed: number|null, moveLeft: number|null, onInitiative: Function, onHp: Function, onMove: Function, dataTour?: string }} props
 */
export default function PlayTiles({ hp, initiative, combat, ac, baseAc, acBreakdown, acEffects, speed, baseSpeed, moveLeft, onInitiative, onHp, onMove, dataTour }) {
  return (
    <div className={`${sheet.tiles} ${styles.tiles}`} data-tour={dataTour}>
      <ActionTile
        icon="dice"
        value={combat ? combat.initiative : formatBonus(initiative)}
        label={combat ? `Initiative · round ${combat.round}` : 'Roll initiative'}
        title={combat ? 'Roll initiative again (combat goes on)' : 'Roll initiative and start combat'}
        onRoll={onInitiative}
      />
      <ActionTile
        icon="chevronRight"
        value={<><AnimatedNumber value={hp.current} /><span className={styles.max}>/{hp.max}</span></>}
        label="Hit Points"
        note={hp.temp > 0 ? `+${hp.temp} temporary` : null}
        title="Damage, healing or temporary hit points"
        onClick={onHp}
      />
      <AcTile ac={ac} base={baseAc} breakdown={acBreakdown} effects={acEffects} />
      <ActionTile
        icon="chevronRight"
        value={speed == null ? '-' : `${combat ? moveLeft : speed} ft`}
        label={combat ? 'Move · left this turn' : 'Move'}
        changed={speed !== baseSpeed || (combat && moveLeft < 0)}
        title="Your speeds, and your movement this turn in combat"
        onClick={onMove}
      />
    </div>
  );
}
