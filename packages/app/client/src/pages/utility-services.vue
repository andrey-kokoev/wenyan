<template>
  <div class="container mx-auto py-8 space-y-8">
    <div>
      <h1 class="text-2xl font-bold">Utility Services</h1>
      <p class="text-muted-foreground">
        Manage system utility integrations.
      </p>
    </div>

    <DocumentConversionAdmin />
  </div>
</template>

<script setup lang="ts">
import DocumentConversionAdmin from "@/admin/components/DocumentConversionAdmin.vue"
</script>
