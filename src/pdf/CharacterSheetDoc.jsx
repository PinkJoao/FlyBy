// =============================================================================
// CharacterSheetDoc: a ficha PDF do FlyBy, em @react-pdf/renderer
// =============================================================================
// O QUE FAZ
//   A ficha PRÓPRIA do app (DDL-0105): sem a organização da ficha oficial, sem
//   arte, logo ou marca (DDL-0003). Recebe o `model` do sheetModel e desenha em
//   fluxo, uma seção depois da outra, cada uma começando numa página nova: a de
//   combate, as features, a conjuração, o inventário e a história, conforme as
//   seções ligadas nas opções. Em toda página: o papel do tema, a moldura dupla,
//   o nome no alto (da segunda em diante) e a paginação no pé.
//
// FUNÇÕES
//   pageSize(id): as dimensões do papel em pontos.
//   CharacterSheet(props): o documento.
//
// DECISÕES E ARMADILHAS
//   - As fontes são registradas por quem chama (exportPdf, o preview e os
//     testes), com registerPdfFonts: o caminho do arquivo depende do ambiente.
//   - A seção sem conteúdo (sem magia, sem item) não desenha nem abre página.
//   - Depois da página de combate, cada seção abre página nova só quando há
//     texto longo (alguma feature completa ou os cartões de magia); na ficha
//     compacta elas seguem uma depois da outra. A história nunca força página.
// -----------------------------------------------------------------------------

import { Document, Page, View } from '@react-pdf/renderer';
import { themeFor, FONTS } from './theme';
import { PageBackground, RunningHeader, Footer } from './parts';
import { CombatSection, FeaturesSection, SpellsSection, InventorySection, BiographySection } from './sections';

const PAGE_SIZES = { A4: [595.28, 841.89], LETTER: [612, 792] };
const PAD = { top: 38, bottom: 40, side: 34 };

/** As dimensões do papel em pontos. */
function pageSize(id) {
  return PAGE_SIZES[id] ?? PAGE_SIZES.A4;
}

/** A ficha completa. */
export default function CharacterSheet({ model }) {
  const opts = model.options;
  const t = themeFor(opts.theme);
  const [width, height] = pageSize(opts.pageSize);
  const w = width - 2 * PAD.side;
  const s = opts.sections;
  const inv = model.inventory;
  const compact = !model.featureGroups.some((g) => g.detail === 'full') && !model.spellcasting.cards?.length;

  const parts = [
    s.combat && <CombatSection key="combat" m={model} t={t} opts={opts} contentHeight={height - PAD.top - PAD.bottom} />,
    s.features && model.featureGroups.length > 0 && <FeaturesSection key="features" groups={model.featureGroups} t={t} w={w} />,
    s.spells && model.spellcasting.origins.length > 0 && <SpellsSection key="spells" sc={model.spellcasting} t={t} w={w} />,
    s.inventory && <InventorySection key="inventory" inv={inv} t={t} w={w} />,
    s.biography && <BiographySection key="bio" b={model.biography} t={t} w={w} portrait={opts.fields.portrait ? model.header.portrait : null} />,
  ].filter(Boolean);

  return (
    <Document title={model.header.name || 'Character Sheet'} author="FlyBy" creator="FlyBy" producer="FlyBy">
      <Page
        size={[width, height]}
        style={{ paddingTop: PAD.top, paddingBottom: PAD.bottom, paddingHorizontal: PAD.side, fontFamily: FONTS.body, backgroundColor: t.page }}
      >
        <PageBackground t={t} width={width} height={height} />
        <RunningHeader t={t} name={model.header.name} width={width} />
        {parts.map((el, i) => {
          const breaks = i > 0 && (i === 1 && s.combat ? true : !compact && el.key !== 'bio');
          return (
            <View key={el.key} break={breaks} style={i > 0 && !breaks ? { marginTop: 14 } : null}>
              {el}
            </View>
          );
        })}
        <Footer t={t} width={width} />
      </Page>
    </Document>
  );
}
