"""auction_ai — offline NBA auction CPU training/simulation engine.

This package trains a compact parameter policy via large-scale self-play and
generation-based learning, then exports it as a tiny JSON artifact that the
Vercel app loads for fast, safe inference. Training happens OFFLINE (here);
inference happens in production. Nothing in this package runs on Vercel.
"""
