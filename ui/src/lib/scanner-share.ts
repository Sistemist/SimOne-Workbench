export type ScannerShareCardInput = {
  headline: string;
  engine: string;
  nextAction: string;
};

type ScannerShareFormat = "summary" | "card";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharacters || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  const representedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (representedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]?$/, "")}…`;
  }
  return lines;
}

function svgTextLines(lines: string[], x: number, y: number, lineHeight: number): string {
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

export function buildAttributableScannerUrl(
  origin: string,
  format: ScannerShareFormat,
): string {
  const url = new URL("/scanner", origin);
  url.searchParams.set("utm_source", "sysdom_scanner_share");
  url.searchParams.set("utm_medium", "organic");
  url.searchParams.set(
    "utm_campaign",
    format === "card" ? "bottleneck_card" : "bottleneck_summary",
  );
  return url.toString();
}

export function buildScannerShareCopy(
  publicText: string,
  origin: string,
): string {
  return `${publicText}\n\nRun your own scan: ${buildAttributableScannerUrl(origin, "summary")}`;
}

export function scannerShareCardFilename(engine: string): string {
  const engineSlug =
    engine
      .toLowerCase()
      .replace(/\s+engine$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "venture";
  return `sysdom-${engineSlug}-bottleneck.svg`;
}

export function buildScannerShareCardSvg(
  input: ScannerShareCardInput,
  origin: string,
): string {
  const headline = wrapText(input.headline, 36, 2);
  const nextAction = wrapText(input.nextAction, 62, 2);
  const scannerUrl = buildAttributableScannerUrl(origin, "card");
  const visibleScannerUrl = new URL(scannerUrl);
  const visibleCta = `${visibleScannerUrl.host}/scanner`;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">',
    `<title id="title">${escapeXml(input.headline)} — Sysdom AI bottleneck readout</title>`,
    `<desc id="description">${escapeXml(input.engine)}. Next move: ${escapeXml(input.nextAction)}</desc>`,
    '<rect width="1200" height="630" fill="#080808"/>',
    '<rect x="48" y="48" width="1104" height="534" fill="none" stroke="#333333" stroke-width="2"/>',
    '<rect x="72" y="72" width="12" height="72" fill="#ff5a1f"/>',
    '<text x="108" y="98" fill="#ff5a1f" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3">SYSTEMS BOTTLENECK</text>',
    '<text x="108" y="132" fill="#9b9b9b" font-family="Arial, Helvetica, sans-serif" font-size="18">Early pattern match · founder review required</text>',
    `<text fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700">${svgTextLines(headline, 72, 238, 68)}</text>`,
    `<text x="76" y="384" fill="#ff5a1f" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="2">${escapeXml(input.engine.toUpperCase())}</text>`,
    '<line x1="72" y1="414" x2="1128" y2="414" stroke="#333333" stroke-width="2"/>',
    '<text x="72" y="456" fill="#9b9b9b" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="2">NEXT MOVE</text>',
    `<text fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="25">${svgTextLines(nextAction, 72, 494, 34)}</text>`,
    '<text x="72" y="558" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">SYSDOM.AI</text>',
    `<a href="${escapeXml(scannerUrl)}"><text x="1128" y="558" text-anchor="end" fill="#ff5a1f" font-family="Arial, Helvetica, sans-serif" font-size="18">Run your own scan → ${escapeXml(visibleCta)}</text></a>`,
    "</svg>",
  ].join("");
}
