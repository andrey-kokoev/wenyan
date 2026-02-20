<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h3 class="text-lg font-medium">Project Rules</h3>
        <p class="text-sm text-muted-foreground">
          Rules are individual policy checks linked directly to this project.
        </p>
      </div>
    </div>

    <MultiSelect
      :model-value="linkedRuleIds"
      :options="ruleOptions"
      :loading="rulesLoading"
      :disable-when-loading="false"
      :error="rulesError"
      placeholder="Select rules for this project"
      search-placeholder="Search rules..."
      class="max-w-2xl"
      @update:model-value="emit('update:rules', $event)"
    >
      <template #option="{ option, selected }">
        <div class="flex w-full items-center justify-between gap-2">
          <div class="grid min-w-0 flex-1 grid-cols-[140px_minmax(0,1fr)] gap-2 text-left">
            <span class="truncate font-mono text-xs text-muted-foreground">
              {{ option.code || "—" }}
            </span>
            <span class="truncate">
              {{ option.label }}
            </span>
          </div>
          <Icon v-if="selected" icon="lucide:check" class="h-4 w-4" />
        </div>
      </template>
    </MultiSelect>
    <p v-if="rulesError" class="text-xs text-destructive">
      {{ rulesError }}
    </p>

    <Input
      v-if="projectRules.length >= 3"
      v-model="ruleSearchQuery"
      class="max-w-md"
      placeholder="Search linked rules..."
    />

    <div v-if="rulesLoading" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:arrow-path" class="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">Loading rules...</p>
    </div>

    <div v-else-if="projectRules.length === 0" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:clipboard-document-list" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">No rules linked to this project.</p>
      <p class="text-sm text-muted-foreground">Use the selector above to link rules.</p>
    </div>

    <div v-else-if="filteredProjectRules.length === 0" class="text-center py-8 border rounded-lg">
      <Icon icon="heroicons:magnifying-glass" class="w-12 h-12 mx-auto text-muted-foreground" />
      <p class="mt-4 text-muted-foreground">No rules match your search.</p>
      <p class="text-sm text-muted-foreground">Try a different keyword.</p>
    </div>

    <div v-else class="space-y-3">
      <Card v-for="projectRule in filteredProjectRules" :key="projectRule.ruleId">
        <CardHeader class="pb-3">
          <div class="flex items-start justify-between">
            <Badge color="primary" variant="soft">Linked</Badge>
            <Button variant="ghost" size="sm" color="error" @click="emit('unlink-rule', projectRule.ruleId)">
              <Icon icon="heroicons:link-slash" class="w-4 h-4 mr-1" />
              Unlink
            </Button>
          </div>
          <CardTitle class="text-base mt-2">
            {{ projectRule.rule?.name || `Rule ${projectRule.ruleId}` }}
          </CardTitle>
          <CardDescription v-if="projectRule.rule?.description" class="line-clamp-2">
            {{ projectRule.rule.description }}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>

    <template v-if="showRuleSetsSection">
      <div class="flex items-center justify-between pt-4 border-t border-border">
        <h3 class="text-lg font-medium">Project Rule Sets</h3>
      </div>
      <p class="text-sm text-muted-foreground">
        Rule sets are groups of rules linked to this project.
      </p>

      <div v-if="ruleSetsLoading" class="text-center py-8 border rounded-lg">
        <Icon icon="heroicons:arrow-path" class="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
        <p class="mt-4 text-muted-foreground">Loading rule sets...</p>
      </div>

      <div v-else-if="projectRuleSets.length === 0" class="text-center py-8 border rounded-lg">
        <Icon icon="heroicons:squares-2x2" class="w-12 h-12 mx-auto text-muted-foreground" />
        <p class="mt-4 text-muted-foreground">No rule sets linked to this project.</p>
        <p class="text-sm text-muted-foreground">Link rule sets to group policies.</p>
      </div>

      <div v-else class="space-y-3">
        <Card v-for="projectRuleSet in projectRuleSets" :key="projectRuleSet.ruleSetId">
          <CardHeader class="pb-3">
            <div class="flex items-start justify-between">
              <Badge color="primary" variant="soft">Linked</Badge>
              <Button variant="ghost" size="sm" color="error" @click="emit('unlink-rule-set', projectRuleSet.ruleSetId)">
                <Icon icon="heroicons:link-slash" class="w-4 h-4 mr-1" />
                Unlink
              </Button>
            </div>
            <CardTitle class="text-base mt-2">
              {{ projectRuleSet.ruleSet?.name || `Rule Set ${projectRuleSet.ruleSetId}` }}
            </CardTitle>
            <CardDescription v-if="projectRuleSet.ruleSet?.description" class="line-clamp-2">
              {{ projectRuleSet.ruleSet.description }}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MultiSelect } from "@/components/ui/multi-select"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const props = defineProps<{
  linkedRuleIds: number[]
  ruleOptions: Array<{ value: number; label: string }>
  rulesLoading: boolean
  rulesError: string
  ruleSearchQuery: string
  filteredProjectRules: Array<{
    projectId: number
    ruleId: number
    rule?: { name?: string; description?: string | null }
  }>
  projectRules: Array<{
    projectId: number
    ruleId: number
    rule?: { name?: string; description?: string | null }
  }>
  projectRuleSets: Array<{
    projectId: number
    ruleSetId: number
    ruleSet?: { name?: string; description?: string | null }
  }>
  ruleSetsLoading: boolean
  showRuleSetsSection: boolean
}>()

const emit = defineEmits<{
  "update:rules": [Array<string | number>]
  "unlink-rule": [number]
  "unlink-rule-set": [number]
  "update:rule-search-query": [string]
}>()

const ruleSearchQuery = computed({
  get: () => props.ruleSearchQuery,
  set: (value: string) => emit("update:rule-search-query", value),
})
</script>
