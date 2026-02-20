import { z } from "zod"

const anchorTypeSchema = z.enum(["line", "span", "quote"])

export const issueAnchorSchema = z
  .object({
    type: anchorTypeSchema,
    start: z.number().int().nonnegative().optional(),
    end: z.number().int().nonnegative().optional(),
    text: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "quote") {
      if (!value.text) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "anchor.text is required for quote anchors",
        })
      }
    } else {
      if (value.start === undefined || value.end === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "anchor.start and anchor.end are required for line/span anchors",
        })
      }
    }
  })

export const issueDocumentReferenceSchema = z.object({
  documentId: z.number().int(),
  anchor: issueAnchorSchema.optional(),
})

export const issueFindingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  ruleIds: z.array(z.number().int()).min(1),
  documents: z.array(issueDocumentReferenceSchema).min(1),
  evidence: z.array(z.string().min(1)).optional(),
})

export const issueFindingResponseSchema = z.object({
  issues: z.array(issueFindingSchema),
  modelMeta: z
    .object({
      model: z.string().optional(),
      promptTokens: z.number().int().optional(),
      completionTokens: z.number().int().optional(),
    })
    .optional(),
})

export type IssueAnchor = z.infer<typeof issueAnchorSchema>
export type IssueDocumentReference = z.infer<typeof issueDocumentReferenceSchema>
export type IssueFinding = z.infer<typeof issueFindingSchema>
export type IssueFindingResponse = z.infer<typeof issueFindingResponseSchema>
