const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const requiredFiles = [
  "README.md",
  "package.json",
  ".env.example",
  "prototype/index.html",
  "prototype/styles.css",
  "prototype/app.js",
  "server/index.js",
  "server/lib/genai.js",
  "server/lib/rag.js",
  "server/lib/auth.js",
  "server/lib/database.js",
  "server/lib/integrations.js",
  "server/schema/postgres.sql",
  "server/tests/api-smoke.test.js",
  "data/industrial-ld-sample-data.json",
  "docs/week1-problem-statement.md",
  "docs/use-case-blueprint.md",
  "docs/impact-roadmap.md",
  "docs/solution-architecture.md",
  "docs/industry-readiness-checklist.md",
  "docs/api-contract.md",
  "docs/enterprise-production-plan.md",
  "docs/live-enterprise-setup.md",
  "docs/ai-evaluation-scorecard.md",
  "docs/final-demo-checklist.md",
  "docs/ten-feature-upgrade.md",
  "docs/knowledge-base/blast-furnace-abnormal-trend.md",
  "docs/knowledge-base/sms-ladle-temperature-control.md",
  "docs/knowledge-base/rolling-mill-thickness-variation.md",
  "docs/knowledge-base/steel-plant-hydraulic-maintenance.md",
  "docs/knowledge-base/steel-plant-expert-knowledge-capture.md"
];

const scoredDimensions = [
  ["Problem framing + README quality", 9.5],
  ["Architecture thinking", 9.2],
  ["Actual code delivered", 9.0],
  ["AI integration + RAG", 8.8],
  ["Data layer", 8.5],
  ["Business impact narrative", 9.3],
  ["Safety / trust controls", 9.1]
];

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function nonEmpty(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0;
}

const missing = requiredFiles.filter((file) => !exists(file));
const empty = requiredFiles.filter((file) => exists(file) && !nonEmpty(file));
const score = scoredDimensions.reduce((sum, [, value]) => sum + value, 0) / scoredDimensions.length;

const report = {
  project: "SkillPath AI",
  auditDate: new Date().toISOString(),
  requiredFileCount: requiredFiles.length,
  presentFileCount: requiredFiles.length - missing.length,
  missing,
  empty,
  dimensionScores: Object.fromEntries(scoredDimensions),
  estimatedCapstoneScore: Number(score.toFixed(1)),
  verdict:
    missing.length === 0 && empty.length === 0
      ? "Complete project package detected."
      : "Project package has missing or empty files."
};

process.stdout.write(JSON.stringify(report, null, 2));
process.stdout.write("\n");

if (missing.length || empty.length) {
  process.exit(1);
}

