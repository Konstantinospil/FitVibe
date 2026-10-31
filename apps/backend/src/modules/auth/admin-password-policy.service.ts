/**
 * Historic hashes cannot establish their original plaintext password length.
 * Only a password write checked against the active admin role may attest it.
 * Pure predicate: guard reuses the user row it already fetched.
 */
export function administratorPasswordChangeRequired(user: {
  admin_password_policy_verified_at: string | null;
}): boolean {
  return !user.admin_password_policy_verified_at;
}
