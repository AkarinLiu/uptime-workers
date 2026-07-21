<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useI18n } from '../composables/i18n'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const RANGES = ['1h', '6h', '24h', '7d', '30d'] as const

const props = defineProps<{
  checks: Array<{ created_at: string; response_time_ms: number | null; status_code: number | null; error: string | null }>
  uptimePct: number | null
}>()

const emit = defineEmits<{
  'range-change': [range: string]
}>()

const selectedRange = defineModel<string>({ default: '24h' })
const { t } = useI18n()

function formatTime(ts: string, range: string): string {
  const d = new Date(ts + 'Z')
  if (range === '1h' || range === '6h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )
}

function pointColor(c: typeof props.checks[number]): string {
  if (c.error) return '#ef4444'
  if (c.status_code == null) return '#9ca3af'
  if (c.status_code >= 500) return '#ef4444'
  if (c.status_code >= 400) return '#f59e0b'
  if (c.status_code >= 300) return '#6b7280'
  return '#22c55e'
}

const chartData = computed(() => ({
  labels: props.checks.map((c) => formatTime(c.created_at, selectedRange.value)),
  datasets: [
    {
      data: props.checks.map((c) => c.response_time_ms ?? null),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      pointBackgroundColor: props.checks.map((c) => pointColor(c)),
      pointRadius: 2,
      pointHoverRadius: 5,
      spanGaps: true,
      fill: true,
      tension: 0.15,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: any[]) => items[0]?.label ?? '',
        label: (ctx: any) => {
          const c = props.checks[ctx.dataIndex]
          if (!c) return ''
          if (c.error) return `Error: ${c.error}`
          return `${c.status_code} / ${c.response_time_ms}ms`
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { maxTicksLimit: 15, maxRotation: 0, font: { size: 10 } },
      grid: { display: false },
    },
    y: {
      beginAtZero: true,
      ticks: { font: { size: 10 }, callback: (v: string | number) => `${v}ms` },
      grid: { color: 'rgba(128,128,128,0.1)' },
    },
  },
}))

function selectRange(r: string) {
  selectedRange.value = r
  emit('range-change', r)
}
</script>

<template>
  <div class="chart-wrap">
    <div class="chart-toolbar">
      <div class="range-btns">
        <button
          v-for="r in RANGES"
          :key="r"
          :class="{ active: selectedRange === r }"
          @click="selectRange(r)"
        >
          {{ r }}
        </button>
      </div>
      <span v-if="uptimePct != null" class="uptime">
        {{ t('uptimeOverall') }}: <strong>{{ uptimePct }}%</strong>
      </span>
    </div>
    <div v-if="checks.length" class="chart-container">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="no-data">{{ t('noData') }}</div>
  </div>
</template>

<style scoped>
.chart-wrap { margin-bottom: 1rem; }
.chart-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;
}
.range-btns { display: flex; gap: 0.25rem; }
.range-btns button {
  padding: 0.2rem 0.6rem; font-size: 0.8rem;
  border: 1px solid var(--color-border); border-radius: 0.25rem;
  background: var(--color-background); color: var(--color-text);
  cursor: pointer;
}
.range-btns button:hover { background: var(--color-background-soft); }
.range-btns button.active {
  background: hsla(160, 100%, 37%, 1); color: #fff; border-color: hsla(160, 100%, 37%, 1);
}
.uptime { font-size: 0.85rem; color: var(--color-text); }
.chart-container { position: relative; height: 300px; }
.no-data { text-align: center; color: var(--color-text); padding: 2rem; font-size: 0.9rem; }
</style>
