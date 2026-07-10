import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(secret: string, expiresIn: string): string {
  return jwt.sign({ iat: Math.floor(Date.now() / 1000) }, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): jwt.JwtPayload | null {
  try {
    return jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    return null;
  }
}
