#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, "../../apps/frontend");
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Get all test files
const testFiles = [
  "tests/frontend/App.test.tsx",
  "tests/frontend/accessibility/Button.accessibility.test.tsx",
  "tests/frontend/accessibility/DateRangePicker.accessibility.test.tsx",
  "tests/frontend/accessibility/LanguageSwitcher.accessibility.test.tsx",
  "tests/frontend/accessibility/PageIntro.accessibility.test.tsx",
  "tests/frontend/accessibility/ThemeToggle.accessibility.test.tsx",
  "tests/frontend/apiClient.test.ts",
  "tests/frontend/bootstrap/bootstrap.test.ts",
  "tests/frontend/components/AdminRoute.test.tsx",
  "tests/frontend/components/AttemptCounter.test.tsx",
  "tests/frontend/components/AuthPageLayout.test.tsx",
  "tests/frontend/components/ConfirmDialog.test.tsx",
  "tests/frontend/components/DateRangePicker.test.tsx",
  "tests/frontend/components/ErrorBoundary.test.tsx",
  "tests/frontend/components/ExerciseSelector.test.tsx",
  "tests/frontend/components/Footer.test.tsx",
  "tests/frontend/components/LanguageSwitcher.test.tsx",
  "tests/frontend/components/LockoutTimer.test.tsx",
  "tests/frontend/components/LoginFormContent.test.tsx",
  "tests/frontend/components/MainLayout.test.tsx",
  "tests/frontend/components/MaintenanceBanner.test.tsx",
  "tests/frontend/components/PageIntro.test.tsx",
  "tests/frontend/components/ProtectedRoute.test.tsx",
  "tests/frontend/components/SessionManagement.test.tsx",
  "tests/frontend/components/StatusPill.test.tsx",
  "tests/frontend/components/ThemeToggle.test.tsx",
  "tests/frontend/contexts/AuthContext.test.tsx",
  "tests/frontend/contexts/ToastContext.test.tsx",
  "tests/frontend/hooks/useCountdown.test.ts",
  "tests/frontend/hooks/useDashboardAnalytics.test.tsx",
  "tests/frontend/hooks/useHealthStatus.test.tsx",
  "tests/frontend/hooks/useRequiredFieldValidation.test.tsx",
  "tests/frontend/i18n/config.test.ts",
  "tests/frontend/i18n/coverage.test.ts",
  "tests/frontend/layouts/MainLayout.test.tsx",
  "tests/frontend/pages/Dashboard.test.tsx",
  "tests/frontend/pages/ForgotPassword.test.tsx",
  "tests/frontend/pages/Home.test.tsx",
  "tests/frontend/pages/Login.test.tsx",
  "tests/frontend/pages/NotFound.test.tsx",
  "tests/frontend/pages/Privacy.test.tsx",
  "tests/frontend/pages/Register.test.tsx",
  "tests/frontend/pages/ResetPassword.test.tsx",
  "tests/frontend/pages/Settings.test.tsx",
  "tests/frontend/pages/Terms.test.tsx",
  "tests/frontend/pages/TermsReacceptance.test.tsx",
  "tests/frontend/pages/TwoFactorVerificationLogin.test.tsx",
  "tests/frontend/pages/VerifyEmail.test.tsx",
  "tests/frontend/pages/admin/AdminDashboard.test.tsx",
  "tests/frontend/pages/admin/ContentReports.test.tsx",
  "tests/frontend/pages/admin/SystemControls.test.tsx",
  "tests/frontend/pages/admin/UserManagement.test.tsx",
  "tests/frontend/public/login-shell.test.ts",
  "tests/frontend/routes/AppRouter.test.tsx",
  "tests/frontend/routes/ProtectedRoutes.test.tsx",
  "tests/frontend/routes/PublicRoutes.test.tsx",
  "tests/frontend/routes/Router.test.tsx",
  "tests/frontend/services/adminApi.test.ts",
  "tests/frontend/services/api.functions.test.ts",
  "tests/frontend/services/api.test.ts",
  "tests/frontend/ssr/cache.test.ts",
  "tests/frontend/ssr/hydration.test.tsx",
  "tests/frontend/ssr/metrics.test.ts",
  "tests/frontend/ssr/render.test.ts",
  "tests/frontend/ssr/render.test.tsx",
  "tests/frontend/store/auth.store.test.tsx",
  "tests/frontend/store/theme.store.test.tsx",
  "tests/frontend/styles/tokens.test.tsx",
  "tests/frontend/ui/Avatar.test.tsx",
  "tests/frontend/ui/Button.test.tsx",
  "tests/frontend/ui/Card.test.tsx",
  "tests/frontend/ui/Chart.test.tsx",
  "tests/frontend/ui/MainLayout.accessibility.test.tsx",
  "tests/frontend/ui/Skeleton.test.tsx",
  "tests/frontend/ui/VisibilityBadge.test.tsx",
  "tests/frontend/utils/featureFlags.test.tsx",
  "tests/frontend/utils/fontLoader.test.ts",
  "tests/frontend/utils/idempotency.test.ts",
  "tests/frontend/utils/idleScheduler.test.ts",
  "tests/frontend/utils/jwt.test.ts",
  "tests/frontend/utils/logger.test.ts",
  "tests/frontend/utils/suppressConsole.test.ts",
];

const results = {
  passed: [],
  failed: [],
  timedOut: [],
};

async function runTest(testFile) {
  // Resolve vitest binary outside the Promise constructor
  const { createRequire } = await import("node:module");
  const require = createRequire(resolve(frontendDir, "package.json"));
  const vitestPkgPath = require.resolve("vitest/package.json");
  const vitestPkg = require("vitest/package.json");
  const binEntry =
    typeof vitestPkg.bin === "string"
      ? vitestPkg.bin
      : (vitestPkg.bin?.vitest ?? vitestPkg.bin?.["vitest"]);
  
  if (!binEntry) {
    console.error("[test] Unable to locate the Vitest binary entry point");
    return { passed: false, error: "Vitest binary not found" };
  }
  
  const vitestBinPath = resolve(dirname(vitestPkgPath), binEntry);
  const nodeArgs = ["--max-old-space-size=6144"];
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let timedOut = false;
    let killed = false;
    let testProcess = null;
    let timeoutId = null;
    
    let stdout = "";
    let stderr = "";
    
    testProcess = spawn(
      process.execPath,
      [...nodeArgs, vitestBinPath, "run", "--reporter=verbose", "--no-coverage", testFile],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: frontendDir,
        env: {
          ...process.env,
          VITEST: "true",
          NODE_OPTIONS: process.env.NODE_OPTIONS 
            ? `${process.env.NODE_OPTIONS} --max-old-space-size=6144`.trim()
            : "--max-old-space-size=6144",
        },
      },
    );
    
    testProcess.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });
    
    testProcess.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });
    
    timeoutId = setTimeout(() => {
      if (!killed && testProcess) {
        timedOut = true;
        console.error(`\n⚠️  TEST TIMED OUT after ${TIMEOUT_MS / 1000} seconds!`);
        console.error(`Killing process...`);
        testProcess.kill("SIGKILL");
        killed = true;
        const duration = Date.now() - startTime;
        results.timedOut.push({ file: testFile, duration });
        resolve({ timedOut: true, duration });
      }
    }, TIMEOUT_MS);

    testProcess.on("exit", (code, signal) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (timedOut) {
        // Already handled in timeout
        return;
      }

      if (code === 0) {
        results.passed.push({ file: testFile, duration, stdout, stderr });
        console.log(`\n✅ PASSED (${duration}ms)`);
        resolve({ passed: true, duration, exitCode: code });
      } else {
        results.failed.push({ file: testFile, duration, exitCode: code, signal, stdout, stderr });
        console.log(`\n❌ FAILED (exit code: ${code}, duration: ${duration}ms)`);
        if (stderr) {
          console.error(`STDERR: ${stderr.slice(-500)}`);
        }
        resolve({ passed: false, duration, exitCode: code, signal });
      }
    });

    testProcess.on("error", (error) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.error(`\n❌ ERROR: ${error.message}`);
      results.failed.push({ file: testFile, duration, error: error.message });
      resolve({ passed: false, duration, error: error.message });
    });
  });
}

async function runAllTests() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`RUNNING ${testFiles.length} TESTS INDIVIDUALLY`);
  console.log(`Timeout threshold: ${TIMEOUT_MS / 1000}s per test`);
  console.log(`${"=".repeat(80)}`);

  for (const testFile of testFiles) {
    await runTest(testFile);
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(80)}`);
  console.log(`Total tests: ${testFiles.length}`);
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏱️  Timed out: ${results.timedOut.length}`);

  if (results.timedOut.length > 0) {
    console.log(`\n${"=".repeat(80)}`);
    console.log("⏱️  TIMED OUT TESTS");
    console.log(`${"=".repeat(80)}`);
    results.timedOut.forEach((r) => {
      console.log(`  ${r.file} (${r.duration}ms)`);
    });
  }

  if (results.failed.length > 0) {
    console.log(`\n${"=".repeat(80)}`);
    console.log("❌ FAILED TESTS");
    console.log(`${"=".repeat(80)}`);
    results.failed.forEach((r) => {
      console.log(`  ${r.file} (${r.duration}ms, exit code: ${r.exitCode || "N/A"})`);
    });
  }

  process.exit(results.failed.length + results.timedOut.length > 0 ? 1 : 0);
}

runAllTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

