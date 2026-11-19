// =============================================================================
// prepareDb: o compêndio pronto para os consumidores (a herança `_copy` dos itens, as correções de magia)
// =============================================================================
// O QUE FAZ
//   Recebe o db como veio da fonte (o cache do app, o pacote do SRD ou o snapshot local dos scripts) e devolve uma
//   cópia rasa com os itens que herdam de outro via `_copy` já completos e as correções de magia aplicadas: a loja, a
//   ficha, o export e o jogo leem o mesmo objeto. Chamado pelo useDataEngine (app) e pelo loadDb (scripts).
//
// FUNÇÕES
//   prepareDb(db): o db com `items.item` resolvido e SPELL_FIXES aplicado, ou o próprio db sem o que mudar.
//   withSpellFixes(db): as magias corrigidas, só nas chaves `spells-*` que têm o que corrigir.
//
// DECISÕES E ARMADILHAS
//   - 90 itens do seletor eram `_copy` sem resolver (o Ashbringer (True State) do WoW, os Ascendant do FTD, as Ashen
//     Band do ICC, os Wave-Swept do EGW): a loja mostrava "Type Other" sem texto e a derivação os lia sem tipo,
//     raridade nem texto (DDL-0267). O pai pode estar entre os itens base, então a resolução corre sobre os itens
//     base mais os itens e devolve só a parte dos itens.
//   - SPELL_FIXES (DDL-0268): o campo de uma magia que diverge do documento do SRD, por decisão do dono. O Flaming
//     Sphere do XPHB veio do 5etools como Evocação e o `spells24` do dnd5e diz Conjuração (TC-0216); o dono escolheu o
//     SRD. Chave `nome|fonte` em minúsculas; só com o `oracle:srd` apontando a diferença.
//   - Puro e sem efeito no objeto recebido: o cache guarda o dado cru, e preparar de novo a cada carga é barato.
// -----------------------------------------------------------------------------

import { resolveCopies } from '../selector/copy';

// ATENÇÃO: só com o oracle:srd apontando a diferença e a decisão do dono registrada num DDL.
const SPELL_FIXES = {
  'flaming sphere|xphb': { school: 'C' },
};

/** As magias corrigidas pelo SPELL_FIXES, só nas chaves `spells-*` que têm o que corrigir. */
function withSpellFixes(db) {
  let out = db;
  for (const [key, value] of Object.entries(db ?? {})) {
    if (!key.startsWith('spells-') || !Array.isArray(value?.spell)) continue;
    const hit = value.spell.some((s) => SPELL_FIXES[`${s.name}|${s.source}`.toLowerCase()]);
    if (!hit) continue;
    const spell = value.spell.map((s) => {
      const fix = SPELL_FIXES[`${s.name}|${s.source}`.toLowerCase()];
      return fix ? { ...s, ...fix } : s;
    });
    out = { ...out, [key]: { ...value, spell } };
  }
  return out;
}

/** O db com a herança `_copy` dos itens resolvida e as magias corrigidas (cópia rasa), ou o próprio db. */
export function prepareDb(db) {
  if (!db) return db;
  let out = withSpellFixes(db);
  const items = out?.items?.item;
  if (Array.isArray(items) && items.some((i) => i?._copy)) {
    const bases = out?.['items-base']?.baseitem ?? [];
    const resolved = resolveCopies([...bases, ...items]).slice(bases.length);
    out = { ...out, items: { ...out.items, item: resolved } };
  }
  return out;
}
