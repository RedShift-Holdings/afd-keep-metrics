"""
Encrypts a plaintext JSON report file into a .enc envelope the static site can
decrypt client-side with the Web Crypto API (see assets/crypto.js - the two
sides MUST use matching PBKDF2/AES-GCM parameters).

Usage:
  python3 encrypt_data.py <in.json> <out.json.enc> "<password>"

Envelope format (JSON):
  {"v":1, "kdf":"PBKDF2-SHA256", "iterations":200000,
   "salt":"<b64>", "iv":"<b64>", "ciphertext":"<b64>"}
"""
import sys, os, json, base64
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 200000

def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(password.encode("utf-8"))

def encrypt_file(in_path, out_path, password):
    with open(in_path, "rb") as f:
        plaintext = f.read()
    salt = os.urandom(16)
    iv = os.urandom(12)
    key = derive_key(password, salt)
    ciphertext = AESGCM(key).encrypt(iv, plaintext, None)
    envelope = {
        "v": 1, "kdf": "PBKDF2-SHA256", "iterations": ITERATIONS,
        "salt": base64.b64encode(salt).decode(), "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode(),
    }
    with open(out_path, "w") as f:
        json.dump(envelope, f)
    print(f"Encrypted {in_path} -> {out_path}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(1)
    encrypt_file(sys.argv[1], sys.argv[2], sys.argv[3])
