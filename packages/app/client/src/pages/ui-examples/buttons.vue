<template>
  <div class="p-6 flex justify-center">
    <div class="w-full max-w-5xl">
      <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Button Component</CardTitle>
        <CardDescription>Examples of all button variants and colors</CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <!-- Variants -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Variants</h2>
          <div class="flex flex-wrap gap-3">
            <Button variant="solid">Solid</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </section>

        <!-- Colors -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Colors (Solid)</h2>
          <div class="flex flex-wrap gap-3">
            <Button color="primary">Primary</Button>
            <Button color="secondary">Secondary</Button>
            <Button color="success">Success</Button>
            <Button color="warning">Warning</Button>
            <Button color="error">Error</Button>
            <Button color="neutral">Neutral</Button>
          </div>
        </section>

        <!-- Sizes -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Sizes</h2>
          <div class="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
          </div>
        </section>

        <!-- Outline Colors -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Outline Variant</h2>
          <div class="flex flex-wrap gap-3">
            <Button variant="outline" color="primary">Primary</Button>
            <Button variant="outline" color="secondary">Secondary</Button>
            <Button variant="outline" color="success">Success</Button>
            <Button variant="outline" color="warning">Warning</Button>
            <Button variant="outline" color="error">Error</Button>
            <Button variant="outline" color="neutral">Neutral</Button>
          </div>
        </section>

        <!-- Soft Colors -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Soft Variant</h2>
          <div class="flex flex-wrap gap-3">
            <Button variant="soft" color="primary">Primary</Button>
            <Button variant="soft" color="secondary">Secondary</Button>
            <Button variant="soft" color="success">Success</Button>
            <Button variant="soft" color="warning">Warning</Button>
            <Button variant="soft" color="error">Error</Button>
            <Button variant="soft" color="neutral">Neutral</Button>
          </div>
        </section>

        <!-- Loading State -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Loading State</h2>
          <div class="flex flex-wrap gap-3">
            <Button :loading="true">Loading</Button>
            <Button variant="outline" :loading="true">Loading Outline</Button>
            <Button variant="soft" color="success" :loading="true">Loading Soft</Button>
          </div>
        </section>

        <!-- Disabled State -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Disabled State</h2>
          <div class="flex flex-wrap gap-3">
            <Button disabled>Disabled</Button>
            <Button variant="outline" disabled>Disabled Outline</Button>
            <Button variant="soft" disabled>Disabled Soft</Button>
          </div>
        </section>

        <!-- Icon Buttons -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Icon Buttons</h2>
          <div class="flex flex-wrap items-center gap-3">
            <Button size="icon-sm">
              <Icon icon="heroicons:plus" />
            </Button>
            <Button size="icon">
              <Icon icon="heroicons:plus" />
            </Button>
            <Button size="icon-lg">
              <Icon icon="heroicons:plus" />
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import { Icon } from '@iconify/vue'
</script>
