/**
 * Unit tests for lib/sanitize.ts — spam detection + profanity filter.
 */

import { describe, it, expect } from "vitest"
import {
  isSpamMessage,
  containsProfanity,
  maskProfanity,
  sanitizeText,
} from "@/lib/sanitize"

describe("isSpamMessage", () => {
  it("does NOT flag normal hype chat (all caps)", () => {
    expect(isSpamMessage("LFG WE WON BIG TONIGHT")).toBe(false)
  })

  it("does NOT flag short repeated phrases", () => {
    expect(isSpamMessage("let's go let's go let's go")).toBe(false)
  })

  it("does NOT flag mild character stretching", () => {
    expect(isSpamMessage("soooo close")).toBe(false)
    expect(isSpamMessage("gooooal")).toBe(false)
  })

  it("flags excessive character repetition", () => {
    expect(isSpamMessage("aaaaaaaaaaaaa")).toBe(true)
    expect(isSpamMessage("!!!!!!!!!!!!!!")).toBe(true)
  })

  it("flags long keyboard mashing with no spaces", () => {
    expect(isSpamMessage("asdkfjaslkdfjaslkdfjaslkdfjaslkdfjasldkfj")).toBe(true)
  })

  it("flags long single-token word flooding", () => {
    expect(isSpamMessage("buy buy buy buy buy buy buy buy")).toBe(true)
  })

  it("flags more than two URLs", () => {
    expect(isSpamMessage("visit https://a.com https://b.com https://c.com")).toBe(true)
  })

  it("does NOT flag a message with a single link", () => {
    expect(isSpamMessage("check this out https://example.com")).toBe(false)
  })

  it("does NOT flag ordinary sentences", () => {
    expect(isSpamMessage("I think the over hits tonight, defense is banged up")).toBe(false)
  })
})

describe("containsProfanity", () => {
  it("detects plain profanity", () => {
    expect(containsProfanity("this is fucking great")).toBe(true)
    expect(containsProfanity("what the shit")).toBe(true)
  })

  it("detects leetspeak / obfuscated profanity", () => {
    expect(containsProfanity("sh1t")).toBe(true)
    expect(containsProfanity("f@ck")).toBe(true)
    expect(containsProfanity("b1tch")).toBe(true)
  })

  it("detects separator-censored profanity", () => {
    expect(containsProfanity("f-u-c-k")).toBe(true)
    expect(containsProfanity("s.h.i.t")).toBe(true)
  })

  it("detects stretched profanity", () => {
    expect(containsProfanity("fuuuuck")).toBe(true)
  })

  it("does NOT false-positive on clean words containing substrings", () => {
    expect(containsProfanity("class assignment")).toBe(false)
    expect(containsProfanity("assist the passage")).toBe(false)
    expect(containsProfanity("Scunthorpe United")).toBe(false)
    expect(containsProfanity("cockpit")).toBe(false)
  })

  it("returns false for empty input", () => {
    expect(containsProfanity("")).toBe(false)
  })
})

describe("maskProfanity", () => {
  it("masks profanity with asterisks of the same length", () => {
    expect(maskProfanity("this is shit")).toBe("this is ****")
  })

  it("preserves surrounding text", () => {
    const out = maskProfanity("what the fuck man")
    expect(out).toBe("what the **** man")
  })

  it("masks multiple occurrences", () => {
    const out = maskProfanity("shit shit shit")
    expect(out).toBe("**** **** ****")
  })

  it("leaves clean text unchanged", () => {
    expect(maskProfanity("great game tonight")).toBe("great game tonight")
  })

  it("masks obfuscated variants", () => {
    expect(maskProfanity("sh1t").includes("*")).toBe(true)
  })
})

describe("sanitizeText + profanity flow", () => {
  it("masking runs after HTML strip + whitespace collapse", () => {
    const clean = sanitizeText("<b>what   the  shit</b>", 1000)
    expect(maskProfanity(clean)).toBe("what the ****")
  })
})
