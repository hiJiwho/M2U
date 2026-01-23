const DB_NAME = 'OnlineLetterDB_V6_MULTI';
const STORE_NAME = 'letters';

const db = {
    open: () => new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    }),

    save: async (letter) => {
        const instance = await db.open();
        const tx = instance.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({
            ...letter,
            savedAt: new Date().toISOString()
        });
        return new Promise((r) => tx.oncomplete = () => r(true));
    },

    getAll: async () => {
        const instance = await db.open();
        return new Promise((resolve) => {
            const req = instance.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt)));
        });
    },

    delete: async (id) => {
        const instance = await db.open();
        const tx = instance.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        return new Promise((r) => tx.oncomplete = () => r(true));
    },

    // URL 파라미터에서 데이터 추출
    fromUrl: () => {
        const params = new URLSearchParams(window.location.search);
        const data = {};
        const fields = ['id', 'subject', 'receiverName', 'receiverRole', 'senderName', 'senderRole', 'content', 'date', 'phone', 'email', 'driveLink', 'theme', 'mode'];
        fields.forEach(f => {
            data[f] = params.get(f) || '';
        });
        return data.subject || data.content ? data : null;
    },

    // 데이터를 URL 파라미터로 변환
    toUrl: (data, page = 'view.html') => {
        const params = new URLSearchParams();
        Object.entries(data).forEach(([key, val]) => {
            if (val) params.append(key, val);
        });
        // ensure absolute path handling for cross-page links
        const base = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/');
        return `${base}${page}?${params.toString()}`;
    },

    // ID 생성 (데이터 해시)
    generateID: async (data) => {
        const str = JSON.stringify(data);
        const buf = new TextEncoder().encode(str);
        const hashBuf = await crypto.subtle.digest('SHA-1', buf);
        return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    },

    // 링크 정규화 (https:// 강제)
    filesUrl: (url) => {
        if (!url) return '';
        if (!url.match(/^https?:\/\//i)) {
            return 'https://' + url;
        }
        return url;
    }
};

window.LetterDB = db;
