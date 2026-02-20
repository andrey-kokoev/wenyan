<template>
  <div class="container mx-auto py-8 space-y-8">
    <div>
      <h1 class="text-2xl font-bold">AI Providers</h1>
      <p class="text-muted-foreground">
        Manage provider credentials and coverage.
      </p>
    </div>

    <AiRespondersAdmin mode="providers" />
  </div>
</template>

<script setup lang="ts">
import AiRespondersAdmin from "@/admin/components/AiRespondersAdmin.vue"
</script>
