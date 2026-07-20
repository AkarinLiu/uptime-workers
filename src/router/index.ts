import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/status',
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('../views/StatusView.vue'),
    },
    {
      path: '/status/:slug',
      name: 'status-detail',
      component: () => import('../views/StatusView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/monitors/:id',
      name: 'monitor-detail',
      component: () => import('../views/MonitorDetailView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { useAuth } = await import('../composables/auth')
    const { checkAuth, role, logout } = useAuth()
    const ok = await checkAuth()
    if (!ok) return { name: 'login', query: { redirect: to.fullPath } }
    if (role.value !== 'admin') {
      await logout()
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }
})

export default router
