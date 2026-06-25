import type { ProviderProfile } from '@/types'
import { seedanceProvider } from './seedanceProvider'
import { customProvider } from './customProvider'
import type { VideoProvider } from './types'

export function resolveProvider(profile: ProviderProfile): VideoProvider {
  return profile.kind === 'seedance' ? seedanceProvider : customProvider
}
