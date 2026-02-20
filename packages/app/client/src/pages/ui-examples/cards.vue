<template>
  <div class="p-6 flex justify-center"><div class="w-full max-w-5xl">
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Card Component</CardTitle>
        <CardDescription>Card container with header, content, and footer</CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <!-- Basic Card -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Basic Card</h2>
          <Card class="w-96">
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is the card content. It can contain any elements you need.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">Cancel</Button>
              <Button size="sm">Submit</Button>
            </CardFooter>
          </Card>
        </section>

        <!-- Card with Form -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Card with Form</h2>
          <Card class="w-96">
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
              <CardDescription>Enter your details to create an account</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="name">Name</Label>
                <Input id="name" placeholder="John Doe" />
              </div>
              <div class="space-y-2">
                <Label for="email">Email</Label>
                <Input id="email" type="email" placeholder="john@example.com" />
              </div>
            </CardContent>
            <CardFooter class="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>Create</Button>
            </CardFooter>
          </Card>
        </section>

        <!-- Multiple Cards -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Card Grid</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-3xl font-bold">2,845</p>
                <p class="text-sm text-muted-foreground">Total visitors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-3xl font-bold">$12,432</p>
                <p class="text-sm text-muted-foreground">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <p class="text-3xl font-bold text-selective-yellow-600">+23%</p>
                <p class="text-sm text-muted-foreground">Compared to last month</p>
              </CardContent>
            </Card>
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
import CardFooter from '@/components/ui/card/CardFooter.vue'
import Button from '@/components/ui/button/Button.vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
</script>
