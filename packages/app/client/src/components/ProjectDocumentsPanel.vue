<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">Documents</h3>
      <Button size="sm" @click="showPasteDocumentDialog = true">
        <Icon icon="heroicons:clipboard-document" class="w-4 h-4 mr-2" />
        Paste as document
      </Button>
    </div>

    <div
      class="w-full border border-dashed rounded-lg p-4 transition-colors"
      :class="isDocumentDragActive ? 'border-primary bg-muted/30' : 'border-border'"
      @dragover.prevent="handleDocumentDragOver"
      @dragleave.prevent="handleDocumentDragLeave"
      @drop.prevent="handleDocumentDrop"
    >
      <input
        ref="documentFileInput"
        type="file"
        multiple
        accept=".txt,.md,.docx"
        class="hidden"
        @change="handleDocumentFileInput"
      />
      <div class="flex flex-col items-center gap-2 text-center">
        <Icon icon="heroicons:arrow-up-tray" class="w-5 h-5 text-muted-foreground" />
        <div class="text-sm">
          <span class="font-medium">Drop .txt, .md, or .docx files</span> or
          <button
            type="button"
            class="text-primary hover:underline"
            @click="documentFileInput?.click()"
          >
            browse
          </button>
        </div>
        <div class="text-xs text-muted-foreground">
          .docx files are converted to Markdown after upload.
        </div>
        <div v-if="documents.length === 0" class="pt-2 text-xs text-muted-foreground">
          No documents yet. Use Paste as document or drop files here.
        </div>
      </div>
    </div>

    <div v-if="documents.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card
        v-for="doc in documents"
        :key="doc.id"
        class="cursor-pointer hover:border-primary transition-colors"
        @click="emit('open-document', doc)"
      >
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <Icon :icon="getFileIcon(doc.fileType)" class="w-8 h-8 text-primary" />
            <div class="flex items-center gap-2">
              <Tooltip v-if="doc.status === 'processing'">
                <TooltipTrigger as-child>
                  <Badge :variant="getStatusVariant(doc.status)" :color="getStatusColor(doc.status)">
                    <Icon icon="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Converting .docx to Markdown. This can take a minute. The document updates when it is ready.
                </TooltipContent>
              </Tooltip>
              <Badge
                v-else
                :variant="getStatusVariant(doc.status)"
                :color="getStatusColor(doc.status)"
              >
                {{ doc.status }}
              </Badge>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="link"
                    size="sm"
                    class="h-7 px-0 text-muted-foreground hover:text-destructive"
                    @click.stop="openDeleteDialog(doc)"
                  >
                    <Icon icon="heroicons:trash" class="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete document</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <CardTitle class="text-sm mt-2">{{ doc.filename }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Dialog v-model:open="showPasteDocumentDialog">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste Document</DialogTitle>
          <DialogDescription>
            Add a text document to this project.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="paste-document-name">Name</Label>
            <Input
              id="paste-document-name"
              v-model="pasteDocumentForm.name"
              placeholder="Document name"
            />
          </div>
          <div class="space-y-2">
            <Label for="paste-document-extension">Extension</Label>
            <Select v-model="pasteDocumentForm.extension">
              <SelectTrigger id="paste-document-extension">
                <SelectValue placeholder="Select extension" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">.txt</SelectItem>
                <SelectItem value="md">.md</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="paste-document-content">Content</Label>
            <Textarea
              id="paste-document-content"
              v-model="pasteDocumentForm.content"
              placeholder="Paste document content..."
              rows="6"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPasteDocumentDialog = false">
            Cancel
          </Button>
          <Button :disabled="!canPasteDocument || pasteDocumentSubmitting" @click="handlePasteDocument">
            {{ pasteDocumentSubmitting ? "Saving..." : "Save Document" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            This will permanently delete "{{ documentToDelete?.filename }}".
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteSubmitting" @click="showDeleteDialog = false">
            Cancel
          </Button>
        <Button variant="solid" color="error" :disabled="deleteSubmitting" @click="confirmDeleteDocument">
          {{ deleteSubmitting ? "Deleting..." : "Delete" }}
        </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { useToast } from "@/composables/useToast"
import { useDocuments } from "@/composables/useDocuments"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type BadgeVariant = "default" | "outline" | "soft" | "subtle" | "ghost"
type BadgeColor = "primary" | "secondary" | "success" | "warning" | "error" | "info" | "neutral"

const props = defineProps<{
  projectId: number
}>()

const emit = defineEmits<{
  "open-document": [any]
}>()

const { documents, fetchByProjectId, uploadFile, uploadContent, deleteDocument } = useDocuments(props.projectId)

const { success: showSuccess, error: showError } = useToast()

const documentFileInput = ref<HTMLInputElement | null>(null)
const isDocumentDragActive = ref(false)
const showPasteDocumentDialog = ref(false)
const showDeleteDialog = ref(false)
const pasteDocumentSubmitting = ref(false)
const deleteSubmitting = ref(false)
const documentToDelete = ref<{ id: number; filename: string } | null>(null)
const pasteDocumentForm = ref({
  name: "",
  content: "",
  extension: "txt",
})

const canPasteDocument = computed(() => {
  return (
    pasteDocumentForm.value.name.trim().length > 0
    && pasteDocumentForm.value.content.trim().length > 0
  )
})

const hasProcessingDocuments = computed(() => {
  return documents.value.some((doc) => doc.status === "processing")
})

let refreshInterval: ReturnType<typeof setInterval> | null = null

function startProcessingPoll() {
  if (refreshInterval) return
  refreshInterval = setInterval(() => {
    if (props.projectId) {
      void fetchByProjectId(props.projectId)
    }
  }, 8000)
}

function stopProcessingPoll() {
  if (!refreshInterval) return
  clearInterval(refreshInterval)
  refreshInterval = null
}

function buildDocumentFilename(name: string, extension: string) {
  const trimmed = name.trim()
  if (trimmed.toLowerCase().endsWith(`.${extension}`)) {
    return trimmed
  }
  return `${trimmed}.${extension}`
}

function handleDocumentDragOver() {
  isDocumentDragActive.value = true
}

function handleDocumentDragLeave() {
  isDocumentDragActive.value = false
}

function handleDocumentDrop(event: DragEvent) {
  isDocumentDragActive.value = false
  if (!event.dataTransfer?.files?.length) return
  void uploadDocumentFiles(event.dataTransfer.files)
}

function handleDocumentFileInput(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  void uploadDocumentFiles(target.files)
  target.value = ""
}

async function uploadDocumentFiles(files: FileList | File[]) {
  const list = Array.from(files)
  if (list.length === 0) return

  const validFiles: File[] = []
  const invalidFiles: File[] = []
  for (const file of list) {
    const name = file.name.toLowerCase()
    if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".docx")) {
      validFiles.push(file)
    } else {
      invalidFiles.push(file)
    }
  }

  if (invalidFiles.length > 0) {
    showError(
      "Unsupported files",
      "Only .txt, .md, and .docx files can be uploaded here.",
    )
  }

  for (const file of validFiles) {
    try {
      await uploadFile(props.projectId, file)
    } catch (e) {
      showError(
        "Failed to upload document",
        e instanceof Error ? e.message : "Unknown error",
      )
    }
  }

  await fetchByProjectId(props.projectId)
}

async function handlePasteDocument() {
  if (!canPasteDocument.value) return
  pasteDocumentSubmitting.value = true
  try {
    const filename = buildDocumentFilename(
      pasteDocumentForm.value.name,
      pasteDocumentForm.value.extension,
    )
    await uploadContent(
      props.projectId,
      filename,
      pasteDocumentForm.value.extension as "txt" | "md",
      pasteDocumentForm.value.content,
    )
    showSuccess("Document added", `"${filename}" has been uploaded.`)
    showPasteDocumentDialog.value = false
    pasteDocumentForm.value = { name: "", content: "", extension: "txt" }
    await fetchByProjectId(props.projectId)
  } catch (e) {
    showError("Failed to upload document", e instanceof Error ? e.message : "Unknown error")
  } finally {
    pasteDocumentSubmitting.value = false
  }
}

function openDeleteDialog(doc: { id: number; filename: string }) {
  documentToDelete.value = doc
  showDeleteDialog.value = true
}

async function confirmDeleteDocument() {
  if (!documentToDelete.value) return
  try {
    deleteSubmitting.value = true
    await deleteDocument(documentToDelete.value.id, props.projectId)
    showSuccess("Document deleted", `"${documentToDelete.value.filename}" has been removed.`)
    showDeleteDialog.value = false
    documentToDelete.value = null
  } catch (e) {
    showError("Failed to delete document", e instanceof Error ? e.message : "Unknown error")
  } finally {
    deleteSubmitting.value = false
  }
}

function getFileIcon(fileType: string): string {
  switch (fileType) {
    case "pdf":
      return "heroicons:document-text"
    case "docx":
      return "heroicons:document"
    case "txt":
    case "md":
      return "heroicons:document-text"
    default:
      return "heroicons:document"
  }
}

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "analyzed":
    case "resolved":
    case "closed":
      return "default"
    case "processing":
    case "in_progress":
      return "soft"
    case "error":
      return "default"
    default:
      return "outline"
  }
}

function getStatusColor(status: string): BadgeColor {
  switch (status) {
    case "analyzed":
    case "resolved":
    case "closed":
      return "success"
    case "processing":
    case "in_progress":
      return "secondary"
    case "error":
      return "error"
    default:
      return "neutral"
  }
}

watch(
  () => props.projectId,
  () => {
    if (props.projectId) {
      void fetchByProjectId(props.projectId)
    }
  },
  { immediate: true },
)

watch(
  hasProcessingDocuments,
  (hasProcessing) => {
    if (hasProcessing) {
      startProcessingPoll()
    } else {
      stopProcessingPoll()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.projectId) {
    void fetchByProjectId(props.projectId)
  }
})

onUnmounted(() => {
  stopProcessingPoll()
})
</script>
