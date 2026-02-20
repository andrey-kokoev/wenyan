<script setup lang="ts">
import { DialogTrigger, type DialogTriggerProps, useForwardProps } from 'reka-ui'

const props = defineProps<DialogTriggerProps>()
const forwardedProps = useForwardProps(props)
</script>

<template>
  <DialogTrigger v-bind="forwardedProps">
    <slot />
  </DialogTrigger>
</template>
