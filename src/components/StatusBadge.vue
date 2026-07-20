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
.up .dot { background: #22c55e; }
.down .dot { background: #ef4444; }
.up { color: #22c55e; }
.down { color: #ef4444; }
</style>
