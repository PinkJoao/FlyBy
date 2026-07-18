// =============================================================================
// CharacterSheetDoc - a ficha PDF CLEAN-ROOM (Fase E), via @react-pdf/renderer
// =============================================================================
// Desenhamos NOSSA PRÓPRIA ficha, com layout FORTEMENTE baseado na organização e
// no posicionamento dos campos da ficha oficial 2024 - mas SEM a arte, o logo, o
// wordmark, as ilustrações, a textura de papel nem o aviso de marca da versão ©.
// Só a estrutura funcional do formulário (caixas + rótulos + linhas), redesenhada
// por nós. Ver memory/pdf-export-template.md + DDL-0003 ("ship code only").
//
// A página é 603 × 774 pt (mesma proporção da oficial), então as coordenadas dos
// campos batem com o layout de referência. Diferenças deliberadas da oficial:
// sem a moldura externa decorativa e sem a faixa do logo (o espaço vertical dela
// foi redistribuído para as caixas de conteúdo).
//
// GRID (padronização): margem de página 10 pt nos 4 lados (conteúdo x 10..593,
// y 10..764), calha de 6 pt entre cards, raio 6 nos cards e 3 nas caixas de
// escrita internas. Títulos de seção a 4 pt do topo do card, tamanho 8 (7 nos
// cards baixos da linha de stats).
//
// PREENCHIMENTO (E1+): recebe um `model` de ./sheetModel (uma entrada em
// `sheets` por classe - multiclasse gera fichas quase idênticas em sequência).
// Sem `model`, renderiza a ficha VAZIA (o template continua exportável).
// -----------------------------------------------------------------------------

import { Document, Page, View, Text } from '@react-pdf/renderer';
import { Frame, Title, L, Rule, VLine, Circ, Diamond } from './primitives';
import { COLORS } from './colors';

const PAGE = { width: 603, height: 774 };
const CAP = COLORS.muted; // cor dos rótulos pequenos (versaletes)

/** Trunca com reticências (as linhas da ficha não podem quebrar de célula). */
const clip = (v, n) => {
  const s = String(v ?? '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** Valor preenchido - some quando vazio (a ficha em branco continua limpa). */
function Val({ l, t, w, align = 'center', size = 8, bold = false, children }) {
  if (children == null || children === '') return null;
  return <L l={l} t={t} w={w} align={align} size={size} bold={bold}>{children}</L>;
}

/** Bloco de texto corrido (quebra automática dentro da largura). */
function Para({ l, t, w, size = 6.5, children }) {
  if (!children) return null;
  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w }}>
      <Text style={{ fontSize: size, lineHeight: 1.45, fontFamily: 'Helvetica', color: COLORS.ink }}>
        {children}
      </Text>
    </View>
  );
}

/** Uma linha de perícia/salvaguarda: círculo de proficiência (preenchido quando
 *  proficiente), linha do modificador (com o valor) e nome. */
function SkillRow({ sx, y, text, bold, value, prof }) {
  return (
    <>
      <Circ l={sx - 24} t={y - 0.3} d={7} bg={prof ? COLORS.ink : undefined} />
      <Rule l={sx - 15} t={y + 7.5} w={13} />
      <Val l={sx - 17} t={y + 0.5} w={17} size={6.5}>{value}</Val>
      <L l={sx + 2} t={y} size={7.5} bold={bold}>{text}</L>
    </>
  );
}

/** Bloco de atributo: moldura + título + círculo do modificador com a caixa do
 *  score encostada no seu canto inferior-direito (leve sobreposição, como a
 *  ficha oficial) + as linhas de salvaguarda/perícias. `data` (opcional) traz
 *  score/mod/save/perícias calculados pelo sheetModel. */
function AbilityBlock({ l, t, w, h, sx, name, rows, data }) {
  const cd = 40;               // diâmetro do círculo do modificador
  const cl = l + 7;            // x do círculo
  const ct = t + 13;           // y do círculo
  const scL = cl + cd - 4;     // caixa do score tangencia a borda direita do círculo
  const scT = ct + 16;
  return (
    <>
      <Frame l={l} t={t} w={w} h={h} r={6} />
      <Title l={l} t={t + 4} w={w} size={8}>{name}</Title>
      <Circ l={cl} t={ct} d={cd} />
      <Val l={cl} t={ct + 14} w={cd} size={13} bold>{data?.mod}</Val>
      <Frame l={scL} t={scT} w={25} h={14} r={3} bg={COLORS.paper} />
      <Val l={scL} t={scT + 3} w={25} size={8.5}>{data?.score}</Val>
      <L l={scL - 5} t={scT + 15.5} w={35} align="center" size={5.5} color={CAP} spacing={0.5}>SCORE</L>
      <L l={cl - 4} t={ct + cd + 2} w={cd + 8} align="center" size={5.5} color={CAP} spacing={0.5}>MODIFIER</L>
      {rows.map((r) => {
        const cell = r.code === 'save'
          ? { value: data?.save, prof: data?.saveProf }
          : data?.skills?.[r.code];
        return (
          <SkillRow key={r.text} sx={sx} y={r.y} text={r.text} bold={r.bold}
            value={cell?.value} prof={cell?.prof} />
        );
      })}
    </>
  );
}

/** N linhas horizontais igualmente espaçadas (papel pautado das tabelas). */
function HRules({ l, t, w, n, gap }) {
  return Array.from({ length: n }).map((_, i) => <Rule key={i} l={l} t={t + i * gap} w={w} />);
}

/** Caracteres estimados por linha (Helvetica ≈ 0.52 em de largura média). */
const charsPerLine = (w, size) => Math.max(8, Math.floor(w / (size * 0.52)));

/** Quebra manual por palavras (as linhas da lista são posicionadas por contagem,
 *  então a quebra automática do Text estouraria o card). Continuações recuadas. */
function wrapLine(s, maxChars) {
  const words = String(s).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = `   ${w}`;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Lista de nomes em coluna(s) de texto corrido: entradas longas QUEBRAM em
 *  linhas de continuação (contadas no orçamento) e o estouro é sinalizado. */
function NameList({ cols, lines, perCol, size = 6.5 }) {
  const total = cols.length * perCol;
  const maxChars = charsPerLine(cols[0].w, size);
  const shown = [];
  let taken = 0;
  for (; taken < lines.length; taken++) {
    const wrapped = wrapLine(lines[taken], maxChars);
    if (shown.length + wrapped.length > total) break;
    shown.push(...wrapped);
  }
  const remaining = lines.length - taken;
  if (remaining > 0) {
    // Abre espaço p/ o marcador (descartando a última linha se preciso).
    if (shown.length >= total) shown.pop();
    shown.push(`… +${remaining} more`);
  }
  return cols.map((c, i) => (
    <Para key={c.l} l={c.l} t={c.t} w={c.w} size={size}>
      {shown.slice(i * perCol, (i + 1) * perCol).join('\n') || null}
    </Para>
  ));
}

/** Card de TRAÇOS DA ESPÉCIE: parágrafos `{ lead, text }` (lead em negrito -
 *  mesma estrutura da tela de Species, compactada: só quebras de linha e
 *  negrito). Como os traços não mudam nem crescem, a fonte é escolhida para
 *  OCUPAR a caixa inteira - a MAIOR que ainda cabe (10 → 4 pt); se nem a menor
 *  basta, corta o excedente com reticências (o jogador consulta o livro). */
function FitTraits({ l, t, w, h, traits }) {
  if (!traits?.length) return null;
  const gap = 2; // margem entre parágrafos
  const chars = (p) => (p.lead ? p.lead.length + 2 : 0) + (p.text?.length ?? 0);
  const linesOf = (p, cpl) => Math.max(1, Math.ceil(chars(p) / cpl));
  const estimate = (size) => {
    const cpl = charsPerLine(w, size);
    const lines = traits.reduce((sum, p) => sum + linesOf(p, cpl), 0);
    return lines * size * 1.25 + traits.length * gap;
  };
  const SIZES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4];
  const size = SIZES.find((s) => estimate(s) <= h) ?? 4;

  // Orçamento na fonte final: corta os parágrafos que não cabem (o corte é no
  // texto corrido; leads já impressos ficam intactos).
  const cpl = charsPerLine(w, size);
  const maxLines = Math.floor((h - traits.length * gap) / (size * 1.25));
  let used = 0;
  const shown = [];
  for (const p of traits) {
    const need = linesOf(p, cpl);
    if (used + need <= maxLines) {
      shown.push(p);
      used += need;
    } else {
      const left = Math.max(0, maxLines - used) * cpl - (p.lead ? p.lead.length + 2 : 0) - 1;
      if (left > 0) shown.push({ lead: p.lead, text: `${(p.text ?? '').slice(0, left)}…` });
      break;
    }
  }

  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w, height: h, overflow: 'hidden' }}>
      {shown.map((p, i) => (
        <Text
          key={i}
          style={{ fontSize: size, lineHeight: 1.25, marginBottom: gap, fontFamily: 'Helvetica', color: COLORS.ink }}
        >
          {p.lead ? <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.lead}. </Text> : null}
          {p.text}
        </Text>
      ))}
    </View>
  );
}

// --- PÁGINA 1: combate, atributos, perícias, equipamento ----------------------
// Linha do topo: y 10..88 (h78). Linha 2 em y94. Coluna A x 10..120, coluna B
// x 126..222, coluna direita x 228..593. Rodapé em y764.
function PageOne({ s }) {
  return (
    <Page size={[PAGE.width, PAGE.height]} style={{ fontFamily: 'Helvetica' }}>
      {/* Identidade */}
      <Frame l={10} t={10} w={232} h={78} r={6} />
      <Rule l={22} t={25} w={214} />
      <Val l={24} t={15.5} w={210} align="left" size={9}>{clip(s?.name, 48)}</Val>
      <L l={24} t={27.5} size={6.5} color={CAP} spacing={0.5}>CHARACTER NAME</L>
      <Rule l={22} t={47} w={110} />
      <Val l={24} t={38.5} w={106} align="left" size={8}>{clip(s?.background, 24)}</Val>
      <L l={24} t={49} size={6.5} color={CAP} spacing={0.5}>BACKGROUND</L>
      <Rule l={140} t={47} w={96} />
      <Val l={142} t={38.5} w={92} align="left" size={8}>{clip(s?.classText, 21)}</Val>
      <L l={142} t={49} size={6.5} color={CAP} spacing={0.5}>CLASS</L>
      <Rule l={22} t={69} w={110} />
      <Val l={24} t={60.5} w={106} align="left" size={8}>{clip(s?.speciesText, 24)}</Val>
      <L l={24} t={71} size={6.5} color={CAP} spacing={0.5}>SPECIES</L>
      <Rule l={140} t={69} w={96} />
      <Val l={142} t={60.5} w={92} align="left" size={8}>{clip(s?.subclassText, 21)}</Val>
      <L l={142} t={71} size={6.5} color={CAP} spacing={0.5}>SUBCLASS</L>

      {/* Level / XP (XP fica em branco para o jogador) */}
      <Frame l={248} t={10} w={56} h={78} r={6} />
      <Rule l={256} t={42} w={40} />
      <Val l={256} t={30} w={40} size={10} bold>{s?.level}</Val>
      <L l={248} t={45} w={56} align="center" size={7} color={CAP} spacing={0.5}>LEVEL</L>
      <Rule l={256} t={70} w={40} />
      <L l={248} t={73} w={56} align="center" size={7} color={CAP} spacing={0.5}>XP</L>

      {/* Armor Class (escudo) */}
      <Frame l={310} t={10} w={60} h={78} r={6} />
      <L l={310} t={15} w={60} align="center" size={7} bold spacing={0.4}>ARMOR</L>
      <L l={310} t={23} w={60} align="center" size={7} bold spacing={0.4}>CLASS</L>
      <Circ l={327} t={33} d={26} />
      <Val l={327} t={41} w={26} size={11} bold>{s?.ac}</Val>
      <L l={310} t={62} w={60} align="center" size={6.5} color={CAP} spacing={0.4}>SHIELD</L>
      <Diamond l={336} t={70} s={4} fill={s?.shield ? COLORS.ink : 'none'} />

      {/* Hit Points (current/temp em branco) */}
      <Frame l={376} t={10} w={102} h={78} r={6} />
      <Title l={376} t={14} w={102} size={8}>HIT POINTS</Title>
      <VLine l={431} t={28} h={56} />
      <L l={380} t={76} size={6.5} color={CAP} spacing={0.4}>CURRENT</L>
      <Rule l={437} t={44} w={38} />
      <L l={437} t={47} size={6.5} color={CAP} spacing={0.4}>TEMP</L>
      <Rule l={437} t={66} w={38} />
      <Val l={437} t={56} w={38} size={9}>{s?.hpMax}</Val>
      <L l={437} t={69} size={6.5} color={CAP} spacing={0.4}>MAX</L>

      {/* Hit Dice (spent em branco) */}
      <Frame l={484} t={10} w={50} h={78} r={6} />
      <Title l={484} t={14} w={50} size={8}>HIT DICE</Title>
      <Rule l={490} t={44} w={38} />
      <L l={491} t={47} size={6.5} color={CAP} spacing={0.4}>SPENT</L>
      <Rule l={490} t={66} w={38} />
      <Val l={490} t={58} w={38} size={6.5}>{s?.hitDice}</Val>
      <L l={491} t={69} size={6.5} color={CAP} spacing={0.4}>MAX</L>

      {/* Death Saves (em branco) */}
      <Frame l={540} t={10} w={53} h={78} r={6} />
      <L l={540} t={14} w={53} align="center" size={8} bold spacing={0.4}>DEATH</L>
      <L l={540} t={22} w={53} align="center" size={8} bold spacing={0.4}>SAVES</L>
      {[552, 562, 572].map((x) => <Diamond key={x} l={x} t={38} s={4} />)}
      <L l={540} t={47} w={53} align="center" size={6.5} color={CAP} spacing={0.4}>SUCCESSES</L>
      {[552, 562, 572].map((x) => <Diamond key={x} l={x} t={60} s={4} />)}
      <L l={540} t={69} w={53} align="center" size={6.5} color={CAP} spacing={0.4}>FAILURES</L>

      {/* Proficiency Bonus + linha de stats */}
      <Frame l={10} t={94} w={110} h={74} r={6} />
      <Title l={10} t={98} w={110} size={8}>PROFICIENCY BONUS</Title>
      <Frame l={38} t={119} w={54} h={40} r={3} />
      <Val l={38} t={132} w={54} size={14} bold>{s?.profBonus}</Val>

      <Frame l={228} t={94} w={74} h={46} r={6} />
      <Title l={228} t={98} w={74} size={7}>INITIATIVE</Title>
      <Rule l={240} t={124} w={50} />
      <Val l={240} t={113} w={50} size={10}>{s?.initiative}</Val>
      <Frame l={308} t={94} w={82} h={46} r={6} />
      <Title l={308} t={98} w={82} size={7}>SPEED</Title>
      <Rule l={323} t={124} w={52} />
      <Val l={323} t={114} w={52} size={9}>{s?.speed}</Val>
      <Frame l={396} t={94} w={74} h={46} r={6} />
      <Title l={396} t={98} w={74} size={7}>SIZE</Title>
      <Rule l={409} t={124} w={48} />
      <Val l={409} t={113} w={48} size={10}>{s?.size}</Val>
      <Frame l={476} t={94} w={117} h={46} r={6} />
      <Title l={476} t={98} w={117} size={7}>PASSIVE PERCEPTION</Title>
      <Rule l={497} t={124} w={74} />
      <Val l={497} t={113} w={74} size={10}>{s?.passivePerception}</Val>

      {/* Atributos - coluna A (x10 w110) e coluna B (x126 w96) */}
      <AbilityBlock l={126} t={94} w={96} h={175} sx={155} name="INTELLIGENCE" data={s?.abilities?.int}
        rows={[{ y: 169, code: 'save', text: 'Saving Throw', bold: true }, { y: 189, code: 'arc', text: 'Arcana' }, { y: 203, code: 'his', text: 'History' }, { y: 217, code: 'inv', text: 'Investigation' }, { y: 231, code: 'nat', text: 'Nature' }, { y: 245, code: 'rel', text: 'Religion' }]} />
      <AbilityBlock l={10} t={174} w={110} h={111} sx={47} name="STRENGTH" data={s?.abilities?.str}
        rows={[{ y: 244, code: 'save', text: 'Saving Throw', bold: true }, { y: 264, code: 'ath', text: 'Athletics' }]} />
      <AbilityBlock l={126} t={275} w={96} h={168} sx={155} name="WISDOM" data={s?.abilities?.wis}
        rows={[{ y: 347, code: 'save', text: 'Saving Throw', bold: true }, { y: 367, code: 'ani', text: 'Animal Handling' }, { y: 381, code: 'ins', text: 'Insight' }, { y: 395, code: 'med', text: 'Medicine' }, { y: 409, code: 'prc', text: 'Perception' }, { y: 423, code: 'sur', text: 'Survival' }]} />
      <AbilityBlock l={10} t={291} w={110} h={145} sx={47} name="DEXTERITY" data={s?.abilities?.dex}
        rows={[{ y: 366, code: 'save', text: 'Saving Throw', bold: true }, { y: 386, code: 'acr', text: 'Acrobatics' }, { y: 400, code: 'slt', text: 'Sleight of Hand' }, { y: 414, code: 'ste', text: 'Stealth' }]} />
      <AbilityBlock l={10} t={442} w={110} h={96} sx={47} name="CONSTITUTION" data={s?.abilities?.con}
        rows={[{ y: 516, code: 'save', text: 'Saving Throw', bold: true }]} />
      <AbilityBlock l={126} t={449} w={96} h={153} sx={155} name="CHARISMA" data={s?.abilities?.cha}
        rows={[{ y: 525, code: 'save', text: 'Saving Throw', bold: true }, { y: 545, code: 'dec', text: 'Deception' }, { y: 559, code: 'itm', text: 'Intimidation' }, { y: 573, code: 'prf', text: 'Performance' }, { y: 587, code: 'per', text: 'Persuasion' }]} />

      {/* Heroic Inspiration (em branco) */}
      <Frame l={10} t={544} w={110} h={58} r={6} />
      <L l={10} t={549} w={110} align="center" size={8} bold spacing={0.4}>HEROIC</L>
      <L l={10} t={557} w={110} align="center" size={8} bold spacing={0.4}>INSPIRATION</L>
      <Diamond l={58} t={574} s={7} />

      {/* Equipment Training & Proficiencies */}
      <Frame l={10} t={608} w={212} h={156} r={6} />
      <Title l={10} t={612} w={212} size={8}>EQUIPMENT TRAINING & PROFICIENCIES</Title>
      <L l={16} t={627} size={6.5} color={CAP} spacing={0.4}>ARMOR</L>
      <L l={16} t={635} size={6.5} color={CAP} spacing={0.4}>TRAINING</L>
      <Diamond l={62} t={631} s={3.5} fill={s?.armorTraining?.light ? COLORS.ink : 'none'} /><L l={71} t={631} size={7}>Light</L>
      <Diamond l={100} t={631} s={3.5} fill={s?.armorTraining?.medium ? COLORS.ink : 'none'} /><L l={109} t={631} size={7}>Medium</L>
      <Diamond l={144} t={631} s={3.5} fill={s?.armorTraining?.heavy ? COLORS.ink : 'none'} /><L l={153} t={631} size={7}>Heavy</L>
      <Diamond l={182} t={631} s={3.5} fill={s?.armorTraining?.shields ? COLORS.ink : 'none'} /><L l={191} t={631} size={7}>Shields</L>
      <Rule l={14} t={646} w={204} color={COLORS.border} />
      <L l={16} t={650} size={6.5} color={CAP} spacing={0.4}>WEAPONS</L>
      <Para l={16} t={660} w={196}>{s?.weaponProfs}</Para>
      <Rule l={14} t={710} w={204} color={COLORS.border} />
      <L l={16} t={714} size={6.5} color={CAP} spacing={0.4}>TOOLS</L>
      <Para l={16} t={724} w={196}>{s?.toolProfs}</Para>

      {/* Weapons & Damage / Cantrips */}
      <Frame l={228} t={146} w={365} h={162} r={6} />
      <Title l={228} t={150} w={365} size={8}>WEAPONS & DAMAGE CANTRIPS</Title>
      <L l={234} t={171} size={7} color={CAP}>Name</L>
      <L l={336} t={171} size={7} color={CAP}>Atk Bonus / DC</L>
      <L l={400} t={171} size={7} color={CAP}>Damage & Type</L>
      <L l={476} t={171} size={7} color={CAP}>Notes</L>
      <Rule l={230} t={182} w={361} color={COLORS.border} />
      <VLine l={332} t={168} h={136} /><VLine l={396} t={168} h={136} /><VLine l={470} t={168} h={136} />
      <HRules l={232} t={198} w={357} n={8} gap={15} />
      {(s?.weaponRows ?? []).slice(0, 8).map((w, i) => (
        <View key={i}>
          <Val l={234} t={190 + i * 15} w={95} align="left" size={7}>{clip(w.name, 24)}</Val>
          <Val l={336} t={190 + i * 15} w={56} size={7}>{w.bonus}</Val>
          <Val l={400} t={190 + i * 15} w={66} align="left" size={7}>{clip(w.damage, 16)}</Val>
          <Val l={474} t={190 + i * 15} w={116} align="left" size={6.5}>{clip(w.notes, 32)}</Val>
        </View>
      ))}

      {/* Class Features (só os NOMES - o jogador consulta os livros) */}
      <Frame l={228} t={314} w={365} h={236} r={6} />
      <Title l={228} t={318} w={365} size={8}>CLASS FEATURES</Title>
      <VLine l={412} t={336} h={206} />
      {s?.classFeatures?.length ? (
        <NameList perCol={22} lines={s.classFeatures}
          cols={[{ l: 234, t: 334, w: 170 }, { l: 418, t: 334, w: 169 }]} />
      ) : null}

      {/* Species Traits (nome + DESCRIÇÃO, fonte adaptativa) + Feats */}
      <Frame l={228} t={556} w={179} h={208} r={6} />
      <Title l={228} t={560} w={179} size={8}>SPECIES TRAITS</Title>
      <FitTraits l={234} t={572} w={167} h={186} traits={s?.speciesTraits} />
      <Frame l={413} t={556} w={180} h={208} r={6} />
      <Title l={413} t={560} w={180} size={8}>FEATS</Title>
      {s?.feats?.length ? (
        <NameList perCol={19} lines={s.feats} cols={[{ l: 419, t: 574, w: 168 }]} />
      ) : null}
    </Page>
  );
}

// --- PÁGINA 2: conjuração, magias, história, equipamento ----------------------
const SLOT_PIPS = { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 };

/** Uma linha de spell slot: "Level N" + linha (total preenchido) + losangos
 *  (expended - sempre em branco, o jogador marca na mesa). */
function SlotRow({ x, y, level, total }) {
  return (
    <>
      <L l={x} t={y} size={7.5}>Level {level}</L>
      <Rule l={x + 34} t={y + 8} w={12} />
      <Val l={x + 34} t={y + 0.5} w={12} size={7.5}>{total || ''}</Val>
      {Array.from({ length: SLOT_PIPS[level] }).map((_, i) => (
        <Diamond key={i} l={x + 50 + i * 9} t={y} s={3.3} />
      ))}
    </>
  );
}

/** Uma linha da tabela de magias: linhas de escrita + losangos C / R / M
 *  (preenchidos conforme a magia), com os valores da `row` quando houver. */
function SpellRow({ y, row }) {
  return (
    <>
      <Rule l={14} t={y + 9} w={18} />
      <Val l={14} t={y + 1} w={18} size={7}>{row?.level}</Val>
      <Rule l={38} t={y + 9} w={104} />
      <Val l={38} t={y + 1} w={104} align="left" size={7}>{clip(row?.name, 28)}</Val>
      <Rule l={148} t={y + 9} w={30} />
      <Val l={148} t={y + 1.5} w={30} size={6.5}>{row?.time}</Val>
      <Rule l={182} t={y + 9} w={42} />
      <Val l={182} t={y + 1.5} w={42} align="left" size={6.5}>{clip(row?.range, 12)}</Val>
      <Rule l={298} t={y + 9} w={96} />
      <Val l={298} t={y + 2} w={96} align="left" size={6}>{clip(row?.notes, 32)}</Val>
      <Diamond l={232} t={y} s={3.4} fill={row?.c ? COLORS.ink : 'none'} /><L l={241} t={y + 0.5} size={6.5} color={CAP}>C</L>
      <Diamond l={254} t={y} s={3.4} fill={row?.r ? COLORS.ink : 'none'} /><L l={263} t={y + 0.5} size={6.5} color={CAP}>R</L>
      <Diamond l={276} t={y} s={3.4} fill={row?.m ? COLORS.ink : 'none'} /><L l={285} t={y + 0.5} size={6.5} color={CAP}>M</L>
    </>
  );
}

// Linhas de magia por página - acima disso a ficha ganha PÁGINAS EXTRAS de
// magias (só a página 2 repete; a 1 é idêntica, a classe não muda).
export const SPELL_ROWS_PER_PAGE = 31;

/** Página 2. `rows` = a fatia de magias DESTA página (paginação acima). */
function PageTwo({ s, rows }) {
  const spellRows = Array.from({ length: SPELL_ROWS_PER_PAGE }, (_, i) => 162 + i * 19.4);
  return (
    <Page size={[PAGE.width, PAGE.height]} style={{ fontFamily: 'Helvetica' }}>
      {/* Spellcasting ability */}
      <Frame l={10} t={10} w={122} h={104} r={6} />
      <L l={16} t={14} size={6.5} color={CAP} spacing={0.4}>SPELLCASTING ABILITY</L>
      <Val l={100} t={14} w={28} align="right" size={7} bold>{s?.spellAbilityCode}</Val>
      <Frame l={12} t={27} w={38} h={27} r={3} />
      <Val l={12} t={35} w={38} size={11} bold>{s?.spellMod}</Val>
      <Frame l={12} t={56} w={38} h={27} r={3} />
      <Val l={12} t={64} w={38} size={11} bold>{s?.spellDc}</Val>
      <Frame l={12} t={85} w={38} h={27} r={3} />
      <Val l={12} t={93} w={38} size={11} bold>{s?.spellAtk}</Val>
      <L l={54} t={31} size={7.5} bold>SPELLCASTING</L>
      <L l={54} t={39} size={7.5} bold>MODIFIER</L>
      <L l={54} t={66} size={7.5} bold>SPELL SAVE DC</L>
      <L l={54} t={89} size={7.5} bold>SPELL ATTACK</L>
      <L l={54} t={97} size={7.5} bold>BONUS</L>

      {/* Spell slots (totais preenchidos; expended em branco) */}
      <Frame l={138} t={10} w={260} h={104} r={6} />
      <Title l={138} t={14} w={260} size={8}>SPELL SLOTS</Title>
      {[{ cx: 146 }, { cx: 232 }, { cx: 312 }].map(({ cx }) => (
        <View key={cx}>
          <L l={cx + 30} t={38} size={6.5} color={CAP}>Total</L>
          <L l={cx + 48} t={38} size={6.5} color={CAP}>Expended</L>
        </View>
      ))}
      {[[1, 2, 3], [4, 5, 6], [7, 8, 9]].map((col, ci) =>
        col.map((lvl, ri) => (
          <SlotRow key={lvl} x={[146, 232, 312][ci]} y={50 + ri * 19} level={lvl}
            total={s?.slotTotals?.[lvl]} />
        )),
      )}

      {/* Appearance */}
      <Frame l={404} t={10} w={189} h={104} r={6} />
      <Title l={404} t={14} w={189} size={8}>APPEARANCE</Title>
      <Para l={408} t={26} w={181}>{clip(s?.appearance, 320)}</Para>

      {/* Backstory & Personality (+ Alignment) */}
      <Frame l={404} t={120} w={189} h={195} r={6} />
      <Title l={404} t={124} w={189} size={8}>BACKSTORY & PERSONALITY</Title>
      <Para l={408} t={136} w={181}>{clip(s?.backstory, 560)}</Para>
      <L l={408} t={280} size={7} color={CAP}>Alignment</L>
      <Rule l={408} t={297} w={177} />
      <Val l={408} t={288.5} w={177} align="left" size={7.5}>{s?.alignment}</Val>

      {/* Languages */}
      <Frame l={404} t={321} w={189} h={68} r={6} />
      <Title l={404} t={325} w={189} size={8}>LANGUAGES</Title>
      <Para l={408} t={337} w={181}>{clip(s?.languages, 190)}</Para>

      {/* Equipment (+ Magic Item Attunement) */}
      <Frame l={404} t={395} w={189} h={299} r={6} />
      <Title l={404} t={399} w={189} size={8}>EQUIPMENT</Title>
      {s?.equipmentLines?.length ? (
        <NameList perCol={24} lines={s.equipmentLines} cols={[{ l: 408, t: 411, w: 181 }]} />
      ) : null}
      <L l={408} t={638} size={7} color={CAP}>Magic Item Attunement</L>
      {[650, 666, 682].map((y, i) => (
        <View key={y}>
          <Diamond l={408} t={y} s={4} />
          <Rule l={420} t={y + 8} w={165} />
          <Val l={422} t={y} w={160} align="left" size={7}>{clip(s?.attunedNames?.[i], 42)}</Val>
        </View>
      ))}

      {/* Coins */}
      <Frame l={404} t={700} w={189} h={64} r={6} />
      <Title l={404} t={704} w={189} size={8}>COINS</Title>
      {['CP', 'SP', 'EP', 'GP', 'PP'].map((c, i) => {
        const cx = 415 + i * 35;
        return (
          <View key={c}>
            <L l={cx} t={716} w={26} align="center" size={6.5} color={CAP}>{c}</L>
            <Frame l={cx} t={726} w={26} h={32} r={3} />
            <Val l={cx} t={738} w={26} size={8.5}>{s?.coins?.[c.toLowerCase()] || ''}</Val>
          </View>
        );
      })}

      {/* Cantrips & Prepared Spells */}
      <Frame l={10} t={120} w={388} h={644} r={6} />
      <Title l={10} t={124} w={388} size={8}>CANTRIPS & PREPARED SPELLS</Title>
      <L l={15} t={149} size={7} color={CAP}>Level</L>
      <L l={38} t={149} size={7} color={CAP}>Name</L>
      <L l={148} t={142} size={7} color={CAP}>Casting</L>
      <L l={148} t={149} size={7} color={CAP}>Time</L>
      <L l={184} t={149} size={7} color={CAP}>Range</L>
      <L l={230} t={142} size={7} color={CAP}>Concentration, Ritual</L>
      <L l={230} t={149} size={7} color={CAP}>& Required Material</L>
      <L l={301} t={149} size={7} color={CAP}>Notes</L>
      <Rule l={14} t={158} w={380} color={COLORS.border} />
      <VLine l={34} t={140} h={616} /><VLine l={146} t={140} h={616} /><VLine l={180} t={140} h={616} />
      <VLine l={226} t={140} h={616} /><VLine l={296} t={140} h={616} />
      {spellRows.map((y, i) => <SpellRow key={y} y={y} row={rows?.[i]} />)}
    </Page>
  );
}

/** Fatia as linhas de magia em páginas de SPELL_ROWS_PER_PAGE (mínimo uma -
 *  a ficha em branco / sem magias mantém a página 2 vazia). */
function spellPageChunks(rows) {
  const all = rows ?? [];
  const chunks = [];
  for (let i = 0; i < Math.max(all.length, 1); i += SPELL_ROWS_PER_PAGE) {
    chunks.push(all.slice(i, i + SPELL_ROWS_PER_PAGE));
  }
  return chunks;
}

/** A ficha completa. Sem `model` → template VAZIO; com `model` → uma ficha por
 *  entrada de `sheets` (multiclasse = fichas em sequência). Magias além das
 *  linhas da página 2 geram PÁGINAS EXTRAS de magias (a página 1 não repete -
 *  a classe é a mesma). */
export default function CharacterSheet({ model }) {
  const sheets = model?.sheets?.length ? model.sheets : [null];
  return (
    <Document title="Character Sheet" author="FlyBy">
      {sheets.map((s, i) => [
        <PageOne key={`p1-${i}`} s={s} />,
        ...spellPageChunks(s?.spellRows).map((rows, j) => (
          <PageTwo key={`p2-${i}-${j}`} s={s} rows={rows} />
        )),
      ])}
    </Document>
  );
}
