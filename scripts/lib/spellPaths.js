// =============================================================================
// spellPaths: por onde cada magia oferecida passa no jogo, e as que têm dado sem caminho
// =============================================================================
// O QUE FAZ
//   O recorte das magias na régua do lançamento (DDL-0271). Cada magia que o seletor oferece (a mais nova de
//   cada nome) cai num caminho do jogo: rola (dano ou cura pela mecânica do dado), zona, instância leve, estado
//   da arma, forma, efeito curado ou PV temporários. Sem caminho, ela só registra o lançamento: isso basta quando o
//   texto não tem dado (log-ok, P4); com dado na prosa, é lacuna, a menos que o motivo esteja em EXPLAINED.
//
// FUNÇÕES
//   pathOf(spell): o caminho da magia no jogo, ou null.
//   spellRows(db): uma linha por magia oferecida { name, source, path, state, note }.
//
// DECISÕES E ARMADILHAS
//   - "Dado na prosa" é uma tag de dado do 5etools no texto ({@damage}, {@dice}, {@scaledamage}, {@scaledice}).
//   - EXPLAINED nomeia a magia cujo dado é de outra criatura (Bane, Confusion, Silvery Barbs), de uma tabela de mesa
//     (Control Weather) ou um número que o personagem não soma (Time Stop, Blink): o lançamento vai ao histórico e o
//     jogador rola na mesa, como as features `log-ok`. Uma magia nova do espelho com dado e sem caminho aparece como
//     lacuna até alguém decidir.
// -----------------------------------------------------------------------------
import { allSpells } from '../../src/engine/spells.js';
import { latestOnly } from '../../src/selector/reprints.js';
import { spellMechanics } from '../../src/engine/playCatalog.js';
import { isZoneSpell, spellTempFormula } from '../../src/engine/playCast.js';
import { isLightSummon } from '../../src/engine/playSummons.js';
import { weaponRuleOf } from '../../src/engine/playWeapons.js';
import { transformRuleOf } from '../../src/engine/playForms.js';
import { sourceModifier } from '../../src/engine/playEffects.js';

const DICE = /\{@(?:damage|dice|scaledamage|scaledice) /;

const EXPLAINED = {
  'Reweave Fate|AU': 'o reroll e os temporários são de quem falhou o teste (outra criatura)',
  "Fortune's Favor|EGW": 'o d20 a mais é de quem recebe; o lançamento registra e o jogador rola na mesa',
  'Silvery Barbs|SCC': 'o reroll é do inimigo; a vantagem vai a outra criatura',
  'Time Dilation|WoW': 'a redução e a perda de PV são do alvo (outra criatura)',
  'Ceremony|XGE': 'os ritos dão o dado a outras criaturas',
  'Create Homunculus|XGE': 'o 2d4 em si mesmo vai pelo Hurt; o homúnculo não é summon do jogo',
  'Infernal Calling|XGE': 'o diabo é do mestre, não do personagem',
  'Animate Objects|XPHB': 'os objetos animados não têm bloco no bestiário; o lançamento registra',
  'Bane|XPHB': 'o -1d4 é dos inimigos',
  'Blink|XPHB': 'o 1d6 do fim do turno é rolado na mesa; não soma a nada',
  'Confusion|XPHB': 'a tabela é dos alvos',
  'Control Weather|XPHB': 'as tabelas do clima são de mesa',
  'Ray of Enfeeblement|XPHB': 'o efeito é no alvo',
  'Time Stop|XPHB': 'os 1d4 + 1 turnos são rolados na mesa; não somam a nada',
};

/** O caminho da magia no jogo, ou null. */
export function pathOf(spell) {
  const m = spellMechanics(spell, Math.max(1, spell.level));
  if (m.damage?.dice || m.heal?.dice) return 'rola';
  if (isZoneSpell(spell)) return 'zona';
  if (isLightSummon(spell)) return 'instância leve';
  if (weaponRuleOf(spell.name)) return 'arma';
  if (transformRuleOf(spell.name)) return 'forma';
  try {
    if (sourceModifier(spell.name, {})) return 'efeito';
  } catch {
    /* sem efeito curado */
  }
  if (spellTempFormula(spell, spell.level)) return 'temporários';
  if (/\b(?:summon|conjure)\b/i.test(spell.name)) return 'summon';
  return null;
}

/** Uma linha por magia oferecida: o caminho e o estado (ok, log-ok, explained, gap). */
export function spellRows(db) {
  return latestOnly(allSpells(db)).map((s) => {
    const path = pathOf(s);
    const key = `${s.name}|${s.source}`;
    const dice = DICE.test(JSON.stringify([s.entries, s.entriesHigherLevel]));
    const state = path ? 'ok' : !dice ? 'log-ok' : EXPLAINED[key] ? 'explained' : 'gap';
    return { name: s.name, source: s.source, path, state, note: EXPLAINED[key] ?? '' };
  });
}
