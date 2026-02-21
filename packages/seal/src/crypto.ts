import { sha256 } from '@noble/hashes/sha256'
import { hmac } from '@noble/hashes/hmac'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import { getPublicKeyAsync, signAsync, verifyAsync } from '@noble/ed25519'

export function digestHex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)))
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'function') {
    throw new Error('base64 encoding unavailable in this runtime')
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new Error('base64 decoding unavailable in this runtime')
  }
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function base64UrlEncode(input: string): string {
  return bytesToBase64(utf8ToBytes(input)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return new TextDecoder().decode(base64ToBytes(padded))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) out |= a[i] ^ b[i]
  return out === 0
}

export interface JwtVerificationOptions {
  alg?: 'HS256'
  aud?: string
  iss?: string
  sub?: string
  nowSeconds?: number
  requireIat?: boolean
}

export function encodeJwtHs256(
  payload: Record<string, unknown>,
  secret: string,
  header: Record<string, unknown> = {},
): string {
  const head = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...header }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const sig = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${head}.${body}`))
  return `${head}.${body}.${base64UrlEncodeBytes(sig)}`
}

export function verifyJwtHs256(
  token: string,
  secret: string,
  options: JwtVerificationOptions = {},
): { ok: boolean; claims?: Record<string, unknown>; reason?: string } {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [headEnc, bodyEnc, sigEnc] = parts
  let header: Record<string, unknown>
  let claims: Record<string, unknown>
  try {
    header = JSON.parse(base64UrlDecode(headEnc)) as Record<string, unknown>
    claims = JSON.parse(base64UrlDecode(bodyEnc)) as Record<string, unknown>
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }

  if (header.alg !== (options.alg ?? 'HS256')) {
    return { ok: false, reason: 'alg-mismatch' }
  }

  const expected = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${headEnc}.${bodyEnc}`))
  const actual = base64ToBytes(sigEnc.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (sigEnc.length % 4)) % 4))
  if (!constantTimeEqual(expected, actual)) {
    return { ok: false, reason: 'signature-invalid' }
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const iat = typeof claims.iat === 'number' ? claims.iat : undefined
  const exp = typeof claims.exp === 'number' ? claims.exp : undefined
  if (options.requireIat && iat === undefined) return { ok: false, reason: 'iat-required' }
  if (iat !== undefined && iat > now + 30) return { ok: false, reason: 'iat-future' }
  if (exp !== undefined && exp < now) return { ok: false, reason: 'expired' }
  if (options.aud && claims.aud !== options.aud) return { ok: false, reason: 'aud-mismatch' }
  if (options.iss && claims.iss !== options.iss) return { ok: false, reason: 'iss-mismatch' }
  if (options.sub && claims.sub !== options.sub) return { ok: false, reason: 'sub-mismatch' }

  return { ok: true, claims }
}

export function encodeCapabilityToken(payload: Record<string, unknown>, secret: string): string {
  return encodeJwtHs256(payload, secret)
}

export function verifyCapabilityToken(
  token: string,
  secret: string,
  options: JwtVerificationOptions = {},
): boolean {
  return verifyJwtHs256(token, secret, { ...options, alg: 'HS256', requireIat: true }).ok
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
