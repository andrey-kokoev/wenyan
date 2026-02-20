<script setup lang="ts">
import { ref } from 'vue'
import { wenyanStatus, wenyanStream, wenyanSubmit } from '../lib/api'

const messageId = ref('')
const submitResult = ref<string>('')
const statusResult = ref<string>('')
const streamResult = ref<string>('')

async function submitSample() {
  const id = `msg-${Date.now()}`
  const result = await wenyanSubmit({
    id,
    genre: 'policy-note',
    payload: { title: 'Draft', body: 'Initial draft text' },
    actor: { id: 'local-user', role: 'admin' },
    submittedAt: new Date().toISOString(),
    metadata: { source: 'ui' },
  })
  messageId.value = result.id
  submitResult.value = JSON.stringify(result, null, 2)
}

async function loadStatus() {
  if (!messageId.value) return
  const result = await wenyanStatus(messageId.value)
  statusResult.value = JSON.stringify(result, null, 2)
}

async function loadStream() {
  const result = await wenyanStream()
  streamResult.value = JSON.stringify(result, null, 2)
}
</script>

<template>
  <main style="padding: 24px; display: grid; gap: 12px;">
    <h1>Wenyan</h1>
    <div style="display: flex; gap: 8px;">
      <button @click="submitSample">Submit Sample</button>
      <button @click="loadStatus">Load Status</button>
      <button @click="loadStream">Load Stream</button>
    </div>
    <label>
      Message ID
      <input v-model="messageId" placeholder="message id" />
    </label>
    <pre>{{ submitResult }}</pre>
    <pre>{{ statusResult }}</pre>
    <pre>{{ streamResult }}</pre>
  </main>
</template>
