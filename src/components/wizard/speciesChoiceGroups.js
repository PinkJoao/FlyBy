// =============================================================================
// speciesChoiceGroups: as escolhas da espécie agrupadas pelo traço que as pede
// =============================================================================
// O QUE FAZ
//   A página de escolhas da espécie no guia (DDL-0290) mostra cada escolha (perícia,
//   talento, atributo de conjuração, lista de magias, tamanho...) com o texto que a
//   explica: o do traço da espécie que a pede (Keen Senses, Versatile, Elven Lineage)
//   ou, sem traço, um texto curto do app (o tamanho).
//
// FUNÇÕES
//   entryText(entry): o texto de um entry, para casar as pistas.
//   speciesChoiceGroups(raceObj, choices, lineageName): os grupos { key, entry, choices,
//     lineage } na ordem das escolhas; `entry` é o traço que as pede, ou null (tamanho, ou
//     sem traço achado); `lineage` marca o grupo do traço da linhagem.
//   lineageTrait(raceObj, label): o traço da linhagem ("Elven Lineage"), pelo nome que
//     o seletor de linhagem usa.
//
// DECISÕES E ARMADILHAS
//   - O traço é achado pelo TEXTO, com uma pista por tipo de escolha (CUES); a perícia
//     ainda pede "proficien", senão um traço que só cita uma perícia a roubaria.
//   - O traço da LINHAGEM ("Elven Lineage") cita perícia e proficiência também e vem antes
//     no texto: só as escolhas de conjuração (LINEAGE_KINDS) podem cair nele; as outras
//     procuram nos demais traços primeiro (o Keen Senses do elfo).
//   - O tamanho de 2024 é um campo, não um traço: sem um entry chamado "Size" (2014), o
//     grupo fica sem traço e a página mostra o texto curto do app.
// -----------------------------------------------------------------------------

const CUES = {
  skill: /\bskills?\b/i,
  tool: /\btools?\b/i,
  language: /\blanguages?\b/i,
  feat: /\{@feat|\bfeat\b/i,
  spellAbility: /spellcasting ability/i,
  spellSet: /spellcasting ability|lineage|legacy/i,
  spell: /\{@spell|\bcantrip\b|\bspell\b/i,
  resist: /resistan/i,
  ability: /ability score/i,
};

const LINEAGE_KINDS = new Set(['spellAbility', 'spellSet', 'spell']);

/** O texto de um entry, para casar as pistas. */
function entryText(entry) {
  return JSON.stringify(entry?.entries ?? entry ?? '');
}

/** As escolhas agrupadas pelo traço da espécie que as pede. */
export function speciesChoiceGroups(raceObj, choices, lineageName = null) {
  const want = String(lineageName ?? '').toLowerCase();
  const isLineage = (e) => !!want && String(e.name).toLowerCase() === want;
  const all = (raceObj?.entries ?? []).filter((e) => e && typeof e === 'object' && e.name);
  const groups = [];
  const byKey = new Map();
  for (const c of choices ?? []) {
    let entry = null;
    if (c.kind === 'size') {
      entry = all.find((e) => /^size$/i.test(e.name)) ?? null;
    } else if (CUES[c.kind]) {
      const named = LINEAGE_KINDS.has(c.kind)
        ? [...all.filter(isLineage), ...all.filter((e) => !isLineage(e))]
        : all.filter((e) => !isLineage(e));
      entry =
        named.find((e) => {
          const t = entryText(e);
          return CUES[c.kind].test(t) && (c.kind !== 'skill' || /proficien/i.test(t));
        }) ?? null;
    }
    const key = entry ? `trait:${entry.name}` : c.kind === 'size' ? 'size' : 'other';
    if (!byKey.has(key)) {
      const group = { key, entry, choices: [], lineage: !!entry && isLineage(entry) };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).choices.push(c);
  }
  return groups;
}

/** O traço da linhagem ("Elven Lineage"), pelo nome que o seletor de linhagem usa. */
export function lineageTrait(raceObj, label) {
  const want = String(label ?? '').toLowerCase();
  return (raceObj?.entries ?? []).find((e) => e && typeof e === 'object' && String(e.name ?? '').toLowerCase() === want) ?? null;
}
