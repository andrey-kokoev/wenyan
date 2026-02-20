import { z } from "zod"

export const docxConversionConfigSchema = z.object({
  docxConversionUrl: z.string().url().nullable(),
  docxConversionToken: z.string().min(1).nullable(),
  docUploadMaxMb: z.number().int().positive().nullable(),
  anthropicBaseUrl: z.string().url().nullable(),
  anthropicApiKey: z.string().min(1).nullable(),
  huggingfaceBaseUrl: z.string().url().nullable(),
  huggingfaceApiKey: z.string().min(1).nullable(),
  moonshotBaseUrl: z.string().url().nullable(),
  moonshotApiKey: z.string().min(1).nullable(),
})

export const docxConversionConfigUpdateSchema = docxConversionConfigSchema.partial()

export type DocxConversionConfig = z.infer<typeof docxConversionConfigSchema>
export type DocxConversionConfigUpdate = z.infer<typeof docxConversionConfigUpdateSchema>
