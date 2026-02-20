<template>
  <div class="p-6 flex justify-center"><div class="w-full max-w-5xl">
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Input Components</CardTitle>
        <CardDescription>Form input, textarea, checkbox, and toggle examples</CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <!-- Basic Input -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Text Input</h2>
          <div class="space-y-2">
            <Label for="basic">Basic Input</Label>
            <Input id="basic" placeholder="Enter text..." />
          </div>
          <div class="space-y-2">
            <Label for="disabled">Disabled Input</Label>
            <Input id="disabled" placeholder="Disabled" disabled />
          </div>
        </section>

        <!-- Input Types -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Input Types</h2>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" placeholder="email@example.com" />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <div class="space-y-2">
            <Label for="number">Number</Label>
            <Input id="number" type="number" placeholder="0" />
          </div>
        </section>

        <!-- Textarea -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Textarea</h2>
          <div class="space-y-2">
            <Label for="message">Message</Label>
            <Textarea id="message" placeholder="Type your message here..." />
          </div>
        </section>

        <!-- Checkbox -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Checkbox</h2>
          <div class="flex items-center space-x-2">
            <Checkbox id="terms" />
            <Label for="terms">Accept terms and conditions</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="marketing" />
            <Label for="marketing">Receive marketing emails</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox id="disabled-check" disabled />
            <Label for="disabled-check">Disabled checkbox</Label>
          </div>
        </section>

        <!-- Toggle -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Toggle</h2>
          <div class="flex items-center space-x-2">
            <Toggle id="airplane">
              <Icon icon="heroicons:paper-airplane" class="h-4 w-4" />
            </Toggle>
            <Label for="airplane">Airplane Mode</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Toggle id="bold" pressed>
              <Icon icon="heroicons:bold" class="h-4 w-4" />
            </Toggle>
            <Label for="bold">Bold (Pressed)</Label>
          </div>
        </section>
      </CardContent>
    </Card>
  </div></div>
</template>

<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Toggle } from '@/components/ui/toggle'
import { Label } from '@/components/ui/label'
import { Icon } from '@iconify/vue'
</script>
