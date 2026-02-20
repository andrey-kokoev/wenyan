import { ref } from "vue"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "success" | "warning" | "error" | "destructive"
  duration?: number
  timeoutId?: ReturnType<typeof setTimeout>
}

const toasts = ref<Toast[]>([])

export function removeToast(id: string) {
  const index = toasts.value.findIndex((t) => t.id === id)
  if (index > -1) {
    const toast = toasts.value[index]
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId)
    }
    toasts.value.splice(index, 1)
  }
}

export function useToast() {
  function addToast(toast: Omit<Toast, "id">) {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast,
    }
    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
      removeToast(id)
    }, newToast.duration)
    newToast.timeoutId = timeoutId

    toasts.value.push(newToast)

    return id
  }

  function success(title: string, description?: string) {
    return addToast({
      title,
      description,
      variant: "success",
    })
  }

  function warning(title: string, description?: string) {
    return addToast({
      title,
      description,
      variant: "warning",
    })
  }

  function error(title: string, description?: string) {
    return addToast({
      title,
      description,
      variant: "error",
    })
  }

  return {
    toasts,
    addToast,
    removeToast,
    success,
    warning,
    error,
  }
}

// Global toast state for use in components
export { toasts }
