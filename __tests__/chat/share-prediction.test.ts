import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sharePredictionToRoom } from "@/lib/chat/sharePrediction"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("sharePredictionToRoom", () => {
  it("POSTs a betslip message to the room's messages route with the parlay id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const result = await sharePredictionToRoom("room-1", "parlay-1")

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/rooms/room-1/messages")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ kind: "betslip", betslipId: "parlay-1" })
  })

  it("includes subchannelId when provided", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    await sharePredictionToRoom("room-1", "parlay-1", "sub-1")

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      kind: "betslip",
      betslipId: "parlay-1",
      subchannelId: "sub-1",
    })
  })

  it("maps a non-ok response to { ok:false } with the server error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "You can only share your own betslip." }),
    })

    const result = await sharePredictionToRoom("room-1", "parlay-1")

    expect(result).toEqual({ ok: false, error: "You can only share your own betslip." })
  })

  it("falls back to a generic error when the body has no error string", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })

    const result = await sharePredictionToRoom("room-1", "parlay-1")

    expect(result.ok).toBe(false)
    expect(result.error).toBe("Couldn't share prediction.")
  })

  it("returns a connection error when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    const result = await sharePredictionToRoom("room-1", "parlay-1")

    expect(result.ok).toBe(false)
    expect(result.error).toContain("connection")
  })
})
