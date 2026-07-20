<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../composables/i18n'
import { renderMarkdown } from '../composables/markdown'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const { t } = useI18n()
const monitors = ref<any[]>([])
const announcements = ref<any[]>([])
const detail = ref<any>(null)
const loading = ref(false)
const error = ref('')

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

async function load(slug: string | undefined) {
  loading.value = true
  error.value = ''
  try {
    if (slug) {
      const res = await fetch(`/api/status/${slug}`)
      const data = await res.json()
      if (res.ok) detail.value = data
      else error.value = data.error || t('error')
    } else {
      const res = await fetch('/api/status/')
      const data = await res.json()
      monitors.value = data.monitors || data
      announcements.value = data.announcements || []
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => route.params.slug, (slug) => load(slug as string | undefined), { immediate: true })
</script>

<template>
  <div class="status-page">
    <template v-if="!route.params.slug">
      <h1>{{ t('status') }}</h1>

      <div v-if="announcements.length" class="announcements">
        <div v-for="a in announcements" :key="a.id" class="announcement">
          <strong>{{ a.title }}</strong>
          <span v-if="a.content" class="ann-content" v-html="renderMarkdown(a.content)"></span>
        </div>
      </div>

      <div v-if="loading">{{ t('loading') }}</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else class="grid">
        <div v-for="m in monitors" :key="m.id" class="card">
          <div class="card-top">
            <StatusBadge :is-up="isUp(m)" />
            <strong>{{ m.name }}</strong>
          </div>
          <div class="card-meta">
            <a :href="m.url" target="_blank">{{ m.url }}</a>
            <span>{{ isUp(m) ? `${m.last_response_time_ms}ms` : (m.last_error || t('unknown')) }}</span>
            <span>{{ t('checked') }} {{ timeAgo(m.last_checked_at) }}</span>
          </div>
          <router-link :to="`/status/${m.slug}`" class="detail-link">{{ t('details') }}</router-link>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-if="loading">{{ t('loading') }}</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="detail" class="detail">
        <h1>{{ detail.name }}</h1>
        <div class="detail-status">
          <StatusBadge :is-up="isUp(detail)" />
          <span class="status-code">{{ isUp(detail) ? `${detail.last_status_code} - ${detail.last_response_time_ms}ms` : (detail.last_error || t('unknown')) }}</span>
        </div>
        <p class="uptime-7d">{{ t('uptime7d') }}: <strong>{{ detail.uptime_7d_pct != null ? detail.uptime_7d_pct + '%' : t('nA') }}</strong></p>
        <table v-if="detail.recent_checks?.length">
          <thead>
            <tr><th>{{ t('time') }}</th><th>{{ t('status') }}</th><th>{{ t('response') }}</th><th>{{ t('error') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in detail.recent_checks" :key="c.id" :class="{ down: c.error || c.status_code >= 400 }">
              <td>{{ new Date(c.created_at + 'Z').toLocaleString() }}</td>
              <td><StatusBadge :is-up="!c.error && c.status_code >= 200 && c.status_code < 400" :show-text="true" /></td>
              <td>{{ c.status_code }} / {{ c.response_time_ms }}ms</td>
              <td>{{ c.error || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <router-link to="/status" class="back-link">{{ t('allStatus') }}</router-link>
      </div>
    </template>
  </div>
</template>

<style scoped>
.status-page { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.5rem; margin-bottom: 1rem; color: var(--color-heading); }
.announcements { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.announcement {
  border-left: 3px solid hsla(160, 100%, 37%, 1);
  padding: 0.5rem 0.75rem;
  background: var(--color-background-soft);
  border-radius: 0 0.25rem 0.25rem 0;
  font-size: 0.9rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.announcement strong { color: var(--color-heading); }
.grid { display: flex; flex-direction: column; gap: 0.75rem; }
.card { border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 1rem; }
.card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.85rem; color: var(--color-text); margin-bottom: 0.5rem; }
.card-meta a { color: var(--color-text); word-break: break-all; }
.detail-link { font-size: 0.85rem; }
.detail-status { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.status-code { font-size: 1.2rem; font-weight: bold; color: var(--color-heading); }
.uptime-7d { margin-bottom: 1rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; }
th { white-space: nowrap; }
tr.down { background: rgba(255,0,0,0.05); }
.back-link { margin-top: 1rem; display: inline-block; }
.error { color: #c00; }

@media (max-width: 600px) {
  .card-meta { flex-direction: column; gap: 0.25rem; }
  th, td { padding: 0.4rem 0.3rem; font-size: 0.75rem; }
}
</style>

<style>
.ann-content a { color: hsla(160, 100%, 37%, 1); }
.ann-content code { background: var(--color-background-mute); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.85em; }
.ann-content ul { padding-left: 1.25rem; margin: 0.25rem 0; }
.ann-content h2, .ann-content h3, .ann-content h4 { font-size: 0.95rem; margin: 0.25rem 0; color: var(--color-heading); }
.ann-content p { margin: 0.25rem 0; }
</style>
