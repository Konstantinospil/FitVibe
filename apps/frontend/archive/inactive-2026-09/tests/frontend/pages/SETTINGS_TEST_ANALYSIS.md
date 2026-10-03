# Settings Test Fix Analysis

## Executive Summary

**Current Status**: 20 failing tests, 13 passing (33 total)
**Progress**: Improved from 3 passing to 13 passing
**Key Insight**: Tests fail primarily due to timing issues - elements are queried before async data loading completes.

## Root Cause Analysis

### 1. Component Loading Behavior

The Settings component has **two-phase loading**:

1. **Initial Render**: Component renders immediately but with `loadingUser = true`
   - Email field shows: `"Loading..."`
   - Other fields may not be populated yet

2. **Data Loaded**: After `loadUserData()` completes:
   - `loadingUser = false`
   - Email field shows: `userData?.email ?? "Not available"`
   - All form fields populated with user data

### 2. Async Operations

The component performs **two async operations on mount**:

- `loadUserData()` - fetches user profile and preferences
- `load2FAStatus()` - fetches 2FA status

Both use `useEffect` with empty dependency array, meaning they run once on mount.

### 3. Test Failure Patterns

#### Pattern A: Element Not Found (Most Common)

```
Error: Unable to find an element with the placeholder text of: "Your display name"
```

**Cause**: Test queries for element before component finishes rendering or before data loads.

#### Pattern B: Wrong Value

```
Error: expected "Loading..." to be "user@example.com"
```

**Cause**: Test checks value before async data fetch completes.

#### Pattern C: Undefined Element

```
Error: expected undefined to be defined
```

**Cause**: Element doesn't exist yet, or query returns undefined due to DOM pollution.

## Successful Fix Patterns

### ✅ Pattern 1: Wait for Component Render

```typescript
// Wait for component to render
await waitFor(
  () => {
    const settingsTexts = screen.queryAllByText("Settings");
    expect(Array.from(settingsTexts).find((el) => container.contains(el))).toBeInTheDocument();
  },
  { timeout: 5000 },
);
```

**Why it works**: Ensures the component structure exists before querying specific elements.

### ✅ Pattern 2: Wait for Element Existence, Then Value

```typescript
// Wait for element to exist
let emailInput: HTMLInputElement;
await waitFor(
  () => {
    emailInput = container.querySelector("#email") as HTMLInputElement;
    expect(emailInput).not.toBeNull();
  },
  { timeout: 5000 },
);

// Wait for value to update
await waitFor(
  () => {
    expect(emailInput!.value).not.toBe("Loading...");
    expect(emailInput!.value).toBe("user@example.com");
  },
  { timeout: 5000 },
);
```

**Why it works**: Separates element existence check from value check, handles async updates.

### ✅ Pattern 3: Find Selects via Label Association

```typescript
const labels = screen.queryAllByLabelText("Default Session Visibility");
const label = Array.from(labels).find((el) => container.contains(el));
if (label && label.getAttribute("for")) {
  select = container.querySelector(`#${label.getAttribute("for")}`) as HTMLSelectElement;
}
if (!select) {
  select = container.querySelector("#default-visibility") as HTMLSelectElement;
}
```

**Why it works**: `getAllByLabelText` returns labels, not inputs. Need to use `htmlFor` to find associated input.

### ✅ Pattern 4: Container-Scoped Queries

```typescript
const inputs = screen.getAllByPlaceholderText("Your display name");
const input = Array.from(inputs).find((el) => container.contains(el));
```

**Why it works**: Prevents DOM pollution from previous tests by scoping to current container.

## Failed Approaches

### ❌ Pattern 1: Generic Loading Helper

```typescript
const waitForSettingsToLoad = async (container: HTMLElement) => {
  await waitFor(() => {
    const profileSettings = screen.queryAllByText("Profile Settings");
    // ... check for content
  });
};
```

**Why it failed**:

- Applied too broadly, causing timeouts
- Didn't account for different loading states
- Some tests don't need this wait

### ❌ Pattern 2: Checking for "Loading..." Absence

```typescript
const loadingInContainer = Array.from(loadingEmails).find((el) => container.contains(el));
expect(loadingInContainer).not.toBeInTheDocument();
```

**Why it failed**:

- `find()` returns `undefined` when element doesn't exist
- `expect(undefined).not.toBeInTheDocument()` throws error
- Should check for value change instead

## Recommended Fix Strategy

### Step 1: Standardize Test Structure

Every test should follow this pattern:

```typescript
it("test name", async () => {
  const { container } = renderSettings();

  // Step 1: Wait for component to render (if needed)
  await waitFor(
    () => {
      const settingsTexts = screen.queryAllByText("Settings");
      expect(Array.from(settingsTexts).find((el) => container.contains(el))).toBeInTheDocument();
    },
    { timeout: 5000 },
  );

  // Step 2: Wait for element to exist
  let element: HTMLElement | undefined;
  await waitFor(
    () => {
      // Use container-scoped query
      const elements = screen.getAllByXxx("...");
      element = Array.from(elements).find((el) => container.contains(el));
      expect(element).toBeDefined();
    },
    { timeout: 5000 },
  );

  // Step 3: Wait for value to be correct (if async data)
  await waitFor(
    () => {
      expect(element!.value).not.toBe("Loading...");
      expect(element!.value).toBe("expected-value");
    },
    { timeout: 5000 },
  );

  // Step 4: Interact with element
  fireEvent.change(element!, { target: { value: "new value" } });

  // Step 5: Assert result
  expect(element!.value).toBe("new value");
});
```

### Step 2: Fix by Category

#### Category A: Email/Display Name Tests (Data Loading)

- Wait for component render
- Wait for element existence
- Wait for value to update from "Loading..."

#### Category B: Select Element Tests (Form Controls)

- Wait for component render
- Find select via label's `htmlFor` attribute
- Use fallback to direct ID query

#### Category C: Button/Action Tests (User Interactions)

- Wait for component render
- Wait for button to be enabled (not loading)
- Click and wait for async result

#### Category D: 2FA Tests (Complex State)

- Wait for component render
- Wait for 2FA status to load
- Handle state transitions (setup → verify → enabled)

#### Category E: Account Deletion Tests (Multi-Step)

- Wait for component render
- Wait for confirmation dialogs
- Handle nested async operations

### Step 3: Common Fixes Needed

1. **All tests**: Add component render wait at start
2. **Email test**: Two-phase wait (element exists → value updates)
3. **Select tests**: Use label → `htmlFor` → querySelector pattern
4. **Button tests**: Wait for `isLoading={false}` state
5. **Form submission tests**: Wait for API call completion

## Key Learnings

1. **Timing is Critical**: Settings component has async data loading that must complete before assertions
2. **Two-Phase Loading**: Component renders → data loads → values update
3. **Container Scoping**: Always use container-scoped queries to avoid DOM pollution
4. **Label vs Input**: `getAllByLabelText` returns labels, need `htmlFor` to find inputs
5. **Progressive Waiting**: Wait for structure → wait for element → wait for value
6. **Avoid Generic Helpers**: Test-specific waits are more reliable than generic helpers

## Next Steps

1. Apply standardized test structure to all 20 failing tests
2. Fix tests one by one, verifying each passes before moving to next
3. Group similar tests together to apply fixes in batches
4. Run full test suite after each batch to ensure no regressions

## Test Categories Breakdown

### Currently Passing (13 tests)

- Basic rendering tests
- API call verification tests
- Some simple interaction tests

### Currently Failing (20 tests)

1. `displays user email after loading` - Needs two-phase wait
2. `allows changing display name` - Needs render wait + element wait
3. `saves preferences when save button clicked` - Needs full loading wait
4. `shows success message after saving preferences` - Needs async wait
5. `shows error message when saving preferences fails` - Needs error state wait
6. `shows 2FA setup when enable button clicked` - Needs 2FA state wait
7. `disables verify button when code is not 6 digits` - Needs form state wait
8. `enables 2FA after successful verification` - Needs multi-step wait
9. `shows delete account confirmation when delete button clicked` - Needs dialog wait
10. `deletes account when confirmed with password` - Needs multi-step async wait
11. `does not delete account when confirmation declined` - Needs dialog state wait
12. `shows error when account deletion fails` - Needs error state wait
13. `allows changing alias` - Needs render wait
14. `saves profile fields when save button clicked` - Needs full loading wait
15. `saves weight with unit conversion` - Needs render wait
16. `reloads user data after successful save` - Needs API completion wait
17. `handles profile data when profile is null` - Needs null state handling
18. `saves all new profile fields together` - Needs full loading wait
19. `displays alias help text` - Needs render wait
20. (One more test - check full list)

## Implementation Priority

**High Priority** (Foundation tests):

1. `displays user email after loading` - Core functionality
2. `allows changing display name` - Basic interaction
3. `saves preferences when save button clicked` - Core feature

**Medium Priority** (Feature tests):
4-12. All 2FA and account deletion tests
13-19. Profile field tests

**Low Priority** (Edge cases): 20. Error handling and edge case tests
