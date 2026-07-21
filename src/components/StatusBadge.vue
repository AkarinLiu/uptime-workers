<script setup lang="ts">
defineProps<{ isUp: boolean; showText?: boolean }>()
</script>

<template>
  <span class="badge" :class="{ up: isUp, down: !isUp }">
    <span class="dot"></span>
    {{ showText ? (isUp ? 'Up' : 'Down') : '' }}
  </span>
</template>

<style scoped>
.badge { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; }
.dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; display: inline-block; }
.up .dot { background: #22c55e; animation: pulse-up 2s ease-in-out infinite; }
.down .dot { background: #ef4444; animation: pulse-down 1s ease-in-out infinite; }
.up { color: #22c55e; }
.down { color: #ef4444; }

@keyframes pulse-up {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
}
@keyframes pulse-down {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); opacity: 1; }
  50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); opacity: 0.6; }
}
</style>
