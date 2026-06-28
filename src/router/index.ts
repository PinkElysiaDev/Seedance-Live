import { createRouter, createWebHistory } from 'vue-router'
import WorkbenchView from '../views/WorkbenchView.vue'
import HistoryView from '../views/HistoryView.vue'
import SettingsView from '../views/SettingsView.vue'
import LogsView from '../views/LogsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workbench',
      component: WorkbenchView
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView
    },
    {
      path: '/logs',
      name: 'logs',
      component: LogsView
    }
  ]
})

export default router
