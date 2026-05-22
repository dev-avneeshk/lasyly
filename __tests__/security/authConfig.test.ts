import { describe, it, expect } from 'vitest'
import {
  AUTH_COOKIE_OPTIONS,
  TOKEN_LIFETIMES,
  getAuthCookiesToClear,
  SUPABASE_AUTH_COOKIE_PREFIX,
} from '@/lib/supabase/auth-config'

describe('Auth Cookie Configuration', () => {
  it('should not set httpOnly (Supabase SSR needs client-side cookie access)', () => {
    expect(AUTH_COOKIE_OPTIONS).not.toHaveProperty('httpOnly')
  })

  it('should set sameSite to lax (required for OAuth redirect flows)', () => {
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBe('lax')
  })

  it('should set path to /', () => {
    expect(AUTH_COOKIE_OPTIONS.path).toBe('/')
  })

  it('should have secure flag based on environment', () => {
    // In test environment, NODE_ENV is 'test', so secure should be false
    // In production, it would be true
    expect(typeof AUTH_COOKIE_OPTIONS.secure).toBe('boolean')
  })
})

describe('Token Lifetimes', () => {
  it('should configure access token expiry to 15 minutes (900 seconds)', () => {
    expect(TOKEN_LIFETIMES.accessTokenExpirySeconds).toBe(900)
  })

  it('should configure refresh token expiry to 7 days (604800 seconds)', () => {
    expect(TOKEN_LIFETIMES.refreshTokenExpirySeconds).toBe(604800)
  })
})

describe('getAuthCookiesToClear', () => {
  it('should filter cookies with Supabase auth prefix', () => {
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-auth-token.0',
      'sb-auth-token.1',
      'lasyly_guest',
      'other_cookie',
    ]

    const result = getAuthCookiesToClear(cookieNames)

    expect(result).toEqual([
      'sb-access-token',
      'sb-refresh-token',
      'sb-auth-token.0',
      'sb-auth-token.1',
    ])
  })

  it('should return empty array when no auth cookies present', () => {
    const cookieNames = ['lasyly_guest', 'other_cookie', '_ga']
    const result = getAuthCookiesToClear(cookieNames)
    expect(result).toEqual([])
  })

  it('should handle empty cookie list', () => {
    const result = getAuthCookiesToClear([])
    expect(result).toEqual([])
  })

  it('should use the correct prefix', () => {
    expect(SUPABASE_AUTH_COOKIE_PREFIX).toBe('sb-')
  })
})
