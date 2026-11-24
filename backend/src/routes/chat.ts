import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { ChatMessage } from '../models/ChatMessage';
import { Document } from '../models/Document';
import { authMiddleware } from '../middleware/auth';

const router = Router();

async function getAccessibleDocument(docId: string, userId: string) {
  const doc = await Document.findById(docId);
  if (!doc) return null;

  const isOwner = doc.ownerId.toString() === userId;
  const isEditor = doc.permissions.editors.some((id: Types.ObjectId) => id.toString() === userId);
  const isViewer = doc.permissions.viewers.some((id: Types.ObjectId) => id.toString() === userId);
  return isOwner || isEditor || isViewer ? doc : false;
}

function formatMessage(message: any) {
  const author = message.authorId && typeof message.authorId === 'object' ? message.authorId : null;
  return {
    id: message._id.toString(),
    docId: message.docId,
    authorId: author?._id?.toString() || message.authorId?.toString(),
    authorName: author?.name || 'Collaborator',
    authorEmail: author?.email || '',
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

router.get('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const doc = await getAccessibleDocument(req.params.docId, req.userId!);
    if (doc === null) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (!doc) return res.status(403).json({ error: { code: 'UNAUTHORIZED', message: 'No access to this document' } });

    const messages = await ChatMessage.find({ docId: req.params.docId })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('authorId', 'name email');

    res.json({ messages: messages.map(formatMessage) });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load chat' } });
  }
});

router.post('/:docId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message text is required' } });
    if (text.length > 4000) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Message is too long' } });

    const doc = await getAccessibleDocument(req.params.docId, req.userId!);
    if (doc === null) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    if (!doc) return res.status(403).json({ error: { code: 'UNAUTHORIZED', message: 'No access to this document' } });

    const message = await ChatMessage.create({ docId: req.params.docId, authorId: req.userId, text });
    const populated = await message.populate('authorId', 'name email');
    res.status(201).json({ message: formatMessage(populated) });
  } catch (error) {
    console.error('Create chat message error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send chat message' } });
  }
});

export default router;
