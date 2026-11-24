import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { aiService } from '../services/aiService';

const router = Router();

/**
 * POST /api/ai/assist
 * Request AI suggestion (rewrite/summarize/expand)
 */
router.post('/assist', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { selection, action, tone, context } = req.body;

    if (!selection || !action) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Selection and action required' },
      });
    }

    if (!['rewrite', 'summarize', 'expand'].includes(action)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Must be rewrite, summarize, or expand' },
      });
    }

    // Call AI service
    const result = await aiService.assist({
      selection,
      action,
      tone: tone || 'professional',
      context,
    });

    res.json({
      variants: result.variants,
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('AI assist error:', error);
    res.status(500).json({
      error: { code: 'AI_ERROR', message: error.message || 'Failed to get AI suggestions' },
    });
  }
});

export default router;
