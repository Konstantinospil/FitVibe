import { HttpError } from "../../utils/http.js";
import { getLegalActionStatus } from "../legal/legal.service.js";

export async function assertTermsRequirementSatisfied(userId: string): Promise<void> {
  const status = await getLegalActionStatus(userId, "terms");
  if (status.needsAction) {
    throw new HttpError(403, "TERMS_VERSION_OUTDATED", "TERMS_VERSION_OUTDATED");
  }
}
