import { spawnSync } from "node:child_process"

const dbName = process.env.HARMONIA_D1_DB ?? "harmonia-db"

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const rules = [
  {
    code: "doc_set_no_contradictions",
    name: "Document Set does not contain contradicting factual statements.",
    description: "Validate that factual claims are internally consistent across all documents.",
  },
  {
    code: "citations_traceable",
    name: "Citations are traceable to specific source excerpts.",
    description: "Every claim must be traceable to an excerpt in the source set.",
  },
  {
    code: "confidence_score_min",
    name: "All claims have a confidence score ≥ 0.7.",
    description: "Require confidence scoring for claims with a minimum threshold of 0.7.",
  },
  {
    code: "no_pii",
    name: "No PII present.",
    description: "Ensure personally identifiable information is absent or redacted.",
  },
  {
    code: "no_supplier_policy_violations",
    name: "No supplier policy violations.",
    description: "Outputs must comply with supplier policy constraints.",
  },
  {
    code: "no_sop_abc123_violations",
    name: "No SOP-ABC123 violations.",
    description: "Outputs must comply with SOP-ABC123 requirements.",
  },
]

const statements = rules
  .map((rule) => {
    const code = rule.code.replace(/'/g, "''")
    const name = rule.name.replace(/'/g, "''")
    const description = rule.description.replace(/'/g, "''")
    return `
      INSERT INTO rules (code, name, description, created_by, created_at, updated_at)
      SELECT '${code}', '${name}', '${description}', 'system', unixepoch('now'), unixepoch('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM rules
        WHERE rules.code = '${code}'
      );
    `
  })
  .join("\n")

const insertSql = statements.trim()

function seed(envLabel, flags) {
  console.log(`Seeding rules to D1 (${envLabel})...`)
  run("wrangler", ["d1", "execute", dbName, "--command", insertSql, ...flags])
}

seed("local", [])
seed("remote", ["--env", "production", "--remote"])

console.log("Seed complete.")
