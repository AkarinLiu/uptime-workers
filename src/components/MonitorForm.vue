<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/auth'
import { useI18n } from '../composables/i18n'

const { token } = useAuth()
const { t } = useI18n()
const props = defineProps<{ monitor: any | null }>()
const emit = defineEmits(['saved', 'cancel'])

const types = ['http', 'tcp'] as const

const name = ref(props.monitor?.name ?? '')
const slug = ref(props.monitor?.slug ?? '')
const type = ref(props.monitor?.type ?? 'http')
const url = ref(props.monitor?.url ?? '')
const notifyEnabled = ref(props.monitor?.notify_enabled ?? 0)
const notifyOn4xx = ref(props.monitor?.notify_on_4xx ?? 0)
const saving = ref(false)
const error = ref('')

const isTcp = computed(() => type.value === 'tcp')

function validateHostPort(v: string): boolean {
  const i = v.lastIndexOf(':')
  if (i === -1 || i === 0 || i === v.length - 1) return false
  const port = parseInt(v.substring(i + 1))
  return !isNaN(port) && port >= 1 && port <= 65535
}

async function submit() {
  if (!name.value || !url.value) {
    error.value = t('pleaseFillAll')
    return
  }
  if (isTcp.value && !validateHostPort(url.value)) {
    error.value = isTcp.value ? 'url must be host:port (e.g. example.com:80)' : t('pleaseFillAll')
    return
  }
  saving.value = true
  error.value = ''
  try {
    const isEdit = !!props.monitor
    const method = isEdit ? 'PUT' : 'POST'
    const path = isEdit ? `/api/monitors/${props.monitor.id}` : '/api/monitors'
    const body: Record<string, unknown> = { name: name.value, url: url.value, type: type.value, notify_enabled: notifyEnabled.value, notify_on_4xx: notifyOn4xx.value }
    if (slug.value) body.slug = slug.value
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify(body),
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
    <label>Slug <span class="md-hint">({{ t('optional') }})</span><input v-model="slug" type="text" placeholder="auto" /></label>
    <label>{{ t('type') }}
      <select v-model="type" class="type-select">
        <option v-for="tp in types" :key="tp" :value="tp">{{ t(tp) }}</option>
      </select>
    </label>
    <label>{{ isTcp ? t('host') : t('url') }}<input v-model="url" :type="isTcp ? 'text' : 'url'" :placeholder="isTcp ? 'example.com:80' : 'https://example.com'" required /></label>
    <fieldset class="notify-section">
      <legend>{{ t('notify') }}</legend>
      <label class="checkbox-label">
        <input v-model.number="notifyEnabled" type="checkbox" :true-value="1" :false-value="0" />
        {{ t('notifyEnable') }}
      </label>
      <label v-if="notifyEnabled" class="checkbox-label indent">
        <input v-model.number="notifyOn4xx" type="checkbox" :true-value="1" :false-value="0" />
        {{ t('notifyOn4xx') }}
      </label>
    </fieldset>
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
input, select { display: block; width: 100%; margin-top: 0.2rem; padding: 0.4rem; border: 1px solid var(--color-border); border-radius: 0.25rem; background: var(--color-background-soft); color: var(--color-heading); font-size: 0.9rem; }
.type-select { cursor: pointer; }
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
.notify-section {
  border: 1px solid var(--color-border); border-radius: 0.25rem;
  padding: 0.5rem 0.75rem; margin-bottom: 0.75rem;
}
.notify-section legend { font-size: 0.8rem; color: var(--color-heading); padding: 0 0.25rem; }
.checkbox-label {
  display: flex !important; align-items: center; gap: 0.4rem;
  margin-bottom: 0.3rem !important; cursor: pointer; font-size: 0.85rem;
}
.checkbox-label input[type="checkbox"] { width: auto; margin-top: 0; }
.checkbox-label.indent { margin-left: 1.5rem; }
</style>
