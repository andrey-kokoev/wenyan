import { z } from "zod"
import { inconsistencyAnalysisSchema } from "./schemas"
import type { DocumentContext } from "./types"

interface Inconsistency {
  id: string
  type: string
  documents: string[]
  description: string
  severity: string
  suggestion: string
}

export async function handleAnalyzeInconsistencies(c: DocumentContext) {
  try {
    const body = await c.req.json()
    const { documents: docs, config } = inconsistencyAnalysisSchema.parse(body)

    const ai = c.env.AI as any
    if (!ai) {
      throw new Error("AI binding not available")
    }

    const analysisPrompt = buildAnalysisPrompt(docs, config)

    const modelName = c.env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct"
    const response = await ai.run(modelName, {
      messages: [
        {
          role: "system",
          content:
            "You are an expert document analyst specializing in identifying inconsistencies across multiple documents. Provide detailed, actionable analysis.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const analysisResults = parseAnalysisResults(response.response, docs)

    return c.json({
      inconsistencies: analysisResults.inconsistencies,
      summary: analysisResults.summary,
      analysisId: generateAnalysisId(),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Analysis error:", error)
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        400,
      )
    }
    return c.json({ error: "Failed to analyze documents" }, 500)
  }
}

function buildAnalysisPrompt(
  docs: Array<{ id: string; name: string; content: string }>,
  config: { analysisType: string; customInstructions?: string },
): string {
  const docTexts = docs
    .map((doc, index) => `Document ${index + 1} (${doc.name}):\n${doc.content}`)
    .join("\n\n---\n\n")

  let prompt = `Analyze the following 3 documents for inconsistencies:\n\n${docTexts}\n\n`

  switch (config.analysisType) {
    case "factual":
      prompt +=
        "Focus specifically on factual inconsistencies - dates, numbers, names, events, and other verifiable information.\n"
      break
    case "temporal":
      prompt +=
        "Focus specifically on temporal inconsistencies - timelines, sequence of events, date contradictions.\n"
      break
    case "semantic":
      prompt +=
        "Focus specifically on semantic inconsistencies - contradictory statements, different interpretations, conflicting meanings.\n"
      break
    case "comprehensive":
      prompt +=
        "Provide a comprehensive analysis covering all types of inconsistencies: factual, temporal, and semantic.\n"
      break
  }

  if (config.customInstructions) {
    prompt += `\nAdditional instructions: ${config.customInstructions}\n`
  }

  prompt += `
Please identify and categorize inconsistencies using this JSON format:
{
  "inconsistencies": [
    {
      "id": "unique-id",
      "type": "Factual|Temporal|Semantic",
      "documents": ["doc-1", "doc-2"],
      "description": "Clear description of the inconsistency",
      "severity": "low|medium|high|critical",
      "suggestion": "Recommendation for resolution"
    }
  ],
  "summary": "Brief summary of findings"
}

Respond only with valid JSON.`

  return prompt
}

function parseAnalysisResults(
  aiResponse: string,
  docs: Array<{ id: string; name: string; content: string }>,
): { inconsistencies: Inconsistency[]; summary: string } {
  try {
    const parsed = JSON.parse(aiResponse)
    return {
      inconsistencies: parsed.inconsistencies || [],
      summary: parsed.summary || "Analysis completed",
    }
  } catch {
    const inconsistencies = extractInconsistenciesFromText(aiResponse, docs)
    return {
      inconsistencies,
      summary: aiResponse.slice(0, 200) + "...",
    }
  }
}

function extractInconsistenciesFromText(
  text: string,
  docs: Array<{ id: string; name: string; content: string }>,
): Inconsistency[] {
  const inconsistencies: Inconsistency[] = []
  const lines = text.split("\n")

  lines.forEach((line, index) => {
    if (line.toLowerCase().includes("inconsist") || line.toLowerCase().includes("conflict")) {
      inconsistencies.push({
        id: `inc-${index}`,
        type: "Mixed",
        documents: docs.map((d) => d.id),
        description: line.trim(),
        severity: "medium",
        suggestion: "Review documents for clarification",
      })
    }
  })

  return inconsistencies
}

function generateAnalysisId(): string {
  return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
