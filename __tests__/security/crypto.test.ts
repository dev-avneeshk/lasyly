import { describe, it, expect } from "vitest"
import {
  generateSecureToken,
  secureRandom,
  encryptAES256GCM,
  decryptAES256GCM,
  hashArgon2id,
  verifyArgon2id,
} from "@/lib/security/crypto"
import * as crypto from "crypto"

describe("Crypto Module", () => {
  describe("generateSecureToken", () => {
    it("generates a hex token with default 256 bits (64 hex chars)", () => {
      const token = generateSecureToken()
      expect(token).toHaveLength(64) // 256 bits = 32 bytes = 64 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/)
    })

    it("generates a token with custom bit length", () => {
      const token = generateSecureToken(512)
      expect(token).toHaveLength(128) // 512 bits = 64 bytes = 128 hex chars
      expect(token).toMatch(/^[0-9a-f]+$/)
    })

    it("throws if bits < 256", () => {
      expect(() => generateSecureToken(128)).toThrow(
        "Token entropy must be at least 256 bits"
      )
    })

    it("generates unique tokens on each call", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()))
      expect(tokens.size).toBe(100)
    })
  })

  describe("secureRandom", () => {
    it("generates the requested number of bytes", () => {
      const buf = secureRandom(32)
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.length).toBe(32)
    })

    it("generates different values on each call", () => {
      const a = secureRandom(16)
      const b = secureRandom(16)
      expect(a.equals(b)).toBe(false)
    })

    it("throws if bytes <= 0", () => {
      expect(() => secureRandom(0)).toThrow("Byte count must be positive")
      expect(() => secureRandom(-1)).toThrow("Byte count must be positive")
    })
  })

  describe("encryptAES256GCM / decryptAES256GCM", () => {
    const key = crypto.randomBytes(32)

    it("encrypts and decrypts a message correctly (round-trip)", () => {
      const plaintext = Buffer.from("Hello, Lasyly!")
      const { ciphertext, iv, tag } = encryptAES256GCM(plaintext, key)

      const decrypted = decryptAES256GCM(ciphertext, key, iv, tag)
      expect(decrypted.equals(plaintext)).toBe(true)
    })

    it("produces different ciphertext for the same plaintext (random IV)", () => {
      const plaintext = Buffer.from("Same message")
      const result1 = encryptAES256GCM(plaintext, key)
      const result2 = encryptAES256GCM(plaintext, key)

      expect(result1.ciphertext.equals(result2.ciphertext)).toBe(false)
      expect(result1.iv.equals(result2.iv)).toBe(false)
    })

    it("returns a 12-byte IV and 16-byte tag", () => {
      const plaintext = Buffer.from("test")
      const { iv, tag } = encryptAES256GCM(plaintext, key)

      expect(iv.length).toBe(12)
      expect(tag.length).toBe(16)
    })

    it("throws on invalid key length", () => {
      const shortKey = crypto.randomBytes(16)
      const plaintext = Buffer.from("test")

      expect(() => encryptAES256GCM(plaintext, shortKey)).toThrow(
        "AES-256-GCM requires a 32-byte key"
      )
    })

    it("throws on tampered ciphertext", () => {
      const plaintext = Buffer.from("sensitive data")
      const { ciphertext, iv, tag } = encryptAES256GCM(plaintext, key)

      // Tamper with ciphertext
      ciphertext[0] ^= 0xff

      expect(() => decryptAES256GCM(ciphertext, iv, key, tag)).toThrow()
    })

    it("throws on tampered tag", () => {
      const plaintext = Buffer.from("sensitive data")
      const { ciphertext, iv, tag } = encryptAES256GCM(plaintext, key)

      // Tamper with tag
      const tamperedTag = Buffer.from(tag)
      tamperedTag[0] ^= 0xff

      expect(() =>
        decryptAES256GCM(ciphertext, key, iv, tamperedTag)
      ).toThrow()
    })

    it("handles empty plaintext", () => {
      const plaintext = Buffer.alloc(0)
      const { ciphertext, iv, tag } = encryptAES256GCM(plaintext, key)

      const decrypted = decryptAES256GCM(ciphertext, key, iv, tag)
      expect(decrypted.length).toBe(0)
    })
  })

  describe("hashArgon2id / verifyArgon2id", () => {
    it("hashes a password and verifies it correctly", async () => {
      const password = "MySecureP@ssw0rd!"
      const hash = await hashArgon2id(password)

      expect(hash).toMatch(/^\$scrypt\$/)
      expect(await verifyArgon2id(password, hash)).toBe(true)
    })

    it("rejects incorrect passwords", async () => {
      const hash = await hashArgon2id("correct-password")
      expect(await verifyArgon2id("wrong-password", hash)).toBe(false)
    })

    it("produces different hashes for the same password (random salt)", async () => {
      const password = "same-password"
      const hash1 = await hashArgon2id(password)
      const hash2 = await hashArgon2id(password)

      expect(hash1).not.toBe(hash2)
    })

    it("hash format contains algorithm, params, salt, and key", async () => {
      const hash = await hashArgon2id("test")
      const parts = hash.split("$")

      expect(parts[0]).toBe("") // leading $
      expect(parts[1]).toBe("scrypt")
      expect(parts[2]).toMatch(/n=\d+,r=\d+,p=\d+/)
      expect(parts[3].length).toBeGreaterThan(0) // salt
      expect(parts[4].length).toBeGreaterThan(0) // hash
    })

    it("throws if memory cost is below 64MB", async () => {
      await expect(
        hashArgon2id("test", { memoryCost: 1024 })
      ).rejects.toThrow("Memory cost must be at least 64MB")
    })

    it("throws if time cost is below 3", async () => {
      await expect(
        hashArgon2id("test", { timeCost: 1 })
      ).rejects.toThrow("Time cost (iterations) must be at least 3")
    })

    it("throws if parallelism is below 1", async () => {
      await expect(
        hashArgon2id("test", { parallelism: 0 })
      ).rejects.toThrow("Parallelism must be at least 1")
    })

    it("throws if salt length is below 16", async () => {
      await expect(
        hashArgon2id("test", { saltLength: 8 })
      ).rejects.toThrow("Salt length must be at least 16 bytes")
    })

    it("returns false for malformed hash strings", async () => {
      expect(await verifyArgon2id("test", "not-a-valid-hash")).toBe(false)
      expect(await verifyArgon2id("test", "$bcrypt$something")).toBe(false)
      expect(await verifyArgon2id("test", "")).toBe(false)
    })
  })
})
