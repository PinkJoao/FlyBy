// =============================================================================
// primitives: os blocos de desenho por coordenada da ficha PDF
// =============================================================================
// O QUE FAZ
//   Componentes absolutos (left e top em pt, origem no canto superior esquerdo):
//   molduras, títulos, rótulos, linhas, círculos de proficiência e losangos. Só a
//   estrutura funcional, sem a arte da ficha oficial; as coordenadas batem 1:1 com
//   o layout de referência (603 x 774 pt). Só exporta componentes (react-refresh).
//
// FUNÇÕES
//   Frame, Title, L, Rule, VLine, Circ, Diamond: moldura, título de seção, rótulo,
//     linha horizontal, linha vertical, círculo e losango.
// -----------------------------------------------------------------------------

import { View, Text, Svg, Path } from '@react-pdf/renderer';
import { COLORS } from './colors';

/** Moldura arredondada. */
export function Frame({ l, t, w, h, r = 5, bw = 0.9, color = COLORS.border, bg }) {
  return (
    <View
      style={{
        position: 'absolute', left: l, top: t, width: w, height: h,
        borderWidth: bw, borderColor: color, borderRadius: r,
        backgroundColor: bg,
      }}
    />
  );
}

/** Título de seção centralizado, em versalete. */
export function Title({ l, t, w, children, size = 8, color = COLORS.ink, spacing = 0.8 }) {
  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w }}>
      <Text style={{ fontSize: size, textAlign: 'center', fontFamily: 'Helvetica-Bold', letterSpacing: spacing, color }}>
        {children}
      </Text>
    </View>
  );
}

/** Rótulo ou valor de texto num ponto. */
export function L({ l, t, children, size = 7.5, w, align = 'left', bold = false, color = COLORS.ink, spacing = 0 }) {
  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w }}>
      <Text style={{ fontSize: size, textAlign: align, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica', color, letterSpacing: spacing }}>
        {children}
      </Text>
    </View>
  );
}

/** Linha horizontal. */
export function Rule({ l, t, w, color = COLORS.rule, bw = 0.7 }) {
  return <View style={{ position: 'absolute', left: l, top: t, width: w, borderTopWidth: bw, borderTopColor: color }} />;
}

/** Linha vertical. */
export function VLine({ l, t, h, color = COLORS.border, bw = 0.7 }) {
  return <View style={{ position: 'absolute', left: l, top: t, height: h, borderLeftWidth: bw, borderLeftColor: color }} />;
}

/** Círculo. */
export function Circ({ l, t, d, bw = 0.9, color = COLORS.border, bg }) {
  return (
    <View
      style={{
        position: 'absolute', left: l, top: t, width: d, height: d,
        borderWidth: bw, borderColor: color, borderRadius: d / 2, backgroundColor: bg,
      }}
    />
  );
}

/** Losango. */
export function Diamond({ l, t, s = 4, color = COLORS.border, bw = 0.8, fill = 'none' }) {
  const d = `M ${s} 0 L ${2 * s} ${s} L ${s} ${2 * s} L 0 ${s} Z`;
  return (
    <Svg style={{ position: 'absolute', left: l, top: t }} width={2 * s} height={2 * s}>
      <Path d={d} stroke={color} strokeWidth={bw} fill={fill} />
    </Svg>
  );
}
