import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../../shared/mlm-types';

// JWT secrets — require strong secrets from environment; fail fast in production
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be set in production environment');
  }
  return 'dev-only-insecure-secret-change-before-deploying';
})();

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.SESSION_SECRET
  ? (process.env.REFRESH_TOKEN_SECRET || `refresh_${process.env.SESSION_SECRET}`)
  : 'dev-only-refresh-secret-change-before-deploying';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function generateReferralCode(length: number | string = 6) {
  if (typeof length === 'string') {
    // create a short deterministic code from the string
    return Buffer.from(length).toString('base64').replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();
  }
  return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export const hashPasswordBcrypt = hashPassword;

export function verifyPassword(password: string, hash: string) {
  if (!password || !hash) {
    return false;
  }
  try {
    return bcrypt.compareSync(String(password), hash);
  } catch (e) {
    return false;
  }
}

export const verifyPasswordBcrypt = verifyPassword;
export const comparePassword = verifyPassword;

export function generateAccessToken(user: { id?: string; userId?: string; email?: string; role?: string }) {
  const id = (user as any).id || (user as any).userId;
  return jwt.sign({ userId: id, email: (user as any).email, role: (user as any).role }, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(user: { id?: string; userId?: string }) {
  const id = (user as any).id || (user as any).userId;
  return jwt.sign({ userId: id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
}

export function sanitizeUserData(user: any) {
  if (!user) return user;
  const { password, ...userWithoutPassword } = user;
  if (!userWithoutPassword.activeUntil && userWithoutPassword.membershipEndDate) {
    userWithoutPassword.activeUntil = userWithoutPassword.membershipEndDate;
  }
  
  // Dynamically set isActive to false if activeUntil has expired (for non-admins)
  if (userWithoutPassword.activeUntil && userWithoutPassword.role !== "admin") {
    const isExpired = new Date(userWithoutPassword.activeUntil).getTime() < Date.now();
    if (isExpired) {
      userWithoutPassword.isActive = false;
    }
  }

  return userWithoutPassword;
}

export function isValidPhone(phone: string) {
  return /^\+?[\d\s-]{10,}$/.test(phone);
}

export function calculateSpiritualNumber(name: string, birthDate: Date | string): number {
  return 7; // Mock calculation
}

export function calculateMembershipExpiry(startDate: Date, durationDays: number): Date {
  const date = new Date(startDate);
  date.setDate(date.getDate() + durationDays);
  return date;
}

let supportsTransactionsCache: boolean | null = null;

export async function supportsTransactions(): Promise<boolean> {
  if (supportsTransactionsCache !== null) {
    return supportsTransactionsCache;
  }
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return false;
    }
    const hello = await mongoose.connection.db?.command({ hello: 1 });
    const hasReplSet = !!(hello && (hello.setName || hello.hosts || hello.msg === 'isdbgrid'));
    
    if (hasReplSet) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        await session.abortTransaction();
        supportsTransactionsCache = true;
      } catch {
        supportsTransactionsCache = false;
      } finally {
        session.endSession();
      }
    } else {
      supportsTransactionsCache = false;
    }
  } catch {
    supportsTransactionsCache = false;
  }
  console.log(`🌐 [DATABASE] Transaction support checked: ${supportsTransactionsCache}`);
  return supportsTransactionsCache;
}

export async function runInTransaction<T>(
  fn: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const useTx = await supportsTransactions();
  if (!useTx) {
    return fn(undefined);
  }
  
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
