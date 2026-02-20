<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-6">
      <Button variant="ghost" @click="goBack">
        <Icon icon="heroicons:arrow-left" class="w-4 h-4 mr-2" />
        Back
      </Button>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Rule Sets</h1>
          <p class="text-muted-foreground">Group rules into reusable sets.</p>
        </div>
        <Button @click="showCreateDialog = true">
          <Icon icon="heroicons:plus" class="w-4 h-4 mr-2" />
          New Rule Set
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Rule Sets</CardTitle>
          <CardDescription>
            Manage rule sets and assign rules directly from the table.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="loading" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <div v-else-if="error" class="text-center py-8">
            <p class="text-destructive">{{ error }}</p>
            <Button variant="outline" class="mt-4" @click="reload">
              Retry
            </Button>
          </div>

          <div v-else-if="ruleSets.length === 0" class="text-center py-8">
            <Icon icon="heroicons:squares-2x2" class="w-12 h-12 mx-auto text-muted-foreground" />
            <p class="mt-4 text-muted-foreground">No rule sets yet.</p>
            <p class="text-sm text-muted-foreground">Create your first rule set to get started.</p>
          </div>

          <Table v-else>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="ruleSet in ruleSets" :key="ruleSet.id">
                <TableCell class="font-medium">
                  <Input
                    :model-value="ruleSet.name"
                    class="h-8"
                    @blur="updateRuleSet(ruleSet.id, { name: ($event.target as HTMLInputElement).value })"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    :model-value="ruleSet.description ?? ''"
                    class="h-8"
                    placeholder="Description"
                    @blur="updateRuleSet(ruleSet.id, { description: ($event.target as HTMLInputElement).value })"
                  />
                </TableCell>
                <TableCell class="min-w-[280px]">
                  <MultiSelect
                    :model-value="selectedRuleIdsBySet[ruleSet.id] ?? []"
                    :options="ruleOptions"
                    :loading="rulesLoadingCombined"
                    :disable-when-loading="false"
                    :error="rulesErrorCombined"
                    placeholder="Select rules"
                    search-placeholder="Search rules..."
                    @update:model-value="(value) => handleRuleSelection(ruleSet.id, value)"
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
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    variant="ghost"
                    color="error"
                    size="sm"
                    @click="removeRuleSet(ruleSet.id)"
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="showCreateDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Rule Set</DialogTitle>
        <DialogDescription>Rule sets are global and can be linked to projects.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="rule-set-name">Name</Label>
            <Input id="rule-set-name" v-model="newRuleSetName" />
          </div>
          <div class="space-y-2">
            <Label for="rule-set-description">Description</Label>
            <Textarea id="rule-set-description" v-model="newRuleSetDescription" rows="3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false">Cancel</Button>
          <Button :disabled="!canCreate" @click="createRuleSet">Create Rule Set</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import { useRouter } from "vue-router"
import { useRuleSets } from "@/composables/useRuleSets"
import { storeToRefs } from "pinia"
import { useRuleSetsRelRulesStore } from "@/stores/ruleSetsRelRules"
import { useRules } from "@/composables/useRules"
import { useToast } from "@/composables/useToast"
import { MultiSelect } from "@/components/ui/multi-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const { data: ruleSets, loading, error, fetchAll, create, patch, remove } = useRuleSets()
const { data: rules, loading: rulesLoading, error: rulesError, fetchAll: fetchRules } = useRules()
const ruleSetRules = useRuleSetsRelRulesStore()
const { ruleSetRulesMap, loading: ruleSetRulesLoading, error: ruleSetRulesError } = storeToRefs(ruleSetRules)
const { error: showError, success: showSuccess } = useToast()
const router = useRouter()

const showCreateDialog = ref(false)
const newRuleSetName = ref("")
const newRuleSetDescription = ref("")

const selectedRuleIdsBySet = ref<Record<number, Array<string | number>>>({})
const syncingRuleSetIds = ref<number[]>([])

const ruleOptions = computed(() =>
  rules.value.map((rule) => ({
    value: rule.id,
    label: rule.name,
    code: rule.code,
    searchText: `${rule.code} ${rule.name}`,
  })),
)

const rulesLoadingCombined = computed(
  () => rulesLoading.value || ruleSetRulesLoading.value,
)
const rulesErrorCombined = computed(
  () => rulesError.value || ruleSetRulesError.value || "",
)

const canCreate = computed(() => Boolean(newRuleSetName.value.trim()))

function syncSelection(ruleSetId: number, next: number[]) {
  if (!syncingRuleSetIds.value.includes(ruleSetId)) {
    syncingRuleSetIds.value = [...syncingRuleSetIds.value, ruleSetId]
  }
  selectedRuleIdsBySet.value = {
    ...selectedRuleIdsBySet.value,
    [ruleSetId]: next,
  }
  queueMicrotask(() => {
    syncingRuleSetIds.value = syncingRuleSetIds.value.filter((id) => id !== ruleSetId)
  })
}

async function loadRuleSetLinks(ruleSetId: number) {
  await ruleSetRules.fetchByRuleSetId(ruleSetId)
  syncSelection(ruleSetId, ruleSetRules.getLinkedRuleIds(ruleSetId))
}

async function handleRuleSelection(ruleSetId: number, value: Array<string | number>) {
  if (syncingRuleSetIds.value.includes(ruleSetId)) return
  const next = value.map((id) => Number(id)).filter((id) => Number.isFinite(id)) as number[]
  const current = ruleSetRules.getLinkedRuleIds(ruleSetId)
  const currentSet = new Set(current)
  const nextSet = new Set(next)
  const toAdd = next.filter((id) => !currentSet.has(id))
  const toRemove = current.filter((id) => !nextSet.has(id))

  try {
    await Promise.all([
      ...toAdd.map((id) => ruleSetRules.linkRule(ruleSetId, id)),
      ...toRemove.map((id) => ruleSetRules.unlinkRule(ruleSetId, id)),
    ])
    syncSelection(ruleSetId, next)
  } catch (err) {
    showError("Failed to update rule set", err instanceof Error ? err.message : "Unknown error")
    syncSelection(ruleSetId, current)
  }
}

async function updateRuleSet(id: number, updates: { name?: string; description?: string }) {
  try {
    const updateData = {
      name: updates.name?.trim() || undefined,
      description: updates.description?.trim() || undefined,
    }
    await patch(id, updateData)
    showSuccess("Rule set updated", "Changes have been saved.")
  } catch (err) {
    showError("Failed to update rule set", err instanceof Error ? err.message : "Unknown error")
  }
}

async function removeRuleSet(id: number) {
  try {
    await remove(id)
    showSuccess("Rule set deleted", "The rule set has been removed.")
  } catch (err) {
    showError("Failed to delete rule set", err instanceof Error ? err.message : "Unknown error")
  }
}

async function createRuleSet() {
  try {
    const created = await create({
      name: newRuleSetName.value.trim(),
      description: newRuleSetDescription.value.trim() || undefined,
    })
    showSuccess("Rule set created", `"${created.name}" has been created.`)
    newRuleSetName.value = ""
    newRuleSetDescription.value = ""
    showCreateDialog.value = false
    await fetchAll()
    await loadRuleSetLinks(created.id)
  } catch (err) {
    showError("Failed to create rule set", err instanceof Error ? err.message : "Unknown error")
  }
}

async function reload() {
  await fetchAll()
  await fetchRules()
  await Promise.all(ruleSets.value.map((set) => loadRuleSetLinks(set.id)))
}

function goBack() {
  router.push("/rules")
}

watch(
  () => ruleSetRulesMap.value,
  () => {
    for (const set of ruleSets.value) {
      if (!syncingRuleSetIds.value.includes(set.id)) {
        syncSelection(set.id, ruleSetRules.getLinkedRuleIds(set.id))
      }
    }
  },
)

onMounted(async () => {
  await fetchAll()
  await fetchRules()
  await Promise.all(ruleSets.value.map((set) => loadRuleSetLinks(set.id)))
})
</script>
