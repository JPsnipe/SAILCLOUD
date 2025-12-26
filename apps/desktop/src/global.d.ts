import type { SailcloudApi } from './shared/ipc'

declare global {
  interface Window {
    sailcloud: SailcloudApi
  }
}

export {}

