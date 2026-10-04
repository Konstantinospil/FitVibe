# NFR-001 — Security

---

**Requirement ID**: NFR-001  
**Type**: Non-Functional Requirement  
**Title**: Security  
**Status**: Done  
**Priority**: High  
**Gate**: GOLD  
**Owner**: SEC/ENG  
**Created**: 2025-11-21  
**Updated**: 2026-09-25

---

## Executive Summary

This non-functional requirement defines security standards and constraints for the FitVibe platform.

Ensure platform security through headers, rate limiting, and threat protection.

## Business Context

- **Business Objective**: Ensure platform security through headers, rate limiting, and threat protection.
- **Success Criteria**: Security headers are properly configured, rate limiting prevents abuse, and threats are detected.
- **Target Users**: All users (security affects everyone)

## Traceability

- **PRD Reference**: PRD §Security
- **TDD Reference**: TDD §Security

## Non-Functional Requirements

### Security Headers

The system shall implement comprehensive security headers:

- **CSP**: Content Security Policy with no inline scripts/styles, nonce-based script-src
- **HSTS**: HTTP Strict Transport Security with min-age ≥6 months
- **Referrer-Policy**: Strict referrer policy
- **Permissions-Policy**: Limits sensors and features
- **Cookie Security**: HttpOnly, Secure, SameSite flags properly configured

### Rate Limiting

- **Auth Endpoints**: Apply temporary throttling and abuse controls to authentication endpoints without exposing password/account validity.
- **Opaque Pre-Authentication Responses**: Pre-authentication failures must not expose account/IP lockout type, remaining-attempt counters, or countdown metadata where this would create an oracle.
- **No Cognitive Challenges**: CAPTCHA/puzzle-style cognitive authentication challenges are not part of the target design. Abuse resistance is provided through throttling, rate limiting, opaque responses, second-factor controls, and recovery workflows.
- **Sensitive 2FA Administration**: Follow [ADR-030](../../2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR-030-account-security-controls.md): password confirmation plus a current second factor is required to disable/replace active 2FA or regenerate backup codes.

### Token Security

- **JWT Validation**: JWT claims validated (aud/iss/exp) with clock skew ≤30s
- **Algorithm Pinning**: RS256 algorithm enforced
- **Key Rotation**: Key rotation (kid) tested and supported

### File Upload Security

- **Antivirus Scanning**: Upload AV scan rejects EICAR and quarantines infected files
- **User-Safe Messages**: User-friendly error messages for rejected files

## Related Epics

- [E17: Security](../b.Epics/E17-security.md)

## Dependencies

### Technical Dependencies

- Security header middleware
- Rate limiting library
- JWT library
- Antivirus scanning service

### Feature Dependencies

- [FR-001: User Registration](./FR-001-user-registration.md) - User accounts
- [FR-002: Login & Session](./FR-002-login-and-session.md) - Authentication
- [FR-009: Profile & Settings](./FR-009-profile-and-settings.md) - File uploads

## Constraints

### Technical Constraints

- CSP report-only mode for 7 days before enforcement
- CSP violations ≤1% before enforcement
- Rate limit: ≥10 req/min/IP for auth endpoints
- Clock skew tolerance: ≤30s

### Business Constraints

- Security must not degrade user experience
- Authentication must remain accessible without CAPTCHA or puzzle-style cognitive tests.

## Assumptions

- Users understand security measures
- Security headers are supported by browsers
- Antivirus service is reliable

## Risks & Issues

- **Risk**: Security headers may break some functionality
- **Risk**: Rate limiting may prevent legitimate access
- **Risk**: Abuse controls may block legitimate users if thresholds are poorly calibrated

## Open Questions

- Should there be different rate limits for different user types?
- How should abuse thresholds be calibrated without creating an account-enumeration oracle?

## Related Requirements

- [FR-001: User Registration](./FR-001-user-registration.md) - Registration security
- [FR-002: Login & Session](./FR-002-login-and-session.md) - Authentication security
- [FR-009: Profile & Settings](./FR-009-profile-and-settings.md) - File upload security

---

**Last Updated**: 2026-09-25  
**Next Review**: 2026-10-25
