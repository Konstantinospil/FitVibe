# FR-013 — Lockout UI Feedback

---

**Requirement ID**: FR-013  
**Type**: Functional Requirement  
**Title**: Lockout UI Feedback & Countdown Timer  
**Status**: Superseded  
**Priority**: Medium  
**Gate**: SILVER  
**Owner**: ENG/UX  
**Created**: 2025-11-30  
**Updated**: 2026-09-23

---

## Executive Summary

> **Superseded by Phase 14 authentication-state hardening (2026-09-23).**
> Login clients must no longer receive account/IP lockout type, remaining-attempt counters,
> or countdown metadata because those signals can become an account/password oracle.
> Temporary throttling remains enforced server-side while the public stage-one response
> stays an opaque pre-authentication challenge.

This document is retained as historical context for the previous lockout-feedback design.

**Lifecycle note:** `Superseded` is a terminal documentation status. The embedded historical labels `US-13.1`–`US-13.3` below are not canonical user-story identifiers and must not be used for future work. The `US-13.*` namespace belongs to E13 (WCAG 2.2 Compliance Update).

This functional requirement specified user interface feedback for brute force protection lockouts. Users must see clear information about lockout status, remaining attempts, and countdown timers.

Provide transparent feedback when login attempts are blocked due to brute force protection, including remaining attempts before lockout and countdown timers during lockout periods.

## Business Context

- **Business Objective**: Improve user experience during security lockouts by providing clear, actionable feedback
- **Success Criteria**: Users understand why login is blocked, how many attempts remain, and when they can try again
- **Target Users**: All users attempting to log in (especially those who may have forgotten passwords or made typos)

## Traceability

- **PRD Reference**: PRD §Auth, §Security
- **TDD Reference**: TDD §Auth, §Brute Force Protection
- **Related**: [FR-002: Login & Session](./FR-002-login-and-session.md), [NFR-001: Security](./NFR-001-security.md)

## Functional Requirements

### Lockout Error Response Enhancement

The backend shall provide structured error data for lockout responses:

- **Structured Error Data**: Error responses for `AUTH_ACCOUNT_LOCKED` and `AUTH_IP_LOCKED` must include:
  - `remainingSeconds`: Number of seconds until lockout expires
  - `attemptCount`: Current number of failed attempts (for account-level)
  - `totalAttemptCount`: Total failed attempts from IP (for IP-level)
  - `distinctEmailCount`: Number of distinct emails attempted from IP (for IP-level)
  - `lockoutType`: Either "account" or "ip"
  - `maxAttempts`: Maximum attempts before lockout (for pre-lockout warnings)

### Pre-Lockout Warnings

The system shall warn users before lockout occurs:

- **Account-Level Warning**: Show remaining attempts before account lockout (e.g., "3 attempts remaining before account lockout")
- **IP-Level Warning**: Show remaining attempts before IP lockout (e.g., "2 attempts remaining before IP lockout")
- **Warning Threshold**: Display warnings when user is within 3 attempts of lockout

### Lockout UI Components

The frontend shall display:

1. **Countdown Timer**: Real-time countdown showing remaining lockout time
   - Format: "MM:SS" (minutes:seconds)
   - Updates every second
   - Stops when lockout expires
   - Accessible: Screen reader announces remaining time

2. **Attempt Counter**: Display remaining attempts before lockout
   - Only shown when not locked out
   - Updates after each failed attempt
   - Clear visual indicator (e.g., progress bar or badge)

3. **Lockout Message**: Clear explanation of why login is blocked
   - Account-level: "Account temporarily locked due to multiple failed login attempts"
   - IP-level: "IP address temporarily locked due to multiple failed login attempts"
   - Include lockout duration information

4. **Visual States**:
   - **Warning State**: Yellow/orange indicator when approaching lockout
   - **Locked State**: Red indicator with countdown timer
   - **Normal State**: No special indicator

### Error Response Format

Backend error responses shall follow this structure:

```json
{
  "error": {
    "code": "AUTH_ACCOUNT_LOCKED" | "AUTH_IP_LOCKED",
    "message": "Human-readable message",
    "details": {
      "remainingSeconds": 900,
      "lockoutType": "account" | "ip",
      "attemptCount": 5,
      "totalAttemptCount": 10,
      "distinctEmailCount": 3,
      "maxAttempts": 5
    }
  }
}
```

## User Stories

### US-13.1: Pre-Lockout Warning

**As a** user attempting to log in  
**I want to** see how many attempts I have remaining before lockout  
**So that** I can avoid being locked out

**Acceptance Criteria**:

- Warning appears when within 3 attempts of lockout
- Attempt counter updates after each failed attempt
- Warning is visually distinct but not alarming

### US-13.2: Lockout Countdown Timer

**As a** user who has been locked out  
**I want to** see a countdown timer showing when I can try again  
**So that** I know exactly when to retry login

**Acceptance Criteria**:

- Timer displays in MM:SS format
- Timer updates every second
- Timer automatically stops when lockout expires
- Screen reader announces remaining time

### US-13.3: Clear Lockout Explanation

**As a** user who has been locked out  
**I want to** understand why I'm locked out and what type of lockout it is  
**So that** I can take appropriate action

**Acceptance Criteria**:

- Message clearly explains account vs IP lockout
- Message includes lockout duration
- Message is accessible (screen reader friendly)

## Technical Requirements

### Backend

- Enhance `HttpError` responses to include structured `details` object
- Include lockout metadata in error responses
- Maintain backward compatibility (graceful degradation if frontend doesn't parse details)

### Frontend

- Parse structured error details from API responses
- Create reusable `LockoutTimer` component
- Create reusable `AttemptCounter` component
- Integrate components into `LoginFormContent`
- Use i18n for all user-facing text
- Ensure accessibility (ARIA labels, screen reader support)

## Related Epics

- [E11: Authentication & Registration](../b.Epics/E11-authentication-and-registration.md)

## Dependencies

### Technical Dependencies

- React hooks for timer management
- i18next for translations
- Existing error handling infrastructure

### Feature Dependencies

- [FR-002: Login & Session](./FR-002-login-and-session.md) - Login functionality
- IP-based brute force protection (recently implemented)

## Constraints

### Technical Constraints

- Timer must be accurate (server time sync may be needed for long lockouts)
- Component must be performant (no memory leaks from timers)
- Must work with existing error handling

### Business Constraints

- Must not reveal sensitive information (e.g., exact attempt counts for security)
- Must be accessible (WCAG 2.2 AA compliant)

## Assumptions

- Users have JavaScript enabled
- Users understand countdown timers
- Browser supports setInterval/clearInterval

## Risks & Issues

- **Risk**: Timer may desync with server time for long lockouts
  - **Mitigation**: Use server-provided remainingSeconds, recalculate client-side
- **Risk**: Component may cause memory leaks if not cleaned up properly
  - **Mitigation**: Proper useEffect cleanup in React components
- **Risk**: Users may find countdown timer stressful
  - **Mitigation**: Use neutral colors, clear messaging

## Open Questions

- Should we show attempt counts for IP-level lockouts? (Security consideration)
- Should timer persist across page refreshes? (Probably not, for security)

## Related Requirements

- [FR-002: Login & Session](./FR-002-login-and-session.md) - Login functionality
- [NFR-001: Security](./NFR-001-security.md) - Security requirements
- [NFR-004: Accessibility](./NFR-004-a11y.md) - Accessibility requirements

---

**Last Updated**: 2026-09-23  
**Next Review**: N/A (superseded)
