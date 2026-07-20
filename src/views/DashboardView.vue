<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/auth'
import { useI18n } from '../composables/i18n'
import { renderMarkdown } from '../composables/markdown'
import StatusBadge from '../components/StatusBadge.vue'
import MonitorForm from '../components/MonitorForm.vue'

const router = useRouter()
const { token } = useAuth()
const { t } = useI18n()
const monitors = ref<any[]>([])
const announcements = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editMonitor = ref<any>(null)
const showAnnForm = ref(false)
const editAnn = ref<any>(null)
const annTitle = ref('')
const annContent = ref('')

function isUp(m: any) {
  return m.last_status_code != null && m.last_status_code >= 200 && m.last_status_code < 400 && !m.last_error
}

function timeAgo(ts: string) {
  if (!ts) return t('neverChecked')
  const diff = (Date.now() - new Date(ts + 'Z').getTime()) / 1000
  if (diff < 60) return t('secsAgo', { n: Math.floor(diff) })
  if (diff < 3600) return t('minsAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('hoursAgo', { n: Math.floor(diff / 3600) })
  return t('daysAgo', { n: Math.floor(diff / 86400) })
}

const headers = () => ({ Authorization: `Bearer ${token.value}` })

async function loadMonitors() {
  try {
    const res = await fetch('/api/monitors', { headers: headers() })
    monitors.value = await res.json()
  } finally { loading.value = false }
}

async function loadAnnouncements() {
  const res = await fetch('/api/announcements', { headers: headers() })
  announcements.value = await res.json()
}

async function toggle(monitor: any) {
  await fetch(`/api/monitors/${monitor.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ enabled: monitor.enabled ? 0 : 1 }),
  })
  await loadMonitors()
}

async function remove(monitor: any) {
  if (!confirm(t('confirmDelete', { name: monitor.name }))) return
  await fetch(`/api/monitors/${monitor.id}`, { method: 'DELETE', headers: headers() })
  await loadMonitors()
}

async function toggleAnn(a: any) {
  await fetch(`/api/announcements/${a.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ active: a.active ? 0 : 1 }),
  })
  await loadAnnouncements()
}

async function removeAnn(a: any) {
  if (!confirm(t('confirmDelete', { name: a.title }))) return
  await fetch(`/api/announcements/${a.id}`, { method: 'DELETE', headers: headers() })
  await loadAnnouncements()
}

async function saveAnn() {
  if (!annTitle.value) return
  if (editAnn.value) {
    await fetch(`/api/announcements/${editAnn.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ title: annTitle.value, content: annContent.value }),
    })
  } else {
    await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ title: annTitle.value, content: annContent.value }),
    })
  }
  showAnnForm.value = false
  editAnn.value = null
  annTitle.value = ''
  annContent.value = ''
  await loadAnnouncements()
}

async function onSaved() { showForm.value = false; editMonitor.value = null; await loadMonitors() }

onMounted(async () => { await loadMonitors(); await loadAnnouncements() })
</script>

<template>
  <div class="admin-page">
    <h1>{{ t('dashboard') }}</h1>

    <section class="section">
      <h2>{{ t('announcements') }}</h2>
      <button class="add-btn" @click="showAnnForm = true; editAnn = null; annTitle = ''; annContent = ''">{{ t('newAnnouncement') }}</button>
      <div v-if="showAnnForm" class="ann-form">
        <div class="ann-form-body">
          <div class="ann-form-fields">
            <label>{{ t('title') }}<input v-model="annTitle" type="text" /></label>
            <label>{{ t('content') }} <span class="md-hint">(Markdown)</span><textarea v-model="annContent" rows="5"></textarea></label>
          </div>
          <div class="ann-form-preview">
            <strong>{{ annTitle || t('title') }}</strong>
            <div class="preview-content" v-html="renderMarkdown(annContent)"></div>
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" @click="saveAnn">{{ t('save') }}</button>
          <button @click="showAnnForm = false">{{ t('cancel') }}</button>
        </div>
      </div>
      <div v-for="a in announcements" :key="a.id" class="ann-card">
        <div class="ann-info">
          <strong :class="{ inactive: !a.active }">{{ a.title }}</strong>
          <span v-if="a.content" class="ann-preview" v-html="renderMarkdown(a.content)"></span>
        </div>
        <div class="ann-actions">
          <button @click="toggleAnn(a)">{{ a.active ? t('pause') : t('resume') }}</button>
          <button @click="editAnn = a; annTitle = a.title; annContent = a.content; showAnnForm = true">{{ t('edit') }}</button>
          <button class="danger" @click="removeAnn(a)">{{ t('delete') }}</button>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>{{ t('status') }}</h2>
      <button class="add-btn" @click="showForm = true; editMonitor = null">{{ t('addMonitor') }}</button>

      <MonitorForm v-if="showForm" :monitor="editMonitor" @saved="onSaved" @cancel="showForm = false; editMonitor = null" />

      <div v-if="loading">{{ t('loading') }}</div>
      <div v-else class="grid">
        <div v-for="m in monitors" :key="m.id" class="card">
          <div class="card-top">
            <StatusBadge :is-up="isUp(m)" />
            <strong>{{ m.name }}</strong>
            <span class="slug">/status/{{ m.slug }}</span>
          </div>
          <div class="card-meta">
            <a :href="m.url" target="_blank">{{ m.url }}</a>
            <span>{{ isUp(m) ? `${m.last_response_time_ms}ms` : (m.last_error || t('nA')) }}</span>
            <span>{{ t('checked') }} {{ timeAgo(m.last_checked_at) }}</span>
          </div>
          <div class="card-actions">
            <button @click="router.push(`/admin/monitors/${m.id}`)">{{ t('history') }}</button>
            <button @click="showForm = true; editMonitor = m">{{ t('edit') }}</button>
            <button @click="toggle(m)">{{ m.enabled ? t('pause') : t('resume') }}</button>
            <button class="danger" @click="remove(m)">{{ t('delete') }}</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-page { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--color-heading); }
h2 { font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--color-heading); }
.section { margin-bottom: 2rem; }
.add-btn {
  background: hsla(160, 100%, 37%, 1);
  color: #fff;
  border: 0;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  margin-bottom: 1rem;
}
.grid { display: flex; flex-direction: column; gap: 0.75rem; }
.card { border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 1rem; }
.card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.slug { font-size: 0.8rem; color: var(--color-text); opacity: 0.7; }
.card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.85rem; color: var(--color-text); margin-bottom: 0.5rem; }
.card-meta a { color: var(--color-text); word-break: break-all; }
.card-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.card-actions button {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  cursor: pointer;
  background: var(--color-background);
  color: var(--color-text);
}
.card-actions button.danger { border-color: #c00; color: #c00; }
.inactive { opacity: 0.4; text-decoration: line-through; }
.ann-card {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 0.5rem 0.75rem; border: 1px solid var(--color-border); border-radius: 0.25rem;
  margin-bottom: 0.5rem; font-size: 0.9rem;
}
.ann-info { flex: 1; min-width: 0; }
.ann-preview { display: block; font-size: 0.8rem; opacity: 0.7; margin-top: 0.2rem; }
.ann-actions { display: flex; gap: 0.5rem; }
.ann-actions button {
  font-size: 0.75rem; padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-border); border-radius: 0.25rem; cursor: pointer;
  background: var(--color-background); color: var(--color-text);
}
.ann-actions button.danger { border-color: #c00; color: #c00; }
.ann-form {
  border: 1px solid var(--color-border); border-radius: 0.5rem;
  padding: 1rem; margin-bottom: 1rem; max-width: 900px;
}
.ann-form-body { display: flex; gap: 1.5rem; }
.ann-form-fields { flex: 1; min-width: 0; }
.ann-form-preview {
  flex: 1; min-width: 0; border-left: 2px solid hsla(160, 100%, 37%, 1);
  padding-left: 1rem; font-size: 0.85rem; color: var(--color-text);
}
.ann-form-preview strong { display: block; margin-bottom: 0.5rem; color: var(--color-heading); font-size: 1rem; }
.preview-content { max-height: 250px; overflow-y: auto; }
.preview-content :empty::after { content: '(empty)'; opacity: 0.4; font-style: italic; }
.md-hint { font-size: 0.75rem; opacity: 0.5; font-weight: normal; }
.ann-form label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--color-heading); }
.ann-form input, .ann-form textarea {
  display: block; width: 100%; margin-top: 0.2rem; padding: 0.4rem;
  border: 1px solid var(--color-border); border-radius: 0.25rem;
  background: var(--color-background-soft); color: var(--color-heading); font-size: 0.9rem;
}
.form-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.form-actions button {
  padding: 0.4rem 0.8rem; border: 1px solid var(--color-border); border-radius: 0.25rem;
  cursor: pointer; font-size: 0.85rem; background: var(--color-background); color: var(--color-text);
}
.form-actions .save-btn { background: hsla(160, 100%, 37%, 1); color: #fff; border-color: transparent; }
</style>

<style>
.ann-preview a { color: hsla(160, 100%, 37%, 1); }
.ann-preview code { background: var(--color-background-mute); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.85em; }
.ann-preview ul { padding-left: 1.25rem; margin: 0.25rem 0; }
.ann-preview h2, .ann-preview h3, .ann-preview h4 { font-size: 0.9rem; margin: 0.25rem 0; color: var(--color-heading); }
.ann-preview p { margin: 0.25rem 0; }
.preview-content a { color: hsla(160, 100%, 37%, 1); }
.preview-content code { background: var(--color-background-mute); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.85em; }
.preview-content ul { padding-left: 1.25rem; margin: 0.25rem 0; }
.preview-content h2, .preview-content h3, .preview-content h4 { font-size: 0.9rem; margin: 0.25rem 0; color: var(--color-heading); }
.preview-content li { margin: 0; }
.preview-content br { display: block; content: ''; margin-top: 0.25rem; }
</style>
