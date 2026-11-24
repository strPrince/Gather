import Bull from 'bull';
import { DocumentVersion } from '../models/DocumentVersion';

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

// Create Bull queue for version cleanup
export const versionCleanupQueue = new Bull('version-cleanup', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Process cleanup jobs
versionCleanupQueue.process(async (job) => {
  const cutoffDate = new Date(Date.now() - FIFTEEN_DAYS_MS);
  
  try {
    // Find all documents with versions to clean
    const versionsToDelete = await DocumentVersion.find({
      createdAt: { $lt: cutoffDate },
    }).select('documentId');

    // Get unique document IDs
    const docIds = [...new Set(versionsToDelete.map((v) => v.documentId.toString()))];

    let totalDeleted = 0;

    // For each document, keep the oldest version as baseline and delete others
    for (const docId of docIds) {
      const oldVersions = await DocumentVersion.find({
        documentId: docId,
        createdAt: { $lt: cutoffDate },
      }).sort({ version: 1 });

      // Keep the first (oldest) version, delete the rest
      if (oldVersions.length > 1) {
        const versionsToRemove = oldVersions.slice(1);
        const idsToDelete = versionsToRemove.map((v) => v._id);
        
        const result = await DocumentVersion.deleteMany({
          _id: { $in: idsToDelete },
        });

        totalDeleted += result.deletedCount || 0;
      }
    }

    console.log(`✓ Version cleanup completed: deleted ${totalDeleted} old versions`);
    return { deleted: totalDeleted, cutoffDate };
  } catch (error) {
    console.error('✗ Version cleanup error:', error);
    throw error;
  }
});

// Schedule cleanup job to run daily at midnight
export async function scheduleVersionCleanup() {
  // Add repeatable job (cron: every day at midnight)
  await versionCleanupQueue.add(
    {},
    {
      repeat: {
        cron: '0 0 * * *', // Daily at midnight
      },
      jobId: 'version-cleanup-daily',
    }
  );
  
  console.log('✓ Version cleanup job scheduled (daily at midnight)');
}

// Manual trigger for cleanup
export async function triggerVersionCleanup() {
  await versionCleanupQueue.add({});
  console.log('✓ Manual version cleanup triggered');
}
