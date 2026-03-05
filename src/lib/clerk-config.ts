const CLERK_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
const CLERK_SECRET_KEY = (process.env.CLERK_SECRET_KEY ?? "").trim();

function keyMode(key: string) {
  const m = key.match(/_(test|live)_/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function hasValidClerkPublishableKey() {
  if (!/^pk_(test|live)_/i.test(CLERK_PUBLISHABLE_KEY)) {
    return false;
  }
  return !CLERK_PUBLISHABLE_KEY.toLowerCase().includes("placeholder");
}

export function hasValidClerkSecretKey() {
  if (!/^sk_(test|live)_/i.test(CLERK_SECRET_KEY)) {
    return false;
  }
  return !CLERK_SECRET_KEY.toLowerCase().includes("placeholder");
}

export function isClerkClientEnabled() {
  return hasValidClerkPublishableKey();
}

export function isClerkServerEnabled() {
  if (!hasValidClerkPublishableKey() || !hasValidClerkSecretKey()) {
    return false;
  }
  return keyMode(CLERK_PUBLISHABLE_KEY) === keyMode(CLERK_SECRET_KEY);
}

export function getClerkPublishableKey() {
  return CLERK_PUBLISHABLE_KEY;
}
