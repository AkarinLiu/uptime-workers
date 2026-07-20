<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/auth'
import { useI18n } from '../composables/i18n'

const router = useRouter()
const { login, register } = useAuth()
const { t } = useI18n()

const isRegister = ref(false)
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value || !password.value) {
    error.value = t('pleaseFillAll')
    return
  }
  loading.value = true
  error.value = ''
  try {
    const err = isRegister.value
      ? await register(username.value, password.value)
      : await login(username.value, password.value)
    if (err) {
      error.value = err
    } else if (isRegister.value) {
      isRegister.value = false
      error.value = ''
    } else {
      router.push('/admin')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form @submit.prevent="submit">
      <h2>{{ isRegister ? t('register') : t('login') }}</h2>
      <div v-if="error" class="form-error">{{ error }}</div>
      <label>{{ t('username') }}<input v-model="username" type="text" autocomplete="username" /></label>
      <label>{{ t('password') }}<input v-model="password" type="password" autocomplete="current-password" /></label>
      <button type="submit" :disabled="loading">{{ loading ? '...' : (isRegister ? t('register') : t('login')) }}</button>
      <p class="toggle">
        <a href="#" @click.prevent="isRegister = !isRegister; error = ''">
          {{ isRegister ? t('alreadyHaveAccount') : t('noAccount') }}
        </a>
      </p>
    </form>
  </div>
</template>

<style scoped>
.login-page { max-width: 380px; margin: 4rem auto; padding: 0 1rem; }
h2 { margin-bottom: 1rem; color: var(--color-heading); }
label { display: block; margin-bottom: 0.75rem; font-size: 0.85rem; color: var(--color-heading); }
input { display: block; width: 100%; margin-top: 0.2rem; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: 0.25rem; background: var(--color-background-soft); color: var(--color-heading); font-size: 0.95rem; }
button { width: 100%; padding: 0.6rem; background: hsla(160, 100%, 37%, 1); color: #fff; border: 0; border-radius: 0.25rem; cursor: pointer; font-size: 0.95rem; margin-top: 0.5rem; }
button:disabled { opacity: 0.6; cursor: default; }
.toggle { text-align: center; margin-top: 1rem; font-size: 0.85rem; }
.toggle a { color: var(--color-text); }
.form-error { color: #c00; font-size: 0.85rem; margin-bottom: 0.75rem; }
</style>
