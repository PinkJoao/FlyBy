// =============================================================================
// parts: as peças de desenho da ficha PDF (texto rico, blocos, caixas, fundo)
// =============================================================================
// O QUE FAZ
//   Os componentes de @react-pdf que o CharacterSheetDoc compõe. Tudo recebe o
//   tema `t` (theme.js) e nada conhece o personagem: o modelo chega pronto.
//
// FUNÇÕES
//   Rich(props): runs { text, b, i } num Text.
//   Blocks(props): os blocos do entries.js (parágrafo, lista, tabela, inset).
//   TableBlock(props): uma tabela de entries.
//   Ornament(props): a régua com losango no meio, sob os títulos.
//   SectionTitle(props), GroupTitle(props): os títulos de seção e de grupo.
//   Label(props): o rótulo em versalete.
//   Box(props): o quadro com borda e fundo do tema.
//   Pips(props): círculos ou losangos para marcar à mão.
//   PageBackground(props): o papel, a borda envelhecida e a moldura dupla.
//   RunningHeader(props), Footer(props): o cabeçalho das páginas seguintes e o
//     rodapé com a paginação.
//
// DECISÕES E ARMADILHAS
//   - O fundo e a moldura são `fixed` e absolutos, desenhados ANTES do conteúdo:
//     repetem em toda página e ficam por baixo do texto.
//   - O pergaminho é só vetor (gradiente radial nas bordas e um tom de papel):
//     nenhuma imagem, nenhuma textura de terceiros (DDL-0003, DDL-0105).
//   - Tabela: a legenda e o cabeçalho ficam juntos e pedem espaço para as
//     primeiras linhas; cada linha é inquebrável, e o inset até 1200 caracteres
//     também. O inset longo pode partir, mas o nome vai preso ao primeiro bloco.
//   - Lead de parágrafo em negrito itálico, como no livro; o corpo justificado
//     só no texto longo (a coluna estreita dos cartões fica à esquerda, para não
//     abrir buracos entre as palavras).
// -----------------------------------------------------------------------------

import { View, Text, Svg, Rect, Path, Circle, Defs, RadialGradient, Stop } from '@react-pdf/renderer';
import { FONTS } from './theme';
import { blocksText } from './entries';

/** Runs { text, b, i } num Text. */
export function Rich({ runs, style }) {
  return (
    <Text style={style}>
      {(runs ?? []).map((r, i) => (
        <Text key={i} style={{ fontWeight: r.b ? 700 : 400, fontStyle: r.i ? 'italic' : 'normal' }}>{r.text}</Text>
      ))}
    </Text>
  );
}

/** Uma tabela de entries. */
function TableBlock({ block, t, size }) {
  const cols = Math.max(block.head?.length ?? 0, ...block.rows.map((r) => r.length), 1);
  const cellStyle = (i) => ({ flex: i === 0 && cols > 2 ? 0.7 : 1, paddingHorizontal: 3, paddingVertical: 1.5 });
  return (
    <View style={{ marginVertical: 3 }} wrap={block.rows.length > 8 || JSON.stringify(block.rows).length > 1200}>
      <View minPresenceAhead={30} wrap={false}>
        {block.caption ? (
          <Text style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: size, color: t.ink, marginBottom: 1.5 }}>{block.caption}</Text>
        ) : null}
        {block.head ? (
          <View style={{ flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: t.red }}>
            {block.head.map((h, i) => (
              <View key={i} style={cellStyle(i)}>
                <Rich runs={h} style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: size - 0.5, color: t.red }} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {block.rows.map((row, ri) => (
        <View key={ri} wrap={false} style={{ flexDirection: 'row', backgroundColor: ri % 2 ? 'transparent' : t.stripe }}>
          {Array.from({ length: cols }).map((_, ci) => (
            <View key={ci} style={cellStyle(ci)}>
              <Rich runs={row[ci]} style={{ fontFamily: FONTS.body, fontSize: size - 0.5, color: t.ink }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Os blocos do entries.js. */
export function Blocks({ blocks, t, size = 9, justify = false, muted = false }) {
  const color = muted ? t.muted : t.ink;
  const para = { fontFamily: FONTS.body, fontSize: size, lineHeight: 1.3, color, marginBottom: 2.5, textAlign: justify ? 'justify' : 'left' };
  return (blocks ?? []).map((b, i) => {
    if (b.type === 'p') {
      return (
        <Text key={i} style={para}>
          {b.lead ? <Text style={{ fontWeight: 700, fontStyle: 'italic' }}>{b.lead}. </Text> : null}
          {b.runs.map((r, j) => (
            <Text key={j} style={{ fontWeight: r.b ? 700 : 400, fontStyle: r.i || muted ? 'italic' : 'normal' }}>{r.text}</Text>
          ))}
        </Text>
      );
    }
    if (b.type === 'list') {
      return (
        <View key={i} style={{ marginBottom: 2.5 }}>
          {b.items.map((item, j) => (
            <View key={j} style={{ flexDirection: 'row' }}>
              <Text style={{ ...para, width: 9, color: t.red }}>•</Text>
              <View style={{ flex: 1 }}>
                <Blocks blocks={item} t={t} size={size} justify={justify} muted={muted} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (b.type === 'table') return <TableBlock key={i} block={b} t={t} size={size} />;
    if (b.type === 'inset') {
      return (
        <View key={i} wrap={blocksText(b.blocks).length > 1200} style={{ borderLeftWidth: 2, borderLeftColor: t.red, backgroundColor: t.panel, padding: 5, marginVertical: 3 }}>
          <View wrap={false}>
            {b.name ? <Text style={{ ...para, fontWeight: 700 }}>{b.name}</Text> : null}
            <Blocks blocks={b.blocks.slice(0, 1)} t={t} size={size - 0.5} justify={justify} muted={muted} />
          </View>
          <Blocks blocks={b.blocks.slice(1)} t={t} size={size - 0.5} justify={justify} muted={muted} />
        </View>
      );
    }
    return null;
  });
}

/** A régua com losango no meio. */
export function Ornament({ t, width = 515, mt = 2, mb = 6 }) {
  const mid = width / 2;
  return (
    <Svg width={width} height={8} style={{ marginTop: mt, marginBottom: mb }}>
      <Path d={`M 0 4 L ${mid - 9} 4 M ${mid + 9} 4 L ${width} 4`} stroke={t.red} strokeWidth={0.8} />
      <Path d={`M ${mid - 6} 4 L ${mid} 0.5 L ${mid + 6} 4 L ${mid} 7.5 Z`} fill={t.red} />
    </Svg>
  );
}

/** O título de uma seção, com a régua. */
export function SectionTitle({ t, width, children }) {
  return (
    <View minPresenceAhead={120}>
      <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: 15, color: t.red, letterSpacing: 1.2, textAlign: 'center' }}>
        {children}
      </Text>
      <Ornament t={t} width={width} />
    </View>
  );
}

/** O título de um grupo (classe, subclasse, espécie). */
export function GroupTitle({ t, title, subtitle, ahead = 50 }) {
  return (
    <View minPresenceAhead={ahead} style={{ flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: t.red, marginTop: 8, marginBottom: 4, paddingBottom: 1.5 }}>
      <Text style={{ flex: 1, fontFamily: FONTS.title, fontWeight: 700, fontSize: 11.5, color: t.red, letterSpacing: 0.6 }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 8.5, color: t.muted }}>{subtitle}</Text> : null}
    </View>
  );
}

/** O rótulo em versalete. */
export function Label({ t, children, size = 6.5, align = 'center', color }) {
  return (
    <Text style={{ fontFamily: FONTS.title, fontWeight: 700, fontSize: size, letterSpacing: 0.6, color: color ?? t.muted, textAlign: align }}>
      {children}
    </Text>
  );
}

/** O quadro com borda e fundo do tema. */
export function Box({ t, style, children, wrap = false }) {
  return (
    <View wrap={wrap} style={{ borderWidth: 0.8, borderColor: t.rule, borderRadius: 4, backgroundColor: t.box, padding: 5, ...style }}>
      {children}
    </View>
  );
}

/** Círculos ou losangos para marcar à mão. */
export function Pips({ t, n, shape = 'circle', size = 7, gap = 3, filled = 0 }) {
  if (!n) return null;
  const w = n * size + (n - 1) * gap;
  return (
    <Svg width={w} height={size}>
      {Array.from({ length: n }).map((_, i) => {
        const x = i * (size + gap);
        const fill = i < filled ? t.red : 'none';
        if (shape === 'diamond') {
          const h = size / 2;
          return <Path key={i} d={`M ${x + h} 0.4 L ${x + size - 0.4} ${h} L ${x + h} ${size - 0.4} L ${x + 0.4} ${h} Z`} stroke={t.ink} strokeWidth={0.7} fill={fill} />;
        }
        if (shape === 'square') return <Rect key={i} x={x + 0.4} y={0.4} width={size - 0.8} height={size - 0.8} stroke={t.ink} strokeWidth={0.7} fill={fill} />;
        return <Circle key={i} cx={x + size / 2} cy={size / 2} r={size / 2 - 0.4} stroke={t.ink} strokeWidth={0.7} fill={fill} />;
      })}
    </Svg>
  );
}

/** O papel, a borda envelhecida e a moldura dupla, em toda página. */
export function PageBackground({ t, width, height }) {
  const inset = 16;
  const parchment = t.id === 'parchment';
  return (
    <View fixed style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height}>
        {parchment ? (
          <Defs>
            <RadialGradient id="edge" cx="50%" cy="50%" r="80%">
              <Stop offset="0%" stopColor={t.page} stopOpacity={1} />
              <Stop offset="62%" stopColor={t.page} stopOpacity={1} />
              <Stop offset="100%" stopColor={t.edge} stopOpacity={1} />
            </RadialGradient>
          </Defs>
        ) : null}
        <Rect x={0} y={0} width={width} height={height} fill={parchment ? 'url(#edge)' : t.page} />
        <Rect x={inset} y={inset} width={width - 2 * inset} height={height - 2 * inset} stroke={t.red} strokeWidth={1.1} fill="none" />
        <Rect x={inset + 3} y={inset + 3} width={width - 2 * inset - 6} height={height - 2 * inset - 6} stroke={t.red} strokeWidth={0.4} fill="none" />
        {[[inset, inset], [width - inset, inset], [inset, height - inset], [width - inset, height - inset]].map(([x, y], i) => (
          <Path key={i} d={`M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`} fill={t.red} />
        ))}
      </Svg>
    </View>
  );
}

/** O nome no alto das páginas seguintes à primeira. */
export function RunningHeader({ t, name, width }) {
  return (
    <Text
      fixed
      style={{ position: 'absolute', top: 24, left: 0, width, textAlign: 'center', fontFamily: FONTS.title, fontSize: 7.5, letterSpacing: 1, color: t.muted }}
      render={({ pageNumber }) => (pageNumber > 1 ? name : '')}
    />
  );
}

/** O rodapé com a paginação. */
export function Footer({ t, width }) {
  return (
    <Text
      fixed
      style={{ position: 'absolute', bottom: 22, left: 0, width, textAlign: 'center', fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 7, color: t.muted }}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}  ·  FlyBy`}
    />
  );
}
