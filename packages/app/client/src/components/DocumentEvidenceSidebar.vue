<script setup lang="ts">
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import { Button } from "@/components/ui/button"

const props = withDefaults(
  defineProps<{
    open: boolean
    overlay?: boolean
    pinned: boolean
    filename?: string
    issueTitle?: string
    anchor?: {
      type?: string | null
      start?: number | null
      end?: number | null
      text?: string | null
    } | null
    content?: string
    lines?: string[]
    loading?: boolean
    error?: string | null
    canPrev?: boolean
    canNext?: boolean
  }>(),
  {
    overlay: false,
    filename: "",
    issueTitle: "",
    anchor: null,
    content: "",
    lines: () => [],
    loading: false,
    error: null,
    canPrev: false,
    canNext: false,
  },
)

const emit = defineEmits<{
  close: []
  "toggle-pin": []
  "copy-anchor": []
  prev: []
  next: []
}>()

const anchorLabel = computed(() => {
  if (props.anchor?.type === "quote") return "Quote highlight"
  if (props.anchor?.start !== undefined && props.anchor?.end !== undefined) {
    return `Lines ${props.anchor.start}–${props.anchor.end}`
  }
  return "No anchor details"
})

const showInlineLines = computed(() => {
  return props.anchor?.type === "line" || props.anchor?.type === "span"
})

</script>

<template>
  <Teleport v-if="open && overlay" to="body">
    <div class="fixed inset-0 z-40">
      <div class="absolute inset-0 bg-black/30" @click="emit('close')" />
      <aside class="absolute right-0 top-0 h-full w-full max-w-xl bg-elevated border-l border-sidebar-border shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
          <div>
            <p class="text-xs text-muted-foreground">Document Evidence</p>
            <p class="text-sm font-medium text-foreground">{{ filename || "Document" }}</p>
            <p v-if="issueTitle" class="text-xs text-muted-foreground mt-1">Issue: {{ issueTitle }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2 text-xs"
              @click="emit('toggle-pin')"
            >
              {{ pinned ? "Unpin" : "Pin" }}
            </Button>
            <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="emit('close')">
              <span class="sr-only">Close</span>
              <Icon icon="heroicons:x-mark" class="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div class="flex h-[calc(100%-56px)] flex-col overflow-hidden">
          <div class="px-4 py-3 border-b border-sidebar-border text-xs text-muted-foreground">
            {{ anchorLabel }}
          </div>
          <div class="flex-1 overflow-auto px-4 py-4">
            <div v-if="loading" class="text-sm text-muted-foreground">Loading document…</div>
            <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>
            <div v-else-if="content" class="text-sm leading-relaxed">
              <template v-if="showInlineLines">
                <div class="space-y-1">
                  <div
                    v-for="(line, index) in lines"
                    :key="index"
                    class="whitespace-pre-wrap"
                    :class="{
                      'bg-warning/40 text-foreground': anchor?.start != null
                        && anchor?.end != null
                        && index + 1 >= anchor.start
                        && index + 1 <= anchor.end,
                    }"
                  >
                    <span class="mr-2 text-xs text-muted-foreground">{{ index + 1 }}</span>
                    {{ line }}
                  </div>
                </div>
              </template>
              <template v-else>
                <div v-html="content" class="whitespace-pre-wrap" />
              </template>
            </div>
            <div v-else class="text-sm text-muted-foreground">No document content available.</div>
          </div>
          <div class="border-t border-sidebar-border px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" @click="emit('prev')" :disabled="!canPrev">Prev</Button>
              <Button variant="outline" size="sm" @click="emit('next')" :disabled="!canNext">Next</Button>
            </div>
            <Button
              variant="link"
              class="px-0 text-xs"
              @click="emit('copy-anchor')"
              :disabled="!anchor?.text"
            >
              Copy anchor text
            </Button>
            <Button variant="outline" size="sm" @click="emit('close')">Close</Button>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>

  <aside
    v-else-if="open"
    class="h-full w-full max-w-xl flex-shrink-0 bg-elevated border-l border-sidebar-border shadow-xl"
  >
    <div class="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
      <div>
        <p class="text-xs text-muted-foreground">Document Evidence</p>
        <p class="text-sm font-medium text-foreground">{{ filename || "Document" }}</p>
        <p v-if="issueTitle" class="text-xs text-muted-foreground mt-1">Issue: {{ issueTitle }}</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs"
          @click="emit('toggle-pin')"
        >
          {{ pinned ? "Unpin" : "Pin" }}
        </Button>
        <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="emit('close')">
          <span class="sr-only">Close</span>
          <Icon icon="heroicons:x-mark" class="h-5 w-5" />
        </Button>
      </div>
    </div>
    <div class="flex h-[calc(100%-56px)] flex-col overflow-hidden">
      <div class="px-4 py-3 border-b border-sidebar-border text-xs text-muted-foreground">
        {{ anchorLabel }}
      </div>
      <div class="flex-1 overflow-auto px-4 py-4">
        <div v-if="loading" class="text-sm text-muted-foreground">Loading document…</div>
        <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>
        <div v-else-if="content" class="text-sm leading-relaxed">
          <template v-if="showInlineLines">
            <div class="space-y-1">
              <div
                v-for="(line, index) in lines"
                :key="index"
                class="whitespace-pre-wrap"
                :class="{
                  'bg-warning/40 text-foreground': anchor?.start != null
                    && anchor?.end != null
                    && index + 1 >= anchor.start
                    && index + 1 <= anchor.end,
                }"
              >
                <span class="mr-2 text-xs text-muted-foreground">{{ index + 1 }}</span>
                {{ line }}
              </div>
            </div>
          </template>
          <template v-else>
            <div v-html="content" class="whitespace-pre-wrap" />
          </template>
        </div>
        <div v-else class="text-sm text-muted-foreground">No document content available.</div>
      </div>
    <div class="border-t border-sidebar-border px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="emit('prev')" :disabled="!canPrev">Prev</Button>
        <Button variant="outline" size="sm" @click="emit('next')" :disabled="!canNext">Next</Button>
      </div>
      <Button
        variant="link"
        class="px-0 text-xs"
        @click="emit('copy-anchor')"
        :disabled="!anchor?.text"
        >
          Copy anchor text
        </Button>
        <Button variant="outline" size="sm" @click="emit('close')">Close</Button>
      </div>
    </div>
  </aside>
</template>
