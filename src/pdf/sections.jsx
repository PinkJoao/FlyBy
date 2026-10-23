// =============================================================================
// sections: as seções da ficha PDF (combate, features, magias, inventário, história)
// =============================================================================
// O QUE FAZ
//   Cada seção recebe a sua fatia do modelo (sheetModel), o tema `t`, a largura
//   útil `w` e as opções, e desenha em FLUXO: o @react-pdf quebra a página onde
//   precisar (DDL-0105). Nenhuma seção calcula regra: só arruma o que o modelo
//   já traz.
//
// FUNÇÕES
//   body(t, size): o estilo do texto corrido.
//   Header(props): nome, linha de classes, espécie, nível e retrato.
//   AbilityRow(props), StatStrip(props), TableBoxes(props): o alto da página
//     de combate.
//   SkillList(props), Senses(props), AttackTable(props), Resources(props),
//     Proficiencies(props): as duas colunas da página de combate.
//   CombatSection(props): a página de combate.
//   FeatureItem(props), TitleGrid(props), FeatureGroup(props),
//     FeaturesSection(props): as features por grupo.
//   SlotTracker(props), SpellTable(props), SpellCard(props), CardGrid(props),
//     SpellsSection(props): a conjuração.
//   isLongCard(card), pairs(list): o cartão que pode partir, e as linhas de dois.
//   ItemTable(props), Coins(props), InventorySection(props): o inventário.
//   TextBox(props), BiographySection(props): a história.
//   isLong(blocks, limit), rightColumnHeight(m, f): o texto que pode partir, e a
//     altura estimada da coluna direita da página de combate.
//
// DECISÕES E ARMADILHAS
//   - QUEBRA DE PÁGINA: caixa, linha de tabela, cartão, item e todo texto curto
//     são inquebráveis (`wrap={false}`); só o texto LONGO (acima de SHORT_CHARS,
//     ou LONG_ITEM_CHARS num item) pode continuar na página seguinte, e mesmo ele
//     leva o título junto. Os limites são altos de propósito (um texto de 1200
//     caracteres cabe com folga numa página): partir só o que precisa.
//   - TÍTULO PRESO ao que vem depois, num bloco inquebrável: a feature ao primeiro
//     parágrafo (até KEEP_FIRST_CHARS), a tabela de magias (título e colunas) às
//     duas primeiras linhas, o círculo dos cartões à primeira linha de cartões, o
//     contêiner do inventário ao primeiro item, o grupo de features (classe,
//     subclasse, espécie) à introdução ou à primeira feature. Só o
//     `minPresenceAhead` não basta: medido, ele deixou órfãos o Channel Divinity
//     (um parágrafo de 3 linhas não parte e pulou inteiro depois que o título
//     ficou), o "4th Level", o Magic Initiate, o "Case, Map or Scroll" e o "Life
//     Domain". Ele fica só como reserva onde o primeiro bloco é longo demais.
//   - A página de combate cabe numa folha: as notas ganham só as linhas que
//     sobram na coluna direita (rightColumnHeight, estimada) e somem abaixo de 3;
//     antes, no papel Carta, a caixa de notas ia sozinha para a página 2.
//   - Os cartões vão em LINHAS de dois, e a linha é INQUEBRÁVEL para o cartão
//     não partir no meio, exceto quando um deles passa de CARD_WRAP_CHARS ou
//     traz tabela: um cartão maior que a página seria cortado. (Com flexWrap o
//     @react-pdf não sabe partir a linha e reclama do nó grande demais.) O título
//     do círculo vai PRESO à primeira linha de cartões; quando ela pode partir,
//     o título pede 200 pt livres. Só o minPresenceAhead deixava o "4th Level"
//     órfão no pé quando a linha seguinte, inquebrável, pulava inteira.
//   - Com as descrições ligadas, a linha da tabela de inventário ganha o texto
//     do item logo abaixo, recuado; o flavour sai em itálico apagado.
//   - Recurso com até MAX_PIPS usos ganha uma caixa por uso; acima disso (Lay
//     on Hands, pontos de feitiçaria altos) vira "____ / máximo", para o lápis.
//   - As caixas da mesa (PV atual, temporário, dados gastos, testes contra a
//     morte, inspiração, exaustão) ficam em branco: são para o lápis.
//   - Retrato: o círculo no cabeçalho (recortado, `cover`) e, na história, o
//     retrato inteiro (`contain`, sem cortar) ao lado da aparência. Os dois
//     obedecem ao campo Portrait das opções.
// -----------------------------------------------------------------------------

import { View, Text, Image } from '@react-pdf/renderer';
import { FONTS } from './theme';
import { Blocks, SectionTitle, GroupTitle, Label, Box, Pips } from './parts';
import { blocksText } from './entries';

const CARD_WRAP_CHARS = 2200;
const SHORT_CHARS = 1200;
const LONG_ITEM_CHARS = 2000;
const KEEP_FIRST_CHARS = 900;

/** O texto é longo o bastante para PODER continuar na página seguinte? */
const isLong = (blocks, limit = SHORT_CHARS) => blocksText(blocks).length > limit;

/** A altura estimada (pt) da coluna direita da página de combate, sem as notas. */
function rightColumnHeight(m, f) {
  const profLines = Object.values(m.proficiencies)
    .reduce((n, v) => n + Math.max(1, Math.ceil((String(v).length + 12) / 80)), 0);
  return (f.attacks ? 36 + 16 * Math.max(m.attacks.length, 4) : 0)
    + (m.resources.length ? 32 + 23 * m.resources.length : 0)
    + (f.proficiencies ? 28 + 13 * profLines : 0);
}

const body = (t, size = 9) => ({ fontFamily: FONTS.body, fontSize: size, color: t.ink });

/** Nome, linha de classes, espécie, nível e retrato. */
function Header({ h, t, showPortrait }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      {showPortrait && h.portrait ? (
        <View style={{ width: 74, height: 74, borderWidth: 1.5, borderColor: t.red, borderRadius: 37, overflow: 'hidden', marginRight: 12, backgroundColor: t.box }}>
          <Image src={h.portrait} style={{ width: 74, height: 74, objectFit: 'cover' }} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 22, color: t.red, letterSpacing: 0.8 }}>
          {h.name || 'Unnamed Hero'}
        </Text>
        <Text style={{ ...body(t, 10.5), fontStyle: 'italic', marginTop: 1 }}>{h.classLine}</Text>
        <Text style={{ ...body(t, 9), color: t.muted }}>{[h.species, h.alignment].filter(Boolean).join('  ·  ')}</Text>
      </View>
      <View style={{ width: 52, height: 52, borderWidth: 1.2, borderColor: t.red, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: t.box }}>
        <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 18, color: t.ink }}>{h.level}</Text>
        <Label t={t} size={5.5}>LEVEL</Label>
      </View>
    </View>
  );
}

/** Os seis atributos, com a salvaguarda. */
function AbilityRow({ abilities, t }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      {abilities.map((a, i) => (
        <Box key={a.code} t={t} style={{ flex: 1, marginLeft: i ? 5 : 0, alignItems: 'center', paddingVertical: 4 }}>
          <Label t={t} color={t.red}>{a.name.toUpperCase()}</Label>
          <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 19, color: t.ink, marginTop: 1 }}>{a.mod}</Text>
          <View style={{ borderWidth: 0.8, borderColor: t.rule, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 0.5, backgroundColor: t.panel }}>
            <Text style={{ ...body(t, 8.5), fontWeight: 700 }}>{a.score}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Pips t={t} n={1} size={5.5} filled={a.saveProf ? 1 : 0} />
            <Text style={{ ...body(t, 7.5), marginLeft: 3 }}>Save {a.save}</Text>
          </View>
        </Box>
      ))}
    </View>
  );
}

/** A faixa de números de combate. */
function StatStrip({ c, t }) {
  const stats = [
    ['ARMOR CLASS', c.ac, c.shield ? 'with shield' : null],
    ['INITIATIVE', c.initiative],
    ['SPEED', c.speed, c.otherSpeeds.join(', ') || null],
    ['SIZE', c.size],
    ['PROFICIENCY', c.profBonus],
    ['HIT POINT MAX', c.hpMax],
    ['HIT DICE', c.hitDice],
  ];
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      {stats.map(([label, value, sub], i) => (
        <Box key={label} t={t} style={{ flex: 1, marginLeft: i ? 5 : 0, alignItems: 'center', paddingVertical: 4 }}>
          <Label t={t} size={5.8}>{label}</Label>
          <Text style={/[a-z]/i.test(String(value))
            ? { ...body(t, String(value).length > 7 ? 10 : 12.5), fontWeight: 700, marginTop: 1.5 }
            : { fontFamily: FONTS.title, fontWeight: 700, fontSize: 13, color: t.ink, marginTop: 2 }}
          >
            {value}
          </Text>
          {sub ? <Text style={{ ...body(t, 6.5), color: t.muted, fontStyle: 'italic', textAlign: 'center' }}>{sub}</Text> : null}
        </Box>
      ))}
    </View>
  );
}

/** As caixas da mesa, em branco para o lápis. */
function TableBoxes({ t }) {
  const blank = (label, flex) => (
    <Box t={t} style={{ flex, height: 46, marginRight: 5 }}>
      <Label t={t} size={5.8} align="left">{label}</Label>
    </Box>
  );
  return (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      {blank('CURRENT HIT POINTS', 2.2)}
      {blank('TEMP HP', 1)}
      {blank('HIT DICE SPENT', 1)}
      <Box t={t} style={{ flex: 1.4, height: 46, marginRight: 5 }}>
        <Label t={t} size={5.8} align="left">DEATH SAVES</Label>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ ...body(t, 7), width: 40 }}>Successes</Text><Pips t={t} n={3} size={6.5} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <Text style={{ ...body(t, 7), width: 40 }}>Failures</Text><Pips t={t} n={3} size={6.5} />
        </View>
      </Box>
      <Box t={t} style={{ flex: 1.2, height: 46 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Label t={t} size={5.8} align="left">INSPIRATION</Label></View>
          <Pips t={t} n={1} shape="diamond" size={9} />
        </View>
        <Label t={t} size={5.8} align="left">EXHAUSTION</Label>
        <View style={{ marginTop: 2 }}>
          <Pips t={t} n={6} shape="square" size={6.5} gap={2} />
        </View>
      </Box>
    </View>
  );
}

/** As 18 perícias. */
function SkillList({ skills, t }) {
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>SKILLS</Label>
      <View style={{ marginTop: 3 }}>
        {skills.map((s) => (
          <View key={s.code} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 1.1, borderBottomWidth: 0.3, borderBottomColor: t.rule }}>
            <Pips t={t} n={s.prof === 2 ? 2 : 1} size={5.5} gap={1} filled={s.prof} />
            <Text style={{ ...body(t, 8.5), fontWeight: 700, width: 22, textAlign: 'right', marginRight: 5, marginLeft: s.prof === 2 ? 0 : 6.5 }}>{s.value}</Text>
            <Text style={{ ...body(t, 8.5), flex: 1 }}>{s.name}</Text>
            <Text style={{ ...body(t, 7), color: t.muted }}>{s.ability}</Text>
          </View>
        ))}
      </View>
    </Box>
  );
}

/** As passivas, a visão e as defesas. */
function Senses({ c, t }) {
  const rows = [
    ['Passive Perception', c.passives.perception],
    ['Passive Insight', c.passives.insight],
    ['Passive Investigation', c.passives.investigation],
  ];
  if (c.darkvision) rows.push(['Darkvision', c.darkvision]);
  const defenses = [
    ['Resistances', c.defenses.resist],
    ['Immunities', c.defenses.immune],
    ['Vulnerabilities', c.defenses.vulnerable],
  ].filter(([, list]) => list.length);
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>SENSES</Label>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', marginTop: 2 }}>
          <Text style={{ ...body(t, 8.5), flex: 1 }}>{label}</Text>
          <Text style={{ ...body(t, 8.5), fontWeight: 700 }}>{value}</Text>
        </View>
      ))}
      {defenses.map(([label, list]) => (
        <Text key={label} style={{ ...body(t, 8), marginTop: 3 }}>
          <Text style={{ fontWeight: 700 }}>{label}: </Text>{list.join(', ')}
        </Text>
      ))}
    </Box>
  );
}

/** Armas e cantrips de ataque. */
function AttackTable({ rows, t }) {
  const col = [{ flex: 2.2 }, { width: 44, textAlign: 'center' }, { flex: 1.5 }, { flex: 2 }];
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>ATTACKS &amp; DAMAGE CANTRIPS</Label>
      <View style={{ flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: t.red, marginTop: 3, paddingBottom: 1 }}>
        {['Name', 'Atk / DC', 'Damage', 'Notes'].map((h, i) => (
          <Text key={h} style={{ ...body(t, 7), color: t.muted, fontWeight: 700, ...col[i] }}>{h}</Text>
        ))}
      </View>
      {rows.length ? rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', paddingVertical: 1.8, backgroundColor: i % 2 ? 'transparent' : t.stripe }}>
          <Text style={{ ...body(t, 8.5), fontWeight: r.equipped ? 700 : 400, ...col[0] }}>{r.name}</Text>
          <Text style={{ ...body(t, 8.5), fontWeight: 700, ...col[1] }}>{r.bonus}</Text>
          <Text style={{ ...body(t, 8.5), ...col[2] }}>{r.damage}</Text>
          <Text style={{ ...body(t, 7.5), color: t.muted, ...col[3] }}>{r.notes}</Text>
        </View>
      )) : Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ height: 13, borderBottomWidth: 0.3, borderBottomColor: t.rule }} />
      ))}
    </Box>
  );
}

const MAX_PIPS = 12;

/** Os recursos com usos, com caixas para marcar. */
function Resources({ rows, t }) {
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>RESOURCES</Label>
      {rows.map((r) => (
        <View key={r.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, borderBottomWidth: 0.3, borderBottomColor: t.rule }}>
          <View style={{ flex: 1, paddingRight: 6 }}>
            <Text style={{ ...body(t, 8.5), fontWeight: 700 }}>{r.name}</Text>
            {r.recovery ? <Text style={{ ...body(t, 7), color: t.muted, fontStyle: 'italic' }}>{r.recovery}</Text> : null}
          </View>
          {r.max <= MAX_PIPS ? (
            <Pips t={t} n={r.max} shape="square" size={7.5} gap={2.5} />
          ) : (
            <Text style={{ ...body(t, 9) }}>
              <Text style={{ color: t.rule }}>______</Text> / <Text style={{ fontWeight: 700 }}>{r.max}</Text>
            </Text>
          )}
        </View>
      ))}
    </Box>
  );
}

/** Armadura, armas, ferramentas e idiomas. */
function Proficiencies({ p, t }) {
  const rows = [['Armor', p.armor], ['Weapons', p.weapons], ['Tools', p.tools], ['Languages', p.languages]];
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>PROFICIENCIES &amp; LANGUAGES</Label>
      {rows.map(([label, value]) => (
        <Text key={label} style={{ ...body(t, 8.5), marginTop: 2.5 }}>
          <Text style={{ fontWeight: 700, color: t.red }}>{label}. </Text>{value || '-'}
        </Text>
      ))}
    </Box>
  );
}

/** A página de combate. */
export function CombatSection({ m, t, opts, contentHeight }) {
  const f = opts.fields;
  const columnsTop = f.tableBoxes ? 250 : 196;
  const notesLines = Math.min(24, Math.floor((contentHeight - columnsTop - rightColumnHeight(m, f) - 40) / 13));
  return (
    <View>
      <Header h={m.header} t={t} showPortrait={f.portrait} />
      <AbilityRow abilities={m.abilities} t={t} />
      <StatStrip c={m.combat} t={t} />
      {f.tableBoxes ? <TableBoxes t={t} /> : null}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: '36%', marginRight: 6 }}>
          {f.skills ? <SkillList skills={m.skills} t={t} /> : null}
          <Senses c={m.combat} t={t} />
        </View>
        <View style={{ flex: 1 }}>
          {f.attacks ? <AttackTable rows={m.attacks} t={t} /> : null}
          {m.resources.length ? <Resources rows={m.resources} t={t} /> : null}
          {f.proficiencies ? <Proficiencies p={m.proficiencies} t={t} /> : null}
          {f.tableBoxes && notesLines >= 3 ? <TextBox label="NOTES" t={t} lines={notesLines} /> : null}
        </View>
      </View>
    </View>
  );
}

/** Uma feature com o texto completo. */
function FeatureItem({ item, t }) {
  const blocks = item.blocks ?? [];
  const first = blocks[0]?.type === 'p' && blocksText(blocks.slice(0, 1)).length <= KEEP_FIRST_CHARS ? 1 : 0;
  return (
    <View wrap={isLong(item.blocks) || item.options.length > 0} style={{ marginBottom: 5 }}>
      <View minPresenceAhead={48} wrap={false}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ flex: 1, fontFamily: FONTS.title, fontWeight: 700, fontSize: 9, color: t.ink, letterSpacing: 0.3 }}>{item.name}</Text>
          {item.tag ? <Text style={{ ...body(t, 7.5), color: t.muted, fontStyle: 'italic' }}>{item.tag}</Text> : null}
        </View>
        {item.notes.length ? (
          <Text style={{ ...body(t, 8.5), color: t.red, fontStyle: 'italic', marginBottom: 1.5 }}>Chosen: {item.notes.join('; ')}</Text>
        ) : null}
        <Blocks blocks={blocks.slice(0, first)} t={t} justify />
      </View>
      <Blocks blocks={blocks.slice(first)} t={t} justify />
      {item.options.map((o) => (
        <View key={o.name} wrap={isLong(o.blocks)} style={{ marginLeft: 8, borderLeftWidth: 1, borderLeftColor: t.rule, paddingLeft: 5, marginBottom: 2 }}>
          <Text style={{ ...body(t, 8.5), fontWeight: 700, fontStyle: 'italic' }}>{o.name}</Text>
          <Blocks blocks={o.blocks} t={t} size={8.5} justify />
        </View>
      ))}
    </View>
  );
}

/** Só os títulos, em duas colunas. */
function TitleGrid({ items, t }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <View key={i} wrap={false} style={{ width: '50%', paddingRight: 8, paddingVertical: 1.5, flexDirection: 'row' }}>
          <Text style={{ ...body(t, 7.5), color: t.muted, width: 22 }}>{it.level ? `Lv ${it.level}` : ''}</Text>
          <Text style={{ ...body(t, 8.8), flex: 1 }}>
            <Text style={{ fontWeight: 700 }}>{it.name}</Text>
            {it.notes.length ? <Text style={{ fontStyle: 'italic', color: t.red }}> ({it.notes.join('; ')})</Text> : null}
            {!it.level && it.tag ? <Text style={{ fontStyle: 'italic', color: t.muted }}>{`  ${it.tag}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Um grupo de features (classe, subclasse, espécie, talentos). */
function FeatureGroup({ g, t }) {
  const full = g.detail === 'full';
  const flavor = g.flavor ? (
    <View wrap={isLong(g.flavor)} style={{ backgroundColor: t.panel, borderRadius: 3, padding: 5, marginBottom: 5 }}>
      <Blocks blocks={g.flavor} t={t} size={8.5} justify muted />
    </View>
  ) : null;
  const items = full ? g.items.map((it, i) => <FeatureItem key={i} item={it} t={t} />) : [<TitleGrid key="grid" items={g.items} t={t} />];
  const firstLong = flavor ? isLong(g.flavor) : full && isLong(g.items[0]?.blocks);
  const [first, ...rest] = flavor ? [flavor, ...items] : items;
  return (
    <View>
      <View wrap={!!firstLong}>
        <GroupTitle t={t} title={g.title} subtitle={g.subtitle} ahead={firstLong ? 120 : 0} />
        {first}
      </View>
      {rest}
    </View>
  );
}

/** As features, grupo por grupo. */
export function FeaturesSection({ groups, t, w }) {
  if (!groups.length) return null;
  return (
    <View>
      <SectionTitle t={t} width={w}>Features &amp; Traits</SectionTitle>
      {groups.map((g) => <FeatureGroup key={g.id} g={g} t={t} />)}
    </View>
  );
}

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** Os slots para marcar à mão, com o pacto à parte. */
function SlotTracker({ slots, pact, t }) {
  if (!slots.length && !pact) return null;
  return (
    <Box t={t} style={{ marginBottom: 6 }}>
      <Label t={t} color={t.red}>SPELL SLOTS</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 }}>
        {slots.map((s) => (
          <View key={s.level} style={{ width: '20%', flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Text style={{ ...body(t, 8.5), fontWeight: 700, width: 22 }}>{ORD[s.level]}</Text>
            <Pips t={t} n={s.total} size={7} gap={2.5} />
          </View>
        ))}
        {pact ? (
          <View style={{ width: '40%', flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Text style={{ ...body(t, 8.5), fontWeight: 700, marginRight: 4 }}>Pact ({ORD[pact.level]})</Text>
            <Pips t={t} n={pact.total} size={7} gap={2.5} shape="diamond" />
          </View>
        ) : null}
      </View>
    </Box>
  );
}

/** O bloco de uma origem de conjuração: atributo, DC, ataque e a tabela. */
function SpellTable({ o, t }) {
  const col = [{ width: 14 }, { width: 16, textAlign: 'center' }, { flex: 2.4 }, { width: 34 }, { flex: 1.1 }, { width: 34, textAlign: 'center' }, { flex: 1.6 }];
  const prep = (p) => (p === 'always' ? 2 : p === 'yes' ? 1 : 0);
  const row = (r, i) => (
    <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 1.5, backgroundColor: i % 2 ? 'transparent' : t.stripe }}>
      <View style={col[0]}>{r.prepared ? <Pips t={t} n={1} shape="diamond" size={6} filled={prep(r.prepared) ? 1 : 0} /> : null}</View>
      <Text style={{ ...body(t, 8.5), ...col[1] }}>{r.level}</Text>
      <Text style={{ ...body(t, 8.5), fontWeight: 700, ...col[2] }}>{r.name}</Text>
      <Text style={{ ...body(t, 8), ...col[3] }}>{r.time}</Text>
      <Text style={{ ...body(t, 8), ...col[4] }}>{r.range}</Text>
      <Text style={{ ...body(t, 8), ...col[5] }}>{[r.c ? 'C' : '-', r.r ? 'R' : '-', r.m ? 'M' : '-'].join(' ')}</Text>
      <Text style={{ ...body(t, 7.5), color: t.muted, ...col[6] }}>{[r.prepared === 'always' ? 'Always' : null, r.notes].filter(Boolean).join(', ')}</Text>
    </View>
  );
  return (
    <View style={{ marginBottom: 8 }}>
      <View wrap={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: t.red, paddingBottom: 1.5, marginBottom: 2 }}>
          <Text style={{ flex: 1, fontFamily: FONTS.title, fontWeight: 700, fontSize: 11, color: t.red }}>{o.title}</Text>
          {o.ability ? (
            <Text style={{ ...body(t, 8.5) }}>
              {o.ability} <Text style={{ fontWeight: 700 }}>{o.mod}</Text>   ·   Save DC <Text style={{ fontWeight: 700 }}>{o.dc}</Text>   ·   Attack <Text style={{ fontWeight: 700 }}>{o.attack}</Text>
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', paddingBottom: 1 }}>
          {['', 'Lv', 'Name', 'Time', 'Range', 'C R M', 'Notes'].map((h, i) => (
            <Text key={i} style={{ ...body(t, 7), color: t.muted, fontWeight: 700, ...col[i] }}>{h}</Text>
          ))}
        </View>
        {o.rows.slice(0, 2).map(row)}
      </View>
      {o.rows.slice(2).map((r, i) => row(r, i + 2))}
    </View>
  );
}

/** O cartão pode partir entre páginas (texto longo ou tabela)? */
const isLongCard = (card) => !!card && (blocksText(card.blocks).length + blocksText(card.higher).length > CARD_WRAP_CHARS
  || card.blocks.some((b) => b.type === 'table'));

/** O cartão de uma magia, com o texto completo. */
function SpellCard({ card, t }) {
  const meta = [['Casting Time', card.time], ['Range', card.range], ['Components', card.components], ['Duration', card.duration]];
  return (
    <View style={{ width: '49%', borderWidth: 0.8, borderColor: t.rule, borderRadius: 4, backgroundColor: t.box }}>
      <View style={{ backgroundColor: t.redSoft, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 5, paddingVertical: 2.5, borderBottomWidth: 0.8, borderBottomColor: t.red }}>
        <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 9, color: t.red }}>{card.name}</Text>
        <Text style={{ ...body(t, 7.5), fontStyle: 'italic', color: t.muted }}>{card.levelLine}</Text>
      </View>
      <View style={{ padding: 5 }}>
        {meta.map(([label, value]) => (
          <Text key={label} style={{ ...body(t, 7.5) }}>
            <Text style={{ fontWeight: 700 }}>{label}: </Text>{value}
          </Text>
        ))}
        <View style={{ borderTopWidth: 0.5, borderTopColor: t.rule, marginVertical: 3 }} />
        <Blocks blocks={card.blocks} t={t} size={7.8} />
        {card.higher ? <Blocks blocks={card.higher} t={t} size={7.8} /> : null}
      </View>
    </View>
  );
}

/** A lista em pares, para as linhas de dois cartões. */
const pairs = (list) => list.reduce((acc, c, i) => (i % 2 ? acc[acc.length - 1].push(c) : acc.push([c]), acc), []);

/** Os cartões de magia por círculo. */
function CardGrid({ cards, t }) {
  const levels = [...new Set(cards.map((c) => c.level))];
  const row = ([a, b]) => (
    <View key={a.key} wrap={isLongCard(a) || isLongCard(b)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
      <SpellCard card={a} t={t} />
      {b ? <SpellCard card={b} t={t} /> : null}
    </View>
  );
  return levels.map((lvl) => {
    const [first, ...rest] = pairs(cards.filter((c) => c.level === lvl));
    const longFirst = isLongCard(first[0]) || isLongCard(first[1]);
    return (
      <View key={lvl}>
        <View wrap={longFirst} minPresenceAhead={longFirst ? 200 : 0}>
          <GroupTitle t={t} title={lvl === 0 ? 'Cantrips' : `${ORD[lvl]} Level`} subtitle="Spell descriptions" ahead={longFirst ? 200 : 0} />
          {row(first)}
        </View>
        {rest.map(row)}
      </View>
    );
  });
}

/** A conjuração: slots, origens e cartões. */
export function SpellsSection({ sc, t, w }) {
  if (!sc.origins.length) return null;
  return (
    <View>
      <SectionTitle t={t} width={w}>Spellcasting</SectionTitle>
      <SlotTracker slots={sc.slots} pact={sc.pact} t={t} />
      {sc.origins.map((o) => <SpellTable key={o.id} o={o} t={t} />)}
      {sc.cards?.length ? <CardGrid cards={sc.cards} t={t} /> : null}
    </View>
  );
}

/** A tabela de um grupo de itens. */
function ItemTable({ g, t }) {
  const col = [{ flex: 3 }, { width: 28, textAlign: 'center' }, { width: 46, textAlign: 'right' }, { flex: 2, paddingLeft: 8 }];
  const long = (it) => blocksText(it.blocks).length + blocksText(it.flavor).length > LONG_ITEM_CHARS;
  const [first, ...rest] = g.items;
  const row = (it, i) => (
    <View
      key={it.uid ?? i}
      wrap={long(it)}
      style={{ backgroundColor: i % 2 ? 'transparent' : t.stripe, paddingVertical: 1.5 }}
    >
      <View wrap={false} minPresenceAhead={it.blocks || it.flavor ? 30 : 0} style={{ flexDirection: 'row' }}>
        <Text style={{ ...body(t, 8.8), fontWeight: 700, ...col[0] }}>{it.name}</Text>
        <Text style={{ ...body(t, 8.5), ...col[1] }}>{it.quantity > 1 ? `x${it.quantity}` : ''}</Text>
        <Text style={{ ...body(t, 8), color: t.muted, ...col[2] }}>{it.weight}</Text>
        <Text style={{ ...body(t, 7.5), color: t.red, fontStyle: 'italic', ...col[3] }}>{it.tags.join(', ')}</Text>
      </View>
      {it.blocks || it.flavor ? (
        <View style={{ marginLeft: 10, marginRight: 4, marginTop: 1.5 }}>
          {it.flavor ? <Blocks blocks={it.flavor} t={t} size={8} muted justify /> : null}
          {it.blocks ? <Blocks blocks={it.blocks} t={t} size={8.2} justify /> : null}
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={{ marginBottom: 6 }}>
      <View wrap={!first || long(first)}>
        <GroupTitle t={t} title={g.title} />
        {first ? row(first, 0) : null}
      </View>
      {rest.map((it, i) => row(it, i + 1))}
    </View>
  );
}

/** Moedas, peso e sintonia. */
function Coins({ inv, t }) {
  const coins = ['pp', 'gp', 'ep', 'sp', 'cp'];
  return (
    <View wrap={false} style={{ flexDirection: 'row', marginBottom: 6 }}>
      {coins.map((c) => (
        <Box key={c} t={t} style={{ width: 46, marginRight: 5, alignItems: 'center', paddingVertical: 3 }}>
          <Label t={t}>{c.toUpperCase()}</Label>
          <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 12, color: t.ink }}>{inv.coins?.[c] || ''}</Text>
        </Box>
      ))}
      <Box t={t} style={{ flex: 1, marginRight: 5, paddingVertical: 3 }}>
        <Label t={t} align="left">CARRIED WEIGHT</Label>
        <Text style={{ ...body(t, 10), fontWeight: 700, marginTop: 2 }}>
          {inv.totalWeight != null ? `${+inv.totalWeight.toFixed(1)} lb` : ''}
          {inv.capacity ? <Text style={{ fontWeight: 400, color: t.muted }}> / {inv.capacity} lb</Text> : null}
        </Text>
      </Box>
      <Box t={t} style={{ flex: 1.4, paddingVertical: 3 }}>
        <Label t={t} align="left">ATTUNEMENT</Label>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1.5 }}>
            <Pips t={t} n={1} shape="diamond" size={5.5} filled={inv.attuned[i] ? 1 : 0} />
            <Text style={{ ...body(t, 8), marginLeft: 3 }}>{inv.attuned[i] ?? ''}</Text>
          </View>
        ))}
      </Box>
    </View>
  );
}

/** O inventário. */
export function InventorySection({ inv, t, w }) {
  return (
    <View>
      <SectionTitle t={t} width={w}>Equipment</SectionTitle>
      <Coins inv={inv} t={t} />
      {inv.groups.map((g) => <ItemTable key={g.id} g={g} t={t} />)}
    </View>
  );
}

/** Um quadro de texto livre, ou linhas para escrever quando vazio. */
function TextBox({ label, text, t, lines = 3, style }) {
  return (
    <Box t={t} wrap={String(text ?? '').length > SHORT_CHARS} style={{ marginBottom: 6, ...style }}>
      <View minPresenceAhead={30}>
        <Label t={t} color={t.red} align="left">{label}</Label>
      </View>
      {text ? (
        String(text).split(/\n{2,}/).map((p, i) => (
          <Text key={i} style={{ ...body(t, 9), lineHeight: 1.35, marginTop: 2, textAlign: 'justify' }}>{p}</Text>
        ))
      ) : Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height: 13, borderBottomWidth: 0.4, borderBottomColor: t.rule }} />
      ))}
    </Box>
  );
}

/** A história do personagem. */
export function BiographySection({ b, t, w, portrait }) {
  return (
    <View>
      <SectionTitle t={t} width={w}>Biography</SectionTitle>
      {b.details.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {b.details.map((d) => (
            <Text key={d.label} style={{ ...body(t, 8.8), marginRight: 14 }}>
              <Text style={{ fontWeight: 700, color: t.red }}>{d.label}: </Text>{d.value}
            </Text>
          ))}
        </View>
      ) : null}
      {portrait ? (
        <View wrap={false} style={{ flexDirection: 'row', marginBottom: 6 }}>
          <View style={{ width: 150, marginRight: 6, borderWidth: 1.5, borderColor: t.red, borderRadius: 4, padding: 3, backgroundColor: t.box }}>
            <Image src={portrait} style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} />
          </View>
          <TextBox label="APPEARANCE" text={b.appearance} t={t} lines={9} style={{ flex: 1, marginBottom: 0 }} />
        </View>
      ) : (
        <TextBox label="APPEARANCE" text={b.appearance} t={t} />
      )}
      <View style={{ flexDirection: 'row' }}>
        <TextBox label="PERSONALITY" text={b.personality} t={t} style={{ flex: 1, marginRight: 5 }} />
        <TextBox label="IDEALS" text={b.ideals} t={t} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <TextBox label="BONDS" text={b.bonds} t={t} style={{ flex: 1, marginRight: 5 }} />
        <TextBox label="FLAWS" text={b.flaws} t={t} style={{ flex: 1 }} />
      </View>
      <TextBox label="BACKSTORY" text={b.backstory} t={t} lines={10} />
    </View>
  );
}
