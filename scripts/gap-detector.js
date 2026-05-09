#!/usr/bin/env node
/**
 * Gap Detector — Autonomous Agent Loop (P28)
 *
 * Scans the codebase to find compliance frameworks that exist in the Prisma
 * FrameworkType enum but are missing one or more of:
 *   - Control seed file
 *   - Upsert block in seed.ts
 *   - Public reference page
 *   - Dashboard placeholder page
 *   - E2E test
 *
 * Writes results to scripts/gap-reports/latest.json and prints to stdout.
 * Exit code 0 always (gaps are data, not errors).
 *
 * Usage:
 *   node scripts/gap-detector.js
 *   node scripts/gap-detector.js --json    (output JSON only, no console logs)
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const QUIET   = process.argv.includes('--json');
const REPORTS = path.join(__dirname, 'gap-reports');

// ── Priority map — higher = fix sooner ────────────────────────────────────────

const PRIORITY = {
  HIPAA:   10,
  PCI_DSS: 9,
  FEDRAMP: 8,
  // SOC2, ISO27001, GDPR, ISO9001 are fully seeded — not in priority map
};

// ── Slug map — how framework enum values map to filesystem slugs ───────────────

const SLUG_MAP = {
  SOC2:    'soc2',
  ISO27001:'iso27001',
  HIPAA:   'hipaa',
  PCI_DSS: 'pci-dss',
  GDPR:    'gdpr',
  FEDRAMP: 'fedramp',
  ISO9001: 'iso9001',
};

// ── Step 1: Extract FrameworkType enum values from schema.prisma ───────────────

function getEnumFrameworks() {
  const schemaPath = path.join(ROOT, 'backend', 'prisma', 'schema.prisma');
  const content    = fs.readFileSync(schemaPath, 'utf8');
  const match      = content.match(/enum FrameworkType \{([^}]+)\}/);
  if (!match) return [];
  return match[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('//'));
}

// ── Step 2: Find which frameworks are seeded in seed.ts ───────────────────────

function getSeededFrameworks() {
  const seedPath = path.join(ROOT, 'backend', 'prisma', 'seed.ts');
  const content  = fs.readFileSync(seedPath, 'utf8');
  const matches  = [...content.matchAll(/FrameworkType\.(\w+)/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// ── Step 3: Find control seed files ───────────────────────────────────────────

function getSeedFiles() {
  const seedsDir = path.join(ROOT, 'backend', 'src', 'control-library', 'seeds');
  if (!fs.existsSync(seedsDir)) return [];
  return fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('-controls.seed.ts'))
    .map(f => f.replace('-controls.seed.ts', '').toUpperCase().replace('-', '_'));
}

// ── Step 4: Find public reference pages ───────────────────────────────────────

function getReferencePagesBuilt() {
  const frameworksDir = path.join(ROOT, 'frontend', 'src', 'app', '(public)', 'frameworks');
  if (!fs.existsSync(frameworksDir)) return [];
  return fs.readdirSync(frameworksDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toUpperCase().replace('-', '_'));
}

// ── Step 5: Find dashboard pages ──────────────────────────────────────────────

function getDashboardPagesBuilt() {
  const dashDir = path.join(ROOT, 'frontend', 'src', 'app', '(dashboard)');
  if (!fs.existsSync(dashDir)) return [];
  return fs.readdirSync(dashDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name.toUpperCase().replace('-', '_'));
}

// ── Step 6: Find E2E tests that mention the framework ─────────────────────────

function getE2ETestsBuilt() {
  const e2eDir = path.join(ROOT, 'frontend', 'e2e');
  if (!fs.existsSync(e2eDir)) return [];
  const covered = new Set();
  for (const file of fs.readdirSync(e2eDir)) {
    if (!file.endsWith('.spec.ts')) continue;
    const content = fs.readFileSync(path.join(e2eDir, file), 'utf8').toUpperCase();
    for (const [fw] of Object.entries(SLUG_MAP)) {
      if (content.includes(fw) || content.includes(SLUG_MAP[fw].toUpperCase())) {
        covered.add(fw);
      }
    }
  }
  return [...covered];
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const enumFrameworks  = getEnumFrameworks();
  const seeded          = getSeededFrameworks();
  const seedFiles       = getSeedFiles();
  const referencePages  = getReferencePagesBuilt();
  const dashboardPages  = getDashboardPagesBuilt();
  const e2eTests        = getE2ETestsBuilt();

  if (!QUIET) {
    console.log('\n🔍 Gap Detector — Compliance Framework Analysis');
    console.log('─'.repeat(60));
    console.log(`Frameworks in enum: ${enumFrameworks.join(', ')}`);
    console.log(`Seeded in seed.ts:  ${seeded.join(', ')}`);
    console.log(`Control seed files: ${seedFiles.join(', ')}`);
  }

  const gaps = [];

  for (const fw of enumFrameworks) {
    const slug = SLUG_MAP[fw] ?? fw.toLowerCase().replace('_', '-');

    const missingControlSeed    = !seedFiles.includes(fw);
    const missingDbSeed         = !seeded.includes(fw);
    const missingReferencePage  = !referencePages.includes(fw);
    const missingDashboardPage  = !dashboardPages.includes(slug.toUpperCase().replace('-', '_'))
                                  && !dashboardPages.includes(fw);
    const missingE2ETest        = !e2eTests.includes(fw);
    const priority              = PRIORITY[fw] ?? 0;

    const hasAnyGap = missingControlSeed || missingDbSeed ||
                      missingReferencePage || missingDashboardPage || missingE2ETest;

    if (hasAnyGap && priority > 0) {
      gaps.push({
        framework:           fw,
        slug,
        missingControlSeed,
        missingDbSeed,
        missingReferencePage,
        missingDashboardPage,
        missingE2ETest,
        priority,
      });
    }
  }

  // Sort by priority descending
  gaps.sort((a, b) => b.priority - a.priority);

  // Write report
  if (!fs.existsSync(REPORTS)) fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'latest.json'), JSON.stringify(gaps, null, 2));

  const date = new Date().toISOString().split('T')[0];
  fs.writeFileSync(path.join(REPORTS, `${date}.json`), JSON.stringify(gaps, null, 2));

  if (!QUIET) {
    console.log('\n📋 Gap Report:');
    if (gaps.length === 0) {
      console.log('  ✅ No gaps found! All frameworks are fully implemented.');
    } else {
      console.log('');
      for (const g of gaps) {
        const missing = [
          g.missingControlSeed    && 'control-seed',
          g.missingDbSeed         && 'db-seed',
          g.missingReferencePage  && 'reference-page',
          g.missingDashboardPage  && 'dashboard-page',
          g.missingE2ETest        && 'e2e-test',
        ].filter(Boolean).join(', ');

        console.log(`  ❌ ${g.framework.padEnd(12)} priority=${g.priority}  missing: ${missing}`);
      }
      console.log('');
      console.log(`  Top priority: ${gaps[0].framework} (priority ${gaps[0].priority})`);
    }
    console.log('');
    console.log(`  Report saved to scripts/gap-reports/latest.json`);
  } else {
    // --json mode: output the array directly for GitHub Actions parsing
    process.stdout.write(JSON.stringify(gaps));
  }
}

main();
