import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

export const configured =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.startsWith('eyJ')

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// 6-char TOTP-style code from session secret + 12s time window.
// MUST match the server-side logic in checkin() (supabase-setup.sql).
export const currentWindow = () => Math.floor(Date.now() / 1000 / 12)

export async function totpCode(secret, win) {
  const data = new TextEncoder().encode(`${secret}:${win}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 6)
    .toUpperCase()
}
