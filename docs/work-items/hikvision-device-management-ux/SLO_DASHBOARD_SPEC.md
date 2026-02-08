# SLO DASHBOARD SPEC

## Core SLOs
1. Device onboarding success rate >= 98%
2. Webhook operation success rate >= 99%
3. P95 device operation latency <= 3s
4. User recreate success rate >= 97%

## Metrics Source
- `/ops/device-metrics`
- structured request logs (`request.completed`)

## Dashboard Panels
1. Operation totals by type
2. Success/failure by operation
3. Avg latency by operation
4. Daily trend

## Alerting
1. Success rate < threshold for 15m
2. Avg latency > threshold for 15m
