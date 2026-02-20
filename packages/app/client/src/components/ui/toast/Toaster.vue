<script setup lang="ts">
import { computed } from "vue"
import { toasts, removeToast } from "@/composables/useToast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { X } from "lucide-vue-next"

const variantClasses = computed(() => ({
  default: "bg-background border-border text-foreground",
  success: "bg-success/95 border-success/60 text-success-foreground",
  warning: "bg-warning/95 border-warning/60 text-warning-foreground",
  error: "bg-error/95 border-error/60 text-error-foreground",
  destructive: "bg-destructive/95 border-destructive/60 text-destructive-foreground",
}))

const getVariantClass = (variant?: string) =>
  variantClasses.value[variant as keyof typeof variantClasses.value] ??
  variantClasses.value.default

const getVariant = (variant?: string) =>
  variant === "destructive" ? "destructive" : "default"

const copyToast = async (title?: string, description?: string) => {
  const content = [title, description].filter(Boolean).join("\n")
  if (!content) return
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    const area = document.createElement("textarea")
    area.value = content
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.focus()
    area.select()
    document.execCommand("copy")
    area.remove()
  }
}
</script>

<template>
  <div
    class="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
  >
    <TransitionGroup
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-x-4"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-4"
    >
      <Alert
        v-for="toast in toasts"
        :key="toast.id"
        :variant="getVariant(toast.variant)"
        class="pointer-events-auto shadow-lg relative pr-8 select-text cursor-pointer"
        :class="getVariantClass(toast.variant)"
        @click="copyToast(toast.title, toast.description)"
      >
        <AlertTitle v-if="toast.title">{{ toast.title }}</AlertTitle>
        <AlertDescription v-if="toast.description">
          {{ toast.description }}
        </AlertDescription>
        <button
          class="absolute top-2 right-2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Close toast"
          @click.stop="removeToast(toast.id)"
        >
          <X class="w-4 h-4" />
        </button>
      </Alert>
    </TransitionGroup>
  </div>
</template>
