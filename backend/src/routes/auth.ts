import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { authService } from '../services/authService';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' },
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
      });
    }

    // Hash password
    const hashedPassword = await authService.hashPassword(password);

    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      name,
    });

    await user.save();

    // Generate tokens
    const token = authService.generateToken(user._id.toString(), user.email);

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to register user' },
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' },
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Verify password
    const validPassword = await authService.verifyPassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    // Generate token
    const token = authService.generateToken(user._id.toString(), user.email);

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to login' },
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', authMiddleware, (req: Request, res: Response) => {
  try {
    const token = authService.generateToken(req.userId!, req.email!);
    res.json({ token });
  } catch (error) {
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to refresh token' },
    });
  }
});

/**
 * GET /api/auth/me
 * Return current user's profile
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch profile' },
    });
  }
});

/**
 * PUT /api/auth/me
 * Update current user's profile (name and/or password)
 */
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    if (name) {
      user.name = name;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Current password required to set a new password' },
        });
      }

      const valid = await authService.verifyPassword(currentPassword, user.password);
      if (!valid) {
        return res.status(400).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' },
        });
      }

      user.password = await authService.hashPassword(newPassword);
    }

    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' },
    });
  }
});

export default router;
