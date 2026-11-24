import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { Comment } from '../models/Comment';
import { Document } from '../models/Document';
import { authMiddleware } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * GET /api/comments/:docId
 * Get all comments in a doc
 */
router.get('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    // Check if user has access to doc
    const doc = await Document.findById(docId);
    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    const isEditor = doc.permissions.editors.some((e: Types.ObjectId) => e.toString() === userId);
    const isViewer = doc.permissions.viewers.some((v: Types.ObjectId) => v.toString() === userId);

    if (!isOwner && !isEditor && !isViewer) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'No access to this document' },
      });
    }

    const comments = await Comment.find({ docId }).sort({ createdAt: -1 });

    const formattedComments = comments.map(comment => ({
      id: comment._id.toString(),
      docId: comment.docId,
      authorId: comment.authorId,
      text: comment.text,
      range: comment.range,
      resolved: comment.resolved,
      replies: comment.replies,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));

    res.json({ comments: formattedComments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to get comments' },
    });
  }
});

/**
 * POST /api/comments/:docId
 * Create comment thread
 */
router.post('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { text, range } = req.body;

    if (!text || !range) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Text and range required' },
      });
    }

    // Check if user has access to doc
    const doc = await Document.findById(docId);
    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const userId = req.userId!;
    const isOwner = doc.ownerId.toString() === userId;
    const isEditor = doc.permissions.editors.some((e: Types.ObjectId) => e.toString() === userId);
    const isViewer = doc.permissions.viewers.some((v: Types.ObjectId) => v.toString() === userId);

    if (!isOwner && !isEditor && !isViewer) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'No access to this document' },
      });
    }

    const comment = new Comment({
      docId,
      authorId: req.userId,
      text,
      range,
      resolved: false,
      replies: [],
    });

    await comment.save();

    res.status(201).json({
      id: comment._id.toString(),
      docId: comment.docId,
      authorId: comment.authorId,
      text: comment.text,
      range: comment.range,
      resolved: comment.resolved,
      replies: comment.replies,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create comment' },
    });
  }
});

/**
 * PATCH /api/comments/:commentId
 * Update comment (resolve, add reply)
 */
router.patch('/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const commentId = req.params.commentId;
    const { resolved, reply } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Comment not found' },
      });
    }

    // Check if user has access (author or doc owner can update)
    const doc = await Document.findById(comment.docId);
    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });
    }

    const userId = req.userId!;
    const isCommentAuthor = comment.authorId.toString() === userId;
    const isDocOwner = doc.ownerId.toString() === userId;

    if (!isCommentAuthor && !isDocOwner) {
      return res.status(403).json({
        error: { code: 'UNAUTHORIZED', message: 'Cannot update this comment' },
      });
    }

    if (typeof resolved === 'boolean') {
      comment.resolved = resolved;
    }

    if (reply && reply.text) {
      comment.replies.push({
        id: uuidv4(),
        authorId: new Types.ObjectId(req.userId!),
        text: reply.text,
        createdAt: new Date(),
      });
    }

    await comment.save();

    res.json({
      id: comment._id.toString(),
      docId: comment.docId,
      authorId: comment.authorId,
      text: comment.text,
      range: comment.range,
      resolved: comment.resolved,
      replies: comment.replies,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update comment' },
    });
  }
});

export default router;
