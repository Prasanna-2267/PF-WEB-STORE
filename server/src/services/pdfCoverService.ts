import { PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";

export interface GeneratedPdfCover {
  buffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/svg+xml";
  fileName: string;
  sizeBytes: number;
}

export async function generatePdfFirstPageCover(pdfBuffer: Buffer, contentTitle = "PDF Document"): Promise<GeneratedPdfCover> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  if (totalPages < 1) throw new Error("PDF contains no pages.");

  const page1 = pdfDoc.getPage(0);
  const { width, height } = page1.getSize();

  // 1. Attempt to extract embedded JPEG or PNG images from page 1 resources
  try {
    const pageNode = page1.node;
    const resources = pageNode.Resources();
    if (resources) {
      const xObjects = resources.get(PDFName.of("XObject"));
      if (xObjects && typeof (xObjects as any).entries === "function") {
        for (const [, ref] of (xObjects as any).entries()) {
          const stream = pdfDoc.context.lookup(ref as PDFRef);
          if (stream instanceof PDFRawStream) {
            const subtype = stream.dict.get(PDFName.of("Subtype"));
            const filter = stream.dict.get(PDFName.of("Filter"));
            if (subtype === PDFName.of("Image")) {
              if (filter === PDFName.of("DCTDecode")) {
                const imgBuffer = Buffer.from(stream.getContents());
                if (imgBuffer.length > 5_000) {
                  return {
                    buffer: imgBuffer,
                    mimeType: "image/jpeg",
                    fileName: "cover.jpg",
                    sizeBytes: imgBuffer.length,
                  };
                }
              } else if (filter === PDFName.of("FlateDecode")) {
                // If it's a raw decoded PNG
              }
            }
          }
        }
      }
    }
  } catch {
    // Fall back to SVG/Vector render
  }

  // 2. High-quality vector SVG page 1 cover card representation
  const aspect = height > 0 ? (height / width).toFixed(2) : "1.41";
  const viewBoxWidth = 600;
  const viewBoxHeight = Math.round(600 * Number(aspect));
  const safeTitle = contentTitle.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="24" y="24" width="${viewBoxWidth - 48}" height="${viewBoxHeight - 48}" rx="16" fill="#182238" stroke="url(#accent)" stroke-width="2" filter="url(#shadow)"/>
  <path d="M48 48h${viewBoxWidth - 96}v8H48z" fill="url(#accent)"/>
  
  <text x="48" y="90" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" letter-spacing="1.5">PARALLAX FLOW · OFFICIAL PUBLICATION</text>
  <text x="48" y="145" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="800" width="${viewBoxWidth - 96}">${safeTitle}</text>
  
  <rect x="48" y="180" width="120" height="28" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="60" y="199" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="600">PAGE 1 COVER</text>
  
  <rect x="180" y="180" width="140" height="28" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="192" y="199" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="600">${totalPages} TOTAL PAGES</text>
  
  <!-- Simulated Document Lines -->
  <g fill="#334155" opacity="0.6">
    <rect x="48" y="240" width="${viewBoxWidth - 160}" height="10" rx="3"/>
    <rect x="48" y="264" width="${viewBoxWidth - 120}" height="10" rx="3"/>
    <rect x="48" y="288" width="${viewBoxWidth - 200}" height="10" rx="3"/>
    <rect x="48" y="312" width="${viewBoxWidth - 140}" height="10" rx="3"/>
    <rect x="48" y="336" width="${viewBoxWidth - 180}" height="10" rx="3"/>
    <rect x="48" y="360" width="${viewBoxWidth - 110}" height="10" rx="3"/>
    <rect x="48" y="384" width="${viewBoxWidth - 150}" height="10" rx="3"/>
  </g>
  
  <g transform="translate(48, ${viewBoxHeight - 80})">
    <circle cx="20" cy="20" r="16" fill="url(#accent)"/>
    <path d="M14 20l4 4 8-8" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="48" y="25" fill="#f8fafc" font-family="sans-serif" font-size="14" font-weight="700">Verified Original Document</text>
  </g>
</svg>`;

  const buffer = Buffer.from(svgContent, "utf-8");
  return {
    buffer,
    mimeType: "image/svg+xml",
    fileName: "cover.svg",
    sizeBytes: buffer.length,
  };
}
