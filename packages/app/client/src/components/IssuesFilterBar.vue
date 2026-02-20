<script setup lang="ts">
import { computed } from "vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Icon } from "@iconify/vue"
import type { IssueWithDocuments } from "@/stores/issues"

type FilterMode = "by-severity" | "by-rule"
type FilterLayout = "both" | "toggle"

const props = withDefaults(defineProps<{
  issues: IssueWithDocuments[]
  getRuleName: (ruleId: number) => string
  filterLayout?: FilterLayout
  filterMode?: FilterMode
  searchQuery: string
  selectedRuleIds: number[]
  selectedSeverities: Array<"low" | "medium" | "high" | "critical">
  showRuleBadges?: boolean
  showSeverityBadges?: boolean
  filteredCountLabel?: string
}>(), {
  filterLayout: "both",
  filterMode: "by-severity",
  showRuleBadges: true,
  showSeverityBadges: true,
  filteredCountLabel: "",
})

const emit = defineEmits<{
  "update:filterMode": [FilterMode]
  "update:searchQuery": [string]
  "update:selectedRuleIds": [number[]]
  "update:selectedSeverities": [Array<"low" | "medium" | "high" | "critical">]
  "clear": []
}>()

const severityBadgeRows = computed(() => {
  const counts = new Map<"low" | "medium" | "high" | "critical", number>()
  for (const issue of props.issues) {
    const priority = issue?.priority as "low" | "medium" | "high" | "critical" | undefined
    if (!priority) continue
    counts.set(priority, (counts.get(priority) || 0) + 1)
  }
  const order: Array<"critical" | "high" | "medium" | "low"> = ["critical", "high", "medium", "low"]
  const labels: Record<"low" | "medium" | "high" | "critical", string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  }
  const colors: Record<"low" | "medium" | "high" | "critical", "neutral" | "primary" | "secondary" | "error"> = {
    low: "neutral",
    medium: "primary",
    high: "secondary",
    critical: "error",
  }
  return order
    .map((priority) => ({
      priority,
      count: counts.get(priority) || 0,
      label: labels[priority],
      color: colors[priority],
    }))
    .filter((row) => row.count > 0)
})

const ruleBadgeRows = computed(() => {
  const counts = new Map<number, number>()
  for (const issue of props.issues) {
    const ruleIds = Array.isArray(issue.ruleIds) ? issue.ruleIds : []
    for (const ruleId of ruleIds) {
      counts.set(ruleId, (counts.get(ruleId) || 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([ruleId, count]) => ({
      ruleId,
      count,
      label: props.getRuleName(ruleId) || `Rule ${ruleId}`,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
})

function toggleRuleFilter(ruleId: number) {
  const next = new Set(props.selectedRuleIds)
  if (next.has(ruleId)) {
    next.delete(ruleId)
  } else {
    next.add(ruleId)
  }
  emit("update:selectedRuleIds", Array.from(next))
}

function toggleSeverityFilter(priority: "low" | "medium" | "high" | "critical") {
  const next = new Set(props.selectedSeverities)
  if (next.has(priority)) {
    next.delete(priority)
  } else {
    next.add(priority)
  }
  emit("update:selectedSeverities", Array.from(next))
}

const selectedRuleIdSet = computed(() => new Set(props.selectedRuleIds))
const selectedSeveritySet = computed(() => new Set(props.selectedSeverities))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-if="filterLayout === 'toggle'">
      <Button size="sm" :variant="filterMode === 'by-severity' ? 'solid' : 'ghost'"
        @click="emit('update:filterMode', 'by-severity')">
        By severity
      </Button>
      <Button size="sm" :variant="filterMode === 'by-rule' ? 'solid' : 'ghost'"
        @click="emit('update:filterMode', 'by-rule')">
        By rule
      </Button>
    </template>

    <div class="relative">
      <Input :model-value="searchQuery" class="h-8 w-55 pr-8" placeholder="Search issues..."
        @update:model-value="(value) => emit('update:searchQuery', String(value))" />
      <button v-if="searchQuery" type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Clear search" @click="emit('update:searchQuery', '')">
        <Icon icon="heroicons:x-mark" class="h-4 w-4" />
      </button>
    </div>

    <span v-if="filteredCountLabel" class="text-xs text-muted-foreground">
      {{ filteredCountLabel }}
    </span>

    <Button v-if="selectedRuleIds.length || selectedSeverities.length" size="xs" variant="ghost"
      class="h-7 px-2 text-xs" @click="emit('clear')">
      Clear filters
    </Button>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <template v-if="showSeverityBadges && (filterLayout === 'both' || filterMode === 'by-severity')">
      <button v-for="row in severityBadgeRows" :key="row.priority" type="button" class="rounded-full"
        @click="toggleSeverityFilter(row.priority)">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge variant="soft" :color="row.color" :class="[
              'inline-flex items-center gap-2 text-xs',
              selectedSeveritySet.has(row.priority) ? '' : 'opacity-70',
            ]">
              <span class="truncate">{{ row.label }}</span>
              <span class="text-[11px] text-muted-foreground">· {{ row.count }}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {{ row.count }} issues found
          </TooltipContent>
        </Tooltip>
      </button>
    </template>

    <template v-if="showRuleBadges && (filterLayout === 'both' || filterMode === 'by-rule')">
      <button v-for="row in ruleBadgeRows" :key="row.ruleId" type="button" class="rounded-full"
        @click="toggleRuleFilter(row.ruleId)">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge variant="soft" :color="selectedRuleIdSet.has(row.ruleId) ? 'secondary' : 'neutral'"
              class="inline-flex items-center gap-2 text-xs">
              <span class="truncate">{{ row.label }}</span>
              <span class="text-[11px] text-muted-foreground">· {{ row.count }}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {{ row.count }} issues found
          </TooltipContent>
        </Tooltip>
      </button>
    </template>
  </div>
</template>
