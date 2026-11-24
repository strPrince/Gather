import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Document } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /api/versions/:docId
 * Create a new version snapshot
 */
router.post('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { content, changes, isOffline, deviceId } = req.body;

    if (!content) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Content is required' },
      });
    }

    const doc = await Document.findById(docId);
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
        error: { code: 'UNAUTHORIZED', message: 'You do not have permission to create versions' },
      });
    }

    // Read the current maximum so existing data is respected when currentVersion
    // is stale. The counter update below is atomic for concurrent saves.
    const latestVersion = await DocumentVersion.findOne({ documentId: docId })
      .sort({ version: -1 })
      .select('version');

    const counterDoc = await Document.findOneAndUpdate(
      { _id: docId },
      {
        $max: { currentVersion: latestVersion?.version ?? 0 },
        $inc: { currentVersion: 1 },
        $set: { lastSyncedAt: new Date() },
      },
      { new: true }
    );

    if (!counterDoc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const nextVersion = counterDoc.currentVersion;

    // Create version
    const version = new DocumentVersion({
      documentId: docId,
      version: nextVersion,
      content,
      changes: changes || `Version ${nextVersion}`,
      authorId: userId,
      isOffline: isOffline || false,
      deviceId: deviceId || undefined,
    });

    await version.save();

    res.status(201).json({
      version: {
        id: version._id,
        version: version.version,
        changes: version.changes,
        createdAt: version.createdAt,
        isOffline: version.isOffline,
      },
    });
  } catch (error) {
    console.error('Create version error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create version' },
    });
  }
});

/**
 * GET /api/versions/:docId
 * List all versions for a document with pagination
 */
router.get('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const doc = await Document.findById(docId);
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

    const [versions, total] = await Promise.all([
      DocumentVersion.find({ documentId: docId })
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit)
        .populate('authorId', 'name email')
        .select('-content')
        .lean(),
      DocumentVersion.countDocuments({ documentId: docId }),
    ]);

    res.json({
      versions: versions.map((v: any) => ({
        id: v._id,
        version: v.version,
        changes: v.changes,
        author: v.authorId ? { name: v.authorId.name, email: v.authorId.email } : null,
        isOffline: v.isOffline,
        deviceId: v.deviceId,
        createdAt: v.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List versions error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to list versions' },
    });
  }
});

/**
 * GET /api/versions/:docId/:versionId
 * Get a specific version with full content
 */
router.get('/:docId/:versionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId, versionId } = req.params;

    const doc = await Document.findById(docId);
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

    const version = await DocumentVersion.findById(versionId)
      .populate('authorId', 'name email')
      .lean();

    if (!version || version.documentId.toString() !== docId) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Version not found' },
      });
    }

    res.json({
      version: {
        id: version._id,
        version: version.version,
        content: version.content,
        changes: version.changes,
        author: version.authorId ? { name: (version.authorId as any).name, email: (version.authorId as any).email } : null,
        isOffline: version.isOffline,
        deviceId: version.deviceId,
        createdAt: version.createdAt,
      },
    });
  } catch (error) {
    console.error('Get version error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get version' },
    });
  }
});

/**
 * GET /api/versions/:docId/:versionId/diff/:compareVersionId
 * Get diff between two versions
 */
router.get('/:docId/:versionId/diff/:compareVersionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId, versionId, compareVersionId } = req.params;

    const doc = await Document.findById(docId);
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

    const [version1, version2] = await Promise.all([
      DocumentVersion.findOne({ _id: versionId, documentId: docId }).select('content version createdAt'),
      DocumentVersion.findOne({ _id: compareVersionId, documentId: docId }).select('content version createdAt'),
    ]);

    if (!version1 || !version2) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'One or both versions not found' },
      });
    }

    // Simple diff - in production, you'd use a proper diff library
    res.json({
      diff: {
        from: {
          version: version1.version,
          createdAt: version1.createdAt,
        },
        to: {
          version: version2.version,
          createdAt: version2.createdAt,
        },
        content: {
          from: version1.content,
          to: version2.content,
        },
      },
    });
  } catch (error) {
    console.error('Get diff error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get diff' },
    });
  }
});

export default router;
