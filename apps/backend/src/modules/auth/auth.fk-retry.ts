const MAX_USER_FK_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 500;

function isUserForeignKeyVisibilityError(error: unknown, relation: string): boolean {
  const candidate = error as { code?: string; detail?: string; message?: string };
  return (
    candidate.code === "23503" &&
    candidate.detail?.includes('is not present in table "users"') === true &&
    (candidate.message?.includes(relation) === true ||
      candidate.detail?.includes(`${relation}_user_id_foreign`) === true)
  );
}

export async function withUserForeignKeyVisibilityRetry<T>(
  relation: string,
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_USER_FK_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable =
        isUserForeignKeyVisibilityError(error, relation) && attempt < MAX_USER_FK_ATTEMPTS - 1;
      if (!retryable) {
        throw error;
      }

      const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed ${relation} operation after retry budget`);
}
