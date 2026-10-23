# =============================================================================
# gen-pdf-fonts: as fontes da ficha PDF em TTF estático (npm run gen:pdf-fonts)
# =============================================================================
# O QUE FAZ
#   Lê o Cinzel e o Alegreya VARIÁVEIS que o app já empacota para o tema papel
#   (@fontsource-variable, woff2) e grava em src/pdf/fonts/ um TTF estático por
#   peso e estilo, com os subconjuntos latin e latin-ext fundidos num arquivo
#   só, mais o OFL de cada família. Requer fontTools e brotli (pip).
#
# FUNÇÕES
#   instance(path, weight): o woff2 variável instanciado num peso, em memória.
#   rename(font, out): os nomes internos da instância (família, estilo, PostScript).
#   build(family, style, weight, out): funde latin e latin-ext e grava o TTF.
#   main(): todas as fontes da tabela FONTS, e as licenças.
#
# DECISÕES E ARMADILHAS
#   - O @react-pdf lê TTF e WOFF, não woff2 variável, e um variável sairia só
#     no peso padrão: por isso a instância estática (DDL-0105).
#   - Cada instância ganha NOME próprio: o variável chama tudo de "Regular", e o
#     PDF reaproveita a fonte de mesmo nome PostScript, então o negrito saía
#     regular.
#   - Os dois subconjuntos são fundidos porque o PDF não tem fonte de reserva
#     por glifo: um caractere fora da fonte sai como caixa vazia.
#   - As fontes são OFL 1.1: podem ir no bundle e no repo público, com a
#     licença ao lado (OFL-Cinzel.txt, OFL-Alegreya.txt).
# -----------------------------------------------------------------------------
import io
import shutil
from pathlib import Path

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
MODULES = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "pdf" / "fonts"

FONTS = [
    ("cinzel", "normal", 400, "Cinzel-Regular.ttf"),
    ("cinzel", "normal", 700, "Cinzel-Bold.ttf"),
    ("alegreya", "normal", 400, "Alegreya-Regular.ttf"),
    ("alegreya", "normal", 700, "Alegreya-Bold.ttf"),
    ("alegreya", "italic", 400, "Alegreya-Italic.ttf"),
    ("alegreya", "italic", 700, "Alegreya-BoldItalic.ttf"),
]


def instance(path, weight):
    font = TTFont(str(path))
    static = instancer.instantiateVariableFont(font, {"wght": weight})
    buf = io.BytesIO()
    static.flavor = None
    static.save(buf)
    buf.seek(0)
    return buf


def rename(font, out):
    family, _, sub = Path(out).stem.partition("-")
    pretty = {"Regular": "Regular", "Bold": "Bold", "Italic": "Italic", "BoldItalic": "Bold Italic"}[sub]
    names = {1: family, 2: pretty, 4: f"{family} {pretty}", 6: f"{family}-{sub}", 16: family, 17: pretty}
    table = font["name"]
    for rec in list(table.names):
        if rec.nameID in names:
            table.removeNames(nameID=rec.nameID)
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def build(family, style, weight, out):
    files = MODULES / family / "files"
    parts = [instance(files / f"{family}-{subset}-wght-{style}.woff2", weight) for subset in ("latin", "latin-ext")]
    merged = Merger().merge(parts)
    rename(merged, out)
    merged.save(str(OUT / out))
    print(f"OK: {out}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for family, style, weight, out in FONTS:
        build(family, style, weight, out)
    for family, label in (("cinzel", "Cinzel"), ("alegreya", "Alegreya")):
        shutil.copyfile(MODULES / family / "LICENSE", OUT / f"OFL-{label}.txt")


if __name__ == "__main__":
    main()
