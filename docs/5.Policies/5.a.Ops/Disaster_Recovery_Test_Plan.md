# Disaster Recovery Test Plan

**Status: Historical AWS regional disaster-recovery plan — NOT executable for the current self-hosted deployment (2026-11-02).** The AWS RDS, S3, Route53 and cross-region assumptions in this document are placeholders, not configured FitVibe services. Current production uses persistent Docker volumes for PostgreSQL and media; verify a protected independent copy of both database and media before any recovery exercise. A locally readable PostgreSQL archive is not proof of off-host backups or successful restore. Refer to [`infra/docker/prod/README.md`](../../../infra/docker/prod/README.md) for the actual deployment and data volumes. A new end-to-end self-hosted restore runbook is still required.

**Version:** 1.0
**Last Updated:** 2025-11-11
**Owner:** DevOps & Infrastructure Team
**Frequency:** Quarterly

This document outlines the quarterly disaster recovery (DR) testing procedures for FitVibe production infrastructure.

---

## Table of Contents

- [Overview](#overview)
- [DR Objectives](#dr-objectives)
- [Test Scenarios](#test-scenarios)
- [Quarterly DR Test Procedure](#quarterly-dr-test-procedure)
- [Success Criteria](#success-criteria)
- [Rollback Procedures](#rollback-procedures)
- [Post-Test Activities](#post-test-activities)

---

## Overview

### Purpose

Quarterly DR testing ensures FitVibe can recover from catastrophic failures within defined Recovery Time Objective (RTO) and Recovery Point Objective (RPO) targets.

### Scope

Tests cover:

- Database restoration from encrypted backups
- Application deployment to secondary region
- DNS failover and traffic routing
- Data integrity verification
- Service functionality validation

### DR Targets

| Metric | Target     | Notes                                    |
| ------ | ---------- | ---------------------------------------- |
| RTO    | ≤ 4 hours  | Time to restore service availability     |
| RPO    | ≤ 24 hours | Maximum acceptable data loss             |
| RCO    | ≤ 8 hours  | Recovery Capacity Objective (full scale) |

---

## DR Objectives

### 1. Recovery Time Objective (RTO)

**Target:** Restore critical services within 4 hours of declared disaster.

**Critical Services:**

- Authentication (`/api/v1/auth/*`)
- Session logging (`/api/v1/sessions/*`)
- User profiles (`/api/v1/users/me`)

**Non-Critical Services (best effort):**

- Analytics (`/api/v1/progress/*`)
- Social feed (`/api/v1/feed/*`)

### 2. Recovery Point Objective (RPO)

**Target:** Maximum 24 hours of data loss.

**Data Protection:**

- Database backups: Daily at 02:00 UTC
- Transaction logs: Continuous replication (production only)
- Media files: S3 cross-region replication

### 3. Service Level Objectives During DR

During DR event:

- Availability: ≥ 95% (reduced from 99.5% normal SLO)
- Latency p95: ≤ 600ms (relaxed from 300ms)
- Error rate: ≤ 2% (relaxed from 0.5%)

---

## Test Scenarios

### Scenario 1: Complete Database Loss

**Failure Mode:** Primary database server destroyed or corrupted beyond repair.

**Test Steps:**

1. Provision new database instance in DR region
2. Restore from latest encrypted backup
3. Verify data integrity (row counts, checksums)
4. Point application to new database
5. Run smoke tests

**Expected Duration:** 2-3 hours

### Scenario 2: Regional Outage

**Failure Mode:** Entire AWS region (eu-central-1) unavailable.

**Test Steps:**

1. Deploy application stack to secondary region (eu-west-1)
2. Restore database from S3 backup
3. Update DNS to point to DR region
4. Verify CDN failover
5. Run full E2E test suite

**Expected Duration:** 3-4 hours

### Scenario 3: Data Corruption

**Failure Mode:** Bad migration or application bug corrupts production data.

**Test Steps:**

1. Identify corruption scope and timeline
2. Restore database to point-in-time before corruption
3. Replay transaction logs (if available)
4. Validate data consistency
5. Deploy fix for corruption source

**Expected Duration:** 2-4 hours (depends on corruption scope)

### Scenario 4: Ransomware Attack

**Failure Mode:** Malicious encryption of production infrastructure.

**Test Steps:**

1. Isolate compromised systems
2. Deploy clean infrastructure from IaC templates
3. Restore database from last verified clean backup
4. Audit and rotate all credentials
5. Deploy with hardened security posture

**Expected Duration:** 4-6 hours

---

## Quarterly DR Test Procedure

### Pre-Test Preparation (Week Before Test)

#### 1. Stakeholder Notification

- [ ] Email engineering team 7 days in advance
- [ ] Schedule test during low-traffic window (Tuesday 02:00-06:00 UTC)
- [ ] Create test plan document with specific scenario
- [ ] Assign roles: Test Lead, Database Lead, Network Lead, Application Lead
- [ ] Notify customer support of planned test (may cause brief staging instability)

#### 2. Environment Preparation

- [ ] Verify latest backup available and valid:

  ```bash
  aws s3 ls s3://fitvibe-backups-prod/postgres/ | tail -5
  ```

- [ ] Provision DR test environment (isolated from staging)
- [ ] Pre-deploy application containers to DR region
- [ ] Verify monitoring and alerting functional in DR region

#### 3. Backup Verification

- [ ] Download latest production backup:

  ```bash
  aws s3 cp s3://fitvibe-backups-prod/postgres/latest.sql.gz.gpg /tmp/
  ```

- [ ] Verify checksum:

  ```bash
  sha256sum -c latest.sql.gz.gpg.sha256
  ```

- [ ] Test decryption (without restoring):
  ```bash
  gpg --decrypt latest.sql.gz.gpg | gunzip | head -100
  ```

### Test Execution (During Test Window)

#### Phase 1: Declare Simulated Disaster (T+0)

**Time:** 02:00 UTC

1. **Test Lead** declares simulated disaster scenario via Slack:

   ```
   @channel DRILL: Simulated DR scenario initiated.
   Scenario: Complete database loss in eu-central-1
   Timeline started. RTO target: 4 hours.
   ```

2. Start timer and begin logging all activities in incident doc

#### Phase 2: Database Recovery (T+0 to T+2h)

**Time:** 02:00 - 04:00 UTC

1. **Database Lead** provisions new RDS instance in DR region:

   ```bash
   aws rds create-db-instance \
     --db-instance-identifier fitvibe-dr-test \
     --db-instance-class db.t3.medium \
     --engine postgres \
     --allocated-storage 100 \
     --region eu-west-1
   ```

2. Wait for instance availability (~10 minutes)

3. Download and decrypt latest backup:

   ```bash
   aws s3 cp s3://fitvibe-backups-prod/postgres/fitvibe_production_20251111_020000.sql.gz.gpg .
   gpg --decrypt fitvibe_production_20251111_020000.sql.gz.gpg | gunzip > backup.sql
   ```

4. Restore database:

   ```bash
   ./infra/scripts/restore-database.sh backup.sql dr-test
   ```

5. Verify restoration:

   ```sql
   -- Check row counts
   SELECT
     'users' AS table_name, COUNT(*) AS rows FROM users
   UNION ALL
   SELECT 'sessions', COUNT(*) FROM sessions
   UNION ALL
   SELECT 'exercises', COUNT(*) FROM exercises;

   -- Verify latest data timestamp
   SELECT MAX(created_at) FROM sessions;
   ```

6. **Checkpoint:** Database restored and verified (Target: T+2h)

#### Phase 3: Application Deployment (T+2h to T+3h)

**Time:** 04:00 - 05:00 UTC

1. **Application Lead** updates connection string in DR region:

   ```bash
   kubectl create secret generic db-credentials \
     --from-literal=DATABASE_URL="postgresql://fitvibe:$DB_PASS@fitvibe-dr-test.eu-west-1.rds.amazonaws.com:5432/fitvibe" \
     -n dr-test
   ```

2. Deploy application stack:

   ```bash
   kubectl apply -f k8s/dr-region/ -n dr-test
   kubectl rollout status deployment/fitvibe-backend -n dr-test
   ```

3. Verify pods healthy:

   ```bash
   kubectl get pods -n dr-test
   # All pods should be Running with 1/1 ready
   ```

4. **Checkpoint:** Application deployed (Target: T+2.5h)

#### Phase 4: Network & DNS Failover (T+3h to T+3.5h)

**Time:** 05:00 - 05:30 UTC

1. **Network Lead** updates Route53 health checks:

   ```bash
   aws route53 update-health-check \
     --health-check-id $HEALTH_CHECK_ID \
     --resource-path /health \
     --fully-qualified-domain-name dr.fitvibe.app
   ```

2. Create DNS failover record (DO NOT activate yet in drill):

   ```bash
   # Dry-run only for drill
   aws route53 change-resource-record-sets \
     --hosted-zone-id $ZONE_ID \
     --change-batch file://dns-failover.json \
     --dry-run
   ```

3. Verify CDN points to DR origin (test subdomain only):

   ```bash
   curl -H "Host: dr.fitvibe.app" https://dr-lb.eu-west-1.elb.amazonaws.com/health
   ```

4. **Checkpoint:** Network configured (Target: T+3h)

#### Phase 5: Validation & Testing (T+3h to T+4h)

**Time:** 05:00 - 06:00 UTC

1. **Run smoke tests:**

   ```bash
   npm run test:smoke -- --base-url=https://dr.fitvibe.app
   ```

2. **Run E2E test suite:**

   ```bash
   npm run test:e2e -- --base-url=https://dr.fitvibe.app
   ```

3. **Manual validation checklist:**
   - [ ] User can register new account
   - [ ] User can login with existing credentials
   - [ ] User can view workout history
   - [ ] User can create new session
   - [ ] User can update profile
   - [ ] API returns correct data from restored database

4. **Performance validation:**

   ```bash
   k6 run tests/performance/smoke.js --vus 10 --duration 5m
   ```

   Verify:
   - p95 latency ≤ 600ms
   - Error rate ≤ 2%
   - All endpoints responding

5. **Data integrity validation:**

   ```bash
   # Compare row counts with pre-disaster snapshot
   diff <(cat pre_disaster_counts.txt) <(ssh dr-db "psql -f count_query.sql")
   ```

6. **Checkpoint:** All tests passed (Target: T+4h)

### Post-Test Activities (After Test Window)

#### 1. Tear Down DR Environment

- [ ] Stop DR application pods:

  ```bash
  kubectl delete namespace dr-test
  ```

- [ ] Terminate DR database instance:

  ```bash
  aws rds delete-db-instance --db-instance-identifier fitvibe-dr-test --skip-final-snapshot
  ```

- [ ] Clean up test artifacts:
  ```bash
  rm -rf /tmp/dr-test-*
  ```

#### 2. Documentation & Reporting

- [ ] Complete test report template (see Appendix A)
- [ ] Log actual vs. target times for each phase
- [ ] Document any issues or deviations
- [ ] Identify improvement opportunities

#### 3. Stakeholder Communication

- [ ] Email test results to engineering-leads@fitvibe.app
- [ ] Post summary in #engineering Slack channel
- [ ] Update DR runbook based on lessons learned

#### 4. Action Items

- [ ] Create JIRA tickets for identified gaps
- [ ] Schedule follow-up meeting for post-mortem
- [ ] Update DR procedures if needed

---

## Success Criteria

### Must Pass

- ✅ Database restored within 2 hours
- ✅ Application deployed and healthy within 3 hours
- ✅ End-to-end tests passing within 4 hours
- ✅ No data loss detected (row counts match)
- ✅ All critical APIs functional

### Should Pass

- ✅ p95 latency ≤ 600ms
- ✅ Error rate ≤ 2%
- ✅ Zero failed smoke tests

### Nice to Have

- ✅ RTO under 3 hours (better than target)
- ✅ Performance within normal SLO (p95 ≤ 300ms)

### Failure Criteria

Test is considered **failed** if:

- ❌ RTO exceeds 4 hours
- ❌ Data loss detected
- ❌ Critical APIs non-functional after 4 hours
- ❌ E2E test suite failure rate > 10%

---

## Rollback Procedures

If DR test encounters critical issues:

### Scenario: Cannot Restore Database

**Symptoms:** Backup corrupted, decryption failed, or restore errors

**Actions:**

1. Attempt restore from previous day's backup
2. If all backups fail, escalate to critical incident
3. Review backup process and scripts
4. Re-test backups in isolated environment

### Scenario: Application Deployment Fails

**Symptoms:** Pods crashing, health checks failing

**Actions:**

1. Check logs: `kubectl logs -n dr-test deployment/fitvibe-backend`
2. Verify database connectivity
3. Check secrets and config maps
4. Rollback to previous working container image

### Scenario: Test Exceeds RTO Window

**Actions:**

1. Continue test to completion (don't abort)
2. Document delays and root causes
3. Mark test as failed
4. Schedule remediation sprint

---

## Post-Test Activities

### 1. Test Report

Complete report template within 48 hours (see Appendix A).

### 2. Metrics Collection

Log the following metrics:

| Metric                  | Target | Actual | Status |
| ----------------------- | ------ | ------ | ------ |
| Database restore time   | 2h     | \_\_\_ | \_\_\_ |
| Application deploy time | 3h     | \_\_\_ | \_\_\_ |
| Total RTO               | 4h     | \_\_\_ | \_\_\_ |
| Data loss (hours)       | 0h     | \_\_\_ | \_\_\_ |
| E2E test pass rate      | 100%   | \_\_\_ | \_\_\_ |
| Smoke test failures     | 0      | \_\_\_ | \_\_\_ |

### 3. Lessons Learned

Conduct post-mortem meeting to discuss:

- What went well?
- What could be improved?
- Were there any surprises?
- Are our DR docs accurate?
- Do we need additional automation?

### 4. Continuous Improvement

Update procedures and automation based on findings:

- Refine restore scripts
- Improve monitoring in DR region
- Automate manual steps
- Update runbooks with new insights

---

## Appendix A: Test Report Template

```markdown
# FitVibe Quarterly DR Test Report

**Test Date:** YYYY-MM-DD
**Test Lead:** [Name]
**Scenario:** [e.g., Complete Database Loss]
**Status:** [Pass / Fail / Partial]

## Executive Summary

[2-3 sentence summary of test outcome]

## Timeline

| Phase                  | Start | End   | Duration | Target | Status |
| ---------------------- | ----- | ----- | -------- | ------ | ------ |
| Database Recovery      | 02:00 | XX:XX | XXh XXm  | 2h     | ✅/❌  |
| Application Deployment | XX:XX | XX:XX | XXh XXm  | 1h     | ✅/❌  |
| Network Failover       | XX:XX | XX:XX | XXh XXm  | 30m    | ✅/❌  |
| Validation & Testing   | XX:XX | XX:XX | XXh XXm  | 1h     | ✅/❌  |
| **Total RTO**          | 02:00 | XX:XX | XXh XXm  | 4h     | ✅/❌  |

## Test Results

### Database Restoration

- Backup file: [filename]
- Restore duration: [time]
- Data integrity: [✅ verified / ❌ issues found]
- Row count diff: [number or "none"]

### Application Deployment

- Deployment method: [k8s / docker / etc]
- Pods/containers: [X/X healthy]
- Health check: [✅ passing / ❌ failing]

### Functional Validation

- Smoke tests: [X/Y passed]
- E2E tests: [X/Y passed]
- Performance: p95 = [XXX]ms, errors = [X]%

## Issues Encountered

1. [Issue description]
   - Impact: [high/medium/low]
   - Resolution: [how resolved]
   - Action item: [JIRA-XXX]

## Lessons Learned

### What Went Well

- [Item 1]
- [Item 2]

### Areas for Improvement

- [Item 1]
- [Item 2]

## Action Items

- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Conclusion

[Summary and overall assessment]

**Next Test Date:** [Quarter + Date]
```

---

## Appendix B: DR Test Schedule

| Quarter | Test Window         | Scenario          | Status |
| ------- | ------------------- | ----------------- | ------ |
| Q1 2025 | Jan 16, 02:00-06:00 | Database Loss     | \_\_\_ |
| Q2 2025 | Apr 15, 02:00-06:00 | Regional Outage   | \_\_\_ |
| Q3 2025 | Jul 15, 02:00-06:00 | Data Corruption   | \_\_\_ |
| Q4 2025 | Oct 14, 02:00-06:00 | Ransomware Attack | \_\_\_ |

---

## Appendix C: Contact Information

**During DR Test:**

- Test Lead: [On-call DevOps]
- Database Lead: [On-call DBA]
- Application Lead: [On-call Backend Engineer]
- Network Lead: [On-call SRE]

**Escalation:**

- Engineering Manager
- CTO
- Customer Support Lead (for communication)

**Communication Channels:**

- Slack: #dr-test (created for test duration)
- Incident Doc: [Google Doc link]
- Video Call: [Zoom/Meet link]
