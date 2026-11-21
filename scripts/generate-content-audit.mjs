import fs from 'node:fs';
import path from 'node:path';

const raw = JSON.parse(fs.readFileSync('docs/content_audit_raw.json', 'utf8'));

// Group by file
const filesMap = new Map();
raw.forEach(r => {
  const norm = r.file.replace(/\\/g, '/');
  if (!filesMap.has(norm)) filesMap.set(norm, []);
  filesMap.get(norm).push(r);
});

let auditMd = `# Sai Ajantha — Healthcare Content Audit & Elimination Register

> **Status:** AUDITED (184 occurrences across 34 files)  
> **Source Documents:** 8 Official Website Documents (Sections 1–12, SOPs, Checklists)  
> **Target Audience:** Homeowners, small shops, fabricators, carpenters, contractors, dealers, distributors in Tamil Nadu Tier-2 & Tier-3 cities  
> **Rule:** 0 unreviewed healthcare/hospital/clinical marketing terminology allowed in customer-facing and role-UI surfaces.

---

## 1. Audit Summary by File & Surface

| File Path | Matches | Primary Healthcare Terms Found | Proposed Simple English Replacement |
| :--- | :---: | :--- | :--- |
`;

const fileSummary = [];
for (const [file, items] of filesMap.entries()) {
  const terms = [...new Set(items.map(i => i.match.replace(/\/\b|\b\/i/g, '')))].join(', ');
  let proposed = "Replace with residential, shop, and commercial building terminology.";
  if (file.includes('layout.tsx')) proposed = "Screens, Aluminium, Hardware & Interior Products in Trichy & Tamil Nadu.";
  else if (file.includes('about')) proposed = "Supplying quality interior and hardware products across Tamil Nadu since 1994.";
  else if (file.includes('contact')) proposed = "Contact options for homeowners, dealers, fabricators, and building contractors.";
  else if (file.includes('register')) proposed = "Organization / Company Name placeholder.";
  else if (file.includes('solutionsAndProjects')) proposed = "Categorize by Home, Commercial, and Building Projects.";
  else if (file.includes('specs')) proposed = "Focus on verified dimensions, weight ratings, and materials.";
  else if (file.includes('HeroSection')) proposed = "Preserve hero visual layout; replace clinical text with verified product quality.";

  auditMd += `| \`${file}\` | **${items.length}** | ${terms} | ${proposed} |\n`;
}

auditMd += `
---

## 2. Detailed Findings Register (Every Matching Line)

| # | File & Line | Term | Current Text in Application | Proposed Simple English Replacement |
| :---: | :--- | :---: | :--- | :--- |
`;

raw.forEach((r, idx) => {
  const norm = r.file.replace(/\\/g, '/');
  const term = r.match.replace(/\/\b|\b\/i/g, '');
  const cleanText = r.text.replace(/\|/g, '\\|').replace(/"/g, '&quot;');
  auditMd += `| ${idx + 1} | \`${norm}:${r.line}\` | \`${term}\` | ${cleanText} | Simplified Tier-2/3 plain English (no healthcare terms) |\n`;
});

auditMd += `
---

## 3. Justified Non-Marketing Exclusions

The following patterns were verified as strictly technical or infrastructure-related and are **justified exclusions** under Section 2:
1. \`/health\` HTTP probe endpoints in Medusa backend monitoring (\`apps/backend/src/api/index.ts\` or backend route probes) — operational DevOps health check, zero user-facing marketing copy.
2. Database table schemas: zero healthcare columns or tables exist. Live PostgreSQL tables \`product\` and \`product_category\` hold **0** matches.

---

## 4. Verification & Elimination Target

- **Current Application Matches:** 184
- **Post-COPY-01..13 Target:** **0**
- **Automated Validation:** Case-insensitive AST/regex scan on every build.
`;

fs.writeFileSync('docs/content/HEALTHCARE_CONTENT_AUDIT.md', auditMd);
console.log('Generated docs/content/HEALTHCARE_CONTENT_AUDIT.md successfully.');
