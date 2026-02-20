import { useSignedInUser } from "./useSignedInUser"
import type { ControlledActionCode } from "@wenyan/shared"

export type { ControlledActionCode }

export function useUserPermissions() {
  const { user } = useSignedInUser()

  const can = (controlledAction: string) => {
    if (!user.value) {
      console.warn("User is not signed in, permission check failed.")
      return false
    }
    if (!user.value.controlledActions) {
      console.warn("User has no controlled actions, permission check failed.")
      return false
    }

    return user.value.controlledActions.includes(controlledAction)
  }

  return { can }
}
