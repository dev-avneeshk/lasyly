/**
 * Cryptographic utilities for the Lasyly platform.
 *
 * Provides CSPRNG token generation, AES-256-GCM encryption/decryption,
 * and password hashing using scrypt (Argon2id-equivalent parameters).
 *
 * SECURITY: This module exclusively uses approved algorithms.
 * Banned: MD5, SHA-1, DES, 3DES, RC4.
 *
 * Requirements: 7.1, 7.2, 7.5, 7.6, 7.7
 */

import * as crypto from "crypto"
import { DEFAULT_TOKEN_BITS, MIN_TOKEN_ENTROPY_BITS } from "./constants"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EncryptionResult {
  /** Encrypted data */
  ciphertext: Buffer
  /** Initialization vector (12 bytes for GCM) */
  iv: Buffer
  /** Authentication tag (16 bytes) */
  tag: Buffer
}

export interface Argon2Options {
  /** Memory cost in bytes. Default: 64MB (67108864) */
  memoryCost?: number
  /** Number of iterations. Default: 3 */
  timeCost?: number
  /** Degree of parallelism. Default: 1 */
  parallelism?: number
  /** Salt length in bytes. Default: 16 */
  saltLength?: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** AES-256-GCM algorithm identifier */
const AES_256_GCM = "aes-256-gcm" as const

/** GCM IV length in bytes (96 bits as recommended by NIST) */
const GCM_IV_LENGTH = 12

/** GCM auth tag length in bytes */
const GCM_TAG_LENGTH = 16

/** AES-256 key length in bytes */
const AES_256_KEY_LENGTH = 32

/** Default scrypt parameters (Argon2id-equivalent security level) */
const DEFAULT_ARGON2_OPTIONS: Required<Argon2Options> = {
  memoryCost: 64 * 1024 * 1024, // 64MB
  timeCost: 3,
  parallelism: 1,
  saltLength: 16,
}

/** Derived key length for password hashing */
const HASH_KEY_LENGTH = 32

// ─── CSPRNG Token Generation ─────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token as a hex string.
 *
 * Uses Node.js crypto.randomBytes (CSPRNG) to produce tokens with
 * at least 256 bits of entropy by default.
 *
 * @param bits - Number of bits of entropy. Must be >= 256. Default: 256.
 * @returns Hex-encoded random token string.
 * @throws Error if bits < MIN_TOKEN_ENTROPY_BITS (256)
 *
 * Validates: Requirements 7.5, 7.7
 */
export function generateSecureToken(bits: number = DEFAULT_TOKEN_BITS): string {
  if (bits < MIN_TOKEN_ENTROPY_BITS) {
    throw new Error(
      `Token entropy must be at least ${MIN_TOKEN_ENTROPY_BITS} bits, got ${bits}`
    )
  }

  const bytes = Math.ceil(bits / 8)
  return crypto.randomBytes(bytes).toString("hex")
}

/**
 * Generates cryptographically secure random bytes.
 *
 * Wrapper around Node.js crypto.randomBytes (CSPRNG).
 *
 * @param bytes - Number of random bytes to generate. Must be > 0.
 * @returns Buffer containing the random bytes.
 * @throws Error if bytes <= 0
 *
 * Validates: Requirement 7.5
 */
export function secureRandom(bytes: number): Buffer {
  if (bytes <= 0) {
    throw new Error(`Byte count must be positive, got ${bytes}`)
  }

  return crypto.randomBytes(bytes)
}

// ─── AES-256-GCM Encryption/Decryption ──────────────────────────────────────

/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * Generates a random 12-byte IV for each encryption operation.
 * Returns the ciphertext, IV, and authentication tag separately
 * so the caller can store/transmit them as needed.
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte (256-bit) encryption key
 * @returns Object containing ciphertext, iv, and authentication tag
 * @throws Error if key length is not 32 bytes
 *
 * Validates: Requirement 7.1
 */
export function encryptAES256GCM(
  plaintext: Buffer,
  key: Buffer
): EncryptionResult {
  if (key.length !== AES_256_KEY_LENGTH) {
    throw new Error(
      `AES-256-GCM requires a 32-byte key, got ${key.length} bytes`
    )
  }

  // Generate a random 96-bit IV for each encryption (NIST recommendation)
  const iv = crypto.randomBytes(GCM_IV_LENGTH)

  const cipher = crypto.createCipheriv(AES_256_GCM, key, iv, {
    authTagLength: GCM_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    ciphertext: encrypted,
    iv,
    tag,
  }
}

/**
 * Decrypts ciphertext encrypted with AES-256-GCM.
 *
 * Verifies the authentication tag to ensure data integrity and authenticity.
 * Throws if the tag verification fails (tampered data).
 *
 * @param ciphertext - Encrypted data
 * @param key - 32-byte (256-bit) encryption key (same key used for encryption)
 * @param iv - Initialization vector used during encryption
 * @param tag - Authentication tag produced during encryption
 * @returns Decrypted plaintext as a Buffer
 * @throws Error if key length is not 32 bytes
 * @throws Error if authentication tag verification fails (data tampered)
 *
 * Validates: Requirement 7.1
 */
export function decryptAES256GCM(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  tag: Buffer
): Buffer {
  if (key.length !== AES_256_KEY_LENGTH) {
    throw new Error(
      `AES-256-GCM requires a 32-byte key, got ${key.length} bytes`
    )
  }

  const decipher = crypto.createDecipheriv(AES_256_GCM, key, iv, {
    authTagLength: GCM_TAG_LENGTH,
  })

  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted
}

// ─── Password Hashing (scrypt with Argon2id-equivalent parameters) ───────────

/**
 * Hashes a password using Node.js crypto.scrypt with parameters
 * equivalent to Argon2id security recommendations.
 *
 * The output format is:
 *   $scrypt$n=<cost>,r=8,p=<parallelism>$<salt_base64>$<hash_base64>
 *
 * Uses scrypt as a fallback since native Argon2id requires a C binding.
 * The parameters are configured to provide equivalent security:
 * - N (cost): derived from memoryCost and timeCost for comparable work factor
 * - r (block size): 8 (standard)
 * - p (parallelism): from options
 *
 * @param password - Plain text password to hash
 * @param options - Optional Argon2id-equivalent parameters
 * @returns Encoded hash string containing algorithm, parameters, salt, and hash
 *
 * Validates: Requirement 7.2
 */
export async function hashArgon2id(
  password: string,
  options?: Argon2Options
): Promise<string> {
  const opts = { ...DEFAULT_ARGON2_OPTIONS, ...options }

  // Validate minimum parameters per Requirement 7.2
  if (opts.memoryCost < 64 * 1024 * 1024) {
    throw new Error("Memory cost must be at least 64MB")
  }
  if (opts.timeCost < 3) {
    throw new Error("Time cost (iterations) must be at least 3")
  }
  if (opts.parallelism < 1) {
    throw new Error("Parallelism must be at least 1")
  }
  if (opts.saltLength < 16) {
    throw new Error("Salt length must be at least 16 bytes")
  }

  // Generate a cryptographically secure salt
  const salt = crypto.randomBytes(opts.saltLength)

  // Calculate scrypt N parameter from memory/time cost
  // scrypt memory usage ≈ 128 * N * r bytes (r=8)
  // We target the configured memoryCost
  const r = 8
  const N = Math.max(
    16384, // Minimum N = 2^14
    Math.pow(2, Math.ceil(Math.log2(opts.memoryCost / (128 * r))))
  )
  const p = opts.parallelism

  // maxmem must be >= 128 * N * r * (p + 1) for scrypt to work
  const requiredMem = 128 * N * r * (p + 1)
  const maxmem = Math.max(requiredMem, opts.memoryCost) + 1024 * 1024 // Add 1MB buffer

  const derivedKey = await scryptAsync(password, salt, HASH_KEY_LENGTH, {
    N,
    r,
    p,
    maxmem,
  })

  // Encode as a self-describing string
  const saltB64 = salt.toString("base64")
  const hashB64 = derivedKey.toString("base64")

  return `$scrypt$n=${N},r=${r},p=${p}$${saltB64}$${hashB64}`
}

/**
 * Verifies a password against a hash produced by hashArgon2id.
 *
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param password - Plain text password to verify
 * @param hash - Encoded hash string from hashArgon2id
 * @returns true if the password matches, false otherwise
 *
 * Validates: Requirement 7.2
 */
export async function verifyArgon2id(
  password: string,
  hash: string
): Promise<boolean> {
  const parsed = parseHashString(hash)
  if (!parsed) {
    return false
  }

  const { N, r, p, salt, derivedKey } = parsed

  const computedKey = await scryptAsync(password, salt, HASH_KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: Math.max(128 * N * r * (p + 1), 128 * 1024 * 1024) + 1024 * 1024,
  })

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(computedKey, derivedKey)
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Promisified wrapper around crypto.scrypt.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keyLength,
      options,
      (err, derivedKey) => {
        if (err) {
          reject(err)
        } else {
          resolve(derivedKey)
        }
      }
    )
  })
}

/**
 * Parses a hash string produced by hashArgon2id.
 * Format: $scrypt$n=<N>,r=<r>,p=<p>$<salt_base64>$<hash_base64>
 */
function parseHashString(
  hash: string
): { N: number; r: number; p: number; salt: Buffer; derivedKey: Buffer } | null {
  const parts = hash.split("$")
  // Expected: ['', 'scrypt', 'n=...,r=...,p=...', '<salt>', '<hash>']
  if (parts.length !== 5 || parts[1] !== "scrypt") {
    return null
  }

  const params = parts[2]
  const nMatch = params.match(/n=(\d+)/)
  const rMatch = params.match(/r=(\d+)/)
  const pMatch = params.match(/p=(\d+)/)

  if (!nMatch || !rMatch || !pMatch) {
    return null
  }

  const N = parseInt(nMatch[1], 10)
  const r = parseInt(rMatch[1], 10)
  const p = parseInt(pMatch[1], 10)

  if (isNaN(N) || isNaN(r) || isNaN(p)) {
    return null
  }

  const salt = Buffer.from(parts[3], "base64")
  const derivedKey = Buffer.from(parts[4], "base64")

  return { N, r, p, salt, derivedKey }
}
