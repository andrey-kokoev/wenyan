<template>
  <div class="container mx-auto py-8">
    <h1 class="text-2xl font-bold mb-6">Access Control</h1>
    <p class="text-muted-foreground mb-8">
      Manage roles, permissions, and user access mappings.
    </p>
    
    <div class="grid gap-6">
      <RolesTable />
      <ControlledActionsTable />
    </div>
  </div>
</template>

<script setup lang="ts">
import RolesTable from "../components/RolesTable.vue"
import ControlledActionsTable from "../components/ControlledActionsTable.vue"
</script>
