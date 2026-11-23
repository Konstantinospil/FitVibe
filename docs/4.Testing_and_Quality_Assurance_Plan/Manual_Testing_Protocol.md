---
title: "FitVibe — Manual Testing Protocol"
version: "v1.0"
status: "Approved"
date: "2025-01-26"
license: "MIT"
---

# Manual Testing Protocol for FitVibe

## Purpose & Scope

This document defines the **manual testing protocol** that must be completed by human testers before code can be promoted from **development** → **staging** → **production** environments. Manual testing complements automated testing (unit, integration, E2E) by validating:

- **User experience** and workflow completeness
- **Visual design** consistency and accessibility
- **Cross-browser/device** compatibility
- **Business logic** correctness from user perspective
- **Edge cases** and error handling in real-world scenarios
- **Performance** perception and responsiveness

**Scope:** All user-facing features, admin functions, authentication flows, data management, and system operations.

**Out of scope:** Automated test coverage (covered by Test_Suite.md), infrastructure-only changes (covered by deployment checklists).

---

## Table of Contents

1. [Testing Process Overview](#1-testing-process-overview)
2. [Test Environment Setup](#2-test-environment-setup)
3. [Test Execution Workflow](#3-test-execution-workflow)
4. [Test Protocol by Feature Area](#4-test-protocol-by-feature-area)
5. [Test Completion Criteria](#5-test-completion-criteria)
6. [Reporting & Sign-off](#6-reporting--sign-off)
7. [Appendix: Test Data Requirements](#appendix-test-data-requirements)

---

## 1. Testing Process Overview

### 1.1 Testing Phases

Manual testing occurs at **two gates**:

1. **Dev → Staging Gate**: Full feature testing after PR merge to `develop` branch
2. **Staging → Production Gate**: Smoke testing + regression testing before production deployment

### 1.2 Testing Roles

| Role              | Responsibility                                        | Sign-off Authority        |
| ----------------- | ----------------------------------------------------- | ------------------------- |
| **QA Tester**     | Execute test cases, document results, report defects  | Test execution complete   |
| **QA Lead**       | Review test results, approve/reject promotion         | Staging → Production gate |
| **Product Owner** | Validate business requirements, approve UAT           | Feature acceptance        |
| **Tech Lead**     | Review technical correctness, approve technical gates | Technical approval        |

### 1.3 Test Coverage Principles

- **Inclusive**: Test all user-facing features, not just new changes
- **Risk-based**: Prioritize critical paths (auth, payments, data integrity)
- **User-centric**: Test from end-user perspective, not just technical correctness
- **Cross-functional**: Test across browsers, devices, screen sizes, languages
- **Accessibility**: Verify WCAG 2.2 AA compliance manually
- **Security**: Verify security controls and privacy settings

### 1.4 Test Execution Time Estimates

| Test Area                                  | Estimated Time  | Frequency      |
| ------------------------------------------ | --------------- | -------------- |
| Authentication & Security                  | 2-3 hours       | Every release  |
| Core Features (Planner, Logger, Dashboard) | 4-6 hours       | Every release  |
| Social Features (Feed, Sharing)            | 2-3 hours       | Every release  |
| Admin Functions                            | 1-2 hours       | Every release  |
| Cross-browser/Device Testing               | 3-4 hours       | Major releases |
| Accessibility Testing                      | 2-3 hours       | Every release  |
| **Total per release**                      | **14-21 hours** | -              |

---

## 2. Test Environment Setup

### 2.1 Required Test Environments

| Environment     | Purpose                     | Access                 | Data State                       |
| --------------- | --------------------------- | ---------------------- | -------------------------------- |
| **Development** | Feature development testing | Developers + QA        | Ephemeral, seeded test data      |
| **Staging**     | Pre-production validation   | QA + PO + Stakeholders | Production-like, anonymized data |
| **Production**  | Smoke testing only          | QA Lead only           | Live production data (read-only) |

### 2.2 Browser & Device Matrix

**Required Testing:**

| Browser       | Version       | OS                    | Priority          |
| ------------- | ------------- | --------------------- | ----------------- |
| Chrome        | Latest stable | Windows, macOS, Linux | **P0** (Critical) |
| Firefox       | Latest stable | Windows, macOS, Linux | **P0** (Critical) |
| Safari        | Latest stable | macOS, iOS (latest)   | **P0** (Critical) |
| Edge          | Latest stable | Windows               | **P1** (High)     |
| Chrome Mobile | Latest        | Android (latest)      | **P1** (High)     |
| Safari Mobile | Latest        | iOS (latest)          | **P1** (High)     |

**Screen Sizes:**

- Desktop: 1920×1080, 1366×768, 2560×1440
- Tablet: 768×1024 (portrait), 1024×768 (landscape)
- Mobile: 375×667 (iPhone SE), 390×844 (iPhone 12), 414×896 (iPhone 11 Pro Max)

### 2.3 Test Accounts

Create and maintain test accounts for each role:

| Role                | Email Pattern                  | Purpose                  |
| ------------------- | ------------------------------ | ------------------------ |
| **Regular User**    | `test.user@fitvibe.test`       | Standard user workflows  |
| **Admin User**      | `test.admin@fitvibe.test`      | Admin functions          |
| **Coach User**      | `test.coach@fitvibe.test`      | Coach-specific features  |
| **Suspended User**  | `test.suspended@fitvibe.test`  | Moderation testing       |
| **Unverified User** | `test.unverified@fitvibe.test` | Email verification flows |

**Password Policy:** All test accounts use: `TestPassword123!@#`

### 2.4 Test Data Requirements

See [Appendix: Test Data Requirements](#appendix-test-data-requirements) for detailed test data setup.

---

## 3. Test Execution Workflow

### 3.1 Pre-Testing Checklist

Before starting manual testing, verify:

- [ ] Test environment is accessible and stable
- [ ] Test accounts are created and functional
- [ ] Test data is seeded (sessions, exercises, plans, feed content)
- [ ] Browser extensions are disabled (ad blockers, password managers)
- [ ] Network conditions are normal (no throttling unless testing performance)
- [ ] Test documentation is up-to-date
- [ ] Defect tracking system is accessible

### 3.2 Test Execution Steps

1. **Review Test Plan**: Understand what features/changes are being tested
2. **Execute Test Cases**: Follow test protocol systematically
3. **Document Results**: Record pass/fail, screenshots, notes
4. **Report Defects**: Create detailed bug reports for failures
5. **Retest Fixes**: Verify defect fixes before sign-off
6. **Complete Test Report**: Submit test report for review

### 3.3 Test Result States

| State       | Meaning                                         | Action                             |
| ----------- | ----------------------------------------------- | ---------------------------------- |
| **PASS**    | Test case passes, feature works as expected     | Mark complete, proceed             |
| **FAIL**    | Test case fails, defect found                   | Create bug report, block promotion |
| **BLOCKED** | Cannot test due to dependency/environment issue | Document blocker, escalate         |
| **SKIP**    | Test case not applicable for this release       | Document reason, get approval      |
| **PARTIAL** | Feature works but with minor issues             | Document issues, assess impact     |

### 3.4 Defect Reporting

**Required Information:**

- **Title**: Clear, concise description
- **Severity**: Critical, High, Medium, Low
- **Priority**: P0 (blocker), P1 (high), P2 (medium), P3 (low)
- **Steps to Reproduce**: Detailed, numbered steps
- **Expected Result**: What should happen
- **Actual Result**: What actually happens
- **Screenshots/Video**: Visual evidence
- **Environment**: Browser, OS, screen size, test account
- **Console Logs**: Browser console errors (if applicable)

**Severity Guidelines:**

- **Critical**: Data loss, security vulnerability, complete feature failure
- **High**: Major feature broken, significant UX issue
- **Medium**: Feature works with workaround, minor UX issue
- **Low**: Cosmetic issue, minor text/formatting problem

---

## 4. Test Protocol by Feature Area

### 4.1 Authentication & Security

#### 4.1.1 User Registration

**Test Cases:**

| ID       | Test Case                         | Steps                                                                                 | Expected Result                                                         | Priority |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| AUTH-001 | Successful registration           | 1. Navigate to `/register`<br>2. Enter valid email, password, alias<br>3. Submit form | User registered, email verification sent, redirect to verify-email page | P0       |
| AUTH-002 | Registration with invalid email   | 1. Enter invalid email format<br>2. Submit                                            | Error message: "Invalid email format"                                   | P0       |
| AUTH-003 | Registration with weak password   | 1. Enter password < 12 chars<br>2. Submit                                             | Error message: "Password must be at least 12 characters"                | P0       |
| AUTH-004 | Registration with duplicate alias | 1. Register with existing alias (case-insensitive)<br>2. Submit                       | Error message: "Alias already taken"                                    | P0       |
| AUTH-005 | Registration with duplicate email | 1. Register with existing email<br>2. Submit                                          | Error message: "Email already registered"                               | P0       |
| AUTH-006 | Registration form validation      | 1. Leave fields empty<br>2. Submit                                                    | Field-level validation errors displayed                                 | P1       |
| AUTH-007 | Registration rate limiting        | 1. Submit registration 10+ times rapidly<br>2. Observe behavior                       | Rate limit message after threshold                                      | P1       |

**Accessibility Checks:**

- [ ] All form fields have labels
- [ ] Error messages are announced by screen reader
- [ ] Form is navigable via keyboard (Tab, Enter)
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1)

**Cross-browser:** Test in Chrome, Firefox, Safari, Edge

---

#### 4.1.2 Email Verification

**Test Cases:**

| ID       | Test Case                       | Steps                                                                   | Expected Result                                           | Priority |
| -------- | ------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- | -------- |
| AUTH-008 | Verify email with valid token   | 1. Click verification link in email<br>2. Token is valid (< 15 min old) | Email verified, redirect to login, success message        | P0       |
| AUTH-009 | Verify email with expired token | 1. Click verification link > 15 min old<br>2. Submit                    | Error: "Verification link expired", option to resend      | P0       |
| AUTH-010 | Verify email with invalid token | 1. Use malformed token<br>2. Submit                                     | Error: "Invalid verification link"                        | P0       |
| AUTH-011 | Resend verification email       | 1. Click "Resend verification email"<br>2. Check email                  | New verification email sent, rate limit applies (≤3/hour) | P1       |
| AUTH-012 | Resend verification rate limit  | 1. Request resend 4+ times in 1 hour<br>2. Observe                      | Rate limit message after 3 requests                       | P1       |

---

#### 4.1.3 User Login

**Test Cases:**

| ID       | Test Case                    | Steps                                                              | Expected Result                                            | Priority |
| -------- | ---------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | -------- |
| AUTH-013 | Successful login             | 1. Navigate to `/login`<br>2. Enter valid credentials<br>3. Submit | Login successful, redirect to dashboard, JWT stored        | P0       |
| AUTH-014 | Login with invalid email     | 1. Enter non-existent email<br>2. Submit                           | Generic error: "Invalid credentials" (no user enumeration) | P0       |
| AUTH-015 | Login with wrong password    | 1. Enter valid email, wrong password<br>2. Submit                  | Generic error: "Invalid credentials"                       | P0       |
| AUTH-016 | Login with unverified email  | 1. Use unverified account<br>2. Submit                             | Error: "Please verify your email", resend option           | P0       |
| AUTH-017 | Login with suspended account | 1. Use suspended account<br>2. Submit                              | Error: "Account suspended", contact admin message          | P0       |
| AUTH-018 | Brute force protection       | 1. Attempt login 10+ times with wrong password<br>2. Observe       | Account locked, lockout message, 15-min cooldown           | P0       |
| AUTH-019 | Remember me functionality    | 1. Check "Remember me"<br>2. Login, close browser, reopen          | Still logged in (refresh token valid)                      | P1       |
| AUTH-020 | Login form accessibility     | 1. Navigate with keyboard only<br>2. Use screen reader             | All fields accessible, labels announced                    | P1       |

---

#### 4.1.4 Two-Factor Authentication (2FA)

**Test Cases:**

| ID       | Test Case                    | Steps                                                                                     | Expected Result                           | Priority |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- | -------- |
| AUTH-021 | Enable 2FA                   | 1. Go to Settings → Security<br>2. Click "Enable 2FA"<br>3. Scan QR code, enter TOTP code | 2FA enabled, backup codes displayed       | P0       |
| AUTH-022 | Login with 2FA enabled       | 1. Login with credentials<br>2. Enter TOTP code from authenticator app                    | Login successful                          | P0       |
| AUTH-023 | Login with invalid TOTP code | 1. Login with credentials<br>2. Enter wrong TOTP code                                     | Error: "Invalid verification code"        | P0       |
| AUTH-024 | Login with backup code       | 1. Login with credentials<br>2. Use backup code instead of TOTP                           | Login successful, backup code invalidated | P0       |
| AUTH-025 | Disable 2FA                  | 1. Go to Settings → Security<br>2. Click "Disable 2FA"<br>3. Confirm with password        | 2FA disabled, can login without TOTP      | P1       |
| AUTH-026 | 2FA rate limiting            | 1. Enter wrong TOTP 5+ times<br>2. Observe                                                | Rate limit message, temporary lockout     | P1       |

---

#### 4.1.5 Password Reset

**Test Cases:**

| ID       | Test Case                         | Steps                                                                             | Expected Result                                             | Priority |
| -------- | --------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| AUTH-027 | Request password reset            | 1. Go to `/forgot-password`<br>2. Enter email<br>3. Submit                        | Reset email sent (if email exists), generic success message | P0       |
| AUTH-028 | Reset password with valid token   | 1. Click reset link in email<br>2. Enter new password (meets policy)<br>3. Submit | Password reset, redirect to login, old sessions invalidated | P0       |
| AUTH-029 | Reset password with expired token | 1. Use reset link > 1 hour old<br>2. Submit                                       | Error: "Reset link expired", option to request new link     | P0       |
| AUTH-030 | Reset password with weak password | 1. Enter password < 12 chars<br>2. Submit                                         | Validation error, password not changed                      | P0       |
| AUTH-031 | Reset password rate limiting      | 1. Request reset 5+ times rapidly<br>2. Observe                                   | Rate limit message                                          | P1       |

---

#### 4.1.6 Session Management

**Test Cases:**

| ID       | Test Case                    | Steps                                                                 | Expected Result                                                  | Priority |
| -------- | ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| AUTH-032 | Token refresh                | 1. Login, wait 14+ days<br>2. Make API request                        | Access token refreshed automatically, seamless experience        | P0       |
| AUTH-033 | Token expiration             | 1. Login, wait for token expiry<br>2. Make API request                | Redirect to login, clear session                                 | P0       |
| AUTH-034 | Logout                       | 1. Click "Logout"<br>2. Verify                                        | Tokens cleared, redirect to home, cannot access protected routes | P0       |
| AUTH-035 | Concurrent sessions          | 1. Login on device A<br>2. Login on device B<br>3. Logout on device A | Device B still logged in, device A logged out                    | P1       |
| AUTH-036 | Session hijacking protection | 1. Copy JWT token<br>2. Use on different device/IP                    | Token invalidated or flagged for review                          | P1       |

---

### 4.2 User Profile & Settings

#### 4.2.1 Profile Management

**Test Cases:**

| ID          | Test Case                         | Steps                                                     | Expected Result                                         | Priority |
| ----------- | --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- | -------- |
| PROFILE-001 | View own profile                  | 1. Navigate to `/profile`<br>2. View profile information  | Profile displays correctly: alias, email, avatar, stats | P0       |
| PROFILE-002 | Edit profile alias                | 1. Go to Settings → Profile<br>2. Change alias<br>3. Save | Alias updated, uniqueness validated (case-insensitive)  | P0       |
| PROFILE-003 | Edit profile with duplicate alias | 1. Change alias to existing one<br>2. Save                | Error: "Alias already taken"                            | P0       |
| PROFILE-004 | Edit profile email                | 1. Change email<br>2. Save                                | Email change requires verification, old email notified  | P0       |
| PROFILE-005 | Edit profile bio                  | 1. Add/update bio (max 500 chars)<br>2. Save              | Bio saved, character count displayed                    | P1       |
| PROFILE-006 | Profile privacy settings          | 1. Toggle privacy settings<br>2. Save                     | Settings saved, applied to profile visibility           | P1       |

---

#### 4.2.2 Avatar Upload

**Test Cases:**

| ID          | Test Case                     | Steps                                                                      | Expected Result                                            | Priority |
| ----------- | ----------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| PROFILE-007 | Upload valid avatar image     | 1. Go to Settings → Profile<br>2. Upload image (JPG/PNG, < 5MB)<br>3. Save | Avatar uploaded, cropped/resized, EXIF stripped, displayed | P0       |
| PROFILE-008 | Upload oversized image        | 1. Upload image > 5MB<br>2. Submit                                         | Error: "File size exceeds 5MB limit"                       | P0       |
| PROFILE-009 | Upload invalid file type      | 1. Upload PDF/document file<br>2. Submit                                   | Error: "Invalid file type. Only JPG/PNG allowed"           | P0       |
| PROFILE-010 | Upload malicious file (EICAR) | 1. Upload EICAR test file<br>2. Submit                                     | File rejected, antivirus scan triggered                    | P0       |
| PROFILE-011 | Avatar crop/resize            | 1. Upload large image<br>2. Crop to square<br>3. Save                      | Image resized to 256×256, aspect ratio maintained          | P1       |
| PROFILE-012 | Remove avatar                 | 1. Click "Remove avatar"<br>2. Confirm                                     | Avatar removed, default placeholder shown                  | P1       |
| PROFILE-013 | Avatar accessibility          | 1. View profile with screen reader<br>2. Check alt text                    | Avatar has descriptive alt text                            | P1       |

---

#### 4.2.3 Account Settings

**Test Cases:**

| ID          | Test Case                                   | Steps                                                                                | Expected Result                                                     | Priority |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------- |
| PROFILE-014 | Change password                             | 1. Go to Settings → Security<br>2. Enter current password, new password<br>3. Save   | Password changed, all sessions invalidated, email notified          | P0       |
| PROFILE-015 | Change password with wrong current password | 1. Enter incorrect current password<br>2. Submit                                     | Error: "Current password incorrect"                                 | P0       |
| PROFILE-016 | Change password with weak new password      | 1. Enter password < 12 chars<br>2. Submit                                            | Validation error                                                    | P0       |
| PROFILE-017 | Language preference                         | 1. Change language (EN/DE)<br>2. Navigate to different page                          | Language persists, UI translated, dates/numbers localized           | P0       |
| PROFILE-018 | Timezone setting                            | 1. Set timezone<br>2. View session timestamps                                        | Timestamps displayed in selected timezone                           | P1       |
| PROFILE-019 | Notification preferences                    | 1. Toggle notification settings<br>2. Save                                           | Preferences saved, notifications respect settings                   | P1       |
| PROFILE-020 | Delete account                              | 1. Go to Settings → Account<br>2. Click "Delete account"<br>3. Confirm with password | Account deletion initiated, 14-day grace period, email confirmation | P0       |

---

### 4.3 Exercise Library

#### 4.3.1 Exercise Management (User)

**Test Cases:**

| ID           | Test Case                | Steps                                                                                  | Expected Result                                             | Priority |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| EXERCISE-001 | View exercise library    | 1. Navigate to `/exercises`<br>2. Browse exercises                                     | Exercises displayed with search/filter options              | P0       |
| EXERCISE-002 | Search exercises         | 1. Enter search query<br>2. Submit                                                     | Relevant exercises displayed, search is fast (< 300ms)      | P0       |
| EXERCISE-003 | Filter exercises by vibe | 1. Select vibe filter (Earth/Air/Water/Fire/Shadow/Aether)<br>2. Apply                 | Exercises filtered by selected vibe                         | P0       |
| EXERCISE-004 | Create custom exercise   | 1. Click "Create Exercise"<br>2. Fill form (name, vibe, equipment, metrics)<br>3. Save | Exercise created, appears in personal library only          | P0       |
| EXERCISE-005 | Edit own exercise        | 1. Open custom exercise<br>2. Edit details<br>3. Save                                  | Exercise updated, changes saved                             | P0       |
| EXERCISE-006 | Delete own exercise      | 1. Delete custom exercise<br>2. Confirm                                                | Exercise soft-deleted, removed from library                 | P0       |
| EXERCISE-007 | View exercise details    | 1. Click on exercise<br>2. View details                                                | Exercise details displayed: metrics, equipment, description | P1       |
| EXERCISE-008 | Exercise form validation | 1. Submit form with missing required fields<br>2. Observe                              | Field-level validation errors                               | P1       |

---

#### 4.3.2 Exercise Management (Admin)

**Test Cases:**

| ID           | Test Case                              | Steps                                                          | Expected Result                                          | Priority |
| ------------ | -------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| EXERCISE-009 | Admin view global exercises            | 1. Login as admin<br>2. Navigate to exercise library           | Global exercises visible, admin actions available        | P0       |
| EXERCISE-010 | Admin create global exercise           | 1. Create exercise as admin<br>2. Mark as "global"<br>3. Save  | Exercise created in global library, visible to all users | P0       |
| EXERCISE-011 | Admin edit global exercise             | 1. Edit global exercise<br>2. Save                             | Exercise updated, audit log created                      | P0       |
| EXERCISE-012 | Admin delete global exercise           | 1. Delete global exercise<br>2. Confirm (2-step)               | Exercise soft-deleted, audit log created                 | P0       |
| EXERCISE-013 | Non-admin cannot edit global exercises | 1. Login as regular user<br>2. Attempt to edit global exercise | Edit option not available, 403 if API called directly    | P0       |

---

### 4.4 Session Planning & Logging

#### 4.4.1 Session Planning

**Test Cases:**

| ID          | Test Case                | Steps                                                                                          | Expected Result                                       | Priority |
| ----------- | ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| SESSION-001 | Create new session plan  | 1. Navigate to `/planner`<br>2. Click "New Session"<br>3. Add exercises, sets, reps<br>4. Save | Session plan created, appears in planner list         | P0       |
| SESSION-002 | Add exercise to session  | 1. Create session<br>2. Click "Add Exercise"<br>3. Select exercise from library<br>4. Add      | Exercise added to session with default sets/reps      | P0       |
| SESSION-003 | Edit session plan        | 1. Open existing session<br>2. Modify exercises/sets/reps<br>3. Save                           | Changes saved, session updated                        | P0       |
| SESSION-004 | Delete session plan      | 1. Delete session<br>2. Confirm                                                                | Session deleted, removed from list                    | P0       |
| SESSION-005 | Schedule session         | 1. Create session<br>2. Set date/time<br>3. Save                                               | Session scheduled, appears in calendar view           | P0       |
| SESSION-006 | Create recurring session | 1. Create session<br>2. Set recurrence (daily/weekly)<br>3. Save                               | Recurring sessions generated, DST-safe                | P0       |
| SESSION-007 | Clone session            | 1. Open existing session<br>2. Click "Clone"<br>3. Modify if needed<br>4. Save                 | New session created from template, original unchanged | P1       |
| SESSION-008 | Session form validation  | 1. Submit session with missing required fields<br>2. Observe                                   | Validation errors displayed                           | P1       |

---

#### 4.4.2 Session Logging

**Test Cases:**

| ID          | Test Case                           | Steps                                                                                                                   | Expected Result                                          | Priority |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| SESSION-009 | Log session from scratch            | 1. Navigate to `/logger`<br>2. Create new session<br>3. Add exercises, log sets (reps, weight, RPE)<br>4. Mark complete | Session logged, points awarded, badges shown             | P0       |
| SESSION-010 | Log session from plan               | 1. Load session from planner<br>2. Exercises pre-filled<br>3. Log actual performance<br>4. Mark complete                | Session logged, linked to plan, points awarded           | P0       |
| SESSION-011 | Log set with all metrics            | 1. Log set with reps, weight, RPE, tempo, rest<br>2. Save                                                               | All metrics saved correctly                              | P0       |
| SESSION-012 | Log session with partial completion | 1. Log session, complete some exercises<br>2. Mark complete                                                             | Session saved, completion percentage calculated          | P1       |
| SESSION-013 | Edit logged session                 | 1. Open logged session<br>2. Edit sets/metrics<br>3. Save                                                               | Changes saved, points recalculated if needed             | P1       |
| SESSION-014 | Delete logged session               | 1. Delete logged session<br>2. Confirm                                                                                  | Session deleted, points adjusted, removed from history   | P0       |
| SESSION-015 | Session visibility settings         | 1. Set visibility (private/public/followers/link)<br>2. Save                                                            | Visibility applied, session appears/disappears from feed | P0       |
| SESSION-016 | Session sharing                     | 1. Generate share link<br>2. Copy link<br>3. Open in incognito                                                          | Link works, session visible to non-authenticated users   | P1       |

---

### 4.5 Training Plans

**Test Cases:**

| ID       | Test Case             | Steps                                                                                  | Expected Result                                            | Priority |
| -------- | --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- |
| PLAN-001 | Create training plan  | 1. Navigate to Plans<br>2. Create new plan<br>3. Add sessions, set schedule<br>4. Save | Plan created, sessions scheduled                           | P0       |
| PLAN-002 | Edit training plan    | 1. Open plan<br>2. Modify sessions/schedule<br>3. Save                                 | Plan updated, schedule adjusted                            | P0       |
| PLAN-003 | Archive training plan | 1. Archive plan<br>2. Confirm                                                          | Plan archived, no longer active, history preserved         | P1       |
| PLAN-004 | View plan progress    | 1. Open plan<br>2. View progress statistics                                            | Progress displayed: completion %, sessions completed/total | P1       |
| PLAN-005 | Plan statistics       | 1. View plan analytics<br>2. Check trends                                              | Statistics accurate, charts render correctly               | P1       |

---

### 4.6 Dashboard & Analytics

#### 4.6.1 Dashboard

**Test Cases:**

| ID       | Test Case                   | Steps                                                                                   | Expected Result                                                   | Priority |
| -------- | --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| DASH-001 | View dashboard              | 1. Navigate to `/dashboard`<br>2. View summary                                          | Dashboard loads, metrics displayed: streak, sessions, volume, PRs | P0       |
| DASH-002 | Dashboard metrics accuracy  | 1. Complete sessions<br>2. Verify dashboard updates                                     | Metrics update correctly, calculations accurate                   | P0       |
| DASH-003 | Training streak calculation | 1. Complete sessions daily<br>2. Check streak                                           | Streak increments correctly, resets on missed day                 | P0       |
| DASH-004 | Personal records display    | 1. View PRs section<br>2. Verify PRs                                                    | Top 3 PRs displayed correctly                                     | P1       |
| DASH-005 | Training trends chart       | 1. Select time range (4w/8w)<br>2. Select granularity (weekly/monthly)<br>3. View chart | Chart updates, data accurate, responsive                          | P1       |
| DASH-006 | Dashboard performance       | 1. Load dashboard<br>2. Measure load time                                               | Dashboard loads < 2s, API calls < 5                               | P1       |

---

#### 4.6.2 Progress & Analytics

**Test Cases:**

| ID       | Test Case                    | Steps                                                         | Expected Result                                    | Priority |
| -------- | ---------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | -------- |
| PROG-001 | View progress page           | 1. Navigate to `/progress`<br>2. View analytics               | Progress page loads, charts/tables displayed       | P0       |
| PROG-002 | Export data (CSV)            | 1. Select date range<br>2. Click "Export CSV"<br>3. Download  | CSV file downloaded, data accurate, format correct | P0       |
| PROG-003 | Export data (JSON)           | 1. Select date range<br>2. Click "Export JSON"<br>3. Download | JSON file downloaded, valid JSON, data complete    | P0       |
| PROG-004 | Export with large date range | 1. Select 1+ year range<br>2. Export                          | Export succeeds or shows appropriate limit message | P1       |
| PROG-005 | Progress trends              | 1. View trends over time<br>2. Verify calculations            | Trends accurate, charts render correctly           | P1       |
| PROG-006 | Plan progress tracking       | 1. View plan progress<br>2. Verify completion %               | Progress percentage accurate                       | P1       |

---

### 4.7 Gamification (Points & Badges)

**Test Cases:**

| ID         | Test Case                            | Steps                                                           | Expected Result                                        | Priority |
| ---------- | ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------ | -------- |
| POINTS-001 | Points awarded on session completion | 1. Complete session<br>2. Check points                          | Points awarded, notification shown                     | P0       |
| POINTS-002 | Points calculation accuracy          | 1. Complete sessions with different volumes<br>2. Verify points | Points calculated correctly based on volume/completion | P0       |
| POINTS-003 | Badge earned notification            | 1. Complete session that triggers badge<br>2. Observe           | Badge notification shown, badge appears in profile     | P0       |
| POINTS-004 | View points history                  | 1. Navigate to points page<br>2. View history                   | Points history displayed, transactions accurate        | P1       |
| POINTS-005 | Streak calculation                   | 1. Complete sessions daily<br>2. Check streak                   | Streak increments, badge earned at milestones          | P1       |
| POINTS-006 | Seasonal events                      | 1. Participate in seasonal event<br>2. Verify points/badges     | Event points/badges awarded correctly                  | P1       |
| POINTS-007 | Points not exposed in API            | 1. Inspect API responses<br>2. Check for points formula         | Points formula not exposed, only totals shown          | P0       |

---

### 4.8 Social Features (Feed & Sharing)

#### 4.8.1 Public Feed

**Test Cases:**

| ID       | Test Case                    | Steps                                      | Expected Result                               | Priority |
| -------- | ---------------------------- | ------------------------------------------ | --------------------------------------------- | -------- |
| FEED-001 | View public feed             | 1. Navigate to `/feed`<br>2. View sessions | Public sessions displayed, pagination works   | P0       |
| FEED-002 | Feed filtering               | 1. Filter by vibe<br>2. Apply filters      | Feed updates, only matching sessions shown    | P0       |
| FEED-003 | Feed search                  | 1. Search feed<br>2. Submit query          | Relevant sessions displayed                   | P1       |
| FEED-004 | Like session                 | 1. Click like on session<br>2. Verify      | Like count increments, like persists          | P0       |
| FEED-005 | Unlike session               | 1. Click like again<br>2. Verify           | Like count decrements, like removed           | P0       |
| FEED-006 | Bookmark session             | 1. Click bookmark<br>2. Verify             | Session bookmarked, appears in bookmarks list | P0       |
| FEED-007 | Share session                | 1. Click share<br>2. Generate link         | Share link generated, works when opened       | P1       |
| FEED-008 | Comment on session           | 1. Add comment<br>2. Submit                | Comment posted, appears in feed               | P1       |
| FEED-009 | Private sessions not in feed | 1. Create private session<br>2. Check feed | Private session not visible in public feed    | P0       |
| FEED-010 | Feed pagination              | 1. Scroll to bottom<br>2. Load more        | More sessions loaded, infinite scroll works   | P1       |

---

#### 4.8.2 User Following

**Test Cases:**

| ID       | Test Case                 | Steps                                                                                   | Expected Result                            | Priority |
| -------- | ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ | -------- |
| FEED-011 | Follow user               | 1. View user profile<br>2. Click "Follow"                                               | User followed, follower count updates      | P0       |
| FEED-012 | Unfollow user             | 1. View followed user<br>2. Click "Unfollow"                                            | User unfollowed, follower count updates    | P0       |
| FEED-013 | View followers list       | 1. Go to profile<br>2. View followers                                                   | Followers list displayed, pagination works | P1       |
| FEED-014 | View following list       | 1. Go to profile<br>2. View following                                                   | Following list displayed                   | P1       |
| FEED-015 | Followers-only visibility | 1. Create session with "followers" visibility<br>2. Check feed as follower/non-follower | Visible to followers only                  | P0       |

---

#### 4.8.3 Content Reporting & Moderation

**Test Cases:**

| ID       | Test Case                       | Steps                                                            | Expected Result                                 | Priority |
| -------- | ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | -------- |
| FEED-016 | Report inappropriate content    | 1. Click "Report" on session<br>2. Select reason<br>3. Submit    | Report submitted, admin notified                | P0       |
| FEED-017 | Report rate limiting            | 1. Submit 10+ reports rapidly<br>2. Observe                      | Rate limit applied                              | P1       |
| FEED-018 | Admin view reports              | 1. Login as admin<br>2. Navigate to reports queue                | Reports displayed, sorted by severity/date      | P0       |
| FEED-019 | Admin moderate report (dismiss) | 1. Open report<br>2. Click "Dismiss"<br>3. Confirm (2-step)      | Report dismissed, audit log created             | P0       |
| FEED-020 | Admin moderate report (hide)    | 1. Open report<br>2. Click "Hide Content"<br>3. Confirm (2-step) | Content hidden, user notified                   | P0       |
| FEED-021 | Admin moderate report (ban)     | 1. Open report<br>2. Click "Ban User"<br>3. Confirm (2-step)     | User banned, content removed, audit log created | P0       |

---

### 4.9 Admin Functions

#### 4.9.1 User Management

**Test Cases:**

| ID        | Test Case                               | Steps                                                            | Expected Result                                 | Priority |
| --------- | --------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | -------- |
| ADMIN-001 | Admin search users                      | 1. Login as admin<br>2. Go to User Management<br>3. Search users | Users displayed, search works                   | P0       |
| ADMIN-002 | Admin view user profile                 | 1. Click on user<br>2. View profile                              | User profile displayed, admin actions available | P0       |
| ADMIN-003 | Admin suspend user                      | 1. Select user<br>2. Click "Suspend"<br>3. Confirm (2-step)      | User suspended, cannot login, audit log created | P0       |
| ADMIN-004 | Admin ban user                          | 1. Select user<br>2. Click "Ban"<br>3. Confirm (2-step)          | User banned, content removed, audit log created | P0       |
| ADMIN-005 | Admin activate user                     | 1. Select suspended user<br>2. Click "Activate"<br>3. Confirm    | User activated, can login again                 | P0       |
| ADMIN-006 | Admin delete user                       | 1. Select user<br>2. Click "Delete"<br>3. Confirm (2-step)       | User deletion initiated, 14-day grace period    | P0       |
| ADMIN-007 | Non-admin cannot access admin functions | 1. Login as regular user<br>2. Attempt to access `/admin/*`      | 403 Forbidden, admin routes not accessible      | P0       |

---

#### 4.9.2 System Controls

**Test Cases:**

| ID        | Test Case              | Steps                                           | Expected Result                                          | Priority |
| --------- | ---------------------- | ----------------------------------------------- | -------------------------------------------------------- | -------- |
| ADMIN-008 | View system status     | 1. Login as admin<br>2. Go to System Controls   | System status displayed: health, metrics                 | P0       |
| ADMIN-009 | Enable read-only mode  | 1. Toggle read-only mode<br>2. Confirm (2-step) | System in read-only mode, writes blocked, users notified | P0       |
| ADMIN-010 | Disable read-only mode | 1. Toggle read-only mode off<br>2. Confirm      | System back to normal, writes enabled                    | P0       |
| ADMIN-011 | Maintenance mode       | 1. Enable maintenance mode<br>2. Verify         | Maintenance page shown, API returns 503                  | P0       |

---

### 4.10 Internationalization (i18n)

**Test Cases:**

| ID       | Test Case                    | Steps                                               | Expected Result                                 | Priority |
| -------- | ---------------------------- | --------------------------------------------------- | ----------------------------------------------- | -------- |
| I18N-001 | Switch language (EN → DE)    | 1. Change language to German<br>2. Navigate pages   | All UI text translated, dates/numbers localized | P0       |
| I18N-002 | Switch language (DE → EN)    | 1. Change language to English<br>2. Navigate pages  | All UI text translated                          | P0       |
| I18N-003 | Language persistence         | 1. Change language<br>2. Logout, login<br>3. Verify | Language preference persists                    | P0       |
| I18N-004 | Date localization            | 1. Set language to DE<br>2. View dates              | Dates formatted in German format (DD.MM.YYYY)   | P1       |
| I18N-005 | Number localization          | 1. Set language to DE<br>2. View numbers            | Numbers formatted with German separators        | P1       |
| I18N-006 | Missing translation fallback | 1. Use untranslated feature<br>2. Observe           | Falls back to English, no broken text           | P1       |

---

### 4.11 Accessibility Testing

**Test Cases:**

| ID       | Test Case                   | Steps                                                                                            | Expected Result                                    | Priority |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------- |
| A11Y-001 | Keyboard navigation         | 1. Navigate entire app with keyboard only (Tab, Enter, Arrow keys)<br>2. Verify focus indicators | All interactive elements accessible, focus visible | P0       |
| A11Y-002 | Screen reader compatibility | 1. Use screen reader (NVDA/JAWS/VoiceOver)<br>2. Navigate app                                    | All content announced, labels descriptive          | P0       |
| A11Y-003 | Color contrast              | 1. Check text/background contrast<br>2. Use contrast checker                                     | All text meets WCAG AA (4.5:1)                     | P0       |
| A11Y-004 | ARIA labels                 | 1. Inspect elements<br>2. Check ARIA attributes                                                  | All interactive elements have ARIA labels          | P0       |
| A11Y-005 | Form accessibility          | 1. Fill forms with screen reader<br>2. Verify                                                    | All form fields labeled, errors announced          | P0       |
| A11Y-006 | Image alt text              | 1. View images with screen reader<br>2. Check alt text                                           | All images have descriptive alt text               | P1       |
| A11Y-007 | Reduced motion              | 1. Enable reduced motion in OS<br>2. Navigate app                                                | Animations respect preference                      | P1       |
| A11Y-008 | Focus management            | 1. Open modals<br>2. Check focus                                                                 | Focus trapped in modal, returns on close           | P1       |

**Tools:** axe DevTools, WAVE, Lighthouse, Keyboard + Screen Reader

---

### 4.12 Cross-Browser & Device Testing

**Test Cases:**

| ID        | Test Case              | Steps                                                            | Expected Result                                  | Priority |
| --------- | ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | -------- |
| CROSS-001 | Chrome desktop         | 1. Test all major features in Chrome<br>2. Verify functionality  | All features work, no console errors             | P0       |
| CROSS-002 | Firefox desktop        | 1. Test all major features in Firefox<br>2. Verify functionality | All features work, no console errors             | P0       |
| CROSS-003 | Safari desktop         | 1. Test all major features in Safari<br>2. Verify functionality  | All features work, no console errors             | P0       |
| CROSS-004 | Edge desktop           | 1. Test all major features in Edge<br>2. Verify functionality    | All features work, no console errors             | P1       |
| CROSS-005 | Chrome mobile          | 1. Test on Android device<br>2. Verify responsive design         | Layout responsive, touch interactions work       | P1       |
| CROSS-006 | Safari mobile          | 1. Test on iOS device<br>2. Verify responsive design             | Layout responsive, touch interactions work       | P1       |
| CROSS-007 | Tablet view            | 1. Test on tablet (768×1024)<br>2. Verify layout                 | Layout adapts correctly, touch interactions work | P1       |
| CROSS-008 | Small screen (375×667) | 1. Test on small mobile<br>2. Verify layout                      | No horizontal scroll, content readable           | P1       |

---

### 4.13 Performance & Responsiveness

**Test Cases:**

| ID       | Test Case                   | Steps                                                                                                                                                 | Expected Result                                               | Priority |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| PERF-001 | Page load time              | 1. Measure initial page load<br>2. Check Lighthouse<br>3. Record INP in a DevTools Performance trace or Lighthouse timespan while clicking and typing | LCP < 2.5s, CLS < 0.1, INP < 200ms                            | P0       |
| PERF-002 | API response time           | 1. Monitor network tab<br>2. Check API calls                                                                                                          | p95 < 600ms for analytics, < 400ms for feed, < 300ms for CRUD | P1       |
| PERF-003 | Image optimization          | 1. Check image loading<br>2. Verify formats                                                                                                           | Images optimized (WebP/AVIF), lazy loading works              | P1       |
| PERF-004 | Bundle size                 | 1. Check network tab<br>2. Verify bundle sizes                                                                                                        | Initial bundle < 500KB, total < 2MB                           | P1       |
| PERF-005 | Infinite scroll performance | 1. Scroll feed extensively<br>2. Monitor performance                                                                                                  | No memory leaks, smooth scrolling                             | P1       |

---

### 4.14 Security & Privacy

**Test Cases:**

| ID      | Test Case                | Steps                                            | Expected Result                                        | Priority |
| ------- | ------------------------ | ------------------------------------------------ | ------------------------------------------------------ | -------- |
| SEC-001 | HTTPS enforcement        | 1. Attempt HTTP access<br>2. Verify              | Redirects to HTTPS, HSTS header present                | P0       |
| SEC-002 | Security headers         | 1. Check response headers<br>2. Verify           | CSP, HSTS, Referrer-Policy, Permissions-Policy present | P0       |
| SEC-003 | XSS protection           | 1. Enter script tags in forms<br>2. Submit       | Scripts sanitized, not executed                        | P0       |
| SEC-004 | CSRF protection          | 1. Attempt CSRF attack<br>2. Verify              | CSRF tokens validated, requests rejected               | P0       |
| SEC-005 | SQL injection protection | 1. Enter SQL in forms<br>2. Submit               | Input sanitized, no SQL executed                       | P0       |
| SEC-006 | Privacy-by-default       | 1. Create session<br>2. Check default visibility | Default visibility is "private"                        | P0       |
| SEC-007 | GDPR data export         | 1. Request data export<br>2. Download            | Complete data export provided (≤30 days)               | P0       |
| SEC-008 | GDPR data deletion       | 1. Request account deletion<br>2. Verify         | Data deleted, 14-day grace period, backup cleanup      | P0       |
| SEC-009 | Rate limiting            | 1. Make rapid API requests<br>2. Observe         | Rate limits applied, appropriate errors returned       | P1       |
| SEC-010 | Session security         | 1. Check JWT tokens<br>2. Verify                 | Tokens signed with RS256, expiration enforced          | P0       |

---

## 5. Test Completion Criteria

### 5.1 Dev → Staging Gate

**Required for promotion:**

- [ ] All **P0 (Critical)** test cases pass
- [ ] ≤5 **P1 (High)** test cases fail (with approved waivers)
- [ ] All **Critical** and **High** severity defects fixed or waived
- [ ] Test report completed and reviewed by QA Lead
- [ ] Product Owner sign-off for feature acceptance (if new features)

**Blocking criteria:**

- Any **Critical** severity defect
- Any **P0** test case failure without approved waiver
- Security vulnerabilities
- Data loss or corruption issues

---

### 5.2 Staging → Production Gate

**Required for promotion:**

- [ ] **Smoke test** passes (critical user paths)
- [ ] **Regression test** passes (no regressions in existing features)
- [ ] All **Critical** and **High** defects from staging fixed
- [ ] Performance benchmarks met (p95 response times)
- [ ] Security scan passes (0 High/Critical vulnerabilities)
- [ ] Accessibility audit passes (WCAG 2.2 AA)
- [ ] QA Lead approval
- [ ] Tech Lead approval (technical gates)

**Smoke test (must pass):**

1. User registration → email verification → login
2. Create session plan → log session → view dashboard
3. View feed → like/bookmark → share session
4. Admin: view reports → moderate content
5. Export data → verify format

**Blocking criteria:**

- Smoke test failures
- Security vulnerabilities
- Performance regressions > 10%
- Critical accessibility issues

---

## 6. Reporting & Sign-off

### 6.1 Test Report Template

**Test Report Structure:**

```markdown
# Test Report: [Release/Feature Name]

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Development / Staging
**Build/Version:** [Commit SHA or version]

## Summary

- **Total Test Cases:** X
- **Passed:** Y
- **Failed:** Z
- **Blocked:** A
- **Skipped:** B
- **Pass Rate:** Y/X × 100%

## Test Results by Area

### Authentication & Security

- Passed: X/Y
- Failed: [List test IDs]
- Notes: [Any observations]

[... repeat for each area ...]

## Defects Found

### Critical

- [Defect ID]: [Title] - [Status]

### High

- [Defect ID]: [Title] - [Status]

[... etc ...]

## Recommendations

- [ ] Approve for promotion to [Staging/Production]
- [ ] Block promotion - [Reason]
- [ ] Conditional approval - [Conditions]

## Sign-offs

- **QA Tester:** [Name] - [Date]
- **QA Lead:** [Name] - [Date]
- **Product Owner:** [Name] - [Date] (if applicable)
- **Tech Lead:** [Name] - [Date] (if applicable)
```

---

### 6.2 Test Execution Tracking

**Use test tracking spreadsheet or tool:**

| Test ID  | Test Case                       | Status | Notes                 | Defect ID | Tester | Date       |
| -------- | ------------------------------- | ------ | --------------------- | --------- | ------ | ---------- |
| AUTH-001 | Successful registration         | PASS   | -                     | -         | [Name] | YYYY-MM-DD |
| AUTH-002 | Registration with invalid email | FAIL   | Error message unclear | BUG-123   | [Name] | YYYY-MM-DD |
| ...      | ...                             | ...    | ...                   | ...       | ...    | ...        |

---

### 6.3 Sign-off Process

1. **QA Tester** completes test execution, documents results
2. **QA Lead** reviews test report, approves/rejects promotion
3. **Product Owner** reviews feature acceptance (new features only)
4. **Tech Lead** reviews technical gates (performance, security)
5. **Final approval** → Code promoted to next environment

**Approval criteria:**

- All blocking criteria met
- Test report complete and accurate
- Defects tracked and prioritized
- Sign-offs obtained from required roles

---

## Appendix: Test Data Requirements

### A.1 Test User Accounts

Create and maintain these test accounts:

| Email                          | Password             | Role  | Status     | Purpose                     |
| ------------------------------ | -------------------- | ----- | ---------- | --------------------------- |
| `test.user1@fitvibe.test`      | `TestPassword123!@#` | user  | verified   | Standard user workflows     |
| `test.user2@fitvibe.test`      | `TestPassword123!@#` | user  | verified   | Social features (following) |
| `test.admin@fitvibe.test`      | `TestPassword123!@#` | admin | verified   | Admin functions             |
| `test.coach@fitvibe.test`      | `TestPassword123!@#` | coach | verified   | Coach features              |
| `test.suspended@fitvibe.test`  | `TestPassword123!@#` | user  | suspended  | Moderation testing          |
| `test.unverified@fitvibe.test` | `TestPassword123!@#` | user  | unverified | Email verification flows    |

### A.2 Test Data Seeding

**Required test data:**

- **Exercises:** 50+ exercises across all 6 vibes (Earth, Air, Water, Fire, Shadow, Aether)
- **Sessions:** 20+ logged sessions per test user (various dates, vibes, completion states)
- **Plans:** 5+ training plans per test user (active and archived)
- **Feed content:** 30+ public sessions from various users
- **Social data:** Follow relationships, likes, bookmarks, comments
- **Points/Badges:** Various point totals and badge achievements
- **Reports:** 5+ content reports in various states (pending, dismissed, hidden)

### A.3 Test Data Maintenance

- **Reset frequency:** Weekly (or before major test cycles)
- **Data cleanup:** Remove test data older than 30 days
- **Data anonymization:** Ensure no real PII in test data
- **Backup:** Maintain test data backup for consistent testing

---

## Document Maintenance

**Update this document when:**

- New features are added
- Test cases need modification
- Process changes (gates, roles, criteria)
- New browsers/devices need support

**Version History:**

- v1.0 (2025-01-26): Initial comprehensive manual testing protocol

---

## References

- [Test Suite (Automated)](./Test_Suite.md) - Automated test coverage
- [QA Plan](./4a.Testing_and_Quality_Assurance_Plan.md) - Overall QA strategy
- [User Flow Documentation](../3.Sensory_Design_System/3.c.User_Flow_Documentation.md) - User journey maps
- [Product Requirements](../1.Product_Requirements/1.Product_Requirements_Document.md) - Feature specifications
