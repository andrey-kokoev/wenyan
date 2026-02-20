<template>
  <div class="p-6 flex justify-center"><div class="w-full max-w-5xl">
    <Card>
      <CardHeader>
        <CardTitle class="text-2xl">Dialog Component</CardTitle>
        <CardDescription>Modal dialogs and popups</CardDescription>
      </CardHeader>
      <CardContent class="space-y-8">
        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Basic Dialog</h2>
          <Dialog v-model:open="isBasicOpen">
            <DialogTrigger as-child>
              <Button>Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog Title</DialogTitle>
                <DialogDescription>
                  This is a dialog description. Dialogs are used for important information.
                </DialogDescription>
              </DialogHeader>
              <div class="py-4">
                <p>Dialog content goes here.</p>
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" @click="isBasicOpen = false">Cancel</Button>
                <Button @click="isBasicOpen = false">Confirm</Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        <section class="space-y-4">
          <h2 class="text-xl font-semibold">Form Dialog</h2>
          <Dialog v-model:open="isFormOpen">
            <DialogTrigger as-child>
              <Button variant="outline">Edit Profile</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Make changes to your profile here.
                </DialogDescription>
              </DialogHeader>
              <div class="space-y-4 py-4">
                <div class="space-y-2">
                  <Label for="dialog-name">Name</Label>
                  <Input id="dialog-name" v-model="profileName" />
                </div>
                <div class="space-y-2">
                  <Label for="dialog-email">Email</Label>
                  <Input id="dialog-email" type="email" v-model="profileEmail" />
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" @click="isFormOpen = false">Cancel</Button>
                <Button @click="saveProfile">Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>
      </CardContent>
    </Card>
  </div></div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardDescription from '@/components/ui/card/CardDescription.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const isBasicOpen = ref(false)
const isFormOpen = ref(false)
const profileName = ref('John Doe')
const profileEmail = ref('john@example.com')

function saveProfile() {
  isFormOpen.value = false
  // Save logic here
}
</script>
