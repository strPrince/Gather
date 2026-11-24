import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      email?: string;
    }
  }
}

/**
 * Middleware: Verify JWT and attach user to request
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = authService.extractToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      error: { code: 'MISSING_TOKEN', message: 'Authorization token required' },
    });
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }

  req.userId = payload.userId;
  req.email = payload.email;
  next();
};

/**
 * Middleware: Error handler
 */
export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: status >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
    },
  });
};
