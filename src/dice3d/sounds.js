// =============================================================================
// sounds: os sons dos dados, sintetizados na hora (Web Audio, sem arquivos)
// =============================================================================
// O QUE FAZ
//   Os efeitos sonoros das animações de dados do play mode (DDL-0157): o chocalho
//   enquanto os dados giram, o toque de cada dado parando, o acorde do 20 natural, o
//   tom que cai do 1 natural, o tique de cada bônus somado (que sobe de tom) e o
//   fecho do total. Tudo gerado por osciladores e ruído filtrado.
//
// FUNÇÕES
//   enabled(): o som está ligado (Settings > Dice sounds)?
//   audio(): o AudioContext (criado no primeiro som; o toque do jogador o libera).
//   noise(ac): um trecho curto de ruído branco, guardado.
//   click(ac, at, opts): um estalo de ruído filtrado com envelope.
//   tone(ac, at, opts): uma nota de oscilador com envelope e queda de tom opcional.
//   playRattle(ms, count): o chocalho de `count` dados por `ms` milissegundos.
//   playLand(strength): o toque de um dado parando.
//   playCrit(): o 20 natural.
//   playFumble(): o 1 natural.
//   playTick(step): o tique do bônus número `step` (sobe de tom).
//   playTotal(): o fecho quando o total aparece.
//
// DECISÕES E ARMADILHAS
//   - Sintetizado, não gravado: nada a empacotar nem a creditar, nenhum download, e o
//     timbre não depende de licença de arquivo de som (§6.2).
//   - O AudioContext nasce no primeiro som e é retomado a cada um (o navegador o
//     suspende sem gesto do usuário; toda rolagem nasce de um toque). Sem Web Audio,
//     tudo vira silêncio, nunca erro.
//   - Volume baixo de propósito (MASTER): é a mesa de jogo, não um caça-níquel.
//   - A preferência é lida na hora de tocar, então desligar vale já no próximo som.
// -----------------------------------------------------------------------------

import useSettingsStore from '../store/settingsStore';

const MASTER = 0.35;
let ctx = null;
let noiseBuf = null;

/** O som está ligado? */
function enabled() {
  return useSettingsStore.getState().diceSound !== false;
}

/** O AudioContext, criado e retomado sob demanda; null sem Web Audio. */
function audio() {
  if (!enabled()) return null;
  try {
    if (!ctx) {
      const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Um trecho de ruído branco (80 ms), criado uma vez. */
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = ac.createBuffer(1, Math.round(ac.sampleRate * 0.08), ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** Um estalo de ruído filtrado, em `at` segundos do relógio do áudio. */
function click(ac, at, { freq = 3000, q = 5, type = 'bandpass', gain = 0.3, decay = 0.04 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain * MASTER, at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(filter).connect(env).connect(ac.destination);
  src.start(at);
  src.stop(at + decay + 0.02);
}

/** Uma nota com envelope; `to` faz o tom cair (ou subir) até lá. */
function tone(ac, at, { freq = 440, to = null, type = 'sine', gain = 0.25, attack = 0.005, decay = 0.4 } = {}) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + decay);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain * MASTER, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(env).connect(ac.destination);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** O chocalho dos dados girando: estalos cada vez mais espaçados, por `ms`. */
export function playRattle(ms = 1200, count = 1) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const end = ms / 1000;
  let t = 0;
  let gap = 0.025 / Math.min(3, Math.sqrt(count));
  while (t < end) {
    click(ac, now + t, { freq: 1800 + Math.random() * 2600, q: 4 + Math.random() * 4, gain: 0.12 + Math.random() * 0.12, decay: 0.03 + Math.random() * 0.03 });
    t += gap * (0.6 + Math.random() * 0.8);
    gap *= 1.07;
  }
}

/** O toque de um dado parando: um estalo seco e um baque grave. */
export function playLand(strength = 1) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  click(ac, now, { freq: 1400, q: 1.5, type: 'lowpass', gain: 0.45 * strength, decay: 0.07 });
  tone(ac, now, { freq: 190, to: 90, type: 'sine', gain: 0.35 * strength, decay: 0.12 });
}

/** O 20 natural: um arpejo brilhante que sobe, com um brilho por cima. */
export function playCrit() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(ac, now + i * 0.075, { freq: f, type: 'triangle', gain: 0.3, decay: 0.9 });
    tone(ac, now + i * 0.075, { freq: f * 2, type: 'sine', gain: 0.08, decay: 0.6 });
  });
  for (let i = 0; i < 6; i++) click(ac, now + 0.3 + i * 0.06, { freq: 6000 + Math.random() * 3000, q: 8, gain: 0.08, decay: 0.08 });
}

/** O 1 natural: um tom que cai, abafado, e um baque. */
export function playFumble() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime + 0.03;
  tone(ac, now, { freq: 330, to: 98, type: 'sawtooth', gain: 0.12, attack: 0.01, decay: 0.7 });
  tone(ac, now + 0.08, { freq: 262, to: 82, type: 'triangle', gain: 0.25, attack: 0.01, decay: 0.8 });
  tone(ac, now + 0.02, { freq: 110, to: 55, type: 'sine', gain: 0.4, decay: 0.3 });
}

/** O tique de um bônus somado; cada um mais agudo que o anterior. */
export function playTick(step = 0) {
  const ac = audio();
  if (!ac) return;
  const f = 660 * 2 ** (Math.min(step, 12) * 2 / 12);
  tone(ac, ac.currentTime, { freq: f, type: 'sine', gain: 0.22, decay: 0.12 });
  tone(ac, ac.currentTime, { freq: f * 1.5, type: 'sine', gain: 0.06, decay: 0.08 });
}

/** O fecho quando o total aparece: duas notas curtas. */
export function playTotal() {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  tone(ac, now, { freq: 587.33, type: 'triangle', gain: 0.18, decay: 0.18 });
  tone(ac, now + 0.07, { freq: 880, type: 'triangle', gain: 0.18, decay: 0.3 });
}
