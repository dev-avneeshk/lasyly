/**
 * Unit tests for lib/security/inputValidator.ts
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  validateBody,
  rejectInjectionPatterns,
  rejectPathTraversal,
  rejectHTMLContent,
  enforceBodySize,
  encodeHTML,
  decodeHTML,
  validateFilename,
} from "@/lib/security/inputValidator"

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().max(255),
    age: z.number().int().positive(),
  })

  it("returns success with parsed data for valid input", () => {
    const result = validateBody({ name: "Alice", age: 30 }, schema)
    expect(result).toEqual({ success: true, data: { name: "Alice", age: 30 } })
  })

  it("returns field-level errors for invalid input", () => {
    const result = validateBody({ name: 123, age: -1 }, schema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.length).toBeGreaterThan(0)
      expect(result.error[0]).toHaveProperty("field")
      expect(result.error[0]).toHaveProperty("constraint")
    }
  })

  it("returns error for missing required fields", () => {
    const result = validateBody({}, schema)
    expect(result.success).toBe(false)
  })

  it("returns error for completely wrong type", () => {
    const result = validateBody("not an object", schema)
    expect(result.success).toBe(false)
  })
})

describe("rejectInjectionPatterns", () => {
  it("rejects values containing $gt operator", () => {
    expect(rejectInjectionPatterns('{"$gt": 0}')).toBe(true)
  })

  it("rejects values containing $ne operator", () => {
    expect(rejectInjectionPatterns("$ne")).toBe(true)
  })

  it("rejects values containing $regex operator", () => {
    expect(rejectInjectionPatterns("field: { $regex: '.*' }")).toBe(true)
  })

  it("rejects values containing $where operator", () => {
    expect(rejectInjectionPatterns("$where: function() {}")).toBe(true)
  })

  it("rejects values containing $or operator", () => {
    expect(rejectInjectionPatterns('{"$or": []}' )).toBe(true)
  })

  it("rejects values containing $exists operator", () => {
    expect(rejectInjectionPatterns("$exists")).toBe(true)
  })

  it("accepts normal string values", () => {
    expect(rejectInjectionPatterns("hello world")).toBe(false)
  })

  it("accepts strings with dollar signs that are not operators", () => {
    expect(rejectInjectionPatterns("price is $50")).toBe(false)
  })

  it("is case-insensitive for operator detection", () => {
    expect(rejectInjectionPatterns("$GT")).toBe(true)
    expect(rejectInjectionPatterns("$Ne")).toBe(true)
  })
})

describe("rejectPathTraversal", () => {
  it("rejects paths with ../", () => {
    expect(rejectPathTraversal("../../etc/passwd")).toBe(true)
  })

  it("rejects paths with ..\\", () => {
    expect(rejectPathTraversal("..\\windows\\system32")).toBe(true)
  })

  it("rejects paths with %2e%2e (URL-encoded)", () => {
    expect(rejectPathTraversal("%2e%2e/etc/passwd")).toBe(true)
  })

  it("rejects paths with mixed case URL encoding", () => {
    expect(rejectPathTraversal("%2E%2e/secret")).toBe(true)
    expect(rejectPathTraversal("%2e%2E/secret")).toBe(true)
    expect(rejectPathTraversal("%2E%2E/secret")).toBe(true)
  })

  it("rejects paths with null bytes", () => {
    expect(rejectPathTraversal("file.txt\0.jpg")).toBe(true)
  })

  it("rejects paths with URL-encoded null bytes", () => {
    expect(rejectPathTraversal("file.txt%00.jpg")).toBe(true)
  })

  it("rejects double-encoded traversal patterns", () => {
    expect(rejectPathTraversal("%252e%252e/etc/passwd")).toBe(true)
  })

  it("accepts normal file paths", () => {
    expect(rejectPathTraversal("uploads/image.png")).toBe(false)
  })

  it("accepts paths with single dots", () => {
    expect(rejectPathTraversal("./file.txt")).toBe(false)
  })
})

describe("rejectHTMLContent", () => {
  it("rejects strings with HTML tags", () => {
    expect(rejectHTMLContent("<div>hello</div>", "bio")).toBe(true)
  })

  it("rejects strings with script tags", () => {
    expect(rejectHTMLContent("<script>alert('xss')</script>", "name")).toBe(true)
  })

  it("rejects strings with self-closing tags", () => {
    expect(rejectHTMLContent("<img src=x />", "avatar")).toBe(true)
  })

  it("rejects strings with script tag (no closing)", () => {
    expect(rejectHTMLContent("<script src='evil.js'>", "field")).toBe(true)
  })

  it("accepts plain text", () => {
    expect(rejectHTMLContent("Hello, world!", "name")).toBe(false)
  })

  it("accepts text with angle brackets that are not tags", () => {
    expect(rejectHTMLContent("5 > 3 and 2 < 4", "description")).toBe(false)
  })

  it("accepts text with ampersands", () => {
    expect(rejectHTMLContent("Tom & Jerry", "title")).toBe(false)
  })
})

describe("enforceBodySize", () => {
  it("returns true when content-length exceeds max", () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "2000000" },
    })
    expect(enforceBodySize(request, 1_000_000)).toBe(true)
  })

  it("returns false when content-length is within limit", () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "500" },
    })
    expect(enforceBodySize(request, 1_000_000)).toBe(false)
  })

  it("returns false when no content-length header is present", () => {
    const request = new Request("http://localhost", {
      method: "POST",
    })
    expect(enforceBodySize(request, 1_000_000)).toBe(false)
  })

  it("returns true for invalid content-length header", () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
    })
    expect(enforceBodySize(request, 1_000_000)).toBe(true)
  })

  it("returns false when content-length equals the limit exactly", () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "1000000" },
    })
    expect(enforceBodySize(request, 1_000_000)).toBe(false)
  })
})

describe("encodeHTML", () => {
  it("encodes ampersand", () => {
    expect(encodeHTML("a & b")).toBe("a &amp; b")
  })

  it("encodes less-than", () => {
    expect(encodeHTML("a < b")).toBe("a &lt; b")
  })

  it("encodes greater-than", () => {
    expect(encodeHTML("a > b")).toBe("a &gt; b")
  })

  it("encodes double quotes", () => {
    expect(encodeHTML('say "hello"')).toBe("say &quot;hello&quot;")
  })

  it("encodes single quotes", () => {
    expect(encodeHTML("it's")).toBe("it&#x27;s")
  })

  it("encodes all special characters in one string", () => {
    expect(encodeHTML('<script>"alert(\'xss\')&"</script>')).toBe(
      "&lt;script&gt;&quot;alert(&#x27;xss&#x27;)&amp;&quot;&lt;/script&gt;"
    )
  })

  it("leaves normal text unchanged", () => {
    expect(encodeHTML("hello world 123")).toBe("hello world 123")
  })
})

describe("decodeHTML", () => {
  it("round-trips with encodeHTML", () => {
    const original = '<script>alert("xss") & \'test\'</script>'
    expect(decodeHTML(encodeHTML(original))).toBe(original)
  })

  it("decodes all entity types", () => {
    expect(decodeHTML("&amp;&lt;&gt;&quot;&#x27;")).toBe("&<>\"'")
  })
})

describe("validateFilename", () => {
  it("accepts valid filenames", () => {
    expect(validateFilename("document.pdf")).toBe(true)
    expect(validateFilename("my-file_v2.txt")).toBe(true)
    expect(validateFilename("photo 2024.jpg")).toBe(true)
  })

  it("rejects filenames with special characters", () => {
    expect(validateFilename("file<name>.txt")).toBe(false)
    expect(validateFilename("file;name.txt")).toBe(false)
    expect(validateFilename("file|name.txt")).toBe(false)
    expect(validateFilename("../etc/passwd")).toBe(false)
  })

  it("rejects empty filenames", () => {
    expect(validateFilename("")).toBe(false)
  })

  it("rejects filenames exceeding 255 characters", () => {
    const longName = "a".repeat(256)
    expect(validateFilename(longName)).toBe(false)
  })

  it("accepts filenames at exactly 255 characters", () => {
    const maxName = "a".repeat(255)
    expect(validateFilename(maxName)).toBe(true)
  })

  it("rejects filenames with null bytes", () => {
    expect(validateFilename("file\0.txt")).toBe(false)
  })

  it("rejects filenames with slashes", () => {
    expect(validateFilename("path/file.txt")).toBe(false)
    expect(validateFilename("path\\file.txt")).toBe(false)
  })
})
