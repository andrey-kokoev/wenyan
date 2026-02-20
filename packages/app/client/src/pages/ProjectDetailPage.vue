<template>
  <ProjectDetailLayout
    :loading="loading"
    :error="error"
    :project="project"
    @retry="fetchProject"
    @back="goBackToWorkspace"
  >
    <template #tabs>
      <div class="space-y-6">
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid w-full grid-cols-4">
            <TabsTrigger value="documents">
              <Icon icon="heroicons:document-text" class="w-4 h-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="rules">
              <Icon icon="heroicons:clipboard-document-check" class="w-4 h-4 mr-2" />
              Rules
              <Badge v-if="linkedRulesCount > 0" color="secondary" class="ml-2">
                {{ linkedRulesCount }}
              </Badge>
              <Badge v-if="linkedRuleSetsCount > 0" color="secondary" class="ml-2">
                {{ linkedRuleSetsCount }} sets
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="issues">
              <Icon icon="heroicons:exclamation-circle" class="w-4 h-4 mr-2" />
              Issues
              <Badge v-if="issues.length > 0" color="secondary" class="ml-2">
                {{ issues.length }}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Icon icon="heroicons:cog-6-tooth" class="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" class="p-2">
            <ProjectDocumentsPanel
              :project-id="projectId"
              @open-document="openProjectDocumentModal"
            />
          </TabsContent>

          <TabsContent value="rules" class="p-2">
            <ProjectRulesPanel
              :linked-rule-ids="linkedRuleIds"
              :rule-options="ruleOptions"
              :rules-loading="rulesLoadingCombined"
              :rules-error="rulesErrorCombined"
              v-model:rule-search-query="ruleSearchQuery"
              :filtered-project-rules="filteredProjectRules"
              :project-rules="projectRules"
              :project-rule-sets="projectRuleSets"
              :rule-sets-loading="ruleSetsLoading"
              :show-rule-sets-section="showRuleSetsSection"
              @update:rules="handleRuleSelection"
              @unlink-rule="unlinkRule"
              @unlink-rule-set="unlinkRuleSet"
            />
          </TabsContent>

          <TabsContent value="issues">
            <ProjectIssuesPanel
              :issues="issues"
              :documents="documents"
              :project-rules-count="projectRules.length"
              :issues-loading="issuesLoading"
              :analyzing-issues="analyzingIssues"
              :can-analyze-issues="canAnalyzeIssues"
              :analyze-issues-tooltip="analyzeIssuesTooltip"
              v-model:analyze-mode="analyzeMode"
              v-model:effort="effort"
              :get-rule-name="getRuleName"
              :get-status-variant="getStatusVariant"
              :get-status-color="getStatusColor"
              :get-priority-variant="getPriorityVariant"
              :get-priority-color="getPriorityColor"
              @analyze="handleAnalyzeIssues"
              @toggle-non-issue="toggleNonIssue"
              @delete-issue="handleDeleteIssue"
              @open-document="openDocumentPreview"
              @create-issue="handleCreateIssue"
            />
          </TabsContent>

          <TabsContent value="settings">
            <ProjectSettingsPanel
              v-model:edit-project="editProject"
              :has-changes="hasChanges"
              @save="handleUpdate"
              @delete="handleDeleteProject"
            />
          </TabsContent>
        </Tabs>
      </div>
    </template>

    <template #viewer>
      <ProjectDocumentViewer
        :show-document-dialog="showDocumentDialog"
        :selected-document="selectedDocument"
        :selected-modal-content="selectedModalContent"
        :is-document-loading="isDocumentLoading"
        :document-load-error="documentLoadError"
        :is-anchor-dialog-open="isAnchorDialogOpen"
        :selected-anchor="selectedAnchor"
        :selected-issue-content="selectedIssueContent"
        :selected-document-id="selectedDocumentId"
        :issues-for-selected-doc="issuesForSelectedDoc"
        :project-documents-count="documents.length"
        :project-rules-count="projectRules.length"
        :get-rule-name="getRuleName"
        :get-status-variant="getStatusVariant"
        :get-status-color="getStatusColor"
        :get-priority-variant="getPriorityVariant"
        :get-priority-color="getPriorityColor"
        @close-modal="closeDocumentModal"
        @close-evidence="handleEvidenceClose"
      />
    </template>
  </ProjectDetailLayout>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router"
import { Icon } from "@iconify/vue"
import ProjectDocumentsPanel from "@/components/ProjectDocumentsPanel.vue"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ProjectIssuesPanel from "@/components/ProjectIssuesPanel.vue"
import ProjectRulesPanel from "@/components/ProjectRulesPanel.vue"
import ProjectSettingsPanel from "@/components/ProjectSettingsPanel.vue"
import ProjectDocumentViewer from "@/components/ProjectDocumentViewer.vue"
import { useDocumentViewer } from "@/composables/useDocumentViewer"
import {
  getPriorityColor,
  getPriorityVariant,
  getStatusColor,
  getStatusVariant,
} from "@/utils/issues-utils"
import ProjectDetailLayout from "@/components/ProjectDetailLayout.vue"
import { useProjectDetail } from "@/composables/useProjectDetail"

const router = useRouter()
const {
  projectId,
  project,
  activeTab,
  loading,
  error,
  documents,
  editProject,
  hasChanges,
  fetchProject,
  handleUpdate,
  handleDelete,
  projectRulesPanel,
  projectIssues,
} = useProjectDetail()

const {
  showDocumentDialog,
  selectedDocument,
  selectedAnchor,
  isAnchorDialogOpen,
  isDocumentLoading,
  documentLoadError,
  selectedModalContent,
  selectedIssueContent,
  selectedDocumentId,
  issuesForSelectedDoc,
  openDocumentPreview,
  openProjectDocumentModal,
  closeDocumentModal,
  handleEvidenceClose,
} = useDocumentViewer(projectIssues.issues)

const {
  linkedRuleIds,
  linkedRuleSetsCount,
  linkedRulesCount,
  ruleOptions,
  rulesLoadingCombined,
  rulesErrorCombined,
  ruleSearchQuery,
  filteredProjectRules,
  projectRules,
  projectRuleSets,
  showRuleSetsSection,
  ruleSetsLoading,
  handleRuleSelection,
  unlinkRule,
  unlinkRuleSet,
  getRuleName,
} = projectRulesPanel

const {
  issues,
  issuesLoading,
  analyzingIssues,
  canAnalyzeIssues,
  analyzeIssuesTooltip,
  analyzeMode,
  effort,
  handleAnalyzeIssues,
  toggleNonIssue,
  handleCreateIssue,
  handleDeleteIssue,
} = projectIssues

function handleDeleteProject() {
  handleDelete(goBackToWorkspace)
}

function goBackToWorkspace() {
  const workspaceId = project.value?.workspaceId
  if (workspaceId) {
    router.push(`/workspaces/${workspaceId}`)
    return
  }
  router.push("/workspaces")
}
</script>
