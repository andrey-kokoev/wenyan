import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../auth'
import DocumentAnalysis from '../pages/DocumentAnalysis.vue'
import ProjectsPage from '../pages/ProjectsPage.vue'
import ProjectDetailPage from '../pages/ProjectDetailPage.vue'
import RulesPage from '../pages/RulesPage.vue'
import RuleSetsPage from '../pages/RuleSetsPage.vue'
import WorkspacesPage from '../pages/WorkspacesPage.vue'
import WorkspaceDetailPage from '../pages/WorkspaceDetailPage.vue'
import SignIn from '../pages/SignIn.vue'
import Unauthorized from '../pages/Unauthorized.vue'
import UserSettings from '../pages/user/user-settings/index.vue'
import AdminProviders from '../pages/admin/providers.vue'
import AdminResponders from '../pages/admin/responders.vue'
import UtilityServices from '../pages/utility-services.vue'

// Access Control pages
import AccessControlIndex from '../access-control/pages/index.vue'
import AccessControlRoles from '../access-control/pages/roles.vue'
import AccessControlControlledActions from '../access-control/pages/controlled-actions.vue'
import AccessControlExternalUsers from '../access-control/pages/external-users/index.vue'
import AccessControlCreateExternalUser from '../access-control/pages/external-users/create.vue'

// UI Examples pages
import UiExamplesIndex from '../pages/ui-examples/index.vue'
import UiExamplesButtons from '../pages/ui-examples/buttons.vue'
import UiExamplesCards from '../pages/ui-examples/cards.vue'
import UiExamplesInputs from '../pages/ui-examples/inputs.vue'
import UiExamplesDialogs from '../pages/ui-examples/dialogs.vue'
import UiExamplesBadges from '../pages/ui-examples/badges.vue'
import UiExamplesTooltips from '../pages/ui-examples/tooltips.vue'
import UiExamplesColorTheme from '../pages/ui-examples/color-theme.vue'
import ThemeEditorEdit from '../pages/themes/edit.vue'
import ThemeEditorClone from '../pages/themes/clone.vue'
import WenyanPage from '../pages/WenyanPage.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: DocumentAnalysis,
    meta: { requiresAuth: true }
  },
  {
    path: '/sign-in',
    name: 'signin',
    component: SignIn,
    meta: { requiresGuest: true }
  },
  {
    path: '/unauthorized',
    name: 'unauthorized',
    component: Unauthorized
  },
  // Access Control routes
  {
    path: '/access-control',
    name: 'access-control',
    component: AccessControlIndex,
    meta: { requiresAuth: true }
  },
  {
    path: '/access-control/roles',
    name: 'access-control-roles',
    component: AccessControlRoles,
    meta: { requiresAuth: true }
  },
  {
    path: '/access-control/controlled-actions',
    name: 'access-control-controlled-actions',
    component: AccessControlControlledActions,
    meta: { requiresAuth: true }
  },
  {
    path: '/access-control/external-users',
    name: 'access-control-external-users',
    component: AccessControlExternalUsers,
    meta: { requiresAuth: true }
  },
  {
    path: '/access-control/external-users/create',
    name: 'access-control-create-external-user',
    component: AccessControlCreateExternalUser,
    meta: { requiresAuth: true }
  },
  {
    path: '/projects',
    name: 'projects',
    component: ProjectsPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/workspaces',
    name: 'workspaces',
    component: WorkspacesPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/workspaces/:id',
    name: 'workspace-detail',
    component: WorkspaceDetailPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: ProjectDetailPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/rules',
    name: 'rules',
    component: RulesPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/rule-sets',
    name: 'rule-sets',
    component: RuleSetsPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/user/user-settings',
    name: 'user-settings',
    component: UserSettings,
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    redirect: '/admin/providers'
  },
  {
    path: '/admin/providers',
    name: 'admin-providers',
    component: AdminProviders,
    meta: { requiresAuth: true, requiredPermission: 'configure_application' }
  },
  {
    path: '/admin/responders',
    name: 'admin-responders',
    component: AdminResponders,
    meta: { requiresAuth: true, requiredPermission: 'configure_application' }
  },
  {
    path: '/utility-services',
    name: 'utility-services',
    component: UtilityServices,
    meta: { requiresAuth: true, requiredPermission: 'configure_application' }
  },
  {
    path: '/themes/edit',
    name: 'theme-editor-edit',
    component: ThemeEditorEdit,
    meta: { requiresAuth: true }
  },
  {
    path: '/themes/clone',
    name: 'theme-editor-clone',
    component: ThemeEditorClone,
    meta: { requiresAuth: true }
  },
  {
    path: '/wenyan',
    name: 'wenyan',
    component: WenyanPage,
    meta: { requiresAuth: true }
  },
  // UI Examples routes
  {
    path: '/ui-examples',
    name: 'ui-examples',
    component: UiExamplesIndex,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/buttons',
    name: 'ui-examples-buttons',
    component: UiExamplesButtons,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/cards',
    name: 'ui-examples-cards',
    component: UiExamplesCards,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/inputs',
    name: 'ui-examples-inputs',
    component: UiExamplesInputs,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/dialogs',
    name: 'ui-examples-dialogs',
    component: UiExamplesDialogs,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/badges',
    name: 'ui-examples-badges',
    component: UiExamplesBadges,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/tooltips',
    name: 'ui-examples-tooltips',
    component: UiExamplesTooltips,
    meta: { requiresAuth: true }
  },
  {
    path: '/color-theme',
    name: 'color-theme',
    component: UiExamplesColorTheme,
    meta: { requiresAuth: true }
  },
  {
    path: '/ui-examples/color-theme',
    redirect: '/color-theme'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  
  // Wait for auth check on first load
  if (!auth.user && !auth.loading) {
    await auth.fetchSession()
  }
  
  const isAuthenticated = auth.isAuthenticated
  
  // Redirect authenticated users away from sign-in page
  if (to.meta.requiresGuest && isAuthenticated) {
    return next('/')
  }

  // Permission checks
  if (to.meta.requiredPermission && !auth.hasPermission(to.meta.requiredPermission as string)) {
    return next('/unauthorized')
  }
  
  // Redirect unauthenticated users to sign-in
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({
      path: '/sign-in',
      query: { returnTo: to.fullPath }
    })
  }
  
  next()
})

export default router
