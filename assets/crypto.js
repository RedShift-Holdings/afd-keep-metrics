// Client-side decryption matching scripts/encrypt_data.py exactly:
// PBKDF2-SHA256 (200000 iterations) -> AES-GCM-256.
// A password that doesn't derive the right key simply fails to decrypt -
// there is no separate "check the password" step, which is the point:
// whichever key someone has determines what they can ever see.

const KM_ITERATIONS = 200000;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToB64(bytes) {
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}

async function deriveKey(password, saltBytes, iterations, usages) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

// Mirrors scripts/encrypt_data.py exactly - same envelope shape, so files
// produced here and files produced by the Python script are interchangeable.
async function encryptJSON(dataObj, password) {
  const plaintext = new TextEncoder().encode(JSON.stringify(dataObj));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, KM_ITERATIONS, ["encrypt"]);
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    v: 1, kdf: "PBKDF2-SHA256", iterations: KM_ITERATIONS,
    salt: bytesToB64(salt), iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(ciphertextBuf)),
  };
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Returns the parsed JSON object on success, or null if the password is wrong
// (a failed AES-GCM decrypt throws - we swallow that as "wrong password").
async function tryDecrypt(envelope, password) {
  try {
    const salt = b64ToBytes(envelope.salt);
    const iv = b64ToBytes(envelope.iv);
    const ciphertext = b64ToBytes(envelope.ciphertext);
    const key = await deriveKey(password, salt, envelope.iterations, ["decrypt"]);
    const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const text = new TextDecoder().decode(plaintextBuf);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
