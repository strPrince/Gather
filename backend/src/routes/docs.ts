import { Router, Request, Response } from 'express';
import puppeteer from 'puppeteer';
import { Types } from 'mongoose';
import { Document } from '../models/Document';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/docs
 * List all docs for authenticated user
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const docs = await Document.find({
      $or: [{ ownerId: userId }, { 'permissions.editors': userId }, { 'permissions.viewers': userId }],
    })
      .select('title ownerId createdAt updatedAt permissions')
      .lean();

    const shaped = docs.map((doc) => {
      const isOwner = doc.ownerId.toString() === userId;
      const isEditor = doc.permissions?.editors?.some((e: Types.ObjectId) => e.toString() === userId);
      const role = isOwner ? 'owner' : isEditor ? 'editor' : 'viewer';

      return {
        id: doc._id.toString(),
        title: doc.title,
        ownerId: doc.ownerId.toString(),
        permissions: { role },
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    res.json({ docs: shaped });
  } catch (error) {
    console.error('List docs error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to list documents' },
    });
  }
});

/**
 * POST /api/docs
 * Create new doc
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
      });
    }

    const doc = new Document({
      title,
      ownerId: req.userId,
      permissions: { editors: [], viewers: [] },
    });

    await doc.save();

    res.status(201).json({
      id: doc._id,
      title: doc.title,
      ownerId: doc.ownerId,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    console.error('Create doc error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create document' },
    });
  }
});

/**
 * GET /api/docs/:docId
 * Get doc metadata
 */
router.get('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await Document.findById(req.params.docId);

    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    // Check permission
    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    const isEditor = doc.permissions.editors.some((e: Types.ObjectId) => e.toString() === userId);
    const isViewer = doc.permissions.viewers.some((v: Types.ObjectId) => v.toString() === userId);

    if (!isOwner && !isEditor && !isViewer) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'You do not have access to this document' },
      });
    }

    const role = isOwner ? 'owner' : isEditor ? 'editor' : 'viewer';

    res.json({
      id: doc._id.toString(),
      title: doc.title,
      ownerId: doc.ownerId.toString(),
      permissions: { role },
      content: doc.content ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('Get doc error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get document' },
    });
  }
});

/**
 * PUT /api/docs/:docId
 * Update doc metadata
 */
router.put('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await Document.findById(req.params.docId);

    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    // Check permission
    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    const isEditor = doc.permissions.editors.some((e: Types.ObjectId) => e.toString() === userId);

    if (!isOwner && !isEditor) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'You do not have permission to update this document' },
      });
    }

    const { title, metadata, content } = req.body;

    if (title) doc.title = title;
    if (metadata) doc.metadata = metadata;
    if (content !== undefined) doc.content = content;

    await doc.save();

    res.json({
      id: doc._id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('Update doc error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update document' },
    });
  }
});

/**
 * DELETE /api/docs/:docId
 * Delete doc
 */
router.delete('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await Document.findById(req.params.docId);

    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    // Only owner can delete
      const userId = req.userId!;
      if (doc.ownerId.toString() !== userId) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'Only owner can delete this document' },
      });
    }

    await Document.deleteOne({ _id: req.params.docId });

    res.status(204).send();
  } catch (error) {
    console.error('Delete doc error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete document' },
    });
  }
});

/**
 * POST /api/docs/:docId/share
 * Share doc with another user
 */
router.post('/:docId/share', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, permission } = req.body;

    if (!email || !permission) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and permission are required' },
      });
    }

    if (!['editor', 'viewer'].includes(permission)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Permission must be editor or viewer' },
      });
    }

    const doc = await Document.findById(req.params.docId);
    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'Only the owner can share the document' },
      });
    }

    // Find user by email
    const { User } = await import('../models/User');
    const userToShare = await User.findOne({ email: email.toLowerCase() });
    if (!userToShare) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const userIdToShare = userToShare._id.toString();

    // Keep a user in exactly one permission list. Re-sharing is a role update,
    // so a viewer can be promoted to editor without needing database access.
    doc.permissions.editors = doc.permissions.editors.filter((id: Types.ObjectId) => id.toString() !== userIdToShare);
    doc.permissions.viewers = doc.permissions.viewers.filter((id: Types.ObjectId) => id.toString() !== userIdToShare);

    if (permission === 'editor') {
      doc.permissions.editors.push(userToShare._id);
    } else {
      doc.permissions.viewers.push(userToShare._id);
    }

    await doc.save();

    res.json({ message: `Document shared as ${permission}` });
  } catch (error) {
    console.error('Share doc error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to share document' },
    });
  }
});

/**
 * POST /api/docs/:docId/export/pdf
 * Convert provided HTML to a PDF using Puppeteer. Accepts JSON: { html: string, css?: string }
 */
router.post('/:docId/export/pdf', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { html, css } = req.body;
    if (typeof html !== 'string' || html.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'HTML content is required' } });
    }
    if (html.length > 5_000_000 || (css !== undefined && (typeof css !== 'string' || css.length > 500_000))) {
      return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'PDF content is too large' } });
    }

    // Optionally fetch doc to check permissions & title
    const doc = await Document.findById(req.params.docId);
    if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });

    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    const isEditor = doc.permissions.editors.some((e: Types.ObjectId) => e.toString() === userId);
    const isViewer = doc.permissions.viewers.some((v: Types.ObjectId) => v.toString() === userId);
    if (!isOwner && !isEditor && !isViewer) {
      return res.status(403).json({ error: { code: 'UNAUTHORIZED', message: 'You do not have access to this document' } });
    }

    // Remove executable/embedded content. JavaScript is also disabled below.
    const safeHtml = html
      .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/<\s*(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const safeCss = typeof css === 'string' ? css.replace(/<\s*\/\s*style/gi, '<\\/style') : '';

    // Build HTML with inline CSS. External resources are blocked below to prevent SSRF.
    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"/>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"/>` +
      `<style>${safeCss}</style></head><body>${safeHtml}</body></html>`;

    // Keep Chromium sandboxing enabled. Deployments must provide a compatible
    // sandboxed Chromium environment rather than using --no-sandbox.
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(10_000);
      page.setDefaultTimeout(10_000);
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const requestUrl = request.url();
        if (/^(about:|data:|blob:)/i.test(requestUrl)) {
          void request.continue();
        } else {
          void request.abort();
        }
      });

      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '1in', bottom: '1in', left: '0.7in', right: '0.7in' }, preferCSSPageSize: true });

      res.setHeader('Content-Type', 'application/pdf');
      const safeFilename = String(doc.title || req.params.docId)
        .replace(/[\r\n"]/g, '')
        .replace(/[^\w .-]/g, '_')
        .trim()
        .slice(0, 100) || 'document';
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
      res.send(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('PDF export error', err);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate PDF' } });
  }
});

export default router;
