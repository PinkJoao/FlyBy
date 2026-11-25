// =============================================================================
// metaChip: o tom de um chip de meta (o preview e o carrossel dos seletores)
// =============================================================================
// FUNÇÕES
//   metaChip(m): as props do Chip para uma linha de meta da entity: o tom do status
//     (pré-requisito contra o personagem), o tom pedido ou o aceso do destaque.
// -----------------------------------------------------------------------------

const STATUS_TONE = { ok: 'success', bad: 'danger', unknown: 'warning' };
const META_TONE = { blue: 'info', red: 'danger' };

/** O tom e o aceso de um chip de meta (pré-requisito, tom do dado, destaque). */
export function metaChip(m) {
  if (m.status) return { tone: STATUS_TONE[m.status] };
  if (m.tone === 'accent' || (!m.tone && m.highlight)) return { active: true };
  return { tone: META_TONE[m.tone] };
}
