<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuth } from './composables/auth'
import { useI18n } from './composables/i18n'

const { token, username, role, logout } = useAuth()
const { locale, t, setLocale } = useI18n()
const router = useRouter()

async function onLogout() {
  await logout()
  router.push('/status')
}
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/status">{{ t('status') }}</RouterLink>
      <template v-if="token">
        <RouterLink v-if="role === 'admin'" to="/admin">{{ t('admin') }}</RouterLink>
        <span class="user">{{ username }}</span>
        <a href="#" class="logout" @click.prevent="onLogout">{{ t('logout') }}</a>
      </template>
      <template v-else>
        <RouterLink to="/login">{{ t('login') }}</RouterLink>
      </template>
      <span class="locale-switch">
        <a href="#" :class="{ active: locale === 'zh' }" @click.prevent="setLocale('zh')">中文</a>
        <a href="#" :class="{ active: locale === 'en' }" @click.prevent="setLocale('en')">EN</a>
      </span>
    </nav>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  border-bottom: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
}
nav {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  gap: 1rem;
  align-items: center;
}
nav a {
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.95rem;
  padding: 0.25rem 0;
}
nav a.router-link-exact-active {
  color: var(--color-heading);
  font-weight: 600;
}
.user { font-size: 0.85rem; color: var(--color-heading); margin-left: auto; }
.logout { font-size: 0.85rem; }
.locale-switch { margin-left: 0.5rem; display: flex; gap: 0.5rem; }
.locale-switch a { font-size: 0.8rem; opacity: 0.5; }
.locale-switch a.active { opacity: 1; font-weight: 600; }
</style>
