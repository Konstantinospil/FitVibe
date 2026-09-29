# FitVibe Implementation Principles

**Last Updated**: 2026-09-30
**Purpose**: Core implementation principles and preferences derived from codebase analysis and development practices.

## Overview

This document captures the fundamental principles that guide all implementation work in FitVibe. These principles ensure consistency, quality, and maintainability across the entire codebase.

---

## Core Principles

### 1. **No Placeholders or Fake Data**

**Principle**: Never use placeholders, mock data, or simplified implementations in production code.

**Rules**:

- ❌ **Never** use `TODO`, `FIXME`, `placeholder`, `mock`, `fake`, `dummy`, or `stub` in production code
- ❌ **Never** hardcode example data that should come from the database or API
- ❌ **Never** use simplified algorithms or shortcuts that reduce functionality
- ✅ **Always** implement full functionality, even if it takes longer
- ✅ **Always** use real data structures and proper error handling
- ✅ **Always** implement complete features, not partial implementations

**Examples**:

```typescript
// ❌ BAD: Placeholder implementation
function calculatePoints(session: Session): number {
  // TODO: Implement real calculation
  return 100; // placeholder
}

// ✅ GOOD: Full implementation
function calculatePoints(context: PointsCalculationContext): PointsCalculationResult {
  const caloriesRaw = context.sessionCalories ?? estimateCalories(context.distanceMeters, context.averageRpe);
  const calories = caloriesRaw === null ? null : clamp(caloriesRaw, 0, 1800);
  // ... complete calculation logic
  return { points, inputs: { ... } };
}
```

---

### 2. **No Code Quality Reduction**

**Principle**: Never simplify code at the expense of quality, maintainability, or correctness.

**Rules**:

- ❌ **Never** remove error handling to "simplify" code
- ❌ **Never** skip validation or type checking
- ❌ **Never** use `any` types to avoid proper typing
- ❌ **Never** remove tests to speed up development
- ❌ **Never** skip edge case handling
- ✅ **Always** maintain TypeScript strict mode compliance
- ✅ **Always** include comprehensive error handling
- ✅ **Always** write tests for new functionality
- ✅ **Always** handle edge cases and boundary conditions
- ✅ **Always** use proper type definitions

**Examples**:

```typescript
// ❌ BAD: Simplified, missing error handling
function createUser(data: any) {
  return db("users").insert(data);
}

// ✅ GOOD: Full implementation with proper types and error handling
async function createUser(data: CreateUserDTO, userId: string): Promise<UserRow> {
  const validated = createUserSchema.parse(data);

  try {
    const [row] = await db("users")
      .insert({ ...validated, user_id: userId })
      .returning("*");

    if (!row) {
      throw new HttpError(500, "E.CREATE_FAILED", "Failed to create user");
    }

    return row;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "E.ALREADY_EXISTS", "User already exists");
    }
    throw new HttpError(500, "E.INTERNAL_ERROR", "Internal server error");
  }
}
```

---

### 3. **Global Settings Over Hardcoding**

**Principle**: All configuration values, constants, and settings must be centralized and configurable.

**Rules**:

- ❌ **Never** hardcode URLs, ports, timeouts, limits, or magic numbers
- ❌ **Never** embed configuration values directly in code
- ❌ **Never** use magic numbers without named constants
- ✅ **Always** use environment variables for configuration
- ✅ **Always** centralize constants in configuration files
- ✅ **Always** use named constants instead of magic numbers
- ✅ **Always** validate configuration with Zod schemas
- ✅ **Always** provide sensible defaults in configuration

**Examples**:

```typescript
// ❌ BAD: Hardcoded values
function sendEmail(to: string, subject: string) {
  const smtp = {
    host: "smtp.gmail.com",
    port: 587,
    timeout: 60000,
  };
  // ...
}

// ✅ GOOD: Configuration from env
import { env } from "../config/env.js";

function sendEmail(to: string, subject: string) {
  const smtp = {
    host: env.email.smtpHost,
    port: env.email.smtpPort,
    timeout: env.email.smtpTimeout,
  };
  // ...
}
```

**Configuration Structure**:

- Backend: `apps/backend/src/config/env.ts` - All environment variables with Zod validation
- Frontend: `apps/frontend/src/config/` - Environment-specific configuration
- Infrastructure: `infra/kubernetes/configmap.yaml` - Kubernetes configuration
- All values must be validated and typed

---

### 4. **Global CSS Classes Over Inline Styles**

**Principle**: All static styling must use global CSS classes from `apps/frontend/src/styles/global.css`, never inline styles.

**Rules**:

- ❌ **Never** use inline `style={{ ... }}` attributes for static styling
- ❌ **Never** create local style constants (`const inputStyle: React.CSSProperties = { ... }`) for reusable patterns
- ❌ **Never** hardcode CSS values in components when utility classes exist
- ✅ **Always** use utility classes from `global.css` (e.g., `.form-input`, `.card`, `.flex`, `.text-secondary`)
- ✅ **Always** check `global.css` first - if a class doesn't exist, add it there rather than using inline styles
- ✅ **Only** use inline styles for truly dynamic values (e.g., conditional colors, calculated widths, state-dependent transforms)

**Examples**:

```tsx
// ❌ BAD: Inline styles for static values
<div style={{ display: "flex", gap: "1rem", padding: "1.5rem" }}>
  <input style={{ width: "100%", padding: "0.75rem", borderRadius: "12px" }} />
</div>

// ❌ BAD: Local style constants
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: "12px",
};
<input style={inputStyle} />

// ✅ GOOD: Global CSS classes
<div className="flex flex--gap-md p-lg">
  <input className="form-input" />
</div>

// ✅ ACCEPTABLE: Dynamic inline styles (conditional/dynamic values only)
<div 
  className="card"
  style={{ 
    borderColor: selectedVibe?.colorBorder,  // Dynamic color from data
    transform: isHovered ? "scale(1.1)" : "scale(1)"  // Conditional transform
  }}
/>
```

**Available Utility Classes**:

The `global.css` file provides comprehensive utility classes for:
- Forms: `.form`, `.form-input`, `.form-label`, `.form-error`, `.form-select`
- Layout: `.flex`, `.grid`, `.flex--gap-*`, `.grid--gap-*`
- Typography: `.text-*`, `.font-weight-*`, `.text-primary`, `.text-secondary`, `.text-muted`
- Spacing: `.p-*`, `.m-*`, `.mb-*`, `.mt-*`, `.gap-*`
- Cards: `.card`, `.card-content`
- Alerts: `.alert`, `.alert--error`, `.alert--success`
- Sections: `.section`, `.section-title`, `.section-text`
- Lists: `.list`, `.list-item`

**Adding New Utility Classes**:

1. Check if a similar class already exists in `global.css`
2. If not, add it to `global.css` following the existing naming conventions
3. Use CSS variables (e.g., `var(--color-text-primary)`) instead of hardcoded values
4. Document the class in a comment if it's not self-explanatory

---

### 5. **Internationalization (i18n) for All Text**

**Principle**: All user-facing text must come from i18n translation files, never hardcoded.

**Rules**:

- ❌ **Never** hardcode strings in components, pages, or UI elements
- ❌ **Never** use hardcoded error messages, labels, or placeholders
- ❌ **Never** embed text directly in JSX or HTML
- ✅ **Always** use `useTranslation()` hook for React components
- ✅ **Always** use translation keys from i18n files
- ✅ **Always** include placeholders in translation files
- ✅ **Always** provide fallback translations
- ✅ **Always** organize translation keys by feature/page

**Examples**:

```typescript
// ❌ BAD: Hardcoded text
export const LoginForm: React.FC = () => {
  return (
    <form>
      <label>Email</label>
      <input placeholder="you@example.com" />
      <button>Login</button>
    </form>
  );
};

// ✅ GOOD: i18n usage
export const LoginForm: React.FC = () => {
  const { t } = useTranslation();

  return (
    <form>
      <label>{t("auth.labels.email")}</label>
      <input placeholder={t("auth.placeholders.email")} />
      <button>{t("auth.buttons.login")}</button>
    </form>
  );
};
```

**Translation File Structure**:

- Frontend: `apps/frontend/src/i18n/locales/{lang}/common.json`
- Backend: `packages/i18n/src/{lang}.ts` (for shared translations)
- Keys organized by feature: `auth.*`, `sessions.*`, `profile.*`, etc.
- All placeholders, labels, buttons, errors, and messages must be translated

---

### 5. **Complete Error Handling**

**Principle**: All operations must have comprehensive error handling with proper error types and messages.

**Rules**:

- ❌ **Never** use generic `Error` or `catch (e)` without proper handling
- ❌ **Never** swallow errors silently
- ❌ **Never** return `null` or `undefined` without proper error handling
- ✅ **Always** use `HttpError` utility for API errors
- ✅ **Always** provide specific error codes and messages
- ✅ **Always** log errors appropriately
- ✅ **Always** handle edge cases and boundary conditions
- ✅ **Always** validate input before processing

**Examples**:

```typescript
// ❌ BAD: Generic error handling
async function getUser(id: string) {
  try {
    return await db("users").where({ id }).first();
  } catch (error) {
    throw error; // Generic, no context
  }
}

// ✅ GOOD: Specific error handling
async function getUser(id: string): Promise<UserRow> {
  if (!id || typeof id !== "string") {
    throw new HttpError(400, "E.INVALID_INPUT", "User ID is required");
  }

  try {
    const user = await db("users").where({ id }).first();

    if (!user) {
      throw new HttpError(404, "E.NOT_FOUND", "User not found");
    }

    return user;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    logger.error("Failed to get user", { userId: id, error });
    throw new HttpError(500, "E.INTERNAL_ERROR", "Failed to retrieve user");
  }
}
```

---

### 6. **Type Safety and Strict TypeScript**

**Principle**: Maintain strict TypeScript compliance with no `any` types in public surfaces.

**Rules**:

- ❌ **Never** use `any` types in production code
- ❌ **Never** disable TypeScript strict mode
- ❌ **Never** use type assertions without validation
- ❌ **Never** skip type definitions for public APIs
- ✅ **Always** use strict TypeScript mode
- ✅ **Always** define proper types and interfaces
- ✅ **Always** use `import type` for type-only imports
- ✅ **Always** validate types at runtime with Zod when needed
- ✅ **Always** use proper type inference where possible

**Examples**:

```typescript
// ❌ BAD: Using any
function processData(data: any): any {
  return data.value * 2;
}

// ✅ GOOD: Proper types
interface ProcessDataInput {
  value: number;
}

interface ProcessDataOutput {
  result: number;
}

function processData(data: ProcessDataInput): ProcessDataOutput {
  return { result: data.value * 2 };
}
```

---

### 7. **Comprehensive Testing**

**Principle**: All new functionality must have corresponding tests with adequate coverage.

**Rules**:

- ❌ **Never** skip tests to speed up development
- ❌ **Never** write tests that don't actually test functionality
- ❌ **Never** use flaky or non-deterministic tests
- ✅ **Always** write unit tests for business logic
- ✅ **Always** write integration tests for API endpoints
- ✅ **Always** use deterministic test data (fake clocks, seeded PRNG)
- ✅ **Always** test happy paths, error cases, and edge cases
- ✅ **Always** maintain ≥80% coverage repo-wide, ≥90% for critical paths

**Examples**:

```typescript
// ✅ GOOD: Comprehensive test
describe("createUser", () => {
  it("should create user with valid data", async () => {
    const userData = { name: "Test User", email: "test@example.com" };
    const result = await createUser(userData, "user-123");

    expect(result).toMatchObject({
      name: "Test User",
      email: "test@example.com",
    });
  });

  it("should throw HttpError for duplicate email", async () => {
    const userData = { name: "Test", email: "existing@example.com" };

    await expect(createUser(userData, "user-123")).rejects.toThrow(
      expect.objectContaining({
        statusCode: 409,
        code: "E.ALREADY_EXISTS",
      }),
    );
  });

  it("should validate required fields", async () => {
    await expect(createUser({}, "user-123")).rejects.toThrow(HttpError);
  });
});
```

---

### 8. **Proper Architecture and Separation of Concerns**

**Principle**: Maintain clear separation between layers and follow established patterns.

**Rules**:

- ❌ **Never** mix business logic with route handlers
- ❌ **Never** put database queries directly in controllers
- ❌ **Never** skip the service layer for "simple" operations
- ✅ **Always** follow the Controller → Service → Repository pattern
- ✅ **Always** keep controllers thin (validation and response formatting)
- ✅ **Always** put business logic in services
- ✅ **Always** put data access in repositories
- ✅ **Always** use proper dependency injection

**Examples**:

```typescript
// ✅ GOOD: Proper separation
// Controller (thin)
export async function createUserHandler(req: Request, res: Response): Promise<void> {
  const validated = createUserSchema.parse(req.body);
  const result = await createUser(validated, req.user!.sub);
  res.status(201).json(result);
}

// Service (business logic)
export async function createUser(data: CreateUserDTO, userId: string): Promise<UserRow> {
  // Business logic validation
  if (await emailExists(data.email)) {
    throw new HttpError(409, "E.ALREADY_EXISTS", "Email already registered");
  }

  return await userRepository.create({ ...data, created_by: userId });
}

// Repository (data access)
export async function create(input: CreateUserInput): Promise<UserRow> {
  const [row] = await db("users").insert(input).returning("*");
  return row;
}
```

---

### 9. **Security and Privacy First**

**Principle**: Security and privacy considerations are built into every feature, not added later.

**Rules**:

- ❌ **Never** skip input validation
- ❌ **Never** expose sensitive data in logs or responses
- ❌ **Never** use weak authentication or authorization
- ❌ **Never** skip rate limiting on public endpoints
- ✅ **Always** validate all input with Zod schemas
- ✅ **Always** use parameterized queries (automatic with Knex)
- ✅ **Always** implement proper authentication and authorization
- ✅ **Always** follow privacy-by-default principles
- ✅ **Always** use secure defaults (HTTPS, secure cookies, etc.)

---

### 10. **Accessibility by Default**

**Principle**: All UI components must be accessible by default, not as an afterthought.

**Rules**:

- ❌ **Never** skip ARIA labels
- ❌ **Never** use color alone to convey information
- ❌ **Never** create keyboard traps
- ❌ **Never** skip focus management
- ✅ **Always** provide ARIA labels and roles
- ✅ **Always** ensure keyboard navigation
- ✅ **Always** maintain WCAG 2.2 AA compliance
- ✅ **Always** test with screen readers
- ✅ **Always** provide text alternatives for visual information

---

## Implementation Checklist

When implementing any feature, ensure:

- [ ] No placeholders or fake data
- [ ] Full functionality implemented (no shortcuts)
- [ ] All configuration values come from environment/config
- [ ] All user-facing text uses i18n
- [ ] Comprehensive error handling with specific error types
- [ ] Strict TypeScript compliance (no `any` types)
- [ ] Tests written for new functionality
- [ ] Proper architecture (Controller → Service → Repository)
- [ ] Security considerations addressed
- [ ] Accessibility requirements met
- [ ] Documentation updated if needed

---

## Examples of What NOT to Do

### ❌ Bad Examples

```typescript
// 1. Placeholder implementation
function calculatePoints(session: Session): number {
  // TODO: Implement later
  return 100;
}

// 2. Hardcoded values
const API_URL = "https://api.example.com";
const TIMEOUT = 5000;

// 3. Hardcoded text
<button>Submit</button>
<input placeholder="Enter email" />

// 4. Inline styles instead of global CSS classes
<div style={{ display: "flex", gap: "1rem" }}>
  <input style={{ width: "100%", padding: "0.75rem" }} />
</div>

// 4. Simplified error handling
try {
  await doSomething();
} catch (e) {
  console.log(e);
}

// 5. Any types
function process(data: any): any {
  return data.value;
}

// 6. Skipping service layer
export async function createUserHandler(req: Request, res: Response) {
  const user = await db("users").insert(req.body).returning("*");
  res.json(user);
}
```

### ✅ Good Examples

```typescript
// 1. Full implementation
function calculatePoints(context: PointsCalculationContext): PointsCalculationResult {
  // Complete calculation logic with all factors
  // ...
}

// 2. Configuration-based
import { env } from "../config/env.js";
const API_URL = env.appBaseUrl;
const TIMEOUT = env.requestTimeout;

// 3. i18n usage
const { t } = useTranslation();
<button>{t("actions.submit")}</button>
<input placeholder={t("forms.emailPlaceholder")} />

// 4. Proper error handling
try {
  await doSomething();
} catch (error) {
  if (error instanceof HttpError) throw error;
  logger.error("Operation failed", { error });
  throw new HttpError(500, "E.OPERATION_FAILED", "Operation failed");
}

// 5. Proper types
interface ProcessDataInput {
  value: number;
}
function process(data: ProcessDataInput): ProcessDataOutput {
  return { result: data.value * 2 };
}

// 6. Proper architecture
export async function createUserHandler(req: Request, res: Response) {
  const validated = createUserSchema.parse(req.body);
  const result = await createUser(validated, req.user!.sub);
  res.status(201).json(result);
}
```

---

## References

- **.cursorrules**: Main coding standards and patterns
- **CODING_STYLE_GUIDE.md**: Detailed coding style guidelines
- **ADR-011**: Internationalization approach
- **env.ts**: Configuration structure and validation

---

## Maintenance

This document should be updated when:

- New implementation principles are identified
- Patterns change based on team feedback
- New tools or practices are adopted
- Issues are discovered that require new principles

**Last Review**: 2025-11-29










## Architecture & Hardcoding Zero-Tolerance Gate

The repository enforces the #302 authority decisions through the required **Architecture & Hardcoding** CI status.

The gate has three independent diagnostics and deliberately has **no grandfather/baseline file**:

1. **Backend policy authority** — business modules must not bypass validated configuration with direct `process.env`, direct rate-limiter construction is centralized, and security/gamification-sensitive services may not reintroduce policy literals that belong to governed, deployment, coded-invariant, or persisted authorities.
2. **Frontend design-token compliance** — TSX code must use semantic tokens instead of raw hex/RGB/HSL color literals. A true data-value color may be retained only with a narrow inline `architecture-token: data-value -- <reason>` explanation.
3. **Frontend component reuse** — feature pages use canonical UI primitives for buttons and ordinary text/select/textarea inputs. Native checkbox/radio/range/file/hidden/color inputs remain allowed while no shared primitive exists. Any other exception must be explicitly enumerated by the checker and documented.

Backend implementation constants in sensitive policy files are exceptional. If a literal is genuinely algorithmic rather than runtime/product/security policy, the preceding or same line must contain `architecture-policy: implementation-constant -- <concrete reason>`. This is a narrow code-local exception, not a blanket suppression.

Local reproduction:

```bash
pnpm architecture:backend
pnpm architecture:frontend-tokens
pnpm architecture:frontend-reuse
pnpm architecture:check
```

New violations must be fixed at their authority layer; do not weaken the checker, add a baseline, or create meaningless constants merely to make CI green.
