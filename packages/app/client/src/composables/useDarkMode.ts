import { ref, watch, onMounted } from 'vue'

const STORAGE_KEY = 'harmonia-dark-mode'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')
const isDark = ref(false)

function updateDocumentClass() {
  const root = document.documentElement
  if (isDark.value) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function resolveTheme(value: Theme): boolean {
  if (value === 'dark') return true
  if (value === 'light') return false
  // system
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useDarkMode() {
  onMounted(() => {
    // Load saved preference
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved) {
      theme.value = saved
    }
    isDark.value = resolveTheme(theme.value)
    updateDocumentClass()

    // Listen for system changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (theme.value === 'system') {
        isDark.value = e.matches
        updateDocumentClass()
      }
    })
  })

  watch(theme, (newTheme) => {
    isDark.value = resolveTheme(newTheme)
    updateDocumentClass()
    localStorage.setItem(STORAGE_KEY, newTheme)
  })

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function toggle() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    theme,
    isDark,
    setTheme,
    toggle,
  }
}
