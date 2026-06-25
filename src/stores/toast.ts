import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ToastItem {
  id: number
  message: string
  type: 'info' | 'error' | 'success'
}

let seq = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function show(message: string, type: ToastItem['type'] = 'info', durationMs = 3500) {
    const id = seq++
    items.value.push({ id, message, type })
    setTimeout(() => dismiss(id), durationMs)
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, show, dismiss }
})
