<script setup lang="ts">
import { DialogClose, type DialogCloseProps, useForwardProps } from 'reka-ui'

const props = defineProps<DialogCloseProps>()
const forwardedProps = useForwardProps(props)
</script>

<template>
  <DialogClose v-bind="forwardedProps">
    <slot />
  </DialogClose>
</template>
