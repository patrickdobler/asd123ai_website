const DB_NAME = 'asd123-local-chat';
const DB_VERSION = 1;
const CHAT_STORE = 'chats';
const SETTINGS_STORE = 'settings';

class ChatStorage {
    constructor() {
        this.dbPromise = this.open();
    }

    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(CHAT_STORE)) {
                    const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
                    chatStore.createIndex('updatedAt', 'updatedAt');
                }

                if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async transaction(storeName, mode, callback) {
        const db = await this.dbPromise;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            let result;

            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);

            result = callback(store);
        });
    }

    async listChats() {
        const db = await this.dbPromise;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readonly');
            const store = tx.objectStore(CHAT_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                const chats = request.result || [];
                chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                resolve(chats);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getChat(id) {
        const db = await this.dbPromise;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(CHAT_STORE, 'readonly');
            const request = tx.objectStore(CHAT_STORE).get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveChat(chat) {
        const record = {
            ...chat,
            updatedAt: new Date().toISOString()
        };

        await this.transaction(CHAT_STORE, 'readwrite', store => store.put(record));
        return record;
    }

    async deleteChat(id) {
        await this.transaction(CHAT_STORE, 'readwrite', store => store.delete(id));
    }

    async clearChats() {
        await this.transaction(CHAT_STORE, 'readwrite', store => store.clear());
    }

    async getSetting(key) {
        const db = await this.dbPromise;

        return new Promise((resolve, reject) => {
            const tx = db.transaction(SETTINGS_STORE, 'readonly');
            const request = tx.objectStore(SETTINGS_STORE).get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    async setSetting(key, value) {
        await this.transaction(SETTINGS_STORE, 'readwrite', store => store.put({ key, value }));
    }

    async clearSetting(key) {
        await this.transaction(SETTINGS_STORE, 'readwrite', store => store.delete(key));
    }
}

export { ChatStorage };
