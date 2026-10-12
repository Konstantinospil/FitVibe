import { RegisterSchema } from "../../../../apps/backend/src/modules/auth/auth.schemas.js";

const baseRegistration = {
  email: "athlete@example.com",
  username: "athlete",
  password: "StrongPassword1!",
  terms_accepted: true,
};

describe("RegisterSchema profile", () => {
  it("accepts profile codes backed by the existing lookup tables", () => {
    expect(
      RegisterSchema.safeParse({
        ...baseRegistration,
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
      RegisterSchema.safeParse({
        ...baseRegistration,
        profile: { sex: "catalog_defined_gender", fitness_level: "catalog_defined_level" },
      }).success,
    ).toBe(true);
  });

  it("does not accept both date_of_birth and deprecated age", () => {
    expect(
      RegisterSchema.safeParse({
        ...baseRegistration,
        profile: { date_of_birth: "1990-06-15", age: 36 },
      }).success,
    ).toBe(false);
  });
});
