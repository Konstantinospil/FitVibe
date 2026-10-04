# Backend Modules

This directory contains the modular domain logic for the FitVibe backend API. Each module is a self-contained vertical slice that includes routes, controllers, services, repositories, types, and tests.

## Architecture

The backend follows a **folder-by-module** structure where each module encapsulates:

- **Routes** (`*.routes.ts`): Express route definitions
- **Controllers** (`*.controller.ts`): Request/response handling
- **Services** (`*.service.ts`): Business logic
- **Repositories** (`*.repository.ts`): Data access layer
- **Types** (`*.types.ts`): TypeScript type definitions
- **Schemas** (`*.schemas.ts`): Zod validation schemas (where applicable)
- **Tests** (`__tests__/`): Unit and integration tests

## Module Index

Versioned API routes are composed in [`../app.ts`](../app.ts) and mounted under `/api/v1/`. Domain routers remain in their module folders; `src/api/` provides thin re-exports used by the composition root.

| Module             | Route Prefix      | Purpose                                                      | Status         |
| ------------------ | ----------------- | ------------------------------------------------------------ | -------------- |
| **auth**           | `/auth`           | Authentication, registration, token management, 2FA          | ✅ Active      |
| **users**          | `/users`          | User profiles, admin operations, avatars, DSR                | ✅ Active      |
| **exercise-types** | `/exercise-types` | Global exercise type catalog (admin-only mutations)          | ✅ Active      |
| **exercises**      | `/exercises`      | User exercise records (CRUD)                                 | ✅ Active      |
| **sessions**       | `/sessions`       | Workout session planning, logging, cloning, recurrence       | ✅ Active      |
| **plans**          | `/plans`          | Training plan management                                     | ✅ Active      |
| **logs**           | `/logs`           | Audit log streaming and querying                             | 🚧 In Progress |
| **points**         | `/points`         | Gamification: points, badges, streaks, seasonal events       | ✅ Active      |
| **progress**       | `/progress`       | Analytics, summaries, trends, exports, plan progress         | ✅ Active      |
| **feed**           | `/feed`           | Social feed, bookmarks, reactions, shares, moderation        | ✅ Active      |
| **health**         | `/health`         | Health check endpoints                                       | ✅ Active      |
| **system**         | `/system`         | System status, read-only mode, maintenance controls          | ✅ Active      |
| **admin**          | `/admin`          | Admin-only operations (reports, moderation, user management) | ✅ Active      |
| **common**         | N/A               | Shared middleware, utilities, and cross-cutting concerns     | ✅ Active      |

## Common Module

The `common/` module provides shared functionality used across all modules:

- **RBAC Middleware** (`rbac.middleware.ts`): Role-based access control
- **Ownership Middleware** (`ownership.middleware.ts`): Resource ownership validation
- **Rate Limiter** (`rateLimiter.ts`): Request rate limiting
- **Error Handler** (`errorHandler.ts`): Centralized error handling
- **Idempotency Service** (`idempotency.service.ts`): Idempotency key handling
- **Audit Utility** (`audit.util.ts`): Audit log creation

## Module Patterns

### Route Definition

```typescript
// modules/example/example.routes.ts
import { Router } from "express";
import { requireAccessToken } from "../auth/auth.middleware.js";
import { requireRole } from "../common/rbac.middleware.js";
import { exampleController } from "./example.controller.js";

export const exampleRouter = Router();

exampleRouter.use(requireAccessToken); // Apply to all routes
exampleRouter.get("/", exampleController.list);
exampleRouter.post("/", requireRole("admin"), exampleController.create);
```

### Service Layer

```typescript
// modules/example/example.service.ts
import { exampleRepository } from "./example.repository.js";
import type { CreateExampleDTO } from "./example.types.js";

export async function createExample(data: CreateExampleDTO, userId: string) {
  // Business logic
  // Validation
  // Call repository
  return await exampleRepository.create({ ...data, user_id: userId });
}
```

### Repository Layer

```typescript
// modules/example/example.repository.ts
import db from "../../db/index.js";
import type { ExampleRow } from "./example.types.js";

export async function createExample(input: CreateExampleInput): Promise<ExampleRow> {
  const [row] = await db("examples").insert(input).returning("*");
  return row;
}
```

## Authentication & Authorization

### Authentication

Most modules require authentication via the canonical `requireAccessToken` middleware from `auth/auth.middleware.ts`. Browser requests use the HttpOnly access-token cookie; deliberate API clients may use a Bearer token.

### Authorization

- **Role-based**: Use `requireRole()` from `common/rbac.middleware.ts`
- **Ownership-based**: Use `requireOwnership()` from `common/ownership.middleware.ts`
- **Custom**: Implement module-specific authorization logic

## Error Handling

All modules should use the centralized error handler:

```typescript
import { HttpError } from "../../utils/http.js";

throw new HttpError(404, "Resource not found");
```

## Validation

Use Zod schemas for request validation:

```typescript
// modules/example/example.schemas.ts
import { z } from "zod";

export const createExampleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});
```

## Testing

Each module should include:

- **Unit tests**: Service and repository logic
- **Integration tests**: API endpoints with test database
- **Test location**: `__tests__/` directory within the module

### Test Structure

```typescript
// modules/example/__tests__/example.service.test.ts
import { describe, it, expect } from "@jest/globals";
import { createExample } from "../example.service.js";

describe("ExampleService", () => {
  it("should create example", async () => {
    // Test implementation
  });
});
```

## Adding a New Module

1. **Create module directory**: `apps/backend/src/modules/new-module/`
2. **Implement layers**: routes, controller, service, repository, types
3. **Add validation**: Create Zod schemas
4. **Write tests**: Unit and integration tests
5. **Expose router**: Add a thin re-export under `src/api/` when the module is part of the versioned API
6. **Register module**: Mount the router in `src/app.ts`
7. **Document**: Update this README

### Module Template

```typescript
// 1. Types (example.types.ts)
export interface Example {
  id: string;
  // ...
}

// 2. Repository (example.repository.ts)
export async function createExample(input: CreateExampleInput) {
  // ...
}

// 3. Service (example.service.ts)
export async function createExample(data: CreateExampleDTO, userId: string) {
  // ...
}

// 4. Controller (example.controller.ts)
export const exampleController = {
  create: asyncHandler(async (req, res) => {
    // ...
  }),
};

// 5. Routes (example.routes.ts)
export const exampleRouter = Router();
exampleRouter.post("/", requireAccessToken, exampleController.create);

// 6. Re-export from src/api/examples.routes.ts
export { exampleRouter } from "../modules/example/example.routes.js";

// 7. Mount in src/app.ts
apiRouter.use("/examples", exampleRouter);
```

## Database Access

All modules use Knex.js for database access:

```typescript
import db from "../../db/index.js";

// Query
const rows = await db("table_name").where({ id });

// Transaction
await db.transaction(async (trx) => {
  await trx("table1").insert(data1);
  await trx("table2").insert(data2);
});
```

## Related Documentation

- [Backend README](../README.md)
- [Database Schema](../db/README.md)
- [Technical Design Document](../../../../docs/2.Technical_Design_Document/2b.Technical_Design_Document_Modules.md)
