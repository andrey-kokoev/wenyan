import { defineStore } from "pinia"
import { ref } from "vue"
import {
  type AiResponder,
  type AiResponderListResponse,
  AiResponderListResponseSchema,
} from "@wenyan/shared"

export const useAdminAiRespondersStore = defineStore("adminAiResponders", () => {
  const responders = ref<AiResponder[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      const response = await fetch("/api/admin/ai/responders")
      if (!response.ok) {
        throw new Error(`Failed to load AI responders (HTTP ${response.status})`)
      }
      const payload = (await response.json()) as AiResponderListResponse
      const parsed = AiResponderListResponseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error("AI responder response validation failed")
      }
      responders.value = parsed.data.data
    } finally {
      loading.value = false
    }
  }

  async function createResponder(input: {
    purpose: AiResponder["purpose"]
    providerKey: string
    model: string
    modelType: AiResponder["modelType"]
    maxOutputTokens: number | null
    settingsJson: string | null
    sortOrder: number
  }) {
    const response = await fetch("/api/admin/ai/responders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      throw new Error(`Failed to create responder (HTTP ${response.status})`)
    }
    const payload = (await response.json()) as { data?: AiResponder }
    if (!payload.data) {
      throw new Error("Failed to create responder (missing response data)")
    }
    return payload.data
  }

  async function updateResponder(
    id: number,
    input: Partial<{
      purpose: AiResponder["purpose"]
      providerKey: string
      model: string
      modelType: AiResponder["modelType"]
      maxOutputTokens: number | null
      settingsJson: string | null
      sortOrder: number
    }>,
  ) {
    const response = await fetch(`/api/admin/ai/responders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      throw new Error(`Failed to update responder (HTTP ${response.status})`)
    }
  }

  async function deleteResponder(id: number) {
    const response = await fetch(`/api/admin/ai/responders/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      throw new Error(`Failed to delete responder (HTTP ${response.status})`)
    }
  }

  return {
    responders,
    loading,
    fetchAll,
    createResponder,
    updateResponder,
    deleteResponder,
  }
})
