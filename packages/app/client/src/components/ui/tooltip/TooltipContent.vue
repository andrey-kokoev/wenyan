<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { Icon } from "@iconify/vue"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

interface Props extends TooltipContentProps {
  class?: HTMLAttributes["class"]
  copyContentOnClick?: boolean
  copiedMessageDuration?: number
}

const props = withDefaults(defineProps<Props>(), {
  sideOffset: 4,
  copyContentOnClick: false,
  copiedMessageDuration: 1500,
})

const emits = defineEmits<TooltipContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "copyContentOnClick", "copiedMessageDuration")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const slotWrapperRef = ref<HTMLElement>()
const showCopied = ref(false)
const cachedText = ref('')
let mutationObserver: MutationObserver | null = null

// Update cached text from slot content
const updateCachedText = async () => {
  if (slotWrapperRef.value) {
    await nextTick()
    cachedText.value = slotWrapperRef.value.innerText || slotWrapperRef.value.textContent || ''
  }
}

// Watch for slot wrapper ref changes
watch(slotWrapperRef, updateCachedText, { immediate: true })

// Setup MutationObserver to watch for content changes
onMounted(() => {
  if (slotWrapperRef.value && window.MutationObserver) {
    mutationObserver = new MutationObserver(updateCachedText)
    mutationObserver.observe(slotWrapperRef.value, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }
})

onUnmounted(() => {
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
})

/**
 * Fallback copy method for browsers without Clipboard API support
 */
function fallbackCopyText(text: string): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    document.body.removeChild(textArea)
    return false
  }
}

async function handleClick(_event: MouseEvent) {
  if (!props.copyContentOnClick) return

  // Use cached text (already optimized to avoid repeated DOM access)
  const textToCopy = cachedText.value

  if (!textToCopy) return

  let success = false

  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy)
      success = true
    } catch {
      // Clipboard API failed, try fallback method
      success = fallbackCopyText(textToCopy)
    }
  } else {
    // Fallback for browsers without Clipboard API
    success = fallbackCopyText(textToCopy)
  }

  if (success) {
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, props.copiedMessageDuration)
  } else {
    console.error('Failed to copy text to clipboard')
  }
}
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      ref="contentRef"
      v-bind="{ ...forwarded, ...$attrs }"
      :class="cn('z-50 overflow-hidden rounded-md bg-popover border border-border px-3 py-1.5 text-xs text-popover-foreground shadow-md select-text pointer-events-auto whitespace-pre-line animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', props.copyContentOnClick && 'cursor-pointer hover:bg-accent', props.class)"
      @click="handleClick"
    >
      <span v-if="showCopied" class="inline-flex items-center gap-1">
        <Icon icon="heroicons:check" class="h-3 w-3" />
        Copied!
      </span>
      <span v-else ref="slotWrapperRef">
        <slot />
      </span>
    </TooltipContent>
  </TooltipPortal>
</template>
