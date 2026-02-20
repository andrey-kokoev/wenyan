<template>
  <Card>
    <CardHeader class="pb-3">
      <div class="flex items-start justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <Badge :variant="getStatusVariant(issue.status)" :color="getStatusColor(issue.status)">
            {{ issue.status }}
          </Badge>
          <Badge :variant="getPriorityVariant(issue.priority)" :color="getPriorityColor(issue.priority)">
            {{ issue.priority }}
          </Badge>
          <Badge v-if="issue.documents.length > 0 && projectDocumentsCount > 1" variant="soft" color="secondary">
            {{ issue.documents.length }} doc(s)
          </Badge>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2"
            @click="emit('toggle-non-issue', issue)"
          >
            {{ issue.markedAsNonissueAt ? "Mark issue" : "Mark non-issue" }}
          </Button>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
                @click="emit('delete-issue', issue)"
              >
                <Icon icon="heroicons:trash" class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete issue</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <CardTitle class="text-base mt-2">{{ issue.title }}</CardTitle>
      <Tooltip v-if="issue.description">
        <TooltipTrigger as-child>
          <div class="relative">
            <CardDescription :class="isDescriptionExpanded ? '' : 'line-clamp-2'">
              {{ issue.description }}
            </CardDescription>
            <button
              type="button"
              class="absolute bottom-0 right-0 bg-background/90 pl-2 text-xs text-primary hover:underline"
              @click.stop="isDescriptionExpanded = !isDescriptionExpanded"
            >
              {{ isDescriptionExpanded ? "Show less" : "Show more" }}
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent class="max-w-xs">
          {{ issue.description }}
        </TooltipContent>
      </Tooltip>
      <p v-if="issue.markedAsNonissueAt" class="mt-1 text-xs text-muted-foreground">
        {{ `Marked as non-issue on ${new Date(issue.markedAsNonissueAt).toLocaleDateString()}` }}
      </p>
    </CardHeader>
    <CardFooter class="pt-0">
      <div class="w-full space-y-3 text-xs text-muted-foreground">
        <div v-if="issue.ruleIds?.length && projectRulesCount > 1" class="flex flex-wrap items-center gap-2">
          <span class="font-medium text-foreground">Rules:</span>
          <Badge v-for="ruleId in issue.ruleIds" :key="ruleId" variant="soft" color="secondary">
            {{ getRuleName(ruleId) }}
          </Badge>
        </div>
        <div v-if="issue.documents.length > 0" class="space-y-2">
          <div v-if="projectDocumentsCount > 1" class="flex items-center gap-2">
            <Icon icon="heroicons:paper-clip" class="w-4 h-4" />
            <span>{{ issue.documents.length }} document(s) attached</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="doc in issue.documents"
              :key="doc.id"
              class="rounded-md bg-muted/30 p-2"
            >
              <div
                :class="[
                  'flex items-center text-xs',
                  showDocumentNames ? 'justify-between' : 'justify-end',
                ]"
              >
                <span v-if="showDocumentNames" class="font-medium text-foreground">
                  {{ doc.filename }}
                </span>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      @click.stop="emit('open-document', doc, issue)"
                    >
                      <Icon icon="heroicons:arrow-top-right-on-square" class="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View in document</TooltipContent>
                </Tooltip>
              </div>
              <div
                v-if="doc.anchor?.type === 'quote' && doc.anchor.text"
                class="mt-2 border-l-2 border-muted-foreground/40 pl-3 text-foreground"
              >
                “{{ doc.anchor.text }}”
              </div>
              <div
                v-else-if="doc.anchor?.start !== undefined && doc.anchor?.end !== undefined"
                class="mt-2"
              >
                Lines {{ doc.anchor.start }}–{{ doc.anchor.end }}
              </div>
              <div v-else class="mt-2 text-muted-foreground">
                No anchor details.
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { BadgeColor, BadgeVariant } from "@/utils/issues-utils"

const props = defineProps<{
  issue: any
  projectDocumentsCount: number
  projectRulesCount: number
  getRuleName: (ruleId: number) => string
  getStatusVariant: (status: string) => BadgeVariant
  getStatusColor: (status: string) => BadgeColor
  getPriorityVariant: (priority: string) => BadgeVariant
  getPriorityColor: (priority: string) => BadgeColor
}>()

const showDocumentNames = computed(() => props.projectDocumentsCount > 1)
const isDescriptionExpanded = ref(false)

const emit = defineEmits<{
  "toggle-non-issue": [any]
  "open-document": [any, any]
  "delete-issue": [any]
}>()
</script>
