import { HttpError } from "../../utils/http.js";
import { checkAliasAvailable } from "./users.repository.js";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]{3,50}$/;

export async function ensureUsernameAvailable(userId: string, username: string): Promise<void> {
  const available = await checkAliasAvailable(username, userId);
  if (!available) {
    throw new HttpError(409, "USER_USERNAME_TAKEN", "USER_USERNAME_TAKEN");
  }
}

export function ensureUsernameFormat(username: string): void {
  if (!USERNAME_REGEX.test(username)) {
    throw new HttpError(422, "USER_USERNAME_INVALID", "USER_USERNAME_INVALID");
  }
}
