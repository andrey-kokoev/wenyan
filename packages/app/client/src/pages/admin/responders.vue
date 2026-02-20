<template>
  <div class="container mx-auto py-8 space-y-8">
    <div>
      <h1 class="text-2xl font-bold">AI Responders</h1>
      <p class="text-muted-foreground">
        Manage responder mappings and models.
      </p>
    </div>

    <AiRespondersAdmin mode="responders" />
  </div>
</template>

<script setup lang="ts">
import AiRespondersAdmin from "@/admin/components/AiRespondersAdmin.vue"
</script>
