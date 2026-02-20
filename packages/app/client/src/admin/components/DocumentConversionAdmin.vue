<template>
  <Card>
    <CardHeader>
      <CardTitle>Document Conversion</CardTitle>
      <CardDescription>
        Configure the service used to convert .docx files into Markdown.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="space-y-2">
        <Label for="docx-conversion-url">Conversion URL</Label>
        <Input
          id="docx-conversion-url"
          v-model="form.url"
          placeholder="https://converter.example.com/docx"
        />
      </div>
      <div class="space-y-2">
        <Label for="docx-conversion-token">Service Token</Label>
        <Input
          id="docx-conversion-token"
          v-model="form.token"
          type="password"
          :placeholder="maskedTokenPlaceholder || 'Bearer token'"
          @focus="handleTokenFocus"
          @blur="handleTokenBlur"
        />
        <p v-if="tokenHint" class="text-xs text-muted-foreground">
          {{ tokenHint }}
        </p>
      </div>
      <div class="space-y-2">
        <Label for="doc-upload-max-mb">Max Upload Size (MB)</Label>
        <Input
          id="doc-upload-max-mb"
          v-model="form.maxMb"
          type="number"
          min="1"
          step="1"
          placeholder="25"
        />
      </div>
    </CardContent>
    <CardFooter class="flex justify-end gap-2">
      <Button variant="outline" @click="loadConfig" :disabled="loading">
        Reset
      </Button>
      <Button @click="saveConfig" :disabled="loading">
        Save
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useToast } from "@/composables/useToast"
import type { DocxConversionConfig } from "@wenyan/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const { error: showError, success: showSuccess } = useToast()
const loading = ref(false)
const form = ref({
  url: "",
  token: "",
  maxMb: "",
})
const tokenHint = ref("")
const isTokenEditing = ref(false)
const maskedTokenPlaceholder = computed(() =>
  tokenHint.value && !isTokenEditing.value ? "*".repeat(64) : "",
)

const apiBaseUrl = computed(() => import.meta.env.VITE_API_URL || "")

async function loadConfig() {
  loading.value = true
  try {
    const baseUrl = apiBaseUrl.value
    const url = baseUrl === "/" || baseUrl === ""
      ? "/api/admin/config"
      : `${baseUrl}/api/admin/config`
    const response = await fetch(url, { credentials: "include" })
    if (!response.ok) {
      throw new Error(`Failed to load config (HTTP ${response.status})`)
    }
    const data = (await response.json()) as { data?: DocxConversionConfig }
    form.value.url = data.data?.docxConversionUrl ?? ""
    form.value.token = ""
    form.value.maxMb = data.data?.docUploadMaxMb ? String(data.data.docUploadMaxMb) : ""
    tokenHint.value = data.data?.docxConversionToken ? "Token is set. Leave blank to keep it unchanged." : ""
    isTokenEditing.value = false
  } catch (e) {
    showError("Failed to load config", e instanceof Error ? e.message : "Unknown error")
  } finally {
    loading.value = false
  }
}

function handleTokenFocus() {
  if (!isTokenEditing.value) {
    form.value.token = ""
    isTokenEditing.value = true
  }
}

function handleTokenBlur() {
  if (!form.value.token.trim() && tokenHint.value) {
    isTokenEditing.value = false
  }
}
async function saveConfig() {
  loading.value = true
  try {
    const baseUrl = apiBaseUrl.value
    const url = baseUrl === "/" || baseUrl === ""
      ? "/api/admin/config"
      : `${baseUrl}/api/admin/config`
    const payload: { docxConversionUrl?: string; docxConversionToken?: string; docUploadMaxMb?: number } = {}
    if (form.value.url.trim()) payload.docxConversionUrl = form.value.url.trim()
    if (isTokenEditing.value && form.value.token.trim()) {
      payload.docxConversionToken = form.value.token.trim()
    }
    const maxMbValue = String(form.value.maxMb ?? "").trim()
    if (maxMbValue) payload.docUploadMaxMb = Number(maxMbValue)

    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to save config (HTTP ${response.status})`)
    }

    showSuccess("Configuration saved", "Document conversion settings updated.")
    await loadConfig()
  } catch (e) {
    showError("Failed to save config", e instanceof Error ? e.message : "Unknown error")
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>
