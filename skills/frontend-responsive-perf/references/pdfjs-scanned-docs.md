# PDF.js + scanned documents: the silent CCITT failure

Battle-tested on prv-concept.com's Bibliothèque (July 2026): a 103-page
scanned Renault repair manual whose 191 diagrams rendered as blank white
in the site's PDF.js viewer — while looking perfectly fine in macOS
Preview, Acrobat and every desktop tool.

## Symptom

- Text renders, scanned images don't. Pages look "empty but present".
- **Zero console errors** — PDF.js (v6.1.200 confirmed, applies to the v4-v6
  line) drops undecodable images silently, even with `verbosity: 5`
  (worker-side warnings often don't reach the page console).
- Covers/thumbnails generated earlier from the same viewer are missing the
  same images — nobody noticed because the text made them look plausible.

## Diagnosis (5 minutes, no guessing)

1. **Confirm the drop in the operator list** (browser console on the page):

```js
const lib = await import('/js/vendor/pdfjs/pdf.min.js');
lib.GlobalWorkerOptions.workerSrc = '/js/vendor/pdfjs/pdf.worker.min.js';
const doc = await lib.getDocument({url: '/path/doc.pdf'}).promise;
const page = await doc.getPage(20);          // an image-heavy page
const ops = await page.getOperatorList();
const names = {}; for (const k in lib.OPS) names[lib.OPS[k]] = k;
console.log([...new Set(ops.fnArray.map(f => names[f]))]);
// No paintImageXObject / paintImageMaskXObject → parser dropped the image
```

2. **Identify the codec** (Python, PyMuPDF):

```python
import fitz
doc = fitz.open("doc.pdf")
for img in doc[19].get_images(full=True):
    xref = img[0]
    print(doc.xref_object(xref))
# Culprit signature:  /ImageMask true  +  /Filter /CCITTFaxDecode
```

Old office scanners produced exactly this: 1-bit stencil masks ("ImageMask")
compressed with fax Group 4 (`/K -1`). MuPDF/Acrobat decode them; PDF.js
doesn't.

## Fix: transcode CCITT→Flate inside the PDF (keep text, keep vectors)

Do NOT rasterize pages (kills text layer, x10 size). Re-encode only the
image streams, preserving `/ImageMask` stencil semantics:

```python
import fitz

doc = fitz.open(SRC)
for xref in range(1, doc.xref_length()):
    obj = doc.xref_object(xref)
    if "/Subtype /Image" not in obj or "CCITTFaxDecode" not in obj:
        continue
    pix = fitz.Pixmap(doc, xref)          # MuPDF decodes (tolerant)
    w, h, stride, comps = pix.width, pix.height, pix.stride, pix.n
    s = pix.samples                       # for a mask: alpha, 255 = painted
    rowbytes = (w + 7) // 8
    packed = bytearray(rowbytes * h)
    for y in range(h):
        base = y * stride                 # USE pix.stride, not w (row padding!)
        for x in range(w):
            if s[base + x * comps] < 128:          # transparent → bit 1
                packed[y * rowbytes + (x >> 3)] |= (0x80 >> (x & 7))
    # ImageMask Decode default [0 1]: bit 0 = painted with fill color.
    doc.update_object(xref,
        f"<< /Type /XObject /Subtype /Image /Width {w} /Height {h} "
        f"/BitsPerComponent 1 /ImageMask true /Interpolate true >>")
    doc.update_stream(xref, bytes(packed), new=True)   # PyMuPDF deflates + sets /Filter
doc.save(DST, garbage=3, deflate=True)
```

**Two traps that cost an hour each:**
- `update_stream(..., compress=False)` + manually writing `/Filter
  /FlateDecode /Length n` in `update_object` **corrupts the object** (PyMuPDF
  rewrites the dict around the stream). Always hand PyMuPDF the *raw* bits and
  let it compress — it inserts the filter entry itself.
- Indexing samples with `y * w` instead of `y * pix.stride` shears the image
  into noise (pixmap rows are padded).

Size cost: Flate on 1-bit scans ≈ +10% vs CCITT G4. Acceptable.

## Verification (the actual proof, both levels)

1. **File level — pixel-diff every page** original vs transcoded:

```python
a, b = fitz.open(SRC), fitz.open(DST)
bad = [p for p in range(len(a))
       if a[p].get_pixmap(dpi=40).samples != b[p].get_pixmap(dpi=40).samples]
assert not bad     # 103/103 identical on the reference case
```

2. **Viewer level** — load the page in the real PDF.js viewer, then sample
   the canvas where the diagram lives (screenshots can lie about "almost
   blank"):

```js
const c = document.getElementById('pdfvCanvas'), ctx = c.getContext('2d');
const d = ctx.getImageData(c.width/2-200, c.height/2-200, 400, 400).data;
let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 240) ink++;
// ink ≈ 0 → still blank; ~5-15% non-white = a line drawing is present
```

## Aftermath checklist

- Replace the PDF asset; redeploy.
- **Regenerate every cover/thumbnail derived from the document** with a
  tolerant renderer (`fitz` `get_pixmap(dpi=150)` → resize to the old asset's
  width), never from a screenshot of the viewer that was broken.
- Note for future uploads (community-contributed scans): blank pages in the
  viewer + fine on desktop = run the same transcode; it's the scanner
  encoding, not the upload.
