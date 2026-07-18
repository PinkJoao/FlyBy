# =============================================================================
# pdf_to_png - converte paginas de um PDF em PNGs (modo de testagem visual)
# =============================================================================
# Uso:  python scripts/pdf_to_png.py <arquivo.pdf> [paginas ex.: 1-2] [escala]
# Gera  <mesma pasta>/<nome>-p<N>.png  (escala padrao 2x).
# -----------------------------------------------------------------------------
import sys
from pathlib import Path

import pypdfium2 as pdfium


def main():
    pdf_path = Path(sys.argv[1])
    pages_arg = sys.argv[2] if len(sys.argv) > 2 else None
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0

    doc = pdfium.PdfDocument(str(pdf_path))
    n = len(doc)
    if pages_arg:
        a, _, b = pages_arg.partition("-")
        idxs = range(int(a) - 1, int(b or a))
    else:
        idxs = range(n)

    for i in idxs:
        page = doc[i]
        img = page.render(scale=scale).to_pil()
        out = pdf_path.with_name(f"{pdf_path.stem}-p{i + 1}.png")
        img.save(out)
        print(f"OK: {out} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
