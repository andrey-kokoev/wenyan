import { computed } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "../../auth"

export function useSignedInUser() {
  const authStore = useAuthStore()
  const router = useRouter()

  const user = computed(() => authStore.user)
  const isLoggedIn = computed(() => authStore.isAuthenticated)

  const id = computed(() => {
    return authStore.user?.email || null
  })

  const load = async () => {
    if (!authStore.user && !authStore.loading) {
      await authStore.fetchSession()
    }
  }

  const loadIfNotSet = () => {
    if (!authStore.user) {
      load()
      if (!authStore.user) {
        throw new Error("User is not set")
      }
    }
  }

  /**
   * Signs in the user with Microsoft OAuth
   */
  const signIn = () => {
    authStore.signIn()
  }

  /**
   * Signs out the user completely
   */
  const signOut = async () => {
    await authStore.signOut()
    router.push("/sign-in")
  }

  return {
    load,
    loadIfNotSet,
    user,
    id,
    isLoggedIn,
    signIn,
    signOut,
  }
}
