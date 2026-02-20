<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: false,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const isChecked = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
</script>

<template>
  <label class="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      :checked="isChecked"
      :disabled="disabled"
      class="sr-only peer"
      @change="isChecked = !isChecked"
    />
    <div
      class="w-11 h-6 bg-inset peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary transition-colors"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    />
  </label>
</template>
