import { AUTH_SECURITY_POLICY } from "../../../apps/backend/src/config/security-policy.js";
import {
  HEART_RATE_LIMITS,
  RPE_LIMITS,
  SESSION_TEXT_LIMITS,
} from "../../../apps/backend/src/modules/sessions/sessions.normalization.js";
import { BODY_WEIGHT_KG_LIMITS } from "../../../apps/backend/src/utils/units.js";
import { ACCOUNT_LIMITS } from "../../../apps/frontend/src/config/account.js";
import { TRAINING_DATA_CONFIG } from "../../../apps/frontend/src/config/trainingSurfaces.js";

// The frontend checks these bounds before sending a request; the server enforces
// them. Both copies must agree or the form accepts what the server refuses.
describe("frontend limits mirror the server", () => {
  it("account bounds match AUTH_SECURITY_POLICY", () => {
    const { account, password } = AUTH_SECURITY_POLICY;
    expect(ACCOUNT_LIMITS).toEqual({
      passwordMinLength: password.minLengthFloor,
      passwordMaxLength: password.maxLength,
      usernameMinLength: account.usernameMinLength,
      usernameMaxLength: account.usernameMaxLength,
      minAgeYears: account.minAgeYears,
      maxAgeYears: account.maxAgeYears,
    });
  });

  it("set and session bounds match the sessions module", () => {
    expect(TRAINING_DATA_CONFIG.setRpeMin).toBe(RPE_LIMITS.min);
    expect(TRAINING_DATA_CONFIG.setRpeMax).toBe(RPE_LIMITS.max);
    expect(TRAINING_DATA_CONFIG.setHeartRateMinBpm).toBe(HEART_RATE_LIMITS.min);
    expect(TRAINING_DATA_CONFIG.setHeartRateMaxBpm).toBe(HEART_RATE_LIMITS.max);
    expect(TRAINING_DATA_CONFIG.sessionNoteMaxLength).toBe(SESSION_TEXT_LIMITS.noteMaxLength);
  });

  it("body weight bounds match the units module", () => {
    expect(TRAINING_DATA_CONFIG.bodyWeightMinKg).toBe(BODY_WEIGHT_KG_LIMITS.min);
    expect(TRAINING_DATA_CONFIG.bodyWeightMaxKg).toBe(BODY_WEIGHT_KG_LIMITS.max);
  });
});
