export function isStrongPassword(pw){
  if (typeof pw !== "string" || pw.length < 12) return false;
  return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^\w\s]/.test(pw);
}
export function cleanUsername(u){
  if(!u || typeof u!=="string") return null;
  const t = u.trim().toLowerCase();
  if(!/^[a-z0-9._-]{3,24}$/.test(t)) return null;
  return t;
}
