// =============================================================================
// itemEffects: o que um item mágico ativo muda na ficha
// =============================================================================
// O QUE FAZ
//   Lê os campos estruturados do 5etools dos itens ATIVOS (equipados; atunados quando pedem
//   atunamento) e devolve o que a derivação aplica: os atributos (`ability`: "fixa em N" e
//   "+N"), o bônus no ataque e na CD de magia (`bonusSpellAttack`, `bonusSpellSaveDc`, por
//   classe quando o texto restringe), o bônus nos testes de atributo (`bonusAbilityCheck`) e
//   os deslocamentos sempre ligados (`modifySpeed`). Puro: quem chama é o resolve e o catálogo
//   do jogo (DDL-0256).
//
// FUNÇÕES
//   isActiveItem(entry): o item vale agora (atunado; ou equipado se não pede atunamento)?
//   bonusOf(value): o número de "+2", 2 ou "-1".
//   plainItemText(raw): o texto do item sem as tags (a classe vem como "{@filter warlock spells|...}").
//   abilityCapOf(raw): o teto do "+N" pelo texto ("to a maximum of 24"), ou 20.
//   itemAbilityEffects(entries): os aumentos `{ ability, amount, max, source }` e os pisos
//     `{ ability, set, source }` dos itens ativos.
//   spellClassOf(raw): a classe a que o texto restringe o bônus de magia ("your warlock spells"), ou null.
//   itemSpellBonuses(entries): os bônus de ataque e CD de magia `{ source, attack, dc, cls }`.
//   itemCheckBonus(entries): o bônus plano nos testes de atributo `{ bonus, sources }`.
//   speedActivated(raw): o deslocamento do item só vale ao ativar (cargas, consumível, multiplicar)?
//   itemSpeeds(entries, walk): os deslocamentos sempre ligados `{ mode: { feet, note } }`.
//
// DECISÕES E ARMADILHAS
//   - "Fixa em N" (Amulet of Health, os Belts of Giant Strength) é um PISO: o texto diz que não faz nada
//     se o atributo já é N ou mais; vai em `set` e o finalScores aplica depois dos aumentos.
//   - "+N" (Ioun Stones, Belt of Dwarvenkind) respeita o teto que o texto dá; sem teto no texto, 20.
//   - A escolha de atributo de item (`choose`: Ashen Band, Book of Vile Darkness, os baralhos) não tem onde
//     ficar guardada; fica fora (o texto diz) até ter uma escolha no inventário.
//   - O bônus de magia restrito ("the spell attack rolls and saving throw DCs of your warlock spells", Rod of
//     the Pact Keeper) vale só na origem daquela classe; sem classe no texto, em toda origem.
//   - Deslocamento de ativação (Boots of Speed multiplica ao bater os calcanhares, Winged Boots gasta cargas,
//     a poção é consumível) NÃO entra na ficha: é estado de jogo, e o item já tem o seu Use ou as cargas.
//   - O export escreve o atributo SEM os itens (`baseScores` no resolve): o item no Foundry leva o próprio
//     efeito, e somar os dois duplicaria o "+2".
// -----------------------------------------------------------------------------

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const CLASS_WORDS = ['artificer', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];

/** O item vale agora? Atunado; ou equipado, se não pede atunamento. */
export function isActiveItem(entry) {
  if (!entry?.raw) return false;
  if (entry.attuned) return true;
  if (entry.required || entry.raw.reqAttune) return false;
  return !!entry.equipped;
}

/** O número de "+2", 2 ou "-1". */
export function bonusOf(value) {
  if (typeof value === 'number') return value;
  const n = parseInt(String(value ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** O texto do item sem as tags do 5etools ("{@filter warlock spells|...}" vira "warlock spells"). */
export function plainItemText(raw) {
  return JSON.stringify(raw?.entries ?? []).replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1');
}

/** O teto do "+N" pelo texto do item ("to a maximum of 24"), ou 20. */
export function abilityCapOf(raw) {
  const m = plainItemText(raw).match(/to a maximum of (\d+)/i);
  return m ? Number(m[1]) : 20;
}

/** Os aumentos e os pisos de atributo dos itens ativos. */
export function itemAbilityEffects(entries = []) {
  const out = [];
  for (const e of entries) {
    const ab = e?.raw?.ability;
    if (!ab || !isActiveItem(e)) continue;
    const source = e.raw.name;
    for (const [a, v] of Object.entries(ab.static ?? {})) if (ABILITY_KEYS.includes(a)) out.push({ ability: a, set: Number(v) || 0, source });
    const cap = abilityCapOf(e.raw);
    for (const a of ABILITY_KEYS) if (typeof ab[a] === 'number') out.push({ ability: a, amount: ab[a], max: cap, source });
  }
  return out;
}

/** A classe a que o texto do item restringe o bônus de magia, ou null. */
export function spellClassOf(raw) {
  const text = plainItemText(raw).toLowerCase();
  const m = text.match(new RegExp(`\\byour (${CLASS_WORDS.join('|')}) spells\\b`));
  return m ? m[1] : null;
}

/** Os bônus de ataque e CD de magia dos itens ativos. */
export function itemSpellBonuses(entries = []) {
  const out = [];
  for (const e of entries) {
    const r = e?.raw;
    if (!r || (!r.bonusSpellAttack && !r.bonusSpellSaveDc) || !isActiveItem(e)) continue;
    out.push({ source: r.name, attack: bonusOf(r.bonusSpellAttack), dc: bonusOf(r.bonusSpellSaveDc), cls: spellClassOf(r) });
  }
  return out;
}

/** O bônus plano nos testes de atributo dos itens ativos. */
export function itemCheckBonus(entries = []) {
  let bonus = 0;
  const sources = [];
  for (const e of entries) {
    const b = bonusOf(e?.raw?.bonusAbilityCheck);
    if (!b || !isActiveItem(e)) continue;
    bonus += b;
    sources.push({ name: e.raw.name, value: b });
  }
  return { bonus, sources };
}

/** O deslocamento do item só vale ao ativar (cargas, consumível, multiplicar)? */
export function speedActivated(raw) {
  return !!(raw?.charges || raw?.type === 'P' || String(raw?.type ?? '').startsWith('P|') || raw?.modifySpeed?.multiply);
}

/** Os deslocamentos sempre ligados dos itens ativos: { mode: { feet, note } }. */
export function itemSpeeds(entries = [], walk = 0) {
  const out = {};
  const put = (mode, feet, note) => {
    if (feet > 0 && !(out[mode]?.feet >= feet)) out[mode] = { feet, note };
  };
  for (const e of entries) {
    const ms = e?.raw?.modifySpeed;
    if (!ms || !isActiveItem(e) || speedActivated(e.raw)) continue;
    for (const [mode, v] of Object.entries(ms.equal ?? {})) if (v === 'walk') put(mode, walk, e.raw.name);
    for (const [mode, v] of Object.entries(ms.static ?? {})) put(mode, Number(v) || 0, e.raw.name);
    if (ms.bonus) for (const [mode, v] of Object.entries(ms.bonus)) put(mode === '*' ? 'walk' : mode, walk + (Number(v) || 0), e.raw.name);
  }
  return out;
}
