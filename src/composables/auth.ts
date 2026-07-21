import { ref } from 'vue'

const token = ref(localStorage.getItem('auth_token') || '')
const username = ref(localStorage.getItem('auth_username') || '')
const role = ref(localStorage.getItem('auth_role') || '')

export function useAuth() {
  async function login(u: string, p: string): Promise<string | null> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    const data = await res.json()
    if (!res.ok) return data.error || 'Login failed'
    token.value = data.token
    username.value = data.username
    role.value = data.role || ''
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_username', data.username)
    localStorage.setItem('auth_role', data.role || '')
    return null
  }

  async function register(u: string, p: string): Promise<string | null> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    const data = await res.json()
    if (!res.ok) return data.error || 'Registration failed'
    return null
  }

  async function logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
    })
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_role')
  }

  async function checkAuth(): Promise<boolean> {
    if (!token.value) return false
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token.value}` } })
      if (!res.ok) { logout(); return false }
      const data = await res.json()
      role.value = data.role || ''
      localStorage.setItem('auth_role', data.role || '')
      return true
    } catch { return false }
  }

  async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<string | null> {
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.value}` },
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    if (!res.ok) {
      const data = await res.json()
      return data.error || 'Failed'
    }
    return null
  }

  return { token, username, role, login, register, logout, checkAuth, changeOwnPassword }
}
