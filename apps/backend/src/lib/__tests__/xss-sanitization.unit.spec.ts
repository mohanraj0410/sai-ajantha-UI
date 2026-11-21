import { escapeHtml, serializeJsonLd } from "@sai-ajanta/types";

describe("XSS & Script Injection Prevention (ADM-02 / SF-05)", () => {
  describe("escapeHtml (Admin Print Invoice Sanitization - ADM-02)", () => {
    it("handles null and undefined gracefully", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
    });

    it("leaves safe alphanumeric strings unchanged", () => {
      expect(escapeHtml("SA-2026-A1B2C3")).toBe("SA-2026-A1B2C3");
      expect(escapeHtml("Trichy 620003")).toBe("Trichy 620003");
    });

    it("escapes script tags to prevent HTML script injection", () => {
      const malicious = "<script>alert('XSS')</script>";
      const escaped = escapeHtml(malicious);
      expect(escaped).toBe("&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;");
      expect(escaped).not.toContain("<script>");
      expect(escaped).not.toContain("</script>");
    });

    it("escapes event handler injection payloads", () => {
      const payload = '"><img src=x onerror=alert(1)>';
      const escaped = escapeHtml(payload);
      expect(escaped).toBe("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
      expect(escaped).not.toContain("<img");
      expect(escaped).not.toContain('">');
    });

    it("escapes ampersands and quotes", () => {
      expect(escapeHtml('A & B "Hardware"')).toBe("A &amp; B &quot;Hardware&quot;");
    });
  });

  describe("serializeJsonLd (Storefront JSON-LD Script Breakout Prevention - SF-05)", () => {
    it("safely serializes normal objects into JSON", () => {
      const schema = {
        "@type": "Product",
        name: "Standard Glass Door Clamp",
        price: 1500,
      };
      const json = serializeJsonLd(schema);
      expect(JSON.parse(json)).toEqual(schema);
    });

    it("neutralizes script closing tags that could escape <script> container", () => {
      const maliciousSchema = {
        name: "</script><script>alert('malicious')</script>",
        description: "Payload with <svg onload=alert(1)>",
      };
      const json = serializeJsonLd(maliciousSchema);

      // Must not contain raw '<' or '>'
      expect(json).not.toContain("</script>");
      expect(json).not.toContain("<script>");
      expect(json).not.toContain("<svg");
      expect(json).toContain("\\u003c/script\\u003e");
      expect(json).toContain("\\u003cscript\\u003e");
    });

    it("neutralizes unicode line separators that cause JS parse errors in script tags", () => {
      const schemaWithSeparators = {
        text: "Line 1\u2028Line 2\u2029Line 3",
      };
      const json = serializeJsonLd(schemaWithSeparators);
      expect(json).not.toContain("\u2028");
      expect(json).not.toContain("\u2029");
      expect(json).toContain("\\u2028");
      expect(json).toContain("\\u2029");
    });
  });
});
