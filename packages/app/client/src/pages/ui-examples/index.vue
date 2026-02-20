<template>
  <div class="p-6 flex justify-center">
    <div class="w-full max-w-5xl">
      <Card class="mb-6">
        <CardHeader>
          <CardTitle class="text-3xl">UI Components</CardTitle>
          <CardDescription>
            Interactive examples of all UI components in the design system
          </CardDescription>
        </CardHeader>
      </Card>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card v-for="component in components" :key="component.path" class="hover:border-primary/50 transition-colors cursor-pointer" @click="navigateTo(component.path)">
          <CardHeader>
            <div class="flex items-center gap-2">
              <Icon :icon="component.icon" class="h-5 w-5 text-primary" />
              <CardTitle>{{ component.name }}</CardTitle>
            </div>
            <CardDescription>{{ component.description }}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'

const router = useRouter()

const components = [
  {
    name: 'Buttons',
    path: '/ui-examples/buttons',
    icon: 'heroicons:cursor-arrow-ripple',
    description: 'All button variants, colors, and sizes'
  },
  {
    name: 'Cards',
    path: '/ui-examples/cards',
    icon: 'heroicons:rectangle-stack',
    description: 'Card containers with headers and footers'
  },
  {
    name: 'Inputs',
    path: '/ui-examples/inputs',
    icon: 'heroicons:pencil-square',
    description: 'Text inputs, textareas, checkboxes, toggles'
  },
  {
    name: 'Dialogs',
    path: '/ui-examples/dialogs',
    icon: 'heroicons:window',
    description: 'Modal dialogs and popups'
  },
  {
    name: 'Badges',
    path: '/ui-examples/badges',
    icon: 'heroicons:tag',
    description: 'Status indicators and labels'
  },
  {
    name: 'Tooltips',
    path: '/ui-examples/tooltips',
    icon: 'heroicons:chat-bubble-bottom-center-text',
    description: 'Contextual information on hover'
  },
]

function navigateTo(path: string) {
  router.push(path)
}
</script>
