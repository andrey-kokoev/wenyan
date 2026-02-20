<template>
  <div class="p-6 flex justify-center">
    <div class="w-full max-w-5xl">
      <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Badge Component</CardTitle>
        <CardDescription>Small status indicators and labels</CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <!-- Colors (solid variant) -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Colors</h2>
          <div class="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge color="primary">Primary</Badge>
            <Badge color="secondary">Secondary</Badge>
            <Badge color="success">Success</Badge>
            <Badge color="warning">Warning</Badge>
            <Badge color="error">Error</Badge>
            <Badge color="error">Error</Badge>
            <Badge color="info">Info</Badge>
            <Badge color="neutral">Neutral</Badge>
          </div>
        </section>

        <!-- Variants -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Variants</h2>
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm text-muted-foreground w-20">Solid:</span>
              <Badge color="primary">Primary</Badge>
              <Badge color="secondary">Secondary</Badge>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm text-muted-foreground w-20">Outline:</span>
              <Badge variant="outline" color="primary">Primary</Badge>
              <Badge variant="outline" color="secondary">Secondary</Badge>
              <Badge variant="outline" color="success">Success</Badge>
              <Badge variant="outline" color="warning">Warning</Badge>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-sm text-muted-foreground w-20">Ghost:</span>
              <Badge variant="ghost" color="primary">Primary</Badge>
              <Badge variant="ghost" color="secondary">Secondary</Badge>
              <Badge variant="ghost" color="success">Success</Badge>
              <Badge variant="ghost" color="warning">Warning</Badge>
            </div>
          </div>
        </section>

        <!-- Usage Examples -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Usage Examples</h2>
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <span>Status:</span>
              <Badge color="success">Active</Badge>
            </div>
            <div class="flex items-center gap-2">
              <span>Priority:</span>
              <Badge color="error">High</Badge>
            </div>
            <div class="flex items-center gap-2">
              <span>Category:</span>
              <Badge color="primary">Featured</Badge>
            </div>
            <div class="flex items-center gap-2">
              <span>Type:</span>
              <Badge color="secondary">New</Badge>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import Badge from '@/components/ui/badge/Badge.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
</script>
