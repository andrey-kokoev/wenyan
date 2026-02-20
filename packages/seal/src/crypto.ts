import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKeyAsync, signAsync, verifyAsync } from '@noble/ed25519'

export function digestHex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)))
}

export function encodeCapabilityToken(payload: Record<string, unknown>, secret: string): string {
  const head = JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  const body = JSON.stringify(payload)
  const sig = digestHex(`${head}.${body}.${secret}`)
  return `${head}.${body}.${sig}`
}

export function verifyCapabilityToken(token: string, secret: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }
  const [head, body, sig] = parts
  return digestHex(`${head}.${body}.${secret}`) === sig
}

export async function signEd25519Hash(hashHex: string, privateKeyHex: string): Promise<string> {
  const privateBytes = hexToBytes(privateKeyHex)
  try {
    return bytesToHex(await signAsync(hexToBytes(hashHex), privateBytes))
  } finally {
    // Best-effort key material cleanup in JS memory.
    privateBytes.fill(0)
  }
}

export async function verifyEd25519Hash(
  signatureHex: string,
  hashHex: string,
  privateKeyHex: string,
  publicKeyHex?: string,
): Promise<boolean> {
  const pub = publicKeyHex ?? bytesToHex(await getPublicKeyAsync(hexToBytes(privateKeyHex)))
  return verifyAsync(hexToBytes(signatureHex), hexToBytes(hashHex), hexToBytes(pub))
}
