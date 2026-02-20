import { computed, unref, type MaybeRef } from "vue"
import { storeToRefs } from "pinia"
import { useDocumentsStore } from "@/stores/documents"

export function useDocuments(projectId: MaybeRef<number>) {
  const store = useDocumentsStore()
  const { documentsByProjectId, loadingByProjectId, errorByProjectId } = storeToRefs(store)
  const projectIdValue = computed(() => unref(projectId))

  const documents = computed(() => documentsByProjectId.value[projectIdValue.value] || [])
  const loading = computed(() => Boolean(loadingByProjectId.value[projectIdValue.value]))
  const error = computed(() => errorByProjectId.value[projectIdValue.value] || null)

  return {
    documents,
    loading,
    error,
    fetchByProjectId: store.fetchByProjectId,
    uploadFile: store.uploadFile,
    uploadContent: store.uploadContent,
    deleteDocument: store.deleteDocument,
  }
}
