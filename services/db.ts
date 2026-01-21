import { Activity } from '../types';

const DB_NAME = 'scripta_db';
const DB_VERSION = 1;
const STORE_NAME = 'activities';

export class DBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Database error:', event);
        reject('Database failed to open');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('archived', 'archived', { unique: false });
          store.createIndex('deleted', 'deleted', { unique: false });
        }
      };
    });
  }

  async getAllActivities(): Promise<Activity[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by updatedAt desc in JS as simple sort
        const result = (request.result as Activity[]).sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveActivity(activity: Activity): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(activity);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteActivity(id: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async softDeleteActivity(id: string): Promise<void> {
    const activity = await this.getActivity(id);
    if (activity) {
      activity.deleted = true;
      activity.updatedAt = new Date().toISOString();
      await this.saveActivity(activity);
    }
  }

  async restoreActivity(id: string): Promise<void> {
    const activity = await this.getActivity(id);
    if (activity) {
      activity.deleted = false;
      activity.archived = false;
      activity.updatedAt = new Date().toISOString();
      await this.saveActivity(activity);
    }
  }

  async archiveActivity(id: string): Promise<void> {
    const activity = await this.getActivity(id);
    if (activity) {
      activity.archived = !activity.archived;
      activity.updatedAt = new Date().toISOString();
      await this.saveActivity(activity);
    }
  }

  async duplicateActivity(id: string): Promise<void> {
    const activity = await this.getActivity(id);
    if (activity) {
        const newActivity = { 
            ...activity, 
            id: crypto.randomUUID(), 
            title: `${activity.title} (Copy)`, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
        };
        await this.saveActivity(newActivity);
    }
  }
}

export const dbService = new DBService();
