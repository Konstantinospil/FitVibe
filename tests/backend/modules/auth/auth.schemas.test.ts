import {
  CompleteRegistrationSchema,
  RegistrationIntentSchema,
  StartRegistrationSchema,
} from "../../../../apps/backend/src/modules/auth/auth.schemas.js";

const LINK_TOKEN = "a".repeat(43);

const baseCompletion = {
  token: LINK_TOKEN,
  username: "athlete",
  password: "StrongPassword1!",
  terms_accepted: true,
};

describe("StartRegistrationSchema (ADR-039 step 1)", () => {
  it("accepts an address with an optional UI language", () => {
    expect(StartRegistrationSchema.safeParse({ email: "athlete@example.com" }).success).toBe(true);
    expect(
      StartRegistrationSchema.safeParse({ email: "athlete@example.com", locale: "de-DE" }).success,
    ).toBe(true);
  });

  it("asks for nothing but the address", () => {
    const parsed = StartRegistrationSchema.parse({
      email: "athlete@example.com",
      password: "ignored",
      username: "ignored",
    });
    expect(parsed).toEqual({ email: "athlete@example.com" });
  });

  it("rejects malformed addresses and locales", () => {
    expect(StartRegistrationSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(
      StartRegistrationSchema.safeParse({ email: "a@example.com", locale: "<script>" }).success,
    ).toBe(false);
  });
});

describe("RegistrationIntentSchema", () => {
  it("accepts a base64url link token and rejects anything else", () => {
    expect(RegistrationIntentSchema.safeParse({ token: LINK_TOKEN }).success).toBe(true);
    expect(RegistrationIntentSchema.safeParse({ token: "short" }).success).toBe(false);
    expect(RegistrationIntentSchema.safeParse({ token: `${LINK_TOKEN}!` }).success).toBe(false);
  });
});

describe("CompleteRegistrationSchema profile (ADR-039 step 2)", () => {
  it("accepts profile codes backed by the existing lookup tables", () => {
    expect(
      CompleteRegistrationSchema.safeParse({
        ...baseCompletion,
        profile: {
          sex: "prefer_not_to_say",
          fitness_level: "rehab",
          date_of_birth: "1990-06-15",
          weight_kg: 82.5,
        },
      }).success,
    ).toBe(true);
  });

  it("accepts opaque reference codes for database validation", () => {
    expect(
      CompleteRegistrationSchema.safeParse({
        ...baseCompletion,
        profile: { sex: "catalog_defined_gender", fitness_level: "catalog_defined_level" },
      }).success,
    ).toBe(true);
  });

  it("does not accept both date_of_birth and deprecated age", () => {
    expect(
      CompleteRegistrationSchema.safeParse({
        ...baseCompletion,
        profile: { date_of_birth: "1990-06-15", age: 36 },
      }).success,
    ).toBe(false);
  });

  it("requires the link token, an alias and accepted terms", () => {
    const { token: _token, ...withoutToken } = baseCompletion;
    expect(CompleteRegistrationSchema.safeParse(withoutToken).success).toBe(false);
    expect(CompleteRegistrationSchema.safeParse({ ...baseCompletion, username: " " }).success).toBe(
      false,
    );
    expect(
      CompleteRegistrationSchema.safeParse({ ...baseCompletion, terms_accepted: false }).success,
    ).toBe(false);
  });
});
