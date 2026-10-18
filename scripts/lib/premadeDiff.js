// =============================================================================
// premadeDiff: o oráculo de EXPORT da Fase T2
// =============================================================================
// O QUE FAZ
//   A T2 certifica o EXPORT/IMPORT Foundry (TESTING-PLAN.md §5). O gabarito são as
//   48 fichas premade oficiais (12 personagens x níveis 1/5/11/17) em `DnD Source
//   Material/Character Sheets in JSON/Standard Premade Characters`, geradas pelo
//   próprio dnd5e e portanto a verdade de esquema (DDL-0001). O oráculo é o CICLO
//   COMPLETO: P --foundryToCharacter--> C --assembleFoundryActor--> A, depois A x P.
//   Uma divergência tem três causas e a triagem DEVE dizer qual: (a) o EXPORT não
//   emite o que o Foundry espera; (b) o IMPORT perdeu a decisão; (c) diferença
//   DELIBERADA do modelo, que entra numa lista com o porquê. Complementa o
//   round-trip do sweep, que compara DECISÕES nossas e não vê o que nunca foi
//   exportado. Cada achado carrega uma CLASSE estável (`cat`) para triar uma vez
//   por classe de problema.
//
// FUNÇÕES
//   norm(s), itemKey(name): nome comparável (itemKey tira o sufixo "(2)").
//   spellKey(name): o nome curto de MAGIA, sem o nome próprio do mago.
//   keyFor(type, name), setDiff(a, b): chave por tipo e diferença de conjuntos.
//   weaponProfSet(list): as proficiências de arma comparáveis.
//   preparedOf(it): o estado de preparação (5.x `prepared`; antigo `preparation`).
//   itemsByType(actor): os itens por `type`, em mapas nome -> item.
//   advLadder(item): a escada de advancement, multiset de `Tipo@nível` ordenado.
//   grantCounts(item): quantos itens cada ItemGrant concede, por `título@nível`.
//   grantEntries(item, actor): O QUE cada passo concede, `"<tipo>:<nome>"`.
//   activityTypes(item): os tipos de activity, ordenados.
//   pushIf, cmp, cmpSet: reportam um achado (valor simples, ou conjunto com só o que
//     falta e o que sobra).
//   compareSystem(P, A, out), compareItems(P, A, out): os blocos do `system` e os
//     itens.
//   comparePremade(premade, ours): os achados de uma ficha.
//   aggregate(perActor): os achados agrupados por `cat`, com contagem e exemplos.
//
// DECISÕES E ARMADILHAS
//   DELIBERATE e EXPECTED
//   - DELIBERATE é o que o comparador NÃO olha: o nome do background (só origens
//     CUSTOM; a MECÂNICA dele é comparada), a identidade de documento (ids, `_stats`
//     exceto `compendiumSource`, img, sort, ownership, folder, flags), a prosa, o
//     estado de sessão (o export nasce "descansado") e senses/movement (derivados
//     de Active Effects). O `container` saiu dessa lista em 2026-07-29 (DDL-0080).
//     Entrada nova precisa de justificativa; sem isso é bug disfarçado.
//   - EXPECTED é o que ele olha e sabe por que estamos certos: fica FORA da
//     contagem e é impresso à parte, contado e nomeado, nunca escondido. Só entra
//     com o motivo verificado, e o predicado precisa ser estreito: no
//     curated-swap-lineage, o item de RAÇA (espécie nua x linhagem) e o TRAÇO (o
//     absorvido x o guarda-chuva "Halfling Lineage (Lightfoot)"); no
//     srd-item-name-variant, as mesmas palavras em ordem invertida ("lantern,
//     hooded"); no race-grant-level-convention, (a) o mesmo passo em 0 x 1 e (b) um
//     passo a MAIS do nosso lado no 1, onde nada falta; o basic-actions só existe
//     pela marca do item (nenhum talento de verdade cai nele); o class-spell-ladder
//     aceita só MAGIA a mais.
//   Comparação
//   - COMPENDIUM_NAMES é o mapa REVERSO id -> nome curado, montado dos registros
//     gerados, só para o oráculo ficar legível ("feature:heightened focus", não
//     "phbmnkHeightened").
//   - spellKey: o SRD tira o nome próprio do mago (Product Identity), então
//     "Tasha's Hideous Laughter" e "Hideous Laughter" são a MESMA magia (verificado
//     contra o spells24 ao fechar o TC-0079). Comparar a grafia daria 26 falsos
//     positivos. A redução é a mesma dos dois lados e nunca inventa coincidência;
//     numa colisão vale a regra de homônimo do itemsByType.
//   - weaponProfSet: quem tem `sim` E `mar` é proficiente com toda arma mundana,
//     então um nome individual ao lado é redundante (o Ranger premade traz
//     longbow/shortbow). Monge e Ladino têm só `sim`, e para eles cada marcial da
//     regra condicional PRECISA estar enumerada (TC-0078).
//   - itemsByType: em nome repetido vence o PRIMEIRO, exceto entre MAGIAS, onde
//     vence o maior `prepared` (o Shield do Beiro vem do Bardo e do Magic
//     Initiate). Não esconde falta: sem a cópia concedida, o nosso máximo seria 0.
//     As ações básicas ganham classe PRÓPRIA pela MARCA (não por lista de nomes,
//     que envelheceria), para não se misturar aos talentos.
//   - grantEntries existe porque CONTAR escondeu a natureza da diferença: TC-0087
//     (o Monge sem Self-Restoration) e TC-0088 (o Bárbaro sem o Improved Brutal
//     Strike do 17) passaram semanas invisíveis como "premade=2 ours=1". O tipo sai
//     do DESTINO do uuid (`spells24` ou item de magia do ator = spell; o resto =
//     feature), e o nome é resolvido, nunca o uuid cru: no nível ALCANÇADO o grant
//     aponta para o item local, no FUTURO para o compêndio.
//   - compareSystem: `hp.max` DEVE ser null nos dois (senão o Foundry vira HP
//     manual, DDL-0001); referências por _id só precisam EXISTIR; dos espaços de
//     magia só o `override` conta (o `value` é sessão); ferramentas pelo bloco
//     `tools` do ator.
//   - compareItems, em cinco passos: (1) presença por tipo, com o inventário
//     (`container` incluso desde o C4) como UM conjunto e o background casado por
//     TIPO; (2) o inventário por nome e a classificação de TIPO por item, sem o
//     Unarmed Strike (concessão de CLASSE, dada a toda classe, ver DELIBERATE);
//     (3) o conteúdo dos documentos de progressão, pelo QUE cada passo concede (um
//     passo que só existe num lado já saiu na escada); `artificer` e `half` são a
//     MESMA progressão no dnd5e (TC-0060); (4) a mecânica das FEATURES que casam por
//     nome (activities, uses, procedência); (5) as magias que casam por nome
//     (preparação, círculo, usos).
// -----------------------------------------------------------------------------

import { srdSpellNames } from '../../src/engine/spells';
import { isBasicActionItem } from '../../src/engine/foundryBasicActions';
import {
  CLASS_FEATURE_IDS, SUBCLASS_FEATURE_IDS, SPELL_IDS, FEAT_IDS, ORIGIN_IDS,
} from '../../src/engine/compendiumUuidsData';

/** Mapa REVERSO id do compêndio -> nome curado. */
const COMPENDIUM_NAMES = new Map();
for (const reg of [CLASS_FEATURE_IDS, SUBCLASS_FEATURE_IDS, SPELL_IDS, FEAT_IDS, ORIGIN_IDS]) {
  for (const [key, id] of Object.entries(reg ?? {})) {
    if (!COMPENDIUM_NAMES.has(id)) COMPENDIUM_NAMES.set(id, key.split('|').pop());
  }
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const COINS = ['pp', 'gp', 'ep', 'sp', 'cp'];

/** Diferenças DELIBERADAS: o que o comparador não reporta. */
export const DELIBERATE = [
  'background item name (custom origins only)',
  'the class-granted "Unarmed Strike" (we grant it to EVERY class - see DDL-0080)',
  'document identity (_id/_stats/img/sort/ownership/folder/flags)',
  'prose (description/biography HTML)',
  'session state (hp.value, spell slots value, uses.spent, death, exhaustion)',
  'senses/movement (derived by Foundry from effects)',
  'spellcasting progression artificer == half (identical in the dnd5e config)',
];

/** ESPERADAS: divergências reais já investigadas, fora da contagem. */
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
    id: 'premade-xp-typo',
    why:
      'O `details.xp` do Riswynn L11 e 6500, que e o limiar do nivel 5 - e e literalmente o mesmo '
      + 'valor do arquivo L05 dele, um copy-paste. O nivel 11 pede 85000, que e o que derivamos. '
      + 'Varredura das 48 fichas em 2026-07-30: esta e a UNICA com XP incoerente com o proprio '
      + 'nivel. O predicado exige que os DOIS valores sejam limiares oficiais e que o nosso seja o '
      + 'MAIOR - se um dia emitirmos um numero que nao esta na tabela, volta a ser achado.',
    test: (f) => {
      if (f.cat !== 'details.xp') return false;
      const THRESHOLDS = new Set([0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
        85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]);
      return THRESHOLDS.has(f.before) && THRESHOLDS.has(f.after) && f.after > f.before;
    },
  },
  {
    id: 'warlock-pact-method',
    why:
      'Contact Other Plane e concedida pelo Contact Patron (Warlock @9): "you always have the '
      + 'spell prepared… you can cast it without expending a spell slot… once… until you finish a '
      + 'Long Rest". O premade encoda isso como `method: "spell"` + `uses` 1/descanso longo; nos '
      + 'emitimos o MESMO `uses` (o `prepared` do dado nao traz frequencia, ela vem da prosa - ver '
      + 'INNATE_USES) e `method: "pact"`. A diferenca e so o caminho de gastar ESPACO: a magia esta '
      + 'sempre preparada, e o RAW deixa conjura-la gastando espaco por cima do uso gratis; num '
      + 'Warlock puro o unico espaco que existe e o de PACTO, entao `spell` deixaria esse caminho '
      + 'morto e `pact` o preserva. Mesma politica do TC-0067/DDL-0074. '
      + 'HISTORICO, para nao se repetir: esta entrada nasceu em 2026-07-30 com a justificativa '
      + 'ERRADA ("quirk do documento, a magia ficaria sem com que ser conjurada"), porque a triagem '
      + 'olhou o `method` sem olhar o `uses` ao lado. O usuario apontou o Contact Patron e a '
      + 'remedicao achou um defeito NOSSO de verdade - o uso gratis nao era emitido. Nomear antes '
      + 'de entender a feature que concede e como se esconde bug.',
    test: (f) => f.cat === 'spell.method' && f.before === 'spell' && f.after === 'pact',
  },
  {
    id: 'race-granted-spell-label',
    why:
      'O passo de concessao da RACA aponta para um cantrip diferente do que o premade escolheu '
      + '(Beiro, Alto Elfo: o documento diz Prestidigitation, nos dizemos Mage Hand). E o LIMITE '
      + 'CONHECIDO E ACEITO documentado no `spellChoiceBag` do foundryImport: uma magia que serve a '
      + 'duas origens pode ser atribuida a origem errada, porque um ator externo nao diz qual '
      + 'origem pagou por qual magia. Medido em 2026-07-30: os dois atores tem exatamente os mesmos '
      + '5 cantrips - nada se perde, so o rotulo de quem concedeu troca. '
      + 'O predicado exige troca UM-POR-UM de MAGIA: se faltar uma sem nada entrar no lugar, ou se '
      + 'o que faltar for FEATURE, continua sendo achado.',
    test: (f) =>
      f.cat === 'advancement.race.grants'
      && (f.before ?? []).length > 0
      && (f.before ?? []).length === (f.after ?? []).length
      && (f.before ?? []).every((x) => String(x).startsWith('spell:'))
      && (f.after ?? []).every((x) => String(x).startsWith('spell:')),
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
      if (f.cat === 'items.race') {
        return swaps.some(
          (base) => (f.before ?? []).includes(base) && (f.after ?? []).some((n) => String(n).startsWith(`${base};`)),
        );
      }
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
      if (before.length === 1 && after.length === 1 && type(before[0]) === type(after[0])) {
        return [before[0], after[0]].every((s) => /@[01]$/.test(s));
      }
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
    id: 'basic-actions',
    why:
      'As ações que QUALQUER personagem pode tomar (Dash, Hide, Help, Study, Influence, Utilize…). '
      + 'O dnd5e as publica como JOURNAL, não como documento de item, então nenhum ator - nem os '
      + 'premades - traz um item "Dash", e no Foundry elas não aparecem em lugar nenhum da ficha: '
      + 'quem não conhece a regra nunca descobre que tinha a opção. Emitimos as 18 do XPHB, '
      + 'derivadas de actions.json, com a marca `flags.builder5e.basicAction` e SEM '
      + 'compendiumSource - não há documento publicado para apontar. Segunda divergência '
      + 'deliberada do SRD (DDL-0080 §1.2), depois do Unarmed Strike universal.',
    test: (f) => f.cat === 'items.basicAction' && (f.before ?? []).length === 0,
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
      // ATENÇÃO: só MAGIA a mais e nada faltando; predicado por CONTAGEM engoliria uma feature ausente (TC-0087/0088).
      && (f.before ?? []).length === 0
      && (f.after ?? []).length > 0
      && (f.after ?? []).every((x) => String(x).startsWith('spell:')),
  },
  {
    id: 'reached-level-grant-lists-features-only',
    why:
      'No nível JÁ ALCANÇADO o SRD junta a MAGIA concedida no mesmo passo ItemGrant das features '
      + "(Paladino @2: Fighting Style + Paladin's Smite + a magia Divine Smite; @5: Extra Attack + "
      + 'Faithful Steed + Find Steed). Nós listamos ali só as features. Medido em 2026-07-30: as '
      + 'magias ESTÃO no ator exportado como itens, então o jogador não perde nada - a diferença é '
      + 'de qual passo as lista. Só passaria a importar se o Foundry re-executasse o advancement '
      + '(um level-down/up dentro dele): é a pergunta 2 do T2d, e esta entrada é para revisitar lá. '
      + 'O predicado exige que o que falta seja MAGIA - uma FEATURE ausente continua sendo achado.',
    test: (f) =>
      f.cat === 'advancement.class.grants'
      && (f.after ?? []).length === 0
      && (f.before ?? []).length > 0
      && (f.before ?? []).every((x) => String(x).startsWith('spell:')),
  },
];

const norm = (s) => String(s ?? '').trim().toLowerCase();
/** Nome comparável de item: minúsculo, sem sufixo "(2)". */
export const itemKey = (name) => norm(name).replace(/\s*\(\d+\)$/, '');

/** Nome comparável de MAGIA, sem o nome próprio do mago. */
export const spellKey = (name) => srdSpellNames(itemKey(name)).at(-1) ?? itemKey(name);

const keyFor = (type, name) => (type === 'spell' ? spellKey(name) : itemKey(name));

const setDiff = (a, b) => [...new Set(a)].filter((x) => !new Set(b).has(x)).sort();

/** Proficiências de arma comparáveis. */
const weaponProfSet = (list) => {
  const v = [...new Set(list ?? [])];
  return v.includes('sim') && v.includes('mar') ? v.filter((x) => ['sim', 'mar'].includes(x)) : v;
};

/** O estado de preparação de um item de magia. */
const preparedOf = (it) => Number(it?.system?.prepared ?? (it?.system?.preparation?.prepared ? 1 : 0)) || 0;

/** Os itens agrupados por `type`, em mapas nome -> item. */
export function itemsByType(actor) {
  const out = {};
  for (const it of actor?.items ?? []) {
    const type = isBasicActionItem(it) ? 'basicAction' : it.type;
    const m = (out[type] ??= new Map());
    const k = keyFor(it.type, it.name);
    const prev = m.get(k);
    if (!prev) m.set(k, it);
    else if (it.type === 'spell' && preparedOf(it) > preparedOf(prev)) m.set(k, it);
  }
  return out;
}

/** A escada de advancement: multiset de `Tipo@nível`, ordenado. */
export function advLadder(item) {
  const advs = Object.values(item?.system?.advancement ?? {});
  return advs.map((a) => `${a.type}@${a.level ?? 0}`).sort();
}

/** Quantos itens cada ItemGrant concede, por `título@nível`. */
export function grantCounts(item) {
  const out = {};
  for (const a of Object.values(item?.system?.advancement ?? {})) {
    if (a.type !== 'ItemGrant') continue;
    const key = `${a.title || 'ItemGrant'}@${a.level ?? 0}`;
    out[key] = (out[key] ?? 0) + (a.configuration?.items ?? []).length;
  }
  return out;
}

/**
 * O QUE cada passo de ItemGrant concede, por `título@nível`.
 * @param {object} item
 * @param {object} actor
 */
export function grantEntries(item, actor) {
  const byId = new Map((actor?.items ?? []).map((i) => [i._id, i]));
  const out = {};
  for (const a of Object.values(item?.system?.advancement ?? {})) {
    if (a.type !== 'ItemGrant') continue;
    const key = `${a.title || 'ItemGrant'}@${a.level ?? 0}`;
    const list = out[key] ?? (out[key] = []);
    for (const cfg of a.configuration?.items ?? []) {
      const uuid = String(cfg?.uuid ?? cfg ?? '');
      // ATENÇÃO: norm, não itemKey: aqui o sufixo "(2)" é a informação, não ruído.
      if (uuid.startsWith('.')) {
        const it = byId.get(uuid.slice(1));
        list.push(`${it?.type === 'spell' ? 'spell' : 'feature'}:${norm(it?.name ?? uuid)}`);
      } else {
        const kind = /\.spells24\./.test(uuid) ? 'spell' : 'feature';
        const id = uuid.split('.').pop();
        list.push(`${kind}:${norm(COMPENDIUM_NAMES.get(id) ?? id)}`);
      }
    }
  }
  return out;
}

/** Os tipos de activity de um item, ordenados. */
const activityTypes = (item) =>
  Object.values(item?.system?.activities ?? {})
    .map((a) => a?.type)
    .filter(Boolean)
    .sort();

const pushIf = (out, cond, cat, key, before, after) => {
  if (cond) out.push({ cat, key, before, after });
};

/** Compara dois valores simples. */
const cmp = (out, cat, key, before, after) =>
  pushIf(out, JSON.stringify(before) !== JSON.stringify(after), cat, key, before, after);

/** Compara conjuntos: só o que falta e o que sobra. */
function cmpSet(out, cat, key, before, after) {
  const missing = setDiff(before ?? [], after ?? []);
  const extra = setDiff(after ?? [], before ?? []);
  if (missing.length || extra.length) out.push({ cat, key, before: missing, after: extra });
}

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

  cmp(out, 'attributes.hp', 'max', ps.attributes?.hp?.max ?? null, as.attributes?.hp?.max ?? null);
  cmp(out, 'attributes.ac', 'calc', ps.attributes?.ac?.calc, as.attributes?.ac?.calc);
  cmp(out, 'attributes.ac', 'flat', ps.attributes?.ac?.flat ?? null, as.attributes?.ac?.flat ?? null);
  cmp(out, 'attributes.attunement', 'max', ps.attributes?.attunement?.max, as.attributes?.attunement?.max);

  for (const c of COINS) cmp(out, 'currency', c, ps.currency?.[c] ?? 0, as.currency?.[c] ?? 0);

  cmp(out, 'details.xp', 'value', ps.details?.xp?.value ?? 0, as.details?.xp?.value ?? 0);
  cmp(out, 'details.alignment', 'alignment', norm(ps.details?.alignment), norm(as.details?.alignment));
  for (const k of ['race', 'background', 'originalClass']) {
    cmp(out, 'details.refs', k, !!ps.details?.[k], !!as.details?.[k]);
  }
  for (const k of Object.keys(ps.spells ?? {})) {
    cmp(out, 'spells.slots', `${k}.override`, ps.spells?.[k]?.override ?? null, as.spells?.[k]?.override ?? null);
  }
}

/** Tipos cujo conteúdo é comparado item a item. */
const DOC_TYPES = ['class', 'subclass', 'race', 'background'];
/** Tipos de inventário (a distinção entre eles vira classe própria). */
const GEAR_TYPES = ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'];

function compareItems(P, A, out) {
  const pByType = itemsByType(P);
  const aByType = itemsByType(A);

  const types = new Set([...Object.keys(pByType), ...Object.keys(aByType)]);
  for (const t of types) {
    if (GEAR_TYPES.includes(t)) continue;
    const pn = [...(pByType[t]?.keys() ?? [])];
    const an = [...(aByType[t]?.keys() ?? [])];
    if (t === 'background') {
      cmp(out, 'items.background', 'count', pn.length, an.length);
      continue;
    }
    cmpSet(out, `items.${t}`, 'names', pn, an);
  }

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

  for (const t of DOC_TYPES) {
    for (const [name, pit] of pByType[t] ?? []) {
      const ait = t === 'background' ? [...(aByType[t]?.values() ?? [])][0] : aByType[t]?.get(name);
      if (!ait) continue;
      const label = t === 'background' ? 'background' : name;
      cmpSet(out, `advancement.${t}`, label, advLadder(pit), advLadder(ait));
      const pg = grantEntries(pit, P);
      const ag = grantEntries(ait, A);
      for (const k of new Set([...Object.keys(pg), ...Object.keys(ag)])) {
        if (pg[k] != null && ag[k] != null) cmpSet(out, `advancement.${t}.grants`, `${label} ${k}`, pg[k], ag[k]);
      }
      if (t === 'class') {
        cmp(out, 'class.levels', label, pit.system?.levels, ait.system?.levels);
        cmp(out, 'class.hitDice', label, pit.system?.hd?.denomination ?? pit.system?.hitDice, ait.system?.hd?.denomination ?? ait.system?.hitDice);
        cmp(out, 'class.identifier', label, pit.system?.identifier, ait.system?.identifier);
        const prog = (p) => (p === 'artificer' ? 'half' : (p ?? null));
        cmp(out, 'class.spellcasting', label, prog(pit.system?.spellcasting?.progression), prog(ait.system?.spellcasting?.progression));
        cmp(out, 'class.spellcasting.formula', label, pit.system?.spellcasting?.preparation?.formula ?? '', ait.system?.spellcasting?.preparation?.formula ?? '');
      }
      if (t === 'subclass') cmp(out, 'subclass.identifier', label, pit.system?.identifier, ait.system?.identifier);
    }
  }

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

  for (const [name, pit] of pByType.spell ?? []) {
    const ait = aByType.spell?.get(name);
    if (!ait) continue;
    cmp(out, 'spell.level', name, pit.system?.level, ait.system?.level);
    const method = (it) => it.system?.method ?? it.system?.preparation?.mode ?? null;
    const prepared = (it) => it.system?.prepared ?? (it.system?.preparation?.prepared ? 1 : 0) ?? null;
    cmp(out, 'spell.method', name, method(pit), method(ait));
    cmp(out, 'spell.prepared', name, prepared(pit), prepared(ait));
  }
}

/**
 * Compara o ator que NÓS geramos com o premade oficial.
 * @param {object} premade
 * @param {object} ours
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

/** Os achados de várias fichas agrupados por `cat`. */
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
