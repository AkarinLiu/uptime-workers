<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/auth'
import { useI18n } from '../composables/i18n'

const { token } = useAuth()
const { t } = useI18n()
const props = defineProps<{ monitor: any | null }>()
const emit = defineEmits(['saved', 'cancel'])

const name = ref(props.monitor?.name ?? '')
const url = ref(props.monitor?.url ?? '')
const interval = ref(props.monitor?.interval_seconds ?? 60)
const retention = ref(props.monitor?.retention_days ?? 30)
const saving = ref(false)
const error = ref('')

async function submit() {
  if (!name.value || !url.value) {
    error.value = t('pleaseFillAll')
    return
  }
  saving.value = true
  error.value = ''
  try {
    const isEdit = !!props.monitor
    const method = isEdit ? 'PUT' : 'POST'
    const path = isEdit ? `/api/monitors/${props.monitor.id}` : '/api/monitors'
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify({ name: name.value, url: url.value, interval_seconds: interval.value, retention_days: retention.value }),
    })
    if (!res.ok) {
      const data = await res.json()
      error.value = data.error || t('error')
      return
    }
    emit('saved')
  } catch (e: any) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="monitor-form" @submit.prevent="submit">
    <h3>{{ monitor ? t('editMonitor') : t('newMonitor') }}</h3>
    <div v-if="error" class="form-error">{{ error }}</div>
    <label>{{ t('name') }}<input v-model="name" type="text" required /></label>
    <label>{{ t('url') }}<input v-model="url" type="url" placeholder="https://example.com" required /></label>
    <label>{{ t('intervalSeconds') }}<input v-model.number="interval" type="number" min="10" /></label>
    <label>{{ t('retentionDays') }}<input v-model.number="retention" type="number" min="1" /></label>
    <div class="form-actions">
      <button type="submit" :disabled="saving">{{ saving ? t('saving') : t('save') }}</button>
      <button type="button" @click="emit('cancel')">{{ t('cancel') }}</button>
    </div>
  </form>
</template>

<style scoped>
.monitor-form {
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  max-width: 480px;
}
h3 { margin-bottom: 0.75rem; color: var(--color-heading); font-size: 1rem; }
label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--color-heading); }
input { display: block; width: 100%; margin-top: 0.2rem; padding: 0.4rem; border: 1px solid var(--color-border); border-radius: 0.25rem; background: var(--color-background-soft); color: var(--color-heading); font-size: 0.9rem; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.form-actions button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.85rem;
  background: var(--color-background);
  color: var(--color-text);
}
.form-actions button[type="submit"] {
  background: hsla(160, 100%, 37%, 1);
  color: #fff;
  border-color: transparent;
}
.form-error { color: #c00; font-size: 0.85rem; margin-bottom: 0.5rem; }
</style>
