<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useClipboard } from "@vueuse/core"
import { Icon } from "@iconify/vue"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { BadgeColor, BadgeVariant } from "@/utils/issues-utils"
import { compareIssuesBySeverityTitle } from "@/utils/issues-utils"
import RuleBadge from "@/components/RuleBadge.vue"
import type { IssueWithDocuments } from "@/stores/issues"
import { useToast } from "@/composables/useToast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import IssuesFilterBar from "@/components/IssuesFilterBar.vue"
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"
import * as XLSX from "xlsx"

const props = defineProps<{
  open: boolean
  filename?: string
  content: string
  documentId: number | null
  issues: IssueWithDocuments[]
  projectDocumentsCount: number
  projectRulesCount: number
  getRuleName: (ruleId: number) => string
  getStatusVariant: (status: string) => BadgeVariant
  getStatusColor: (status: string) => BadgeColor
  getPriorityVariant: (priority: string) => BadgeVariant
  getPriorityColor: (priority: string) => BadgeColor
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedSeverities = ref<Array<"low" | "medium" | "high" | "critical">>([])
const selectedRuleIds = ref<number[]>([])
const activePopoverKey = ref<string | null>(null)
const issueSearchQuery = ref("")
const debouncedSearchQuery = ref("")
let searchDebounceTimer: number | null = null
const activeView = ref<"full" | "snippets" | "export">("full")
const { copy } = useClipboard()
const { success: showSuccess, error: showError } = useToast()

const selectedSeveritySet = computed(() => new Set(selectedSeverities.value))
const selectedRuleIdSet = computed(() => new Set(selectedRuleIds.value))

function sortIssues(issues: IssueWithDocuments[]) {
  return [...issues].sort(compareIssuesBySeverityTitle)
}

function buildExportIssueOrderMap() {
  const unique = new Map<number, IssueWithDocuments>()
  for (const item of highlightItems.value) {
    for (const issue of item.issues) {
      if (!unique.has(issue.id)) {
        unique.set(issue.id, issue)
      }
    }
  }
  const sorted = Array.from(unique.values()).sort(compareIssuesBySeverityTitle)
  const orderMap = new Map<number, number>()
  sorted.forEach((issue, index) => {
    orderMap.set(issue.id, index + 1)
  })
  return orderMap
}

function sortIssuesByOrder(issues: IssueWithDocuments[], orderMap: Map<number, number>) {
  return [...issues].sort((a, b) => {
    const orderA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

const filteredIssues = computed(() => {
  const search = debouncedSearchQuery.value.trim().toLowerCase()
  return props.issues.filter((issue) => {
    const ruleIds = Array.isArray(issue.ruleIds) ? issue.ruleIds : []
    const matchesRules = !selectedRuleIds.value.length
      ? true
      : ruleIds.some((ruleId: number) => selectedRuleIdSet.value.has(ruleId))
    const matchesSeverity = !selectedSeverities.value.length
      ? true
      : selectedSeveritySet.value.has(issue?.priority)
    const matchesSearch = !search
      ? true
      : [
          issue?.title,
          issue?.description,
          ...ruleIds.map((ruleId: number) => props.getRuleName(ruleId)),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
    return matchesRules && matchesSeverity && matchesSearch
  })
})

const filteredCountLabel = computed(() => {
  const total = props.issues.length
  const shown = filteredIssues.value.length
  if (!total || shown === total) return ""
  return `Showing ${shown}/${total} issues`
})

const highlightItems = computed(() => {
  const quoteMap = new Map<string, IssueWithDocuments[]>()
  const lineMap = new Map<string, { start: number; end: number; issues: IssueWithDocuments[] }>()

  for (const issue of filteredIssues.value) {
    const doc = issue?.documents?.find((item) => item.id === props.documentId)
    const anchor = doc?.anchor
    if (!anchor) continue

    if (anchor.type === "quote" && anchor.text && anchor.text.trim()) {
      const key = anchor.text
      const list = quoteMap.get(key) || []
      list.push(issue)
      quoteMap.set(key, list)
      continue
    }

    if ((anchor.type === "line" || anchor.type === "span") && anchor.start != null && anchor.end != null) {
      const key = `${anchor.start}-${anchor.end}`
      const existing = lineMap.get(key)
      if (existing) {
        existing.issues.push(issue)
      } else {
        lineMap.set(key, { start: anchor.start, end: anchor.end, issues: [issue] })
      }
    }
  }

  const quoteItems = Array.from(quoteMap.entries()).map(([text, issues]) => ({
    type: "quote" as const,
    text,
    issues,
  }))

  const lineItems = Array.from(lineMap.values()).map((entry) => ({
    type: "line" as const,
    start: entry.start,
    end: entry.end,
    text: contentLines.value.slice(entry.start - 1, entry.end).join("\n"),
    issues: entry.issues,
  }))

  return [...lineItems, ...quoteItems]
})

const hasLineAnchors = computed(() => {
  return filteredIssues.value.some((issue) => {
    const doc = issue?.documents?.find((item) => item.id === props.documentId)
    return doc?.anchor?.type === "line" || doc?.anchor?.type === "span"
  })
})

type HighlightSegment =
  | { type: "text"; text: string }
  | { type: "highlight"; text: string; issues: IssueWithDocuments[] }

const quoteAnchors = computed(() => {
  const anchorMap = new Map<string, IssueWithDocuments[]>()
  for (const issue of filteredIssues.value) {
    const doc = issue?.documents?.find((item) => item.id === props.documentId)
    const anchorText = doc?.anchor?.type === "quote" ? doc.anchor.text : null
    if (!anchorText || !anchorText.trim()) continue
    const list = anchorMap.get(anchorText) || []
    list.push(issue)
    anchorMap.set(anchorText, list)
  }

  return Array.from(anchorMap.entries())
    .map(([text, issues]) => ({ text, issues }))
    .sort((a, b) => b.text.length - a.text.length)
})

function buildSegments(text: string, anchors: Array<{ text: string; issues: IssueWithDocuments[] }>): HighlightSegment[] {
  if (!anchors.length || !text) return [{ type: "text", text }]
  const segments: HighlightSegment[] = []
  let cursor = 0
  while (cursor < text.length) {
    let bestIndex = -1
    let bestAnchor: { text: string; issues: IssueWithDocuments[] } | null = null
    for (const anchor of anchors) {
      const idx = text.indexOf(anchor.text, cursor)
      if (idx === -1) continue
      if (bestIndex === -1 || idx < bestIndex || (idx === bestIndex && anchor.text.length > (bestAnchor?.text.length || 0))) {
        bestIndex = idx
        bestAnchor = anchor
      }
    }
    if (bestIndex === -1 || !bestAnchor) {
      segments.push({ type: "text", text: text.slice(cursor) })
      break
    }
    if (bestIndex > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, bestIndex) })
    }
    segments.push({ type: "highlight", text: bestAnchor.text, issues: bestAnchor.issues })
    cursor = bestIndex + bestAnchor.text.length
  }
  return segments
}

const quoteSegments = computed<HighlightSegment[]>(() => buildSegments(props.content, quoteAnchors.value))

const lineHighlightMap = computed(() => {
  const map = new Map<number, IssueWithDocuments[]>()
  for (const issue of filteredIssues.value) {
    const doc = issue?.documents?.find((item) => item.id === props.documentId)
    const anchor = doc?.anchor
    if (!anchor || anchor.start == null || anchor.end == null) continue
    for (let line = anchor.start; line <= anchor.end; line += 1) {
      const list = map.get(line) || []
      list.push(issue)
      map.set(line, list)
    }
  }
  return map
})

const contentLines = computed(() => props.content.split("\n"))

function lineQuoteSegments(lineText: string) {
  const anchors = quoteAnchors.value.filter((anchor) => lineText.includes(anchor.text))
  return buildSegments(lineText, anchors)
}

function clearFilters() {
  selectedRuleIds.value = []
  selectedSeverities.value = []
}

function buildIssueCopyText(issue: IssueWithDocuments) {
  const title = issue.title || "Untitled issue"
  const description = issue.description || ""
  return [title, description].filter(Boolean).join("\n")
}

async function copyIssue(issue: IssueWithDocuments) {
  try {
    await copy(buildIssueCopyText(issue))
    showSuccess("Copied", "Issue details copied to clipboard.")
  } catch (error) {
    showError("Copy failed", error instanceof Error ? error.message : "Unable to copy issue details.")
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadText(filename: string, contents: string, mime = "text/plain") {
  downloadBlob(filename, new Blob([contents], { type: mime }))
}

function buildCsv() {
  const rows = [["type", "text", "issue_number", "issue_title", "rules", "description"]]
  const orderMap = buildExportIssueOrderMap()
  for (const item of highlightItems.value) {
    for (const issue of sortIssuesByOrder(item.issues, orderMap)) {
      rows.push([
        item.type,
        item.text.replace(/\n/g, " "),
        String(orderMap.get(issue.id) ?? ""),
        issue.title || "",
        (issue.ruleIds || []).map((ruleId: number) => props.getRuleName(ruleId)).join(", "),
        issue.description || "",
      ])
    }
  }
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(","))
    .join("\n")
}

function buildMarkdown() {
  const lines = [`# ${props.filename || "Document"}`, ""]
  const orderMap = buildExportIssueOrderMap()
  for (const item of highlightItems.value) {
    const header = item.type === "line" ? `Lines ${item.start}–${item.end}` : "Quote"
    lines.push(`## ${header}`)
    lines.push("")
    lines.push("```")
    lines.push(item.text)
    lines.push("```")
    lines.push("")
    for (const issue of sortIssuesByOrder(item.issues, orderMap)) {
      lines.push(`${orderMap.get(issue.id) ?? ""}. **${issue.title || "Untitled issue"}**`)
      if (issue.ruleIds?.length) {
        lines.push(`  - Rules: ${issue.ruleIds.map((ruleId: number) => props.getRuleName(ruleId)).join(", ")}`)
      }
      if (issue.description) {
        lines.push(`  - ${issue.description}`)
      }
    }
    lines.push("")
  }
  return lines.join("\n")
}

function handleExport(type: "md" | "csv" | "xlsx" | "docx") {
  if (type === "md") {
    downloadText(`${props.filename || "document"}.md`, buildMarkdown(), "text/markdown")
    return
  }
  if (type === "csv") {
    downloadText(`${props.filename || "document"}.csv`, buildCsv(), "text/csv")
    return
  }
  if (type === "xlsx") {
    const rows = [["type", "text", "issue_number", "issue_title", "rules", "description"]]
    const orderMap = buildExportIssueOrderMap()
    for (const item of highlightItems.value) {
      for (const issue of sortIssuesByOrder(item.issues, orderMap)) {
        rows.push([
          item.type === "line" ? `Lines ${item.start}–${item.end}` : "Quote",
          item.text,
          String(orderMap.get(issue.id) ?? ""),
          issue.title || "",
          (issue.ruleIds || []).map((ruleId: number) => props.getRuleName(ruleId)).join(", "),
          issue.description || "",
        ])
      }
    }
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Highlights")
    const array = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    downloadBlob(`${props.filename || "document"}.xlsx`, blob)
    return
  }
  if (type === "docx") {
    const paragraphs: Paragraph[] = [
      new Paragraph({ text: props.filename || "Document", heading: HeadingLevel.HEADING_1 }),
    ]
    const orderMap = buildExportIssueOrderMap()

    for (const item of highlightItems.value) {
      const header = item.type === "line" ? `Lines ${item.start}–${item.end}` : "Quote"
      paragraphs.push(new Paragraph({ text: header, heading: HeadingLevel.HEADING_2 }))
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: item.text })] }))
      const sortedIssues = sortIssuesByOrder(item.issues, orderMap)
      for (const [index, issue] of sortedIssues.entries()) {
        const projectNumber = orderMap.get(issue.id) ?? index + 1
        paragraphs.push(
          new Paragraph({
            text: `[project:${projectNumber} issue:${index + 1}] ${issue.title || "Untitled issue"}`,
            heading: HeadingLevel.HEADING_3,
          }),
        )
        if (issue.ruleIds?.length) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: "Rules: ", bold: true }),
                new TextRun({ text: issue.ruleIds.map((ruleId: number) => props.getRuleName(ruleId)).join(", ") }),
              ],
            }),
          )
        }
        if (issue.description) {
          paragraphs.push(new Paragraph({ text: issue.description }))
        }
      }
      paragraphs.push(new Paragraph({ text: "" }))
    }

    const doc = new Document({ sections: [{ children: paragraphs }] })
    void Packer.toBlob(doc).then((blob) => {
      downloadBlob(`${props.filename || "document"}.docx`, blob)
    }).catch((error) => {
      showError("Export failed", error instanceof Error ? error.message : "Unable to export DOCX.")
    })
    return
  }
}

function openPopoverImmediate(key: string) {
  activePopoverKey.value = key
}

function closePopoverImmediate(key: string) {
  if (activePopoverKey.value === key) {
    activePopoverKey.value = null
  }
}

function makeLineKey(lineNumber: number, issues: IssueWithDocuments[] = []) {
  const ids = (issues || []).map((issue) => issue.id).join(",")
  return `line-${lineNumber}-${ids}`
}

function makeQuoteKey(text: string, issues: IssueWithDocuments[] = []) {
  const ids = (issues || []).map((issue) => issue.id).join(",")
  return `quote-${text.length}-${ids}`
}

watch(
  () => props.open,
  () => {
    activePopoverKey.value = null
  },
)

watch(
  () => [selectedSeverities.value, selectedRuleIds.value, props.documentId, props.content],
  () => {
    activePopoverKey.value = null
  },
  { deep: true },
)

watch(
  issueSearchQuery,
  (value) => {
    if (searchDebounceTimer != null) {
      window.clearTimeout(searchDebounceTimer)
    }
    searchDebounceTimer = window.setTimeout(() => {
      debouncedSearchQuery.value = value
    }, 150)
  },
  { immediate: true },
)
</script>

<template>
  <Dialog :open="open" @update:open="(value) => !value && emit('close')">
    <DialogContent class="max-w-5xl min-h-[70vh]">
      <DialogHeader>
        <DialogTitle>{{ filename || "Document" }}</DialogTitle>
        <DialogDescription>
          Review all issue highlights in this document.
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeView" class="w-full">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <TabsList class="grid grid-cols-3">
            <TabsTrigger value="full">Full document</TabsTrigger>
            <TabsTrigger value="snippets">Snippets</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <IssuesFilterBar
            :issues="issues"
            :get-rule-name="getRuleName"
            filter-layout="both"
            :search-query="issueSearchQuery"
            :selected-rule-ids="selectedRuleIds"
            :selected-severities="selectedSeverities"
            :filtered-count-label="filteredCountLabel"
            @update:search-query="(value) => (issueSearchQuery = value)"
            @update:selected-rule-ids="(value) => (selectedRuleIds = value)"
            @update:selected-severities="(value) => (selectedSeverities = value)"
            @clear="clearFilters"
          />
        </div>

        <div class="mt-4 max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/10 p-4 text-sm">
          <div v-if="!content" class="text-muted-foreground">No document content available.</div>
          <div v-else class="text-sm leading-relaxed">
            <TabsContent value="snippets">
            <div class="space-y-3">
              <div
                v-for="(item, index) in highlightItems"
                :key="index"
                class="rounded-md bg-muted/20 p-3"
              >
                <div v-if="item.type === 'line'" class="text-xs text-muted-foreground">
                  {{ `Lines ${item.start}–${item.end}` }}
                </div>
                <div
                  class="mt-2 whitespace-pre-wrap text-foreground"
                  :class="item.type === 'quote' ? 'border-l-2 border-muted-foreground/40 pl-3 italic' : ''"
                >
                  {{ item.type === "quote" ? `“${item.text}”` : item.text }}
                </div>
                <div class="mt-3 space-y-2">
                  <div
                    v-for="(issue, issueIndex) in sortIssues(item.issues)"
                    :key="issue.id"
                    class="group relative rounded-md border border-border bg-muted/10 p-3 text-xs text-foreground"
                  >
                    <Button
                      variant="link"
                      size="xs"
                      class="absolute right-2 top-2 h-6 w-6 p-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                      @click.stop="copyIssue(issue)"
                    >
                      <Icon icon="heroicons:clipboard" class="h-4 w-4" />
                    </Button>
                    <div class="font-medium text-sm text-foreground">
                      {{ `${issueIndex + 1}. ${issue.title || "Untitled issue"}` }}
                    </div>
                    <div v-if="issue.ruleIds?.length" class="mt-1">
                      <RuleBadge
                        :label="`${props.getRuleName(issue.ruleIds[0])}${issue.ruleIds.length > 1 ? ` +${issue.ruleIds.length - 1}` : ''}`"
                      />
                    </div>
                    <div v-if="issue.description" class="mt-2 text-muted-foreground whitespace-pre-wrap">
                      {{ issue.description }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </TabsContent>
            <TabsContent value="full">
          <template v-if="hasLineAnchors">
            <div class="space-y-1">
              <div
                v-for="(line, index) in contentLines"
                :key="index"
                class="whitespace-pre-wrap"
              >
                <Popover
                  v-if="lineHighlightMap.get(index + 1)"
                  :open="activePopoverKey === makeLineKey(index + 1, lineHighlightMap.get(index + 1))"
                  @update:open="(value) => value ? openPopoverImmediate(makeLineKey(index + 1, lineHighlightMap.get(index + 1))) : closePopoverImmediate(makeLineKey(index + 1, lineHighlightMap.get(index + 1)))"
                >
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-warning/30 text-[10px] text-foreground hover:underline"
                    >
                      {{ index + 1 }}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    class="min-w-[50ch] p-2"
                  >
                    <div class="space-y-2">
                      <div
                        v-for="(issue, issueIndex) in sortIssues(lineHighlightMap.get(index + 1) || [])"
                        :key="issue.id"
                        class="group relative rounded-md border border-border bg-muted/20 p-3 text-xs text-foreground"
                      >
                        <Button
                          variant="link"
                          size="xs"
                          class="absolute right-2 top-2 h-6 w-6 p-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                          @click.stop="copyIssue(issue)"
                        >
                          <Icon icon="heroicons:clipboard" class="h-4 w-4" />
                        </Button>
                        <div class="font-medium text-sm text-foreground">
                          {{ `${issueIndex + 1}. ${issue.title || "Untitled issue"}` }}
                        </div>
                        <div v-if="issue.ruleIds?.length" class="mt-1">
                          <RuleBadge
                            :label="`${props.getRuleName(issue.ruleIds[0])}${issue.ruleIds.length > 1 ? ` +${issue.ruleIds.length - 1}` : ''}`"
                          />
                        </div>
                        <div v-if="issue.description" class="mt-2 text-muted-foreground whitespace-pre-wrap">
                          {{ issue.description }}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <span v-else class="mr-2 text-xs text-muted-foreground">{{ index + 1 }}</span>
                <span :class="lineHighlightMap.get(index + 1) ? 'bg-warning/10' : ''">
                  <template v-for="(segment, segIndex) in lineQuoteSegments(line)" :key="segIndex">
                    <span v-if="segment.type === 'text'">{{ segment.text }}</span>
                    <Popover
                      v-else
                      :open="activePopoverKey === makeQuoteKey(segment.text, segment.issues)"
                      @update:open="(value) => value ? openPopoverImmediate(makeQuoteKey(segment.text, segment.issues)) : closePopoverImmediate(makeQuoteKey(segment.text, segment.issues))"
                    >
                      <PopoverTrigger as-child>
                        <mark
                          class="bg-warning/40 text-foreground cursor-pointer hover:underline hover:decoration-dashed hover:decoration-2 hover:decoration-muted-foreground/60 hover:underline-offset-2"
                          tabindex="0"
                        >
                          {{ segment.text }}
                        </mark>
                      </PopoverTrigger>
                      <PopoverContent class="min-w-[50ch] p-2">
                        <div class="space-y-2">
                          <div
                            v-for="(issue, issueIndex) in sortIssues(segment.issues)"
                            :key="issue.id"
                            class="group relative rounded-md border border-border bg-muted/20 p-3 text-xs text-foreground"
                          >
                            <Button
                              variant="link"
                              size="xs"
                              class="absolute right-2 top-2 h-6 w-6 p-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                              @click.stop="copyIssue(issue)"
                            >
                              <Icon icon="heroicons:clipboard" class="h-4 w-4" />
                            </Button>
                            <div class="font-medium text-sm text-foreground">
                              {{ `${issueIndex + 1}. ${issue.title || "Untitled issue"}` }}
                            </div>
                            <div v-if="issue.ruleIds?.length" class="mt-1">
                              <RuleBadge
                                :label="`${props.getRuleName(issue.ruleIds[0])}${issue.ruleIds.length > 1 ? ` +${issue.ruleIds.length - 1}` : ''}`"
                              />
                            </div>
                            <div v-if="issue.description" class="mt-2 text-muted-foreground whitespace-pre-wrap">
                              {{ issue.description }}
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </template>
                </span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="whitespace-pre-wrap">
              <template v-for="(segment, index) in quoteSegments" :key="index">
                <span v-if="segment.type === 'text'">{{ segment.text }}</span>
                <Popover
                  v-else
                  :open="activePopoverKey === makeQuoteKey(segment.text, segment.issues)"
                  @update:open="(value) => value ? openPopoverImmediate(makeQuoteKey(segment.text, segment.issues)) : closePopoverImmediate(makeQuoteKey(segment.text, segment.issues))"
                >
                  <PopoverTrigger as-child>
                    <mark
                      class="bg-warning/40 text-foreground cursor-pointer hover:underline hover:decoration-dashed hover:decoration-2 hover:decoration-muted-foreground/60 hover:underline-offset-2"
                      tabindex="0"
                    >
                      {{ segment.text }}
                    </mark>
                  </PopoverTrigger>
                  <PopoverContent class="min-w-[50ch] p-2">
                    <div class="space-y-2">
                      <div
                        v-for="(issue, issueIndex) in sortIssues(segment.issues)"
                        :key="issue.id"
                        class="group relative rounded-md border border-border bg-muted/20 p-3 text-xs text-foreground"
                      >
                        <Button
                          variant="link"
                          size="xs"
                          class="absolute right-2 top-2 h-6 w-6 p-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                          @click.stop="copyIssue(issue)"
                        >
                          <Icon icon="heroicons:clipboard" class="h-4 w-4" />
                        </Button>
                        <div class="font-medium text-sm text-foreground">
                          {{ `${issueIndex + 1}. ${issue.title || "Untitled issue"}` }}
                        </div>
                        <div v-if="issue.ruleIds?.length" class="mt-1">
                          <RuleBadge
                            :label="`${props.getRuleName(issue.ruleIds[0])}${issue.ruleIds.length > 1 ? ` +${issue.ruleIds.length - 1}` : ''}`"
                          />
                        </div>
                        <div v-if="issue.description" class="mt-2 text-muted-foreground whitespace-pre-wrap">
                          {{ issue.description }}
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </template>
            </div>
          </template>
            </TabsContent>
            <TabsContent value="export">
              <div class="flex min-h-[45vh] items-center justify-center gap-3">
                <Button variant="outline" @click="handleExport('md')">Export .md</Button>
                <Button variant="outline" @click="handleExport('csv')">Export .csv</Button>
                <Button variant="outline" @click="handleExport('xlsx')">Export .xlsx</Button>
                <Button variant="outline" @click="handleExport('docx')">Export .docx</Button>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
