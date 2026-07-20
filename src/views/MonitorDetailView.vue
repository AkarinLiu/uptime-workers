<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/auth'
import { useI18n } from '../composables/i18n'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()
const router = useRouter()
const { token } = useAuth()
const { t } = useI18n()
const monitor = ref<any>(null)
const checks = ref<any[]>([])
const uptime = ref<number | null>(null)
const loading = ref(true)
const limit = ref(100)

const headers = () => ({ Authorization: `Bearer ${token.value}` })

async function load() {
  const id = route.params.id
  try {
    const [mRes, cRes] = await Promise.all([
      fetch(`/api/monitors/${id}`, { headers: headers() }),
      fetch(`/api/checks?monitor_id=${id}&limit=${limit.value}`, { headers: headers() }),
    ])
    monitor.value = await mRes.json()
    const cData = await cRes.json()
    checks.value = cData.checks
    uptime.value = cData.uptime_pct
  } finally { loading.value = false }
}

function isUp(c: any) {
  return !c.error && c.status_code >= 200 && c.status_code < 400
}

onMounted(load)
</script>

<template>
  <div class="detail-page">
    <button class="back-btn" @click="router.push('/admin')">{{ t('back') }}</button>

    <div v-if="loading">{{ t('loading') }}</div>
    <div v-else-if="monitor">
      <h1>{{ monitor.name }}</h1>
      <div class="info">
        <a :href="monitor.url" target="_blank">{{ monitor.url }}</a>
        <span>{{ t('interval') }}: {{ monitor.interval_seconds }}s</span>
        <span>{{ t('retention') }}: {{ monitor.retention_days }}d</span>
        <StatusBadge :is-up="monitor.last_status_code != null && monitor.last_status_code >= 200 && monitor.last_status_code < 400 && !monitor.last_error" :show-text="true" />
      </div>
      <p v-if="uptime != null" class="uptime">{{ t('uptimeOverall') }}: <strong>{{ uptime }}%</strong></p>

      <table v-if="checks.length">
        <thead>
          <tr><th>{{ t('time') }}</th><th>{{ t('status') }}</th><th>{{ t('response') }}</th><th>{{ t('error') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in checks" :key="c.id" :class="{ down: !isUp(c) }">
            <td>{{ new Date(c.created_at + 'Z').toLocaleString() }}</td>
            <td><StatusBadge :is-up="isUp(c)" :show-text="true" /></td>
            <td>{{ c.status_code }} / {{ c.response_time_ms }}ms</td>
            <td>{{ c.error || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.detail-page { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
.back-btn {
  font-size: 0.9rem; padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border); border-radius: 0.25rem; cursor: pointer;
  background: var(--color-background); color: var(--color-text); margin-bottom: 1rem;
}
h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--color-heading); }
.info { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: center; font-size: 0.9rem; margin-bottom: 0.5rem; }
.info a { color: var(--color-text); word-break: break-all; }
.uptime { margin-bottom: 1rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; }
tr.down { background: rgba(255,0,0,0.05); }
</style>
