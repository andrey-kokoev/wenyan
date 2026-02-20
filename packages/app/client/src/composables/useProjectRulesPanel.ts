import { computed, ref, unref, type MaybeRef } from "vue"
import type { Rule, RuleSet } from "@wenyan/shared"
import { useRuleSets } from "@/composables/useRuleSets"
import { useRules } from "@/composables/useRules"
import { useProjectsRelRules } from "@/composables/useProjectsRelRules"
import { useProjectsRelRuleSets } from "@/composables/useProjectsRelRuleSets"
import { useToast } from "@/composables/useToast"
import { useWorkspacesRelRules } from "@/composables/useWorkspacesRelRules"

export function useProjectRulesPanel(
  projectId: MaybeRef<number | undefined>,
  workspaceId?: MaybeRef<number | undefined>,
  allRulesAvailableInWorkspace?: MaybeRef<boolean | undefined>,
) {
  const { error: showError } = useToast()
  const projectIdValue = computed(() => unref(projectId))
  const workspaceIdValue = computed(() => unref(workspaceId))
  const allRulesAvailableValue = computed(() => Boolean(unref(allRulesAvailableInWorkspace)))

  const { data: allRules, fetchAll: fetchAllRules, loading: allRulesLoading, error: allRulesError } = useRules()

  const {
    linkedRuleIds,
    loading: rulesLoading,
    fetchByProjectId: fetchProjectRules,
    linkRule,
    unlinkRule,
  } = useProjectsRelRules(projectIdValue)

  const {
    linkedRuleSetIds,
    loading: ruleSetsLoading,
    fetchByProjectId: fetchProjectRuleSets,
    unlinkRuleSet,
  } = useProjectsRelRuleSets(projectIdValue)

  const {
    data: ruleSets,
    getById: getRuleSetById,
    fetchAll: fetchRuleSets,
  } = useRuleSets()

  const {
    loading: workspaceRulesLoading,
    error: workspaceRulesError,
    fetchByWorkspaceId,
  } = useWorkspacesRelRules(workspaceIdValue)

  const workspaceRules = ref<Rule[]>([])
  const availableRules = computed(() => {
    if (allRulesAvailableValue.value) {
      return allRules.value
    }
    return workspaceRules.value
  })
  const workspaceRuleMap = computed(() => {
    const map = new Map<number, Rule>()
    for (const rule of availableRules.value) {
      map.set(rule.id, rule)
    }
    return map
  })

  const projectRules = computed(() => {
    return linkedRuleIds.value
      .map((ruleId: number) => workspaceRuleMap.value.get(ruleId))
      .filter((rule): rule is Rule => rule !== undefined)
      .map((rule) => ({
        projectId: projectIdValue.value ?? 0,
        ruleId: rule.id,
        rule,
      }))
  })

  function getRuleName(ruleId: number) {
    const rule = workspaceRuleMap.value.get(ruleId)
    return rule?.name ?? `Rule ${ruleId}`
  }

  const ruleOptions = computed(() =>
    availableRules.value.map((rule) => ({
      value: rule.id,
      label: rule.name,
      code: rule.code,
      searchText: `${rule.code} ${rule.name}`,
    })),
  )

  const rulesLoadingCombined = computed(
    () =>
      rulesLoading.value ||
      (allRulesAvailableValue.value ? allRulesLoading.value : workspaceRulesLoading.value),
  )
  const rulesErrorCombined = computed(() => {
    if (allRulesAvailableValue.value) {
      return allRulesError.value || ""
    }
    return workspaceRulesError.value || ""
  })

  const ruleSearchQuery = ref("")
  const filteredProjectRules = computed(() => {
    const query = ruleSearchQuery.value.trim().toLowerCase()
    if (!query) return projectRules.value
    return projectRules.value.filter((projectRule) => {
      const name = projectRule.rule?.name?.toLowerCase() ?? ""
      const description = projectRule.rule?.description?.toLowerCase() ?? ""
      return name.includes(query) || description.includes(query)
    })
  })

  const linkedRulesCount = computed(() => linkedRuleIds.value.length)

  const projectRuleSets = computed(() => {
    return linkedRuleSetIds.value
      .map((ruleSetId: number) => getRuleSetById(ruleSetId))
      .filter((ruleSet): ruleSet is RuleSet => ruleSet !== undefined)
      .map((ruleSet) => ({
        projectId: projectIdValue.value ?? 0,
        ruleSetId: ruleSet.id,
        ruleSet,
      }))
  })

  const linkedRuleSetsCount = computed(() => linkedRuleSetIds.value.length)

  const showRuleSetsSection = computed(() => {
    if (ruleSetsLoading.value) return true
    if (linkedRuleSetIds.value.length > 0) return true
    return ruleSets.value.length > 0
  })

  async function handleRuleSelection(value: Array<string | number>) {
    if (!projectIdValue.value) return
    const next = value.map((id) => Number(id)).filter((id) => Number.isFinite(id)) as number[]
    const current = linkedRuleIds.value
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
    const toAdd = next.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !next.includes(id))

    try {
      await Promise.all([
        ...toAdd.map((id) => linkRule(id)),
        ...toRemove.map((id) => unlinkRule(id)),
      ])
    } catch (error) {
      showError(
        "Failed to update project rules",
        error instanceof Error ? error.message : "Unknown error",
      )
    }
  }

  async function fetchRulesPanelData() {
    if (projectIdValue.value) {
      await fetchProjectRules(projectIdValue.value).catch(() => {
        // Silently handle rules fetch errors
      })
    }
    if (workspaceIdValue.value) {
      if (allRulesAvailableValue.value) {
        await fetchAllRules().catch(() => {
          // Silently handle rule fetch errors
        })
      } else {
        await fetchByWorkspaceId(workspaceIdValue.value)
          .then((rules) => {
            workspaceRules.value = rules
          })
          .catch(() => {
            // Silently handle workspace rules fetch errors
          })
      }
    }
    await fetchRuleSets().catch(() => {
      // Silently handle rule set fetch errors
    })
    if (projectIdValue.value) {
      await fetchProjectRuleSets(projectIdValue.value).catch(() => {
        // Silently handle rule set fetch errors
      })
    }
  }

  return {
    linkedRuleIds,
    linkedRuleSetsCount,
    linkedRulesCount,
    ruleOptions,
    rulesLoadingCombined,
    rulesErrorCombined,
    ruleSearchQuery,
    filteredProjectRules,
    projectRules,
    projectRuleSets,
    showRuleSetsSection,
    ruleSetsLoading,
    handleRuleSelection,
    getRuleName,
    unlinkRule,
    unlinkRuleSet,
    fetchRulesPanelData,
  }
}
