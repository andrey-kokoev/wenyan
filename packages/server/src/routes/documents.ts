import { Hono } from "hono"
import type { Bindings, Variables } from "../types/env"
import {
  handleAnalyzeInconsistencies,
  handleDocumentAnalysisResults,
  handleDocumentAnalyze,
  handleDocumentContent,
  handleDocumentDelete,
  handleDocumentList,
  handleDocumentStatus,
  handleDocumentUpload,
} from "../services/documents"
import { ensurePersonalWorkspace, getUserEmail } from "../utils/workspaces"

const documentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

documentRoutes.use("*", async (c, next) => {
  try {
    const email = getUserEmail(c)
    await ensurePersonalWorkspace(c, email)
  } catch {
    // If user is not authenticated, let the route handler deal with it
  }
  await next()
})

documentRoutes.post("/upload", handleDocumentUpload)

documentRoutes.get("/:documentId/status", handleDocumentStatus)

documentRoutes.get("/:documentId", handleDocumentContent)

documentRoutes.post("/:documentId/analyze", handleDocumentAnalyze)

documentRoutes.get("/:documentId/analysis/:analysisId", handleDocumentAnalysisResults)

documentRoutes.get("/", handleDocumentList)

documentRoutes.delete("/:documentId", handleDocumentDelete)

documentRoutes.post("/analyze-inconsistencies", handleAnalyzeInconsistencies)

export { documentRoutes }
