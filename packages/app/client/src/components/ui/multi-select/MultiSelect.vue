<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import type { HTMLAttributes } from "vue"
import { Icon } from "@iconify/vue"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type MultiSelectValue = string | number

export interface MultiSelectOption {
  value: MultiSelectValue
  label: string
  code?: string
  searchText?: string
  disabled?: boolean
}

type Size = "sm" | "md" | "lg"

const props = withDefaults(
  defineProps<{
    modelValue?: MultiSelectValue[]
    options: MultiSelectOption[]
    placeholder?: string
    searchPlaceholder?: string
    disabled?: boolean
    loading?: boolean
    disableWhenLoading?: boolean
    error?: string
    size?: Size
    class?: HTMLAttributes["class"]
    preserveSearchOnSelect?: boolean
  }>(),
  {
    modelValue: () => [],
    placeholder: "Select options",
    searchPlaceholder: "Search...",
    disabled: false,
    loading: false,
    disableWhenLoading: true,
    error: undefined,
    size: "md",
    preserveSearchOnSelect: true,
  },
)

const emit = defineEmits<{
  "update:modelValue": [MultiSelectValue[]]
}>()

const open = ref(false)
const searchTerm = ref("")
const lastTyped = ref("")
const searchInputRef = ref<HTMLInputElement | null>(null)

const sizeClasses: Record<Size, string> = {
  sm: "min-h-8 text-xs",
  md: "min-h-9 text-sm",
  lg: "min-h-10 text-sm",
}

const chipClasses: Record<Size, string> = {
  sm: "text-[11px] h-5 px-1.5",
  md: "text-xs h-6 px-2",
  lg: "text-sm h-7 px-2.5",
}

const selectedSet = computed(() => new Set(props.modelValue))

const lastOptions = ref<MultiSelectOption[]>([])

const baseOptions = computed(() => {
  if (props.loading && lastOptions.value.length > 0) {
    return lastOptions.value
  }
  return props.options
})

const filteredOptions = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return baseOptions.value
  return baseOptions.value.filter((option) => {
    const haystack = option.searchText ?? `${option.label} ${option.code ?? ""}`
    return haystack.toLowerCase().includes(term)
  })
})

const selectedOptions = computed(() => {
  const map = new Map(props.options.map((option) => [option.value, option]))
  return props.modelValue.map((value) => {
    const option = map.get(value)
    return option ?? { value, label: String(value) }
  })
})

function setSelection(values: MultiSelectValue[]) {
  emit("update:modelValue", values)
}

function handleSearchInput(e: Event) {
  const value = (e.target as HTMLInputElement)?.value ?? ""
  lastTyped.value = value
  searchTerm.value = value
}

function toggleOption(option: MultiSelectOption) {
  if (props.disabled || option.disabled) return
  const next = new Set(props.modelValue)
  if (next.has(option.value)) {
    next.delete(option.value)
  } else {
    next.add(option.value)
  }
  setSelection([...next])
  open.value = true
  nextTick(() => {
    if (props.preserveSearchOnSelect) {
      searchTerm.value = lastTyped.value
    } else {
      lastTyped.value = ""
      searchTerm.value = ""
    }
  })
}

function removeValue(value: MultiSelectValue) {
  if (props.disabled) return
  const next = props.modelValue.filter((item) => item !== value)
  setSelection(next)
}

watch(
  () => open.value,
  (value) => {
    if (value) {
      nextTick(() => searchInputRef.value?.focus())
    } else {
      searchTerm.value = ""
      lastTyped.value = ""
    }
  },
)

watch(
  () => props.options,
  (options) => {
    if (!props.loading && options.length > 0) {
      lastOptions.value = options
    }
  },
  { immediate: true },
)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :disabled="disabled"
        :class="
          cn(
            'flex w-full flex-wrap items-center gap-1 rounded-md border border-input bg-inset px-2 py-1.5 text-left ring-offset-background transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            sizeClasses[size],
            props.class,
          )
        "
      >
        <div v-if="selectedOptions.length === 0" class="text-muted-foreground">
          {{ placeholder }}
        </div>
        <div v-else class="flex flex-wrap items-center gap-1">
          <template v-for="option in selectedOptions" :key="option.value">
            <slot name="tag" :option="option" :remove="removeValue">
              <Badge
                variant="soft"
                color="secondary"
                :class="cn('inline-flex items-center gap-1', chipClasses[size])"
              >
                <span class="truncate">{{ option.label }}</span>
                <button
                  type="button"
                  class="flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-muted/60"
                  @click.stop="removeValue(option.value)"
                >
                  <Icon icon="lucide:x" class="h-3 w-3" />
                </button>
              </Badge>
            </slot>
          </template>
        </div>
        <span class="ml-auto flex items-center">
          <Icon icon="lucide:chevron-down" class="h-4 w-4 opacity-50" />
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-[var(--reka-popover-trigger-width)] p-0">
      <div class="border-b px-2 py-2">
        <Input
          ref="searchInputRef"
          :placeholder="searchPlaceholder"
          :disabled="disabled"
          class="h-8"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          :model-value="searchTerm"
          @input="handleSearchInput"
        />
      </div>
      <div class="max-h-64 overflow-auto p-1">
        <div v-if="loading" class="px-2 py-1 text-[11px] text-muted-foreground">
          Syncing...
        </div>
        <slot
          v-if="filteredOptions.length === 0 || error"
          name="empty"
          :loading="loading"
          :error="error"
          :search="searchTerm"
        >
          <div class="px-2 py-3 text-xs text-muted-foreground">
            <span v-if="error">Error loading options</span>
            <span v-else>No options match search</span>
          </div>
        </slot>
        <div v-else class="flex flex-col">
          <button
            v-for="option in filteredOptions"
            :key="option.value"
            type="button"
            :disabled="option.disabled"
            class="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            @mousedown.prevent
            @click="toggleOption(option)"
          >
            <slot name="option" :option="option" :selected="selectedSet.has(option.value)">
              <span>{{ option.label }}</span>
              <Icon
                v-if="selectedSet.has(option.value)"
                icon="lucide:check"
                class="h-4 w-4"
              />
            </slot>
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
const isDisabled = computed(
  () => props.disabled || (props.loading && props.disableWhenLoading),
)
