// =============================================================================
// primitives - blocos de desenho por COORDENADA para a ficha PDF (clean-room)
// =============================================================================
// Componentes absolutos (left/top em pt, origem no canto superior-esquerdo) que
// montam NOSSA ficha própria: molduras, títulos, rótulos, linhas de escrita,
// círculos de proficiência e losangos. NÃO reproduzem a arte/branding da ficha ©
// original - só a estrutura funcional (caixas + rótulos), desenhada por nós.
//
// A página é dimensionada em 603 × 774 pt (mesma proporção da oficial), então as
// coordenadas batem 1:1 com o layout de referência.
//
// Só exporta componentes (regra react-refresh).
// -----------------------------------------------------------------------------

import { View, Text, Svg, Path } from '@react-pdf/renderer';
import { COLORS } from './colors';

/** Moldura arredondada (nossa versão limpa das molduras decorativas). */
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

/** Título de seção - centralizado numa faixa de largura `w`, versalete. */
export function Title({ l, t, w, children, size = 8, color = COLORS.ink, spacing = 0.8 }) {
  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w }}>
      <Text style={{ fontSize: size, textAlign: 'center', fontFamily: 'Helvetica-Bold', letterSpacing: spacing, color }}>
        {children}
      </Text>
    </View>
  );
}

/** Rótulo/valor de texto num ponto. `w`+`align` permitem centralizar/alinhar. */
export function L({ l, t, children, size = 7.5, w, align = 'left', bold = false, color = COLORS.ink, spacing = 0 }) {
  return (
    <View style={{ position: 'absolute', left: l, top: t, width: w }}>
      <Text style={{ fontSize: size, textAlign: align, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica', color, letterSpacing: spacing }}>
        {children}
      </Text>
    </View>
  );
}

/** Linha horizontal (regra de escrita ou divisória). */
export function Rule({ l, t, w, color = COLORS.rule, bw = 0.7 }) {
  return <View style={{ position: 'absolute', left: l, top: t, width: w, borderTopWidth: bw, borderTopColor: color }} />;
}

/** Linha vertical (divisória de colunas). */
export function VLine({ l, t, h, color = COLORS.border, bw = 0.7 }) {
  return <View style={{ position: 'absolute', left: l, top: t, height: h, borderLeftWidth: bw, borderLeftColor: color }} />;
}

/** Círculo (marcador de proficiência ou o grande círculo de atributo). */
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

/** Losango (spell slots, death saves, atunement, armor-training toggles). */
export function Diamond({ l, t, s = 4, color = COLORS.border, bw = 0.8, fill = 'none' }) {
  const d = `M ${s} 0 L ${2 * s} ${s} L ${s} ${2 * s} L 0 ${s} Z`;
  return (
    <Svg style={{ position: 'absolute', left: l, top: t }} width={2 * s} height={2 * s}>
      <Path d={d} stroke={color} strokeWidth={bw} fill={fill} />
    </Svg>
  );
}
