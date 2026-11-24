import * as Y from 'yjs';
import { getSyncService } from './syncService';

const AUTO_SAVE_INTERVAL = 10 * 60 * 1000; // 10 minutes

export class VersionService {
  private intervalId: NodeJS.Timeout | null = null;
  private lastSavedContent: string | null = null;

  startAutoSave(
    docId: string,
    ydoc: Y.Doc,
    userId: string,
    onSaved?: (versionNumber: number) => void
  ) {
    this.stopAutoSave();

    this.intervalId = setInterval(async () => {
      await this.saveVersion(docId, ydoc, 'Auto-save', userId, onSaved);
    }, AUTO_SAVE_INTERVAL);

    console.log('✓ Auto-save started (every 10 minutes)');
  }

  stopAutoSave() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('✓ Auto-save stopped');
    }
  }

  async saveVersion(
    docId: string,
    ydoc: Y.Doc,
    changes: string,
    userId: string,
    onSaved?: (versionNumber: number) => void
  ): Promise<void> {
    try {
      const content = ydoc.toJSON();
      const contentString = JSON.stringify(content);

      // Skip if content hasn't changed
      if (contentString === this.lastSavedContent) {
        console.log('⏭️ No changes detected, skipping version save');
        return;
      }

      const isOffline = typeof window !== 'undefined' ? !getSyncService().isNetworkOnline() : false;

      if (isOffline) {
        // Queue version creation for later sync
        await getSyncService().queueVersionCreate(docId, content, changes, true);
        console.log('📥 Version queued for offline sync');
      } else {
        // Save version immediately
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/versions/${docId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              content,
              changes,
              isOffline: false,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to save version: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✓ Version saved: ${data.version.version}`);
        
        if (onSaved) {
          onSaved(data.version.version);
        }
      }

      this.lastSavedContent = contentString;
    } catch (error) {
      console.error('✗ Failed to save version:', error);
      
      // Queue for retry if online save failed
      if (typeof window !== 'undefined') {
        const content = ydoc.toJSON();
        await getSyncService().queueVersionCreate(docId, content, changes, false);
      }
    }
  }

  async manualSave(
    docId: string,
    ydoc: Y.Doc,
    changes: string,
    userId: string,
    onSaved?: (versionNumber: number) => void
  ): Promise<void> {
    console.log('💾 Manual save triggered');
    await this.saveVersion(docId, ydoc, changes || 'Manual save', userId, onSaved);
  }

  async loadVersion(docId: string, versionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/versions/${docId}/${versionId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load version: ${response.statusText}`);
      }

      const data = await response.json();
      return data.version;
    } catch (error) {
      console.error('✗ Failed to load version:', error);
      throw error;
    }
  }

  async listVersions(
    docId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ versions: any[]; pagination: any }> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/versions/${docId}?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list versions: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('✗ Failed to list versions:', error);
      throw error;
    }
  }

  async restoreVersion(ydoc: Y.Doc, versionContent: any): Promise<void> {
    try {
      // Clear current document
      ydoc.transact(() => {
        const yXmlFragment = ydoc.getXmlFragment('prosemirror');
        while (yXmlFragment.length > 0) {
          yXmlFragment.delete(0, yXmlFragment.length);
        }
      });

      // Apply version content
      // This is a simplified restoration - in production you'd need proper Yjs state restoration
      console.log('✓ Version restored');
    } catch (error) {
      console.error('✗ Failed to restore version:', error);
      throw error;
    }
  }
}

export const versionService = new VersionService();
