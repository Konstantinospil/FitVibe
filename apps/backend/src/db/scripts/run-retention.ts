import db from "../index.js";
import { logger } from "../../config/logger.js";
import { toErrorPayload } from "../../utils/error.utils.js";
import { runRetentionSweep } from "../../services/retention.service.js";

async function main(): Promise<void> {
  logger.info("[retention] starting retention sweep...");
  const summary = await runRetentionSweep(new Date());
  logger.info(
    {
      purgedIdempotencyKeys: summary.purgedIdempotencyKeys,
      purgedAuthTokens: summary.purgedAuthTokens,
      purgedRefreshTokens: summary.purgedRefreshTokens,
      purgedUnverifiedAccounts: summary.purgedUnverifiedAccounts,
      purgedRegistrationIntents: summary.purgedRegistrationIntents,
      processedDsrRequests: summary.processedDsrRequests,
    },
    "[retention] sweep completed",
  );
}

main()
  .then(() => db.destroy())
  .catch((error: unknown) => {
    logger.error(toErrorPayload(error), "[retention] sweep failed");
    return db.destroy().finally(() => process.exit(1));
  });
