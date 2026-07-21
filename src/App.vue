<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuth } from './composables/auth'
import { useI18n } from './composables/i18n'

const { token, username, role, logout, changeOwnPassword } = useAuth()
const { locale, t, setLocale } = useI18n()
const router = useRouter()

const showPwForm = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const pwError = ref('')

async function onSubmitPassword() {
  const err = await changeOwnPassword(oldPassword.value, newPassword.value)
  if (err) { pwError.value = err; return }
  showPwForm.value = false
  oldPassword.value = ''
  newPassword.value = ''
  pwError.value = ''
}

function openPwForm() {
  oldPassword.value = ''
  newPassword.value = ''
  pwError.value = ''
  showPwForm.value = true
}

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
        <a href="#" @click.prevent="openPwForm">{{ t('myPassword') }}</a>
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

  <div v-if="showPwForm" class="modal-overlay" @click.self="showPwForm = false">
    <div class="modal">
      <h3>{{ t('changePassword') }}</h3>
      <label>{{ t('oldPassword') }}<input v-model="oldPassword" type="password" /></label>
      <label>{{ t('newPassword') }}<input v-model="newPassword" type="password" /></label>
      <p v-if="pwError" class="pw-error">{{ pwError }}</p>
      <div class="form-actions">
        <button class="save-btn" @click="onSubmitPassword">{{ t('save') }}</button>
        <button @click="showPwForm = false">{{ t('cancel') }}</button>
      </div>
    </div>
  </div>
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
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: var(--color-background); padding: 1.5rem; border-radius: 0.5rem;
  min-width: 320px; max-width: 400px;
}
.modal h3 { margin: 0 0 1rem; color: var(--color-heading); font-size: 1.1rem; }
.modal label {
  display: block; margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--color-heading);
}
.modal input {
  display: block; width: 100%; margin-top: 0.2rem; padding: 0.4rem;
  border: 1px solid var(--color-border); border-radius: 0.25rem;
  background: var(--color-background-soft); color: var(--color-heading); font-size: 0.9rem;
}
.pw-error { color: #c00; font-size: 0.85rem; margin: 0 0 0.5rem; }
.form-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.form-actions button {
  padding: 0.4rem 0.8rem; border: 1px solid var(--color-border); border-radius: 0.25rem;
  cursor: pointer; font-size: 0.85rem; background: var(--color-background); color: var(--color-text);
}
.form-actions .save-btn { background: hsla(160, 100%, 37%, 1); color: #fff; border-color: transparent; }
</style>
