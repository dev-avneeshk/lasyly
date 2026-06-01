# Load Testing (k6)

Load tests for the Betroom API using [k6](https://k6.io/).

## Prerequisites

```bash
brew install k6
```

## Test Scenarios

| Script | Purpose | Duration | VUs |
|--------|---------|----------|-----|
| `smoke.js` | Quick sanity check | 30s | 2 |
| `load.js` | Sustained realistic traffic | ~5 min | 10→50 |
| `stress.js` | Find breaking points | ~8 min | 20→300 |
| `spike.js` | Sudden traffic bursts | ~2 min | 5→300 |
| `soak.js` | Extended stability check | ~15 min | 30 |

## Running

### Against local dev server

Start the dev server first, then:

```bash
k6 run load-tests/smoke.js
k6 run load-tests/load.js
```

### Against deployed environment

```bash
k6 run -e BASE_URL=https://your-app.vercel.app load-tests/smoke.js
k6 run -e BASE_URL=https://your-app.vercel.app load-tests/load.js
```

### Quick smoke test (recommended before deploys)

```bash
k6 run load-tests/smoke.js
```

## Interpreting Results

k6 outputs metrics at the end of each run:

- **http_req_duration**: Response time distribution (p50, p90, p95, p99)
- **http_req_failed**: Percentage of failed requests
- **checks**: Pass/fail rate of assertions
- **vus**: Virtual users active over time

### Thresholds

Tests will exit with code 99 if thresholds are breached:

- Smoke: p95 < 1s, <1% errors
- Load: p95 < 2s, <5% errors
- Stress: p95 < 5s, <15% errors (relaxed for extreme load)
- Spike: p95 < 8s, <20% errors (generous during bursts)
- Soak: p95 < 3s, <3% errors (strict over long duration)

## Exporting Results

```bash
# JSON output for CI/dashboards
k6 run --out json=results.json load-tests/load.js

# CSV output
k6 run --out csv=results.csv load-tests/load.js
```

## CI Integration

Add to your workflow:

```yaml
- name: Load Test (Smoke)
  run: k6 run -e BASE_URL=${{ secrets.STAGING_URL }} load-tests/smoke.js
```

## Tips

- Run smoke tests before every deploy
- Run load tests weekly against staging
- Run stress/spike tests before major launches
- Run soak tests monthly to catch memory leaks
- Never run stress/spike tests against production without coordination
