const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "evaluator-readable");

const files = [
  "README.md",
  "PROJECT_MANIFEST.md",
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
  "docs/evaluator-audit-response.md",
  "docs/ten-feature-upgrade.md",
  "docs/knowledge-base/blast-furnace-abnormal-trend.md",
  "docs/knowledge-base/sms-ladle-temperature-control.md",
  "docs/knowledge-base/rolling-mill-thickness-variation.md",
  "docs/knowledge-base/steel-plant-hydraulic-maintenance.md",
  "docs/knowledge-base/steel-plant-expert-knowledge-capture.md",
  "scripts/audit-project.js",
  "scripts/rag-search.js"
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function flattenName(file) {
  return file.replace(/[\\/]/g, "__").replace(/^\./, "dot-");
}

function language(file) {
  if (file.endsWith(".js")) return "javascript";
  if (file.endsWith(".json")) return "json";
  if (file.endsWith(".html")) return "html";
  if (file.endsWith(".css")) return "css";
  if (file.endsWith(".sql")) return "sql";
  if (file.endsWith(".md")) return "markdown";
  return "text";
}

fs.mkdirSync(DIST, { recursive: true });
cleanDir(OUT);

const allCode = [
  "# SkillPath AI Complete Readable Code Bundle",
  "",
  "This file is generated so evaluators that cannot read uploaded folders can still inspect the actual implementation.",
  "",
  "## File Index",
  "",
  ...files.map((file) => `- ${file}`),
  ""
];

for (const file of files) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing required file: ${file}`);
  }

  const content = fs.readFileSync(src, "utf8");
  const flat = path.join(OUT, flattenName(file));
  fs.writeFileSync(flat, content);

  allCode.push(`\n## ${file}\n`);
  allCode.push(`\`\`\`${language(file)}`);
  allCode.push(content);
  allCode.push("```");
}

fs.writeFileSync(path.join(OUT, "ALL_CODE.md"), allCode.join("\n"));

const proof = {
  generatedAt: new Date().toISOString(),
  purpose: "Evaluator-safe flattened package. Use this when an upload tool treats folders as empty.",
  fileCount: files.length,
  files,
  runCommands: ["npm.cmd run check", "npm.cmd test", "npm.cmd run audit", "npm.cmd start"],
  appUrl: "http://localhost:8080"
};

fs.writeFileSync(path.join(OUT, "EVALUATOR_PROOF.json"), JSON.stringify(proof, null, 2));

const zipPath = path.join(DIST, "SkillPath-ai-evaluator-readable.zip");
fs.rmSync(zipPath, { force: true });
execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${zipPath}' -Force`
  ],
  { stdio: "inherit" }
);

process.stdout.write(`Evaluator-readable package created:\n${zipPath}\n`);
process.stdout.write(`Readable folder:\n${OUT}\n`);

