import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';

const configuredJwtSecret = process.env.JWT_SECRET;
if (!configuredJwtSecret) {
  throw new Error('JWT_SECRET must be configured before starting the server');
}

const JWT_SECRET: Secret = configuredJwtSecret;
const JWT_SIGN_OPTIONS: SignOptions = {
  expiresIn: (process.env.JWT_EXPIRY || '7d') as SignOptions['expiresIn'],
};

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const authService = {
  /**
   * Hash password with bcryptjs
   */
  hashPassword: async (password: string): Promise<string> => {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(password, salt);
  },

  /**
   * Compare password with hash
   */
  verifyPassword: async (password: string, hash: string): Promise<boolean> => {
    return bcryptjs.compare(password, hash);
  },

  /**
   * Generate JWT access token
   */
  generateToken: (userId: string, email: string): string => {
    const payload: JWTPayload = { userId, email };
    return jwt.sign(payload, JWT_SECRET, JWT_SIGN_OPTIONS);
  },

  /**
   * Verify JWT token
   */
  verifyToken: (token: string): JWTPayload | null => {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  },

  /**
   * Extract token from Authorization header
   */
  extractToken: (authHeader?: string): string | null => {
    if (!authHeader) return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    return parts[1];
  },
};
