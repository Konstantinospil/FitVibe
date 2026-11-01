# Observability Stack

This directory contains configurations for the FitVibe observability stack, including Prometheus, Grafana, Loki, Tempo, and Alertmanager. These tools provide comprehensive monitoring, logging, tracing, and alerting capabilities.

## Components

| Component        | Purpose                        | Configuration File                            |
| ---------------- | ------------------------------ | --------------------------------------------- |
| **Prometheus**   | Metrics collection and storage | `prometheus.yml`                              |
| **Grafana**      | Visualization and dashboards   | `grafana/dashboards/`, `grafana/datasources/` |
| **Loki**         | Log aggregation                | `loki-config.yml`                             |
| **Promtail**     | Log shipping to Loki           | `promtail-config.yml`                         |
| **Tempo**        | Distributed tracing            | `tempo-config.yml`                            |
| **Alertmanager** | Alert routing and notification | `alertmanager.yml`                            |
| **Alert Rules**  | Prometheus alert definitions   | `alert-rules.yml`                             |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Promtail   │────▶│     Loki     │────▶│   Grafana   │
│ (Log Agent) │     │ (Log Store)  │     │(Visualization)│
└─────────────┘     └──────────────┘     └─────────────┘

┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Application │────▶│  Prometheus  │────▶│   Grafana   │
│  (Metrics)  │     │ (Metrics DB) │     │(Visualization)│
└─────────────┘     └──────────────┘     └─────────────┘

┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Application │────▶│    Tempo     │────▶│   Grafana   │
│  (Traces)   │     │ (Trace Store)│     │(Visualization)│
└─────────────┘     └──────────────┘     └─────────────┘

┌─────────────┐     ┌──────────────┐
│ Prometheus  │────▶│ Alertmanager │
│ (Alerts)    │     │(Notifications)│
└─────────────┘     └──────────────┘
```

## Prometheus

### Configuration

`prometheus.yml` defines:

- Scrape targets (backend, frontend, PostgreSQL, etc.)
- Scrape intervals
- Alert rule files
- Remote write endpoints (optional)

### Key Metrics

Prometheus scrapes metrics from:

- **Backend**: `/metrics` endpoint (Express metrics middleware)
- **PostgreSQL**: `postgres_exporter` (if deployed)
- **Node**: `node_exporter` (if deployed)
- **Kubernetes**: ServiceMonitor resources (if using Prometheus Operator)

### Scrape Targets

```yaml
scrape_configs:
  - job_name: "fitvibe-backend"
    static_configs:
      - targets: ["backend:4000"]
```

## Grafana

### Dashboards

Pre-configured dashboards in `grafana/dashboards/`:

- **Backend API Dashboard** (`backend-api.json`): API metrics, request rates, error rates
- **PostgreSQL Dashboard** (`postgres.json`): Database performance, connections, queries
- **SLO Dashboard** (`slo-dashboard.json`): Service Level Objectives monitoring
- **OpenTelemetry Tracing** (`otel-tracing-dashboard.json`): Distributed tracing visualization

### Data Sources

Data sources are configured in `grafana/datasources/datasources.yml`:

- Prometheus
- Loki
- Tempo

### Provisioning

Grafana automatically provisions:

- Dashboards from `grafana/dashboards/`
- Data sources from `grafana/datasources/`

## Loki

### Configuration

`loki-config.yml` configures:

- Storage backend (filesystem, S3, etc.)
- Retention policies
- Compaction settings
- Query limits

### Log Collection

Promtail (`promtail-config.yml`) collects logs from:

- Application containers
- System logs
- Access logs

### Log Labels

Logs are labeled for efficient querying:

- `job`: Service name (backend, frontend)
- `level`: Log level (info, error, warn)
- `environment`: Deployment environment

## Tempo

### Configuration

`tempo-config.yml` configures:

- Storage backend
- Trace retention
- Sampling rates

### Trace Collection

Traces are sent via:

- OpenTelemetry SDK (from application)
- OTLP endpoint
- Jaeger-compatible endpoints

## Alertmanager

### Configuration

`alertmanager.yml` configures:

- Notification receivers (email, Slack, PagerDuty)
- Routing rules
- Grouping and inhibition rules
- Silence management

### Alert Routing

Alerts are routed based on:

- Severity (critical, warning, info)
- Service (backend, frontend, database)
- Environment (production, staging)

## Alert Rules

`alert-rules.yml` defines Prometheus alert rules for:

- **High Error Rate**: API error rate exceeds threshold
- **High Latency**: P95 latency exceeds SLO
- **Database Issues**: Connection pool exhaustion, slow queries
- **Resource Exhaustion**: CPU, memory usage too high
- **Service Down**: Health check failures

### Example Alert

```yaml
groups:
  - name: fitvibe_backend
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

## Deployment

### Docker Compose

Add to your Docker Compose stack:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/observability/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./infra/observability/alert-rules.yml:/etc/prometheus/alert-rules.yml
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
```

### Kubernetes

Use Helm charts or direct manifests:

```bash
# Prometheus Operator
helm install prometheus prometheus-community/kube-prometheus-stack

# Or use provided ServiceMonitor resources
kubectl apply -f infra/kubernetes/prometheus-servicemonitor.yaml
```

## Querying

### Prometheus Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Loki Queries

```logql
# Error logs
{job="fitvibe-backend"} |= "error"

# Logs with specific trace ID
{job="fitvibe-backend"} | json | trace_id="abc123"
```

### Tempo Queries

Query traces by:

- Service name
- Operation name
- Tags/attributes
- Trace ID
- Time range

## SLOs and SLIs

### Service Level Indicators (SLIs)

- **Availability**: Uptime percentage
- **Latency**: P50, P95, P99 response times
- **Error Rate**: Percentage of failed requests
- **Throughput**: Requests per second

### Service Level Objectives (SLOs)

Defined in `grafana/dashboards/slo-dashboard.json`:

- **Availability**: 99.9% uptime (3 nines)
- **Latency**: P95 < 500ms
- **Error Rate**: < 0.1%

## Best Practices

1. **Labeling**: Use consistent, meaningful labels
2. **Cardinality**: Avoid high-cardinality labels
3. **Retention**: Set appropriate retention policies
4. **Sampling**: Sample traces appropriately
5. **Alerts**: Keep alerts actionable and specific
6. **Dashboards**: Create focused, purpose-driven dashboards

## Authentication policy alerts (Issue 557)

The active `alert-rules.yml` includes failed-login deviation from a
30-day five-minute-rate baseline, password-reset token failures, repeated
per-account lockout incidents and missing lockout threshold configuration.
All exported authentication metrics use bounded or **no identity labels**.

**Required runtime configuration:**

- Set `AUTH_ACCOUNT_LOCKOUT_ALERT_THRESHOLD` to the security owner's
  explicitly approved positive integer `N`; it counts distinct account
  lockout activations within ten minutes. Do not invent or silently default
  the policy value. Until configured, a dedicated monitor-unconfigured
  alert is raised once the monitoring stack is operating.
- Retain at least 30 days of Prometheus samples for the anomaly baseline
  plus safety margin. For an isolated small deployment, set
  `--storage.tsdb.retention.time=32d` in the Prometheus container command,
  then verify actual disk headroom and retention. Historical samples cannot
  be fabricated during the warm-up period.
- Ensure the `alertmanager:9093` service is deployed on the same private
  network. The bundled Alertmanager configuration contains example
  notification addresses and requires real receiver configuration and a
  live delivery test; no notification is guaranteed merely by passing CI.
- Keep `/metrics`, Prometheus and Alertmanager private. Verify the intended
  backend scrape target and do not publish monitoring ports.

**Validation commands** (with a compatible Prometheus installation):

```bash
promtool check config infra/observability/prometheus.yml
promtool check rules infra/observability/alert-rules.yml
amtool check-config infra/observability/alertmanager.yml
node tests/metrics/assert-prom.cjs
```

The authentication lockout metric is computed from private audit events;
only the aggregate number of accounts over the approved threshold is
exposed. Test alert delivery with synthetic events in an isolated
environment before accepting policy compliance.

## Troubleshooting

### Prometheus Not Scraping

1. Check scrape targets: `http://prometheus:9090/targets`
2. Verify network connectivity
3. Check service discovery configuration
4. Review Prometheus logs

### Grafana Not Showing Data

1. Verify data source connections
2. Check time range selection
3. Verify metrics exist in Prometheus
4. Check dashboard queries

### Logs Not Appearing

1. Verify Promtail is running
2. Check log file paths
3. Verify Loki is accessible
4. Review Promtail configuration

## Related Documentation

- [Infrastructure README](../README.md)
- [Backend README](../../apps/backend/README.md)
- [Kubernetes Configurations](../kubernetes/README.md)
