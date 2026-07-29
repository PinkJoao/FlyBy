// =============================================================================
// premadeDiff - o oráculo de EXPORT da Fase T2 (TESTING-PLAN.md §5)
// =============================================================================
// A T2 certifica o EXPORT/IMPORT Foundry. O gabarito são as 48 fichas premade
// oficiais (12 personagens × níveis 1/5/11/17) em `DnD Source Material/Character
// Sheets in JSON/Standard Premade Characters` - documentos gerados pelo próprio
// sistema dnd5e, portanto a verdade de esquema (DDL-0001).
//
// O oráculo é o CICLO COMPLETO sobre um premade:
//     P --foundryToCharacter--> C --assembleFoundryActor--> A ,  depois A × P.
// Uma divergência tem três causas possíveis e a triagem DEVE dizer qual:
//   (a) nosso EXPORT não emite o que o Foundry espera;
//   (b) nosso IMPORT perdeu a decisão no caminho (o premade a tinha);
//   (c) diferença DELIBERADA do nosso modelo (então entra na lista de ignorados
//       abaixo, com o porquê - nunca fica como "ruído" solto).
// É complementar ao round-trip do sweep (que compara DECISÕES nossas ida-e-volta
// e por isso não vê nada que nunca foi exportado, nem o que só um documento
// oficial revela).
//
// Cada achado carrega uma CLASSE estável (`cat`) para agregar as 48 fichas e
// triar uma vez por classe de problema, em vez de linha a linha.
// -----------------------------------------------------------------------------

import { srdSpellNames } from '../../src/engine/spells';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/**
 * DIFERENÇAS DELIBERADAS - o que o comparador NÃO reporta, e por quê. Uma
 * entrada nova aqui precisa de justificativa; sem isso é bug disfarçado.
 *
 * - **Nome do background.** O FlyBy só tem origens CUSTOM (README/§1): o item de
 *   background sai como "Custom Background" em vez de "Vigilante". A MECÂNICA
 *   dele (boosts, perícias, ferramenta, idiomas, talento) É comparada.
 * - **Ids, `_stats` (exceto `compendiumSource`), `img`, `sort`, `ownership`,
 *   `folder`, `flags`.** Identidade de documento, não conteúdo.
 * - **Prosa** (`description`, `biography`): o premade traz HTML editorial com
 *   links/creditos; comparar texto seria ruído puro.
 * - **Estado de sessão:** `hp.value`, `spellN.value`, `uses.spent`, `death`,
 *   `exhaustion`, `inspiration` - o export nasce "descansado" de propósito.
 * - (nada mais sobre `container`: desde 2026-07-29 um pack É exportado como
 *   contêiner + conteúdo, como nos atores oficiais - ver C4 do DEFERRED-REVIEW.)
 * - **`attributes.senses` / `movement`.** O Foundry DERIVA de Active Effects; os
 *   dois lados guardam null.
 */
export const DELIBERATE = [
  'background item name (custom origins only)',
  'the class-granted "Unarmed Strike" (we grant it to EVERY class - see DDL-0080)',
  'document identity (_id/_stats/img/sort/ownership/folder/flags)',
  'prose (description/biography HTML)',
  'session state (hp.value, spell slots value, uses.spent, death, exhaustion)',
  'senses/movement (derived by Foundry from effects)',
  'spellcasting progression artificer == half (identical in the dnd5e config)',
];

/**
 * ESPERADAS: divergências REAIS mas já investigadas, em que a nossa saída está
 * certa (ou é equivalente) e não vai mudar. Ficam FORA da contagem de achados e
 * são impressas à parte - contadas e nomeadas, nunca escondidas (mesmo espírito
 * dos WAIVERS do sweep). Uma entrada só entra aqui com o motivo verificado.
 */
export const EXPECTED = [
  {
    id: 'baked-feature-grant',
    why:
      'O premade deixa a proficiência concedida por uma feature a cargo de um Active Effect '
      + '(Divine Order Protector → mar/hvy, Primal Order Warden → med, Disciplined Survivor → '
      + 'flags.dnd5e.diamondSoul = todas as salvaguardas); nós a assamos no ator, que é o que a '
      + 'nossa própria derivação usa na ficha. Runtime idêntico - proficiência é flag, não soma.',
    test: (f) =>
      (f.cat === 'saves' && f.before === 0 && f.after === 1)
      || (['traits.weaponProf', 'traits.armorProf'].includes(f.cat)
        && Array.isArray(f.before) && Array.isArray(f.after)
        && f.before.length === 0
        && f.after.length > 0
        && f.after.every((v) => ['mar', 'hvy', 'med'].includes(v))),
  },
  {
    id: 'capstone-asi-on-class-item',
    why:
      'O aumento de atributo do capstone (Primal Champion, Body and Mind) vira um '
      + 'AbilityScoreImprovement no item de CLASSE. O próprio SRD usa as duas formas - no Monge '
      + 'ele está no item de classe (como o nosso), no Bárbaro no item da FEATURE -, então o passo '
      + 'a mais no item de classe do Bárbaro é escolha de forma, não lacuna.',
    test: (f) =>
      f.cat === 'advancement.class'
      && Array.isArray(f.after)
      && f.after.some((x) => String(x).startsWith('AbilityScoreImprovement@20'))
      && (f.before ?? []).length === 0,
  },
  {
    id: 'curated-swap-lineage',
    why:
      'Os guarda-chuvas "Halfling Lineage" e "Dwarf Lineage" são acréscimo NOSSO (DDL-0063): o livro '
      + '2024 absorveu na base o traço de UMA das sub-raças 2014 (Naturally Stealthy do Lightfoot, '
      + 'Dwarven Toughness do Hill) e deixou as outras de fora; nós o devolvemos como escolha. O '
      + 'documento do dnd5e não tem essa linhagem, então o item sai com o nosso nome e sem '
      + 'procedência - apontar para o "Halfling"/"Dwarf" publicado faria o Foundry oferecer '
      + '"atualizar do compêndio" e trocar a linhagem escolhida pela base.',
    test: (f) => {
      const swaps = ['halfling', 'dwarf'];
      // O item de RAÇA: o premade tem a espécie nua, nós a linhagem.
      if (f.cat === 'items.race') {
        return swaps.some(
          (base) => (f.before ?? []).includes(base) && (f.after ?? []).some((n) => String(n).startsWith(`${base};`)),
        );
      }
      // E o TRAÇO: onde o premade tem o traço que a base absorveu, nós temos o
      // guarda-chuva ("Halfling Lineage (Lightfoot)", "Dwarf Lineage (Hill)").
      return (
        f.cat === 'items.feat'
        && (f.after ?? []).some((n) => swaps.some((base) => String(n).startsWith(`${base} lineage`)))
      );
    },
  },
  {
    id: 'pack-contents-from-data',
    why:
      'O conteúdo de um pack sai do `packContents` do 5etools, que segue o livro. O premade é '
      + "CURADO à mão e omite itens: o Explorer's Pack do Aoth vem sem as 10 tochas que o PHB 2024 "
      + 'lista. Seguir o premade tiraria do jogador equipamento que ele comprou.',
    test: (f) =>
      f.cat === 'items.gear'
      && (f.before ?? []).length === 0
      && (f.after ?? []).length > 0,
  },
  {
    id: 'srd-item-name-variant',
    why:
      'O SRD publica DOIS documentos para a mesma lanterna ("Bullseye Lantern" e "Lantern, '
      + 'Bullseye"); usamos a grafia do 5etools, que resolve para um uuid real - não há link perdido, '
      + 'só uma escolha entre dois nomes que existem.',
    test: (f) => {
      if (f.cat !== 'items.gear') return false;
      // O mesmo item com as duas metades do nome invertidas ("lantern, hooded" x
      // "hooded lantern"): as palavras coincidem, a ordem não.
      const words = (n) => String(n).toLowerCase().split(/[,\s]+/).filter(Boolean).sort().join(' ');
      const b = (f.before ?? []).map(words);
      const a = (f.after ?? []).map(words);
      return b.length > 0 && a.length > 0 && b.every((x) => a.includes(x)) && a.every((x) => b.includes(x));
    },
  },
  {
    id: 'invocation-spell-copy',
    why:
      'O premade do Warlock emite uma CÓPIA do cantrip por invocação que o modifica ("Eldritch Blast '
      + '(Repelling)"), além do original. No nosso modelo a invocação é uma feature própria (item de '
      + 'optional feature) e o cantrip é UM só - que é a forma do livro. Emitir a cópia significaria '
      + 'inventar um documento de magia por invocação, e o jogador teria duas linhas do mesmo cantrip '
      + 'na Spellbook.',
    test: (f) =>
      f.cat === 'items.spell'
      && (f.after ?? []).length === 0
      && (f.before ?? []).length > 0
      && (f.before ?? []).every((n) => /\(.+\)$/.test(String(n))),
  },
  {
    id: 'race-grant-level-convention',
    why:
      'O SRD não é consistente consigo mesmo sobre em QUE nível pendurar uma concessão de criação: '
      + 'o passo de nível 1 é `@0` no Gnome e `@1` no Elfo, e a resistência da linhagem é `Trait@0` '
      + 'no Dragonborn e `Trait@1` no Tiefling. Não há regra derivável, e o Foundry concede a mesma '
      + 'coisa nos dois casos (é tudo criação de personagem). Nossa convenção - nível 0 para o que '
      + 'vem na criação, o nível real para o resto - é mais coerente, e acertar a do SRD exigiria '
      + 'uma tabela por espécie: dívida de curadoria crescente para zero efeito.',
    test: (f) => {
      if (f.cat !== 'advancement.race') return false;
      const before = f.before ?? [];
      const after = f.after ?? [];
      const type = (s) => String(s).split('@')[0];
      // (a) o MESMO passo, em níveis 0/1 diferentes.
      if (before.length === 1 && after.length === 1 && type(before[0]) === type(after[0])) {
        return [before[0], after[0]].every((s) => /@[01]$/.test(s));
      }
      // (b) um passo de concessão a MAIS do nosso lado, no nível 1 (o SRD o pôs
      //     no 0, onde os dois lados já têm um passo - por isso nada falta).
      return before.length === 0 && after.length === 1 && /^ItemGrant@1$/.test(after[0]);
    },
  },
  {
    id: 'universal-unarmed-strike',
    why:
      'O SRD concede o item "Unarmed Strike" só ao Bárbaro e ao Monge, cujas features o citam. Mas '
      + 'a regra 2024 diz que TODA criatura pode fazer um Ataque Desarmado, e sem o item um Mago que '
      + 'perdeu o cajado chega ao Foundry sem botão nenhum de ataque - seguir o SRD aqui penalizaria '
      + 'o jogador. Concedemos a TODA classe, com a cópia genérica do equipment24 e num passo de '
      + 'advancement de título próprio, para não se passar pela escada oficial.',
    test: (f) =>
      f.cat === 'items.gear'
      && (f.before ?? []).length === 0
      && JSON.stringify(f.after ?? []) === JSON.stringify(['unarmed strike']),
  },
  {
    id: 'class-spell-ladder',
    why:
      'A escada de ItemGrant das magias que a CLASSE concede por nível: nós a emitimos para os '
      + 'níveis futuros de toda classe, o SRD só a tem no Paladino. Sem ela, subir de nível dentro '
      + 'do Foundry não concede a magia (o Power Word Heal do Bardo 20, o Contact Other Plane do '
      + 'Warlock 9). O passo a mais concede exatamente o que a classe concede - é cobertura, '
      + 'não divergência de regra.',
    test: (f) =>
      f.cat === 'advancement.class.grants'
      && typeof f.before === 'number'
      && typeof f.after === 'number'
      && f.after > f.before,
  },
];

const norm = (s) => String(s ?? '').trim().toLowerCase();
/** Nome comparável de item: minúsculo, sem sufixo de repetição "(2)". */
export const itemKey = (name) => norm(name).replace(/\s*\(\d+\)$/, '');

/**
 * Nome comparável de MAGIA. O SRD tira o nome próprio do mago do título (é
 * Product Identity), então o premade diz "Hideous Laughter" onde nós, que
 * transcrevemos o livro pelo 5etools, dizemos "Tasha's Hideous Laughter" - a
 * MESMA magia, mesmo círculo e mesma escola (verificado um a um contra o pacote
 * spells24 ao fechar o TC-0079). Comparar a grafia faria o oráculo acusar 26
 * falsos positivos e esconder as ausências de verdade, então os dois lados são
 * reduzidos ao nome curto.
 *
 * A redução é a MESMA dos dois lados, então ela nunca inventa uma coincidência:
 * no máximo dois títulos diferentes cairiam na mesma chave (o "Jim's Magic
 * Missile" de Acquisitions Inc. colide com "Magic Missile"), e aí vale a regra
 * de homônimo do `itemsByType` - o primeiro vence. Nenhum premade traz o caso.
 */
export const spellKey = (name) => srdSpellNames(itemKey(name)).at(-1) ?? itemKey(name);

const keyFor = (type, name) => (type === 'spell' ? spellKey(name) : itemKey(name));

const setDiff = (a, b) => [...new Set(a)].filter((x) => !new Set(b).has(x)).sort();

/**
 * Proficiências de arma comparáveis. Quem tem `sim` E `mar` é proficiente com
 * TODA arma mundana, então um nome individual ao lado dos dois é redundante -
 * e é isso que o premade do Ranger faz (Quillathe traz `longbow`/`shortbow`
 * além de `sim`+`mar`, e só a partir do nível 5). Reduzir os dois lados evita
 * um falso "faltando" ali sem esconder o caso que importa: o Monge e o Ladino
 * têm só `sim`, e para eles cada arma marcial da regra condicional PRECISA
 * estar enumerada (TC-0078) - lá a redução não se aplica.
 */
const weaponProfSet = (list) => {
  const v = [...new Set(list ?? [])];
  return v.includes('sim') && v.includes('mar') ? v.filter((x) => ['sim', 'mar'].includes(x)) : v;
};

/** Estado de preparação de um item de magia (5.x: `prepared`; antigo: `preparation`). */
const preparedOf = (it) => Number(it?.system?.prepared ?? (it?.system?.preparation?.prepared ? 1 : 0)) || 0;

/**
 * Itens agrupados por `type`, em mapas name→item. Em nome repetido vence o
 * PRIMEIRO - exceto entre MAGIAS, onde vence a de maior `prepared`: uma mesma
 * magia pode estar na ficha duas vezes (o Shield que o Beiro tem no repertório
 * do Bardo e ganha de novo pelo Magic Initiate), e aí guardar a primeira faria o
 * oráculo comparar cópias diferentes dos dois lados. A regra vale para os dois,
 * e não esconde falta de verdade: se a cópia concedida não fosse emitida, o
 * nosso máximo seria 0 contra o 2 do premade e o achado apareceria igual.
 */
export function itemsByType(actor) {
  const out = {};
  for (const it of actor?.items ?? []) {
    const m = (out[it.type] ??= new Map());
    const k = keyFor(it.type, it.name);
    const prev = m.get(k);
    if (!prev) m.set(k, it);
    else if (it.type === 'spell' && preparedOf(it) > preparedOf(prev)) m.set(k, it);
  }
  return out;
}

/** Escada de advancement de um item: multiset de `Tipo@nível`, ordenado. */
export function advLadder(item) {
  const advs = Object.values(item?.system?.advancement ?? {});
  return advs.map((a) => `${a.type}@${a.level ?? 0}`).sort();
}

/**
 * Quantos itens cada passo de ItemGrant concede, por `título@nível`. A escada
 * comparada como CONJUNTO esconde isto: um nível pode existir nos dois lados e
 * conceder 3 features no premade e 2 nas nossas.
 */
export function grantCounts(item) {
  const out = {};
  for (const a of Object.values(item?.system?.advancement ?? {})) {
    if (a.type !== 'ItemGrant') continue;
    const key = `${a.title || 'ItemGrant'}@${a.level ?? 0}`;
    out[key] = (out[key] ?? 0) + (a.configuration?.items ?? []).length;
  }
  return out;
}

/** Tipos de activity de um item (ordenados; vazio quando não há). */
const activityTypes = (item) =>
  Object.values(item?.system?.activities ?? {})
    .map((a) => a?.type)
    .filter(Boolean)
    .sort();

const pushIf = (out, cond, cat, key, before, after) => {
  if (cond) out.push({ cat, key, before, after });
};

/** Compara dois valores simples e reporta com a classe dada. */
const cmp = (out, cat, key, before, after) =>
  pushIf(out, JSON.stringify(before) !== JSON.stringify(after), cat, key, before, after);

/** Conjuntos (ordem irrelevante): reporta só o que falta / o que sobra. */
function cmpSet(out, cat, key, before, after) {
  const missing = setDiff(before ?? [], after ?? []);
  const extra = setDiff(after ?? [], before ?? []);
  if (missing.length || extra.length) out.push({ cat, key, before: missing, after: extra });
}

// --- Blocos do `system` ------------------------------------------------------

function compareSystem(P, A, out) {
  const ps = P.system ?? {};
  const as = A.system ?? {};

  for (const a of ABILITIES) {
    cmp(out, 'abilities', a, ps.abilities?.[a]?.value, as.abilities?.[a]?.value);
    cmp(out, 'saves', a, ps.abilities?.[a]?.proficient ?? 0, as.abilities?.[a]?.proficient ?? 0);
  }

  const skills = new Set([...Object.keys(ps.skills ?? {}), ...Object.keys(as.skills ?? {})]);
  for (const s of skills) {
    cmp(out, 'skills', s, ps.skills?.[s]?.value ?? 0, as.skills?.[s]?.value ?? 0);
  }

  // Ferramentas: o bloco `tools` do ator (chave → nível de proficiência).
  cmpSet(out, 'tools', 'keys', Object.keys(ps.tools ?? {}), Object.keys(as.tools ?? {}));

  const pt = ps.traits ?? {};
  const at = as.traits ?? {};
  cmp(out, 'traits.size', 'size', pt.size, at.size);
  cmpSet(out, 'traits.languages', 'value', pt.languages?.value, at.languages?.value);
  cmpSet(out, 'traits.weaponProf', 'value', weaponProfSet(pt.weaponProf?.value), weaponProfSet(at.weaponProf?.value));
  cmpSet(out, 'traits.mastery', 'value', pt.weaponProf?.mastery?.value, at.weaponProf?.mastery?.value);
  cmpSet(out, 'traits.armorProf', 'value', pt.armorProf?.value, at.armorProf?.value);
  for (const k of ['dr', 'di', 'dv', 'ci']) {
    cmpSet(out, `traits.${k}`, 'value', pt[k]?.value, at[k]?.value);
  }

  // `hp.max` DEVE ser null nos dois (senão o Foundry vira HP manual - DDL-0001).
  cmp(out, 'attributes.hp', 'max', ps.attributes?.hp?.max ?? null, as.attributes?.hp?.max ?? null);
  cmp(out, 'attributes.ac', 'calc', ps.attributes?.ac?.calc, as.attributes?.ac?.calc);
  cmp(out, 'attributes.ac', 'flat', ps.attributes?.ac?.flat ?? null, as.attributes?.ac?.flat ?? null);
  cmp(out, 'attributes.attunement', 'max', ps.attributes?.attunement?.max, as.attributes?.attunement?.max);

  for (const c of COINS) cmp(out, 'currency', c, ps.currency?.[c] ?? 0, as.currency?.[c] ?? 0);

  cmp(out, 'details.xp', 'value', ps.details?.xp?.value ?? 0, as.details?.xp?.value ?? 0);
  cmp(out, 'details.alignment', 'alignment', norm(ps.details?.alignment), norm(as.details?.alignment));
  // As referências são por _id (identidade, ignorada) - o que importa é EXISTIR.
  for (const k of ['race', 'background', 'originalClass']) {
    cmp(out, 'details.refs', k, !!ps.details?.[k], !!as.details?.[k]);
  }
  // Espaços de magia: só o `override` (o `value` é estado de sessão).
  for (const k of Object.keys(ps.spells ?? {})) {
    cmp(out, 'spells.slots', `${k}.override`, ps.spells?.[k]?.override ?? null, as.spells?.[k]?.override ?? null);
  }
}

// --- Itens -------------------------------------------------------------------

/** Tipos cujo conteúdo é comparado item a item (os outros só entram/saem). */
const DOC_TYPES = ['class', 'subclass', 'race', 'background'];
/** Tipos de inventário - a distinção entre eles é frouxa e vira classe própria. */
const GEAR_TYPES = ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'];

function compareItems(P, A, out) {
  const pByType = itemsByType(P);
  const aByType = itemsByType(A);

  // 1) Presença por tipo, tratando o inventário como UM conjunto (a classificação
  //    exata é o item 2). O `container` entra no conjunto de inventário desde que
  //    um pack passou a ser exportado como contêiner + conteúdo (C4).
  const types = new Set([...Object.keys(pByType), ...Object.keys(aByType)]);
  for (const t of types) {
    if (GEAR_TYPES.includes(t)) continue;
    const pn = [...(pByType[t]?.keys() ?? [])];
    const an = [...(aByType[t]?.keys() ?? [])];
    // O nome do background é deliberadamente nosso ("Custom Background").
    if (t === 'background') {
      cmp(out, 'items.background', 'count', pn.length, an.length);
      continue;
    }
    cmpSet(out, `items.${t}`, 'names', pn, an);
  }

  // 2) Inventário: um conjunto só (nome), mais a classificação de TIPO por item.
  //    O `container` conta como inventário (um pack é contêiner + conteúdo, C4).
  //    O "Unarmed Strike" NÃO: é concessão de CLASSE (o advancement o emite), e
  //    nós o damos a toda classe de propósito - ver DELIBERATE.
  const gearNames = (byType) =>
    GEAR_TYPES.flatMap((t) => [...(byType[t]?.keys() ?? [])]).filter((n) => n !== 'unarmed strike');
  const pGear = gearNames(pByType);
  const aGear = gearNames(aByType);
  cmpSet(out, 'items.gear', 'names', pGear, aGear);
  const typeOf = (byType, name) => GEAR_TYPES.find((t) => byType[t]?.has(name)) ?? null;
  for (const name of pGear) {
    const pt = typeOf(pByType, name);
    const at = typeOf(aByType, name);
    if (at && pt !== at) out.push({ cat: 'items.gear.type', key: name, before: pt, after: at });
  }

  // 3) Conteúdo dos documentos de progressão (classe/subclasse/raça/background).
  for (const t of DOC_TYPES) {
    for (const [name, pit] of pByType[t] ?? []) {
      // O background casa por TIPO (nome deliberadamente diferente).
      const ait = t === 'background' ? [...(aByType[t]?.values() ?? [])][0] : aByType[t]?.get(name);
      if (!ait) continue;
      const label = t === 'background' ? 'background' : name;
      cmpSet(out, `advancement.${t}`, label, advLadder(pit), advLadder(ait));
      const pg = grantCounts(pit);
      const ag = grantCounts(ait);
      for (const k of new Set([...Object.keys(pg), ...Object.keys(ag)])) {
        // Um passo que só existe num lado já foi reportado pela escada acima.
        if (pg[k] != null && ag[k] != null) cmp(out, `advancement.${t}.grants`, `${label} ${k}`, pg[k], ag[k]);
      }
      if (t === 'class') {
        cmp(out, 'class.levels', label, pit.system?.levels, ait.system?.levels);
        cmp(out, 'class.hitDice', label, pit.system?.hd?.denomination ?? pit.system?.hitDice, ait.system?.hd?.denomination ?? ait.system?.hitDice);
        cmp(out, 'class.identifier', label, pit.system?.identifier, ait.system?.identifier);
        // `artificer` e `half` são a MESMA progressão no dnd5e (divisor 2,
        // roundUp - ver config.mjs); o dado do 5etools chama de `artificer` a do
        // Paladino/Ranger 2024 e nós a preservamos (TC-0060), então o par não é
        // divergência. Qualquer outro valor é.
        const prog = (p) => (p === 'artificer' ? 'half' : (p ?? null));
        cmp(out, 'class.spellcasting', label, prog(pit.system?.spellcasting?.progression), prog(ait.system?.spellcasting?.progression));
        cmp(out, 'class.spellcasting.formula', label, pit.system?.spellcasting?.preparation?.formula ?? '', ait.system?.spellcasting?.preparation?.formula ?? '');
      }
      if (t === 'subclass') cmp(out, 'subclass.identifier', label, pit.system?.identifier, ait.system?.identifier);
    }
  }

  // 4) Mecânica dos itens de FEATURE que casam por nome: activities, uses e
  //    procedência de compêndio (o que faz a ficha rolar e atualizar).
  for (const [name, pit] of pByType.feat ?? []) {
    const ait = aByType.feat?.get(name);
    if (!ait) continue;
    cmpSet(out, 'feat.activities', name, activityTypes(pit), activityTypes(ait));
    const uses = (it) => (it.system?.uses?.max ? 'has' : 'none');
    cmp(out, 'feat.uses', name, uses(pit), uses(ait));
    const src = (it) => (it._stats?.compendiumSource ? 'has' : 'none');
    cmp(out, 'feat.compendiumSource', name, src(pit), src(ait));
    cmp(out, 'feat.type', name, pit.system?.type?.value ?? null, ait.system?.type?.value ?? null);
  }

  // 5) Magias que casam por nome: modo de preparação, círculo e usos.
  for (const [name, pit] of pByType.spell ?? []) {
    const ait = aByType.spell?.get(name);
    if (!ait) continue;
    cmp(out, 'spell.level', name, pit.system?.level, ait.system?.level);
    // dnd5e 5.x: `method` + `prepared`; Plutonium ainda usa `preparation` (DDL/§B2.5).
    const method = (it) => it.system?.method ?? it.system?.preparation?.mode ?? null;
    const prepared = (it) => it.system?.prepared ?? (it.system?.preparation?.prepared ? 1 : 0) ?? null;
    cmp(out, 'spell.method', name, method(pit), method(ait));
    cmp(out, 'spell.prepared', name, prepared(pit), prepared(ait));
  }
}

/**
 * Compara o ator que NÓS geramos com o premade oficial.
 * @param {object} premade  o ator oficial (ground truth de esquema)
 * @param {object} ours     `assembleFoundryActor(foundryToCharacter(premade))`
 * @returns {Array<{cat:string, key:string, before:any, after:any}>}
 */
export function comparePremade(premade, ours) {
  const out = [];
  compareSystem(premade, ours, out);
  compareItems(premade, ours, out);
  return out.map((f) => {
    const e = EXPECTED.find((x) => x.test(f));
    return e ? { ...f, expected: e.id } : f;
  });
}

/** Agrupa achados de várias fichas por classe (`cat`) → contagem + exemplos. */
export function aggregate(perActor) {
  const byCat = new Map();
  for (const { actor, findings } of perActor) {
    for (const f of findings) {
      if (f.expected) continue;
      const g = byCat.get(f.cat) ?? { cat: f.cat, count: 0, actors: new Set(), examples: [] };
      g.count++;
      g.actors.add(actor);
      if (g.examples.length < 4) g.examples.push({ actor, ...f });
      byCat.set(f.cat, g);
    }
  }
  return [...byCat.values()]
    .map((g) => ({ ...g, actors: [...g.actors].sort() }))
    .sort((a, b) => b.count - a.count || a.cat.localeCompare(b.cat));
}
