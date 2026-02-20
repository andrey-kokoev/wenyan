<template>
  <div class="container mx-auto py-8 px-4">
    <div class="space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Color Theme</h1>
          <p class="text-muted-foreground">
            Visual reference for the current theme's color palette and component styling.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="min-w-[220px]">
            <Select
              :model-value="settings?.themeId"
              :disabled="themesLoading || !themes.length"
              @update:model-value="handleThemeIdChange"
            >
              <SelectTrigger class="w-full">
                <SelectValue
                  :placeholder="themesLoading ? 'Loading themes...' : 'Select theme'"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="theme in themes"
                  :key="theme.id"
                  :value="theme.id"
                >
                  {{ theme.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="themesError" class="text-xs text-destructive mt-1">
              Failed to load theme registry.
            </p>
          </div>
          <ThemeModeToggle v-if="settings" :mode="settings.themeMode" />
          <div class="flex items-center gap-2">
            <Button
              v-if="canEditTheme"
              variant="link"
              size="sm"
              class="cursor-pointer"
              @click="$router.push('/themes/edit')"
            >
              <Icon icon="heroicons:pencil-square" class="w-4 h-4" />
            </Button>
            <Button
              v-if="canCloneTheme"
              variant="link"
              size="sm"
              class="cursor-pointer"
              @click="$router.push('/themes/clone')"
            >
              <Icon icon="heroicons:square-2-stack" class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Canvas & Elevated Backgrounds -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Background Colors</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card class="bg-background">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">background</CardTitle>
              <CardDescription>Main canvas background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-background border flex items-center justify-center text-muted-foreground">
                bg-background
              </div>
            </CardContent>
          </Card>

          <Card class="bg-card">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">card</CardTitle>
              <CardDescription>Card component background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-card border flex items-center justify-center text-muted-foreground">
                bg-card
              </div>
            </CardContent>
          </Card>

          <Card class="bg-popover">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">popover</CardTitle>
              <CardDescription>Popover/dropdown background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-popover border flex items-center justify-center text-muted-foreground">
                bg-popover
              </div>
            </CardContent>
          </Card>

          <Card class="bg-muted">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">muted</CardTitle>
              <CardDescription>Muted/subtle background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-muted flex items-center justify-center text-muted-foreground">
                bg-muted
              </div>
            </CardContent>
          </Card>

          <Card class="bg-accent">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">accent</CardTitle>
              <CardDescription>Accent/hover background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-accent flex items-center justify-center text-accent-foreground">
                bg-accent
              </div>
            </CardContent>
          </Card>

          <Card class="bg-primary">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">primary</CardTitle>
              <CardDescription>Primary action background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-primary flex items-center justify-center text-primary-foreground">
                bg-primary
              </div>
            </CardContent>
          </Card>

          <Card class="bg-secondary text-secondary-foreground">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-secondary-foreground">secondary</CardTitle>
              <CardDescription class="text-secondary-foreground/80">Secondary action background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-secondary flex items-center justify-center text-secondary-foreground">
                bg-secondary
              </div>
            </CardContent>
          </Card>

          <Card class="bg-destructive">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">destructive</CardTitle>
              <CardDescription>Destructive/error background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-destructive flex items-center justify-center text-destructive-foreground">
                bg-destructive
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <!-- Text Colors -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Text Colors</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent class="pt-6 space-y-3">
              <p class="text-foreground text-lg">text-foreground</p>
              <p class="text-muted-foreground">text-muted-foreground - Secondary text</p>
              <p class="text-primary">text-primary - Primary brand color</p>
              <p class="text-secondary-foreground bg-secondary p-2 rounded">text-secondary-foreground</p>
              <p class="text-destructive">text-destructive - Error/danger text</p>
            </CardContent>
          </Card>
          <Card class="bg-muted">
            <CardContent class="pt-6 space-y-3">
              <p class="text-foreground text-lg">Text on muted background</p>
              <p class="text-muted-foreground">Muted text on muted</p>
              <p class="text-accent-foreground bg-accent p-2 rounded">Accent text on accent</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <!-- Semantic Colors -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Semantic Colors</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card class="bg-success text-black">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-black">success</CardTitle>
              <CardDescription class="text-black/70">Success state</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-success flex items-center justify-center text-black">
                bg-success
              </div>
            </CardContent>
          </Card>
          <Card class="bg-warning text-black">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-black">warning</CardTitle>
              <CardDescription class="text-black/70">Warning state</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-warning flex items-center justify-center text-black">
                bg-warning
              </div>
            </CardContent>
          </Card>
          <Card class="bg-info text-white">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-white">info</CardTitle>
              <CardDescription class="text-white/70">Informational</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-info flex items-center justify-center text-white">
                bg-info
              </div>
            </CardContent>
          </Card>
          <Card class="bg-neutral text-white">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-white">neutral</CardTitle>
              <CardDescription class="text-white/70">Neutral surface</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-neutral flex items-center justify-center text-white">
                bg-neutral
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <!-- Badges -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Badge Variants</h2>
        
        <!-- Default Variant with Colors -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">Default Variant (Filled)</h3>
          <div class="flex flex-wrap gap-3">
            <Badge>primary</Badge>
            <Badge color="secondary">secondary</Badge>
            <Badge color="success">success</Badge>
            <Badge color="warning">warning</Badge>
            <Badge color="error">error</Badge>
            <Badge color="info">info</Badge>
            <Badge color="neutral">neutral</Badge>
          </div>
        </div>

        <!-- Outline Variant with Colors -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">Outline Variant</h3>
          <div class="flex flex-wrap gap-3">
            <Badge variant="outline">primary</Badge>
            <Badge variant="outline" color="secondary">secondary</Badge>
            <Badge variant="outline" color="success">success</Badge>
            <Badge variant="outline" color="warning">warning</Badge>
            <Badge variant="outline" color="error">error</Badge>
            <Badge variant="outline" color="info">info</Badge>
            <Badge variant="outline" color="neutral">neutral</Badge>
          </div>
        </div>

        <!-- Soft Variant with Colors -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">Soft Variant</h3>
          <div class="flex flex-wrap gap-3">
            <Badge variant="soft">primary</Badge>
            <Badge variant="soft" color="secondary">secondary</Badge>
            <Badge variant="soft" color="success">success</Badge>
            <Badge variant="soft" color="warning">warning</Badge>
            <Badge variant="soft" color="error">error</Badge>
            <Badge variant="soft" color="info">info</Badge>
            <Badge variant="soft" color="neutral">neutral</Badge>
          </div>
        </div>

        <!-- Subtle Variant with Colors -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">Subtle Variant</h3>
          <div class="flex flex-wrap gap-3">
            <Badge variant="subtle">primary</Badge>
            <Badge variant="subtle" color="secondary">secondary</Badge>
            <Badge variant="subtle" color="success">success</Badge>
            <Badge variant="subtle" color="warning">warning</Badge>
            <Badge variant="subtle" color="error">error</Badge>
            <Badge variant="subtle" color="info">info</Badge>
            <Badge variant="subtle" color="neutral">neutral</Badge>
          </div>
        </div>

        <!-- Ghost Variant with Colors -->
        <div class="space-y-2">
          <h3 class="text-sm font-medium text-muted-foreground">Ghost Variant</h3>
          <div class="flex flex-wrap gap-3">
            <Badge variant="ghost">primary</Badge>
            <Badge variant="ghost" color="secondary">secondary</Badge>
            <Badge variant="ghost" color="success">success</Badge>
            <Badge variant="ghost" color="warning">warning</Badge>
            <Badge variant="ghost" color="error">error</Badge>
            <Badge variant="ghost" color="info">info</Badge>
            <Badge variant="ghost" color="neutral">neutral</Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Usage Examples</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center gap-2">
              <Badge>Active</Badge>
              <span class="text-sm text-muted-foreground">- Default primary state</span>
            </div>
            <div class="flex items-center gap-2">
              <Badge color="secondary">Pending</Badge>
              <span class="text-sm text-muted-foreground">- Secondary/inactive state</span>
            </div>
            <div class="flex items-center gap-2">
              <Badge color="error">Error</Badge>
              <span class="text-sm text-muted-foreground">- Error/danger state</span>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant="outline">Draft</Badge>
              <span class="text-sm text-muted-foreground">- Outline/subtle state</span>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant="soft" color="success">Completed</Badge>
              <span class="text-sm text-muted-foreground">- Soft success state</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- Border & Input -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Border & Input</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded border border-border bg-background">
            <p class="text-sm font-medium">border</p>
            <p class="text-xs text-muted-foreground">Standard border color</p>
          </div>
          <div class="p-4 rounded border border-input bg-inset">
            <p class="text-sm font-medium">border-input</p>
            <p class="text-xs text-muted-foreground">Input field border</p>
          </div>
          <div class="p-4 rounded border border-ring bg-background">
            <p class="text-sm font-medium">border-ring</p>
            <p class="text-xs text-muted-foreground">Focus ring border</p>
          </div>
        </div>
      </section>

      <!-- Interactive Components -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Interactive Components</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Button variants and states</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button color="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button color="error">Destructive</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Elements</CardTitle>
            <CardDescription>Inputs styled with theme colors</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4 max-w-md">
            <div class="space-y-2">
              <Label for="example">Label</Label>
              <Input id="example" placeholder="Input placeholder" />
            </div>
            <div class="space-y-2">
              <Label for="example-textarea">Textarea</Label>
              <Textarea id="example-textarea" placeholder="Textarea content" />
            </div>
            <div class="space-y-2">
              <Label>Select</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one">Option One</SelectItem>
                  <SelectItem value="two">Option Two</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label>Checkbox</Label>
              <div class="flex items-center gap-2">
                <Checkbox :checked="true" />
                <span class="text-sm">Checked</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <Label class="text-sm">Toggle</Label>
              <Toggle :model-value="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>States</CardTitle>
            <CardDescription>Disabled, loading, and focus styles</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-wrap gap-3">
            <Button :loading="true">Loading</Button>
            <Button variant="outline" disabled>Disabled</Button>
            <Input placeholder="Disabled input" disabled class="max-w-xs" />
          </CardContent>
        </Card>
      </section>

      <!-- Sidebar Colors -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Sidebar Colors</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card class="bg-sidebar">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-sidebar-foreground">sidebar</CardTitle>
              <CardDescription class="text-sidebar-foreground/70">Sidebar background</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground">
                bg-sidebar
              </div>
            </CardContent>
          </Card>

          <Card class="bg-sidebar-accent">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-sidebar-accent-foreground">sidebar-accent</CardTitle>
              <CardDescription class="text-sidebar-accent-foreground/70">Active/hover state</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground">
                bg-sidebar-accent
              </div>
            </CardContent>
          </Card>

          <Card class="bg-sidebar-primary">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm text-sidebar-primary-foreground">sidebar-primary</CardTitle>
              <CardDescription class="text-sidebar-primary-foreground/70">Primary action in sidebar</CardDescription>
            </CardHeader>
            <CardContent>
              <div class="h-16 rounded bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
                bg-sidebar-primary
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <!-- Alerts & Toasts -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Alerts & Toasts</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert>
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>Standard informational alert.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Destructive</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="showToast">Default Toast</Button>
          <Button variant="soft" @click="showToastSuccess">Success Toast</Button>
          <Button variant="soft" @click="showToastWarning">Warning Toast</Button>
          <Button variant="soft" @click="showToastError">Error Toast</Button>
        </div>
      </section>

      <!-- Tabs -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Tabs</h2>
        <Tabs default-value="overview" class="max-w-md">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardContent class="pt-6 text-sm text-muted-foreground">
                Overview content
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">
            <Card>
              <CardContent class="pt-6 text-sm text-muted-foreground">
                Details content
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      <!-- Table -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Table</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Atlas</TableCell>
              <TableCell><Badge color="success">Active</Badge></TableCell>
              <TableCell>Andrey</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Nova</TableCell>
              <TableCell><Badge color="warning">Pending</Badge></TableCell>
              <TableCell>Team</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <!-- Pagination -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Pagination</h2>
        <Pagination :page="paginationPage" :page-size="10" :total="120" @update:page="paginationPage = $event" />
      </section>

      <!-- Tooltip -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">Tooltip</h2>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Helpful context</TooltipContent>
        </Tooltip>
      </section>

      <!-- Theme Variables Reference -->
      <section class="space-y-4">
        <h2 class="text-lg font-medium border-b pb-2">CSS Variables Reference</h2>
        <Card>
          <CardContent class="pt-6">
            <pre class="text-xs overflow-x-auto p-4 bg-muted rounded-lg"><code>/* Background Colors */
--background        /* Main canvas */
--foreground        /* Primary text */
--card              /* Card surface */
--card-foreground   /* Card text */
--popover           /* Dropdown/popover surface */
--popover-foreground /* Dropdown/popover text */
--muted             /* Subtle background */
--muted-foreground  /* Subtle text */
--accent            /* Accent/hover background */
--accent-foreground /* Accent text */
--primary           /* Primary action */
--primary-foreground /* Primary action text */
--secondary         /* Secondary action */
--secondary-foreground /* Secondary action text */
--destructive       /* Error/danger */
--destructive-foreground /* Error/danger text */

/* Border & Ring */
--border            /* Standard borders */
--input             /* Input borders */
--ring              /* Focus rings */

/* Sidebar */
--sidebar           /* Sidebar background */
--sidebar-foreground /* Sidebar text */
--sidebar-accent    /* Sidebar hover/active */
--sidebar-primary   /* Sidebar primary */
--sidebar-border    /* Sidebar divider */</code></pre>
          </CardContent>
        </Card>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Toggle } from "@/components/ui/toggle"
import { Pagination } from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Icon } from "@iconify/vue"
import type { AcceptableValue } from "reka-ui"
import { toSelectString } from "@/lib/selectValue"
import { useThemeRegistry } from "@/composables/useThemeRegistry"
import { useUserSettings } from "@/composables/useUserSettings"
import { useToast } from "@/composables/useToast"
import ThemeModeToggle from "@/components/ThemeModeToggle.vue"
import { useAuthStore } from "@/auth"
import { isAdmin, isDeveloper } from "@wenyan/shared"

const { settings, setThemeId } = useUserSettings()
const { themes, isLoading: themesLoading, error: themesError, loadThemes } = useThemeRegistry()
const { error: showError, success: showSuccess, warning: showWarning } = useToast()
const auth = useAuthStore()
const paginationPage = ref(1)


const handleThemeIdChange = async (value: AcceptableValue) => {
  const themeId = toSelectString(value)
  if (!themeId) return
  try {
    const ok = await setThemeId(themeId)
    if (!ok) {
      showError("Failed to apply theme", "Theme could not be loaded from the registry.")
      return
    }
    showSuccess("Theme updated", "Color theme has been applied.")
  } catch (err) {
    showError("Failed to update theme", String(err))
  }
}

const selectedThemeEntry = computed(() =>
  themes.value.find((theme) => theme.id === settings.value?.themeId),
)

const isElevated = computed(() => {
  const roles = auth.user?.roles ?? []
  return isAdmin(roles) || isDeveloper(roles)
})

const canEditTheme = computed(() => {
  const theme = selectedThemeEntry.value
  if (!theme || !auth.user) return false
  return isElevated.value || theme.createdBy === auth.user.email
})

const canCloneTheme = computed(() => Boolean(selectedThemeEntry.value))


onMounted(() => {
  loadThemes()
})

const showToast = () => {
  showSuccess("Theme preview", "This is how toasts look in the current theme.")
}

const showToastSuccess = () => {
  showSuccess("Saved", "Settings updated successfully.")
}

const showToastWarning = () => {
  showWarning("Heads up", "Some fields still need attention.")
}

const showToastError = () => {
  showError("Failed", "We couldn't save your changes.")
}
</script>
