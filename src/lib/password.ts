const BLOCKLIST = new Set([
  "password", "password1", "123456", "12345678", "qwerty", "letmein",
  "welcome", "admin", "iloveyou", "Temp1234!",
]);

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Please choose a longer password (at least 8 characters).";
  }
  if (BLOCKLIST.has(password)) {
    return "This password is too common — please choose another.";
  }
  return null;
}
