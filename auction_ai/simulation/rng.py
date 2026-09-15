"""Deterministic RNG + hashing — a faithful port of lib/arena/rng.ts and the
djb2 hash in lib/arena/ai.ts.

Reproducing these EXACTLY matters: the production TypeScript engine derives its
auction order, its AI jitter, and its "mistake" rolls from these functions. If
the Python simulator is to reproduce the same auctions, the bit-level behavior
must match (32-bit unsigned wraparound, Math.imul semantics, etc.).
"""
from __future__ import annotations

from typing import Callable, List, TypeVar

T = TypeVar("T")

_U32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """Match JS Math.imul: 32-bit integer multiply, returned as an unsigned
    32-bit value (we keep everything unsigned and mask on use)."""
    return ((a & _U32) * (b & _U32)) & _U32


def mulberry32(seed: int) -> Callable[[], float]:
    """Port of mulberry32 from rng.ts. Returns a nullary function → [0,1)."""
    state = seed & _U32

    def rng() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & _U32
        a = state
        # let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = _imul(a ^ (a >> 15), 1 | a)
        # t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _U32) ^ t
        t &= _U32
        # return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        return ((t ^ (t >> 14)) & _U32) / 4294967296.0

    return rng


def hash_seed(s: str) -> int:
    """FNV-1a-style 32-bit hash — port of hashSeed() in rng.ts."""
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = _imul(h, 16777619)
    return h & _U32


def djb2(s: str) -> int:
    """djb2 hash — port of the internal hash() in ai.ts.

    JS: h = ((h << 5) + h + c) >>> 0, starting from 5381.
    """
    h = 5381
    for ch in s:
        h = ((h << 5) + h + ord(ch)) & _U32
    return h & _U32


def shuffle(rng: Callable[[], float], arr: List[T]) -> List[T]:
    """Fisher-Yates — port of shuffle() in rng.ts (returns a new list)."""
    out = list(arr)
    for i in range(len(out) - 1, 0, -1):
        j = int(rng() * (i + 1))
        out[i], out[j] = out[j], out[i]
    return out
