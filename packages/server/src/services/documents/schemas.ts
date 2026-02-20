import { z } from "zod"

export const uploadDocumentSchema = z.object({
  projectId: z.number().int().positive(),
  filename: z.string().min(1),
  fileType: z.enum(["pdf", "docx", "txt", "md"]),
  content: z.string().optional(),
  url: z.string().url().optional(),
})

export const analysisRequestSchema = z.object({
  analysisType: z.enum(["summary", "sentiment", "entities", "keywords", "full"]),
  options: z
    .object({
      language: z.string().default("en"),
      detailLevel: z.enum(["basic", "detailed", "comprehensive"]).default("basic"),
    })
    .optional(),
})

export const inconsistencyAnalysisSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .min(3)
    .max(3),
  config: z.object({
    analysisType: z
      .enum(["factual", "temporal", "semantic", "comprehensive"])
      .default("comprehensive"),
    outputFormat: z.enum(["summary", "detailed", "structured"]).default("detailed"),
    customInstructions: z.string().optional(),
  }),
})
