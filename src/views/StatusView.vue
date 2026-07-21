<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../composables/i18n'
import { renderMarkdown } from '../composables/markdown'
import StatusBadge from '../components/StatusBadge.vue'
import UptimeChart from '../components/UptimeChart.vue'

const route = useRoute()
const { t } = useI18n()
const monitors = ref<any[]>([])
const announcements = ref<any[]>([])
const detail = ref<any>(null)
const loading = ref(false)
const error = ref('')
const chartRange = ref('24h')
const chartLoading = ref(false)
const lastUpdated = ref<string | null>(null)
const polling = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

function isUp(m: any) {
  return m.last_status_code != null && m.last_status_code >= 200 && m.last_status_code < 400 && !m.last_error
}

function isHttp(m: any): boolean {
  return !m.type || m.type === 'http'
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
      await loadDetail(slug)
    } else {
      await loadList()
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadList() {
  const res = await fetch('/api/status/')
  const data = await res.json()
  monitors.value = data.monitors || data
  announcements.value = data.announcements || []
  lastUpdated.value = new Date().toISOString()
}

async function loadDetail(slug: string) {
  chartLoading.value = true
  try {
    const res = await fetch(`/api/status/${slug}?range=${chartRange.value}`)
    const data = await res.json()
    if (res.ok) {
      detail.value = data
      lastUpdated.value = new Date().toISOString()
    }
    else error.value = data.error || t('error')
  } catch (e: any) {
    error.value = e.message
  } finally {
    chartLoading.value = false
  }
}

async function poll() {
  if (polling.value) return
  polling.value = true
  try {
    const slug = route.params.slug as string | undefined
    if (slug) {
      await loadDetail(slug)
    } else {
      await loadList()
    }
  } catch { /* silent on poll errors */ }
  finally { polling.value = false }
}

function startPolling() {
  stopPolling()
  const slug = !!route.params.slug
  pollTimer = setInterval(poll, slug ? 15_000 : 30_000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

function onRangeChange(range: string) {
  chartRange.value = range
  if (route.params.slug) loadDetail(route.params.slug as string)
}

watch(() => route.params.slug, (slug) => {
  stopPolling()
  load(slug as string | undefined)
  startPolling()
}, { immediate: true })

onBeforeUnmount(stopPolling)
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

      <div v-if="loading && monitors.length === 0" class="loading-shimmer">
        <div v-for="i in 3" :key="i" class="shimmer-card"></div>
      </div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else class="grid">
        <TransitionGroup name="card-list">
          <div v-for="m in monitors" :key="m.id" class="card">
            <div class="card-top">
              <StatusBadge :is-up="isUp(m)" />
              <strong>{{ m.name }}</strong>
              <span class="type-badge">{{ t(m.type || 'http') }}</span>
            </div>
            <div class="card-meta">
              <a v-if="isHttp(m)" :href="m.url" target="_blank">{{ m.url }}</a>
              <span v-else class="mono">tcp://{{ m.url }}</span>
              <span>{{ isUp(m) ? `${m.last_response_time_ms}ms` : (m.last_error || t('unknown')) }}</span>
              <span>{{ t('checked') }} {{ timeAgo(m.last_checked_at) }}</span>
            </div>
            <router-link :to="`/status/${m.slug}`" class="detail-link">{{ t('details') }}</router-link>
          </div>
        </TransitionGroup>
      </div>
      <div v-if="lastUpdated" class="last-updated" :key="lastUpdated">
        {{ t('lastUpdated') }}: {{ new Date(lastUpdated).toLocaleTimeString() }}
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
        <UptimeChart
          v-model="chartRange"
          :checks="detail.recent_checks ?? []"
          :uptime-pct="detail.uptime_pct"
          @range-change="onRangeChange"
        />
        <div v-if="chartLoading" class="chart-loading">{{ t('loading') }}</div>
        <div v-if="lastUpdated" class="last-updated" :key="lastUpdated">
          {{ t('lastUpdated') }}: {{ new Date(lastUpdated).toLocaleTimeString() }}
        </div>
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
.card {
  border: 1px solid var(--color-border); border-radius: 0.5rem; padding: 1rem;
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
}
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.card-top { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.type-badge {
  font-size: 0.65rem;
  text-transform: uppercase;
  background: var(--color-background-soft);
  color: var(--color-text);
  padding: 0.1rem 0.35rem;
  border-radius: 0.2rem;
  opacity: 0.7;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.mono { font-family: monospace; }
.card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; font-size: 0.85rem; color: var(--color-text); margin-bottom: 0.5rem; }
.card-meta a { color: var(--color-text); word-break: break-all; }
.detail-link { font-size: 0.85rem; }
.detail-status { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.status-code { font-size: 1.2rem; font-weight: bold; color: var(--color-heading); }
.chart-loading { text-align: center; color: var(--color-text); padding: 1rem; font-size: 0.85rem; }
.back-link { margin-top: 1rem; display: inline-block; }
.error { color: #c00; }

.last-updated {
  text-align: center; font-size: 0.75rem; color: var(--color-text);
  opacity: 0.5; margin-top: 1rem;
  animation: fadeIn 0.6s ease;
}

.loading-shimmer { display: flex; flex-direction: column; gap: 0.75rem; }
.shimmer-card {
  height: 4.5rem; border-radius: 0.5rem;
  background: linear-gradient(90deg, var(--color-background-soft) 25%, var(--color-background-mute) 50%, var(--color-background-soft) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.card-list-enter-active { transition: all 0.4s ease-out; }
.card-list-leave-active { transition: all 0.3s ease-in; }
.card-list-enter-from { opacity: 0; transform: translateY(12px); }
.card-list-leave-to { opacity: 0; transform: translateX(20px); }
.card-list-move { transition: transform 0.4s ease; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 0.5; } }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 600px) {
  .card-meta { flex-direction: column; gap: 0.25rem; }
}
</style>

<style>
.ann-content a { color: hsla(160, 100%, 37%, 1); }
.ann-content code { background: var(--color-background-mute); padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-size: 0.85em; }
.ann-content ul { padding-left: 1.25rem; margin: 0.25rem 0; }
.ann-content h2, .ann-content h3, .ann-content h4 { font-size: 0.95rem; margin: 0.25rem 0; color: var(--color-heading); }
.ann-content p { margin: 0.25rem 0; }
</style>
