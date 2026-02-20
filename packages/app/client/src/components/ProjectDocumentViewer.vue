<template>
  <div>
    <DocumentEvidenceModal
      :open="isAnchorDialogOpen"
      :filename="selectedAnchor?.filename"
      :content="selectedIssueContent"
      :document-id="selectedDocumentId"
      :issues="issuesForSelectedDoc"
      :project-documents-count="projectDocumentsCount"
      :project-rules-count="projectRulesCount"
      :get-rule-name="getRuleName"
      :get-status-variant="getStatusVariant"
      :get-status-color="getStatusColor"
      :get-priority-variant="getPriorityVariant"
      :get-priority-color="getPriorityColor"
      @close="emit('close-evidence')"
    />

    <Dialog :open="showDocumentDialog" @update:open="handleDialogOpen">
      <DialogContent class="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ selectedDocument?.filename || "Document" }}</DialogTitle>
          <DialogDescription>
            Full document content.
          </DialogDescription>
        </DialogHeader>
        <div class="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/10 p-4 text-sm">
          <div v-if="isDocumentLoading" class="text-muted-foreground">Loading document…</div>
          <div v-else-if="documentLoadError" class="text-destructive">{{ documentLoadError }}</div>
          <div v-else-if="selectedModalContent" class="whitespace-pre-wrap">
            {{ selectedModalContent }}
          </div>
          <div v-else class="text-muted-foreground">No document content available.</div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="emit('close-modal')">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import DocumentEvidenceModal from "@/components/DocumentEvidenceModal.vue"
import type { BadgeColor, BadgeVariant } from "@/utils/issues-utils"
import type { IssueWithDocuments } from "@/stores/issues"
import type { DocumentAnchor } from "@/composables/useDocumentViewer"

defineProps<{
  showDocumentDialog: boolean
  selectedDocument: { id: number; filename: string } | null
  selectedModalContent: string
  isDocumentLoading: boolean
  documentLoadError: string | null
  isAnchorDialogOpen: boolean
  selectedAnchor: {
    docId: number
    filename: string
    issueId?: number
    issueTitle?: string
    anchor?: DocumentAnchor
  } | null
  selectedIssueContent: string
  selectedDocumentId: number | null
  issuesForSelectedDoc: IssueWithDocuments[]
  projectDocumentsCount: number
  projectRulesCount: number
  getRuleName: (ruleId: number) => string
  getStatusVariant: (status: string) => BadgeVariant
  getStatusColor: (status: string) => BadgeColor
  getPriorityVariant: (priority: string) => BadgeVariant
  getPriorityColor: (priority: string) => BadgeColor
}>()

const emit = defineEmits<{
  "close-modal": []
  "close-evidence": []
}>()

function handleDialogOpen(value: boolean) {
  if (!value) {
    emit("close-modal")
  }
}
</script>
