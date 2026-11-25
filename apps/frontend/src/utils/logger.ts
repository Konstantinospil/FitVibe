/**
 * Frontend logging utility
 *
 * Provides structured logging with support for different log levels
 * and environment-specific behavior.
 *
 * Errors are also reported to FitVibe's own backend once error reporting is
 * installed (production only, see utils/errorReporter.ts and ADR-040).
 */

/* eslint-disable no-console */

import { reportLoggedError } from "./errorReporter";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    // SSR-safe: Check if we're in browser and import.meta.env exists
    if (typeof window === "undefined") {
      // Server-side: default to false (production mode)
      this.isDevelopment = false;
    } else {
      // Client-side: check Vite's import.meta.env
      try {
        const viteEnv = import.meta.env;
        this.isDevelopment = viteEnv && typeof viteEnv === "object" && viteEnv.DEV === true;
      } catch {
        // Fallback if import.meta.env access fails
        this.isDevelopment = false;
      }
    }
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context ?? "");
    }
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context ?? "");
    }
  }

  /**
   * Log warnings
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context ?? "");
  }

  /**
   * Log errors and report them (message and Error only) to the backend
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof Error) {
      errorContext.errorMessage = error.message;
      errorContext.errorStack = error.stack;
    } else if (error) {
      errorContext.error = error;
    }

    console.error(`[ERROR] ${message}`, errorContext);
    // Context is deliberately not reported: it can hold user data (ADR-040).
    reportLoggedError(message, error);
  }

  /**
   * Log API errors with request details
   */
  apiError(message: string, error: unknown, endpoint?: string, method?: string): void {
    const context: LogContext = {};

    if (endpoint) {
      context.endpoint = endpoint;
    }
    if (method) {
      context.method = method;
    }

    // Extract axios error details
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response?: { status?: number; data?: unknown };
        config?: { url?: string; method?: string };
      };

      if (axiosError.response) {
        context.status = axiosError.response.status;
        context.responseData = axiosError.response.data;
      }

      if (axiosError.config) {
        context.url = axiosError.config.url;
        context.requestMethod = axiosError.config.method;
      }
    }

    this.error(message, error as Error, context);
  }
}

// Export singleton instance
export const logger = new Logger();
