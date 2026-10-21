import crypto from 'crypto';

/**
 * Generates a cryptographically secure, opaque random token for QR codes.
 * This token can be safely printed on QR codes without leaking internal sequential counters or DB IDs.
 */
export const generateOpaqueQRToken = (): string => {
  return crypto.randomBytes(24).toString('base64url');
};

/**
 * Generates a default human-readable Asset ID Tag if not manually supplied.
 * Example: AST-2026-A1B2C3
 */
export const generateDefaultAssetTag = (prefix: string = 'AST'): string => {
  const year = new Date().getFullYear();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${randomSuffix}`;
};
