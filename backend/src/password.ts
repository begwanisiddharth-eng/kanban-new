import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const OPTIONS = { N: 2 ** 16, r: 8, p: 1, maxmem: 128 * 2 ** 20 };

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, OPTIONS, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${salt.toString("base64")}:${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":").map((s) => Buffer.from(s, "base64"));
  return timingSafeEqual(await derive(password, salt), key);
}

// Compared against when no account exists, so sign-in takes the same time
// either way and a response's timing can't reveal whether an email is registered.
export const DUMMY_HASH = await hashPassword(randomBytes(32).toString("hex"));
