<template>
  <div class="p-6 flex justify-center"><div class="w-full max-w-5xl">
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Tooltip Component</CardTitle>
        <CardDescription>
          Contextual information on hover. Tooltip content is selectable for copying.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <!-- Basic Tooltip -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Basic Tooltip</h2>
          <div class="flex flex-wrap gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip. You can select this text!</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="soft">With selectable content</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Try selecting this text with your mouse.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>

        <!-- Multiline Tooltip -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Multiline Content</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline">Multiline tooltip</Button>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                <p>This tooltip has multiple lines of text.
You can select any part of it.
Whitespace is preserved using whitespace-pre-line.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </section>

        <!-- Positioning -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Positioning</h2>
          <div class="flex flex-wrap gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline">Top (default)</Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Tooltip on top</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline">Right</Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Tooltip on right</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline">Bottom</Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Tooltip on bottom</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline">Left</Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Tooltip on left</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>

        <!-- With Icons -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">With Icons</h2>
          <div class="flex flex-wrap items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button size="icon" variant="ghost">
                    <Icon icon="heroicons:information-circle" class="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Additional information here</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button size="icon" variant="ghost">
                    <Icon icon="heroicons:question-mark-circle" class="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent class="max-w-xs">
                  <p>Help text can be longer and include multiple lines. All text remains selectable.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </section>

        <!-- Selectable Content Demo -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Selectable Content</h2>
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              Hover over the items below and try selecting the tooltip text:
            </p>
            <div class="flex flex-wrap gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="outline">Copy this ID</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>usr_2k4j5h3g2f1d0a9s8d7f6</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="outline">API Endpoint</Button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-sm">
                    <p>https://api.example.com/v1/users/2k4j5h3g2f1d0a9s8d7f6</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </section>

        <!-- Copy on Click -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Copy Content on Click</h2>
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              Click on the tooltip to copy its content to clipboard:
            </p>
            <div class="flex flex-wrap gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="outline">Click tooltip to copy ID</Button>
                  </TooltipTrigger>
                  <TooltipContent copy-content-on-click>
                    <p>usr_2k4j5h3g2f1d0a9s8d7f6</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="outline">Click to copy endpoint</Button>
                  </TooltipTrigger>
                  <TooltipContent copy-content-on-click class="max-w-sm">
                    <p>https://api.example.com/v1/users/2k4j5h3g2f1d0a9s8d7f6</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button variant="outline">Copy multiline</Button>
                  </TooltipTrigger>
                  <TooltipContent copy-content-on-click class="max-w-xs">
                    <p>Line 1: Important info
Line 2: More details
Line 3: Final note</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  </div></div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@iconify/vue'
</script>
