<template>
  <div class="container mx-auto py-8 px-4">
    <ProjectCard>
      <div class="space-y-6">
        <!-- Project Info Alert -->
        <Alert v-if="!currentProject" variant="default">
          <Info class="h-4 w-4" />
          <AlertTitle>No Project Selected</AlertTitle>
          <AlertDescription>
            Please select or create a project using the selector above to upload and analyze
            documents.
          </AlertDescription>
        </Alert>

        <!-- Document Upload Section -->
        <div v-else class="space-y-4">
          <div
            class="w-full border-2 border-dashed rounded-lg p-6 transition-colors"
            :class="isDragging ? 'border-primary bg-muted/30' : 'border-muted'"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInput"
              type="file"
              multiple
              accept=".txt,.md,.json,.js,.ts,.css,.html"
              class="hidden"
              @change="onFileInputChange"
            />
            <div class="flex flex-col items-center gap-3 text-center">
              <Upload class="w-6 h-6 text-muted-foreground" />
              <div class="space-y-1">
                <p class="text-sm font-medium">Drop documents here or browse</p>
                <p class="text-xs text-muted-foreground">
                  Text-based files only (.txt, .md, .json, .js, .ts, .css, .html)
                </p>
              </div>
              <Button variant="outline" size="sm" @click="fileInput?.click()">
                Select Files
              </Button>
            </div>

            <div v-if="documents.length" class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div
                v-for="(doc, index) in documents"
                :key="`${doc.file?.name ?? 'doc'}-${index}`"
                class="flex items-center gap-3 rounded-md border bg-background/60 px-3 py-2"
              >
                <FileText class="h-4 w-4 text-muted-foreground" />
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate">{{ doc.file?.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ doc.file ? formatFileSize(doc.file.size) : "Pending" }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Schema Configuration -->
        <div v-if="currentProject" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-sm font-medium mb-2 block">Analysis Type</label>
              <Select v-model="config.analysisType">
                <SelectTrigger>
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="factual">Factual Consistency</SelectItem>
                  <SelectItem value="temporal">Temporal Consistency</SelectItem>
                  <SelectItem value="semantic">Semantic Consistency</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="text-sm font-medium mb-2 block">Output Format</label>
              <Select v-model="config.outputFormat">
                <SelectTrigger>
                  <SelectValue placeholder="Select output format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary Report</SelectItem>
                  <SelectItem value="detailed">Detailed Analysis</SelectItem>
                  <SelectItem value="structured">Structured Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label class="text-sm font-medium mb-2 block">Custom Instructions</label>
            <Textarea
              v-model="config.customInstructions"
              placeholder="Enter any specific instructions for the analysis..."
              rows="3"
            />
          </div>
        </div>

        <!-- Analysis Button -->
        <div v-if="currentProject" class="flex justify-center">
          <Button
            @click="analyzeDocuments"
            :disabled="!canAnalyze || loading"
            size="lg"
            class="min-w-48"
          >
            <Brain class="w-4 h-4 mr-2" />
            {{ loading ? "Analyzing..." : "Analyze Documents" }}
          </Button>
        </div>

        <!-- Error Section -->
        <div v-if="error" class="space-y-4">
          <Alert variant="destructive">
            <XCircle class="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>
              {{ error }}
            </AlertDescription>
          </Alert>
        </div>

        <!-- Results Section -->
        <div v-if="results" class="space-y-4">
          <h3 class="text-lg font-medium">Analysis Results</h3>
          <div
            v-if="results.inconsistencies && results.inconsistencies.length > 0"
            class="space-y-3"
          >
            <Alert
              variant="destructive"
              v-for="inconsistency in results.inconsistencies"
              :key="inconsistency.id"
            >
              <AlertTriangle class="h-4 w-4" />
              <AlertTitle>{{ inconsistency.type }} Inconsistency</AlertTitle>
              <AlertDescription>
                <div class="mt-2 space-y-2">
                  <p><strong>Documents:</strong> {{ inconsistency.documents.join(", ") }}</p>
                  <p><strong>Description:</strong> {{ inconsistency.description }}</p>
                  <p>
                    <strong>Severity:</strong>
                    <Badge :color="getSeverityColor(inconsistency.severity)" variant="soft">
                      {{ inconsistency.severity }}
                    </Badge>
                  </p>
                  <p v-if="inconsistency.suggestion">
                    <strong>Suggestion:</strong> {{ inconsistency.suggestion }}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
          <div v-else>
            <Alert>
              <CheckCircle class="h-4 w-4" />
              <AlertTitle>No Inconsistencies Found</AlertTitle>
              <AlertDescription>
                The documents appear to be consistent with each other.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-8">
          <div class="text-center space-y-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p class="text-sm text-muted-foreground">Analyzing documents with Cloudflare AI...</p>
          </div>
        </div>
      </div>
    </ProjectCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import { useWorkspaceContext } from "@/composables/useWorkspaceContext"
import ProjectCard from "@/components/ProjectCard.vue"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Upload, Brain, AlertTriangle, CheckCircle, XCircle, Info, FileText } from "lucide-vue-next"

interface Document {
  file: File | null
  content: string
  uploaded: boolean
}

interface AnalysisConfig {
  analysisType: "factual" | "temporal" | "semantic" | "comprehensive"
  outputFormat: "summary" | "detailed" | "structured"
  customInstructions: string
}

interface Inconsistency {
  id: string
  type: string
  documents: string[]
  description: string
  severity: "low" | "medium" | "high" | "critical"
  suggestion?: string
}

interface AnalysisResults {
  inconsistencies: Inconsistency[]
  summary: string
  analysisId: string
  timestamp: string
}

const { currentProject } = useWorkspaceContext()

const documents = ref<Document[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const config = ref<AnalysisConfig>({
  analysisType: "comprehensive",
  outputFormat: "detailed",
  customInstructions: "",
})

const loading = ref(false)
const results = ref<AnalysisResults | null>(null)
const error = ref<string | null>(null)

const canAnalyze = computed(() => {
  return documents.value.length > 0 && documents.value.every((doc) => doc.file && doc.uploaded)
})

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const getSeverityColor = (
  severity: string,
): "error" | "warning" | "primary" | "neutral" => {
  switch (severity) {
    case "critical":
    case "high":
      return "error"
    case "medium":
      return "warning"
    case "low":
      return "primary"
    default:
      return "neutral"
  }
}

const SUPPORTED_TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "application/json",
  "text/javascript",
  "text/typescript",
  "text/css",
  "text/html",
]

const isTextFile = (file: File): boolean => {
  return SUPPORTED_TEXT_TYPES.includes(file.type) || file.type.startsWith("text/")
}

const onDragOver = () => {
  isDragging.value = true
}

const onDragLeave = () => {
  isDragging.value = false
}

const onDrop = (event: DragEvent) => {
  isDragging.value = false
  if (!event.dataTransfer?.files?.length) return
  void handleFiles(event.dataTransfer.files)
}

const onFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  void handleFiles(target.files)
  target.value = ""
}

const handleFiles = async (files: FileList | File[]) => {
  const list = Array.from(files)
  if (list.length === 0) return

  error.value = null

  const invalidFiles = list.filter((file) => !isTextFile(file))
  if (invalidFiles.length > 0) {
    const names = invalidFiles.map((file) => `"${file.name}"`).join(", ")
    error.value = `Skipped ${names} because they appear to be binary files. Please upload text-based documents only (.txt, .md, .json, etc.).`
  }

  const validFiles = list.filter((file) => isTextFile(file))
  const newDocs: Document[] = []

  for (const file of validFiles) {
    try {
      const content = await readFileContent(file)
      newDocs.push({ file, content, uploaded: true })
    } catch (err) {
      console.error("Error reading file:", err)
      error.value = `Failed to read "${file.name}". Please ensure it is a valid text file.`
    }
  }

  if (newDocs.length > 0) {
    documents.value = [...documents.value, ...newDocs]
  }
}

const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(content)
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return "Network error: Unable to connect to the server. Please check your internet connection or try again later."
  }
  if (err instanceof Response) {
    switch (err.status) {
      case 400:
        return "Invalid request: Please check your documents and configuration."
      case 401:
        return "Authentication required: Please sign in to continue."
      case 403:
        return "Access denied: You do not have permission to perform this analysis."
      case 413:
        return "Files too large: Please upload smaller documents."
      case 429:
        return "Rate limit exceeded: Please wait a moment and try again."
      case 500:
      case 502:
      case 503:
        return "Server error: The analysis service is temporarily unavailable. Please try again later."
      default:
        return `Server error (${err.status}): ${err.statusText || "Unknown error"}`
    }
  }
  return err instanceof Error ? err.message : "An unexpected error occurred during analysis"
}

// API base URL - uses environment variable if available, otherwise relative
const API_BASE_URL = import.meta.env.VITE_API_URL || ""

const analyzeDocuments = async () => {
  if (!canAnalyze.value) return

  loading.value = true
  results.value = null
  error.value = null

  try {
    const endpoint = `${API_BASE_URL}/documents/analyze-inconsistencies`
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documents: documents.value.map((doc, index) => ({
          id: `doc-${index + 1}`,
          name: doc.file!.name,
          content: doc.content,
        })),
        config: config.value,
      }),
    })

    if (!response.ok) {
      throw response
    }

    const analysisResults: AnalysisResults = await response.json()
    results.value = analysisResults
  } catch (err) {
    console.error("Error during analysis:", err)
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>
