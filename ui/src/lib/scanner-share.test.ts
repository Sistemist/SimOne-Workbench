import { describe, expect, it } from "vitest";
import {
  buildAttributableScannerUrl,
  buildScannerShareCardSvg,
  buildScannerShareCopy,
  scannerShareCardFilename,
} from "./scanner-share";

describe("privacy-safe Scanner share artifacts", () => {
  it("adds stable first-party attribution to copied summaries", () => {
    expect(
      buildScannerShareCopy(
        "Built with Sysdom AI: Customer loop is leaking.",
        "https://alpha.sysdom.ai",
      ),
    ).toBe(
      [
        "Built with Sysdom AI: Customer loop is leaking.",
        "",
        "Run your own scan: https://alpha.sysdom.ai/scanner?utm_source=sysdom_scanner_share&utm_medium=organic&utm_campaign=bottleneck_summary",
      ].join("\n"),
    );
  });

  it("builds a portable SVG card from public result fields only", () => {
    const svg = buildScannerShareCardSvg(
      {
        headline: "Customer <loop> is leaking",
        engine: "Customer Engine",
        nextAction: "Make one review queue for replies & proof points.",
      },
      "https://alpha.sysdom.ai",
    );

    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain("Customer &lt;loop&gt; is leaking");
    expect(svg).toContain("replies &amp; proof points.");
    expect(svg).toContain("Early pattern match · founder review required");
    expect(svg).toContain(
      "https://alpha.sysdom.ai/scanner?utm_source=sysdom_scanner_share&amp;utm_medium=organic&amp;utm_campaign=bottleneck_card",
    );
    expect(svg).not.toContain("founderNote");
    expect(svg).not.toContain("startupUrl");
  });

  it("uses a stable, safe filename for the selected engine", () => {
    expect(scannerShareCardFilename("Cash Engine")).toBe("sysdom-cash-bottleneck.svg");
    expect(scannerShareCardFilename("///")).toBe("sysdom-venture-bottleneck.svg");
  });

  it("bounds long next moves before the card footer", () => {
    const svg = buildScannerShareCardSvg(
      {
        headline: "Capacity is trapped in founder work",
        engine: "Skills Engine",
        nextAction: Array.from({ length: 30 }, (_, index) => `step-${index + 1}`).join(" "),
      },
      "https://alpha.sysdom.ai",
    );

    expect(svg).toContain("…</tspan>");
    expect(svg).toContain('y="494"');
    expect(svg).toContain('y="528"');
    expect(svg).not.toContain('y="562"');
  });

  it("keeps attribution format-specific", () => {
    expect(buildAttributableScannerUrl("https://alpha.sysdom.ai", "card")).toContain(
      "utm_campaign=bottleneck_card",
    );
    expect(buildAttributableScannerUrl("https://alpha.sysdom.ai", "summary")).toContain(
      "utm_campaign=bottleneck_summary",
    );
  });
});
