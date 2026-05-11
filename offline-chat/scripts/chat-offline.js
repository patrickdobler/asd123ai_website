class OfflineModelResolver {
    constructor(storage) {
        this.storage = storage;
        this.rootHandle = null;
        this.uploadedFiles = new Map();
        this.originalFetch = window.fetch.bind(window);
        this.fetchPatched = false;
        this.enabled = false;
        this.useBundledFiles = false;
        this.bundledAccess = new Map();
    }

    supportsDirectoryPicker() {
        return 'showDirectoryPicker' in window;
    }

    async restore() {
        if (!this.supportsDirectoryPicker()) {
            return false;
        }

        const handle = await this.storage.getSetting('offlineModelRoot');
        if (!handle) {
            return false;
        }

        const permission = await this.ensurePermission(handle, false);
        if (!permission) {
            return false;
        }

        this.rootHandle = handle;
        this.enabled = true;
        this.patchFetch();
        return true;
    }

    async chooseFolder() {
        if (!this.supportsDirectoryPicker()) {
            throw new Error('This browser does not support persistent folder access. Use Chrome or Edge for offline model folders.');
        }

        const handle = await window.showDirectoryPicker({ mode: 'read' });
        const allowed = await this.ensurePermission(handle, true);
        if (!allowed) {
            throw new Error('Folder access was not granted.');
        }

        this.rootHandle = handle;
        this.enabled = true;
        await this.storage.setSetting('offlineModelRoot', handle);
        this.patchFetch();
        return handle.name;
    }

    useFileList(fileList) {
        const files = [...fileList];
        if (!files.length) {
            throw new Error('No offline model files were selected.');
        }

        this.uploadedFiles.clear();

        files.forEach(file => {
            const relativePath = file.webkitRelativePath || file.name;
            this.uploadedFiles.set(this.normalizePath(relativePath), file);
        });

        this.enabled = true;
        this.patchFetch();
        return files.length;
    }

    enableBundledModels() {
        this.enabled = true;
        this.useBundledFiles = true;
        this.patchFetch();
    }

    async disable() {
        this.enabled = false;
        this.useBundledFiles = false;
        this.rootHandle = null;
        await this.storage.clearSetting('offlineModelRoot');
    }

    async ensurePermission(handle, request) {
        if (typeof handle.queryPermission !== 'function') {
            return true;
        }

        const options = { mode: 'read' };
        const existing = await handle.queryPermission(options);
        if (existing === 'granted') {
            return true;
        }

        if (!request || typeof handle.requestPermission !== 'function') {
            return false;
        }

        return await handle.requestPermission(options) === 'granted';
    }

    patchFetch() {
        if (this.fetchPatched) {
            return;
        }

        window.fetch = async (input, init) => {
            const requestUrl = typeof input === 'string' ? input : input?.url;
            const resolved = this.parseHuggingFaceAsset(requestUrl);

            if (this.enabled && resolved) {
                const response = await this.findLocalResponse(resolved.modelId, resolved.assetPath, init);

                if (!response) {
                    throw new Error(`Offline model file not found: ${resolved.modelId}/${resolved.assetPath}`);
                }

                return response;
            }

            return this.originalFetch(input, init);
        };

        this.fetchPatched = true;
    }

    parseHuggingFaceAsset(value) {
        if (!value) {
            return null;
        }

        let url;
        try {
            url = new URL(value, window.location.href);
        } catch (error) {
            return null;
        }

        if (url.hostname !== 'huggingface.co') {
            return null;
        }

        const parts = url.pathname.split('/').filter(Boolean);
        const resolveIndex = parts.indexOf('resolve');

        if (resolveIndex < 2 || parts.length <= resolveIndex + 2) {
            return null;
        }

        return {
            modelId: `${parts[0]}/${parts[1]}`,
            revision: parts[resolveIndex + 1],
            assetPath: parts.slice(resolveIndex + 2).join('/')
        };
    }

    async findLocalFile(modelId, assetPath) {
        if (!this.rootHandle && !this.uploadedFiles.size) {
            return null;
        }

        for (const candidate of this.modelCandidates(modelId, assetPath)) {
            const file = await this.getFile(candidate);
            if (file) {
                return file;
            }

            const uploaded = this.getUploadedFile(candidate);
            if (uploaded) {
                return uploaded;
            }
        }

        return null;
    }

    async findLocalResponse(modelId, assetPath, init) {
        const file = await this.findLocalFile(modelId, assetPath);
        if (file) {
            return new Response(file, {
                headers: {
                    'content-type': this.contentType(assetPath),
                    'content-length': String(file.size)
                }
            });
        }

        if (!this.useBundledFiles) {
            return null;
        }

        return this.findBundledResponse(modelId, assetPath, init);
    }

    async canReadBundledModel(modelId) {
        if (!this.useBundledFiles || !modelId) {
            return false;
        }

        if (this.bundledAccess.has(modelId)) {
            return this.bundledAccess.get(modelId);
        }

        const response = await this.findBundledResponse(modelId, 'config.json');
        const readable = Boolean(response?.ok);
        this.bundledAccess.set(modelId, readable);
        return readable;
    }

    async canReadModel(modelId) {
        if (!modelId) {
            return false;
        }

        if (await this.findLocalFile(modelId, 'config.json')) {
            return true;
        }

        return this.canReadBundledModel(modelId);
    }

    async findBundledResponse(modelId, assetPath, init) {
        for (const candidate of this.modelCandidates(modelId, assetPath)) {
            const relativePath = this.normalizePath(candidate.join('/'));
            const localUrl = new URL(relativePath, window.location.href).href;

            try {
                const response = await this.originalFetch(localUrl, init);
                if (response.ok) {
                    return response;
                }
            } catch (error) {
                // Browsers commonly block file:// fetches. The app falls back to
                // one-time folder permission from the Load Model gesture.
            }
        }

        return null;
    }

    modelCandidates(modelId, assetPath) {
        const safeModelId = modelId.replace('/', '--');
        const assetParts = assetPath.split('/');

        return [
            ['models', safeModelId, ...assetParts],
            [safeModelId, ...assetParts],
            ['models', ...modelId.split('/'), ...assetParts],
            [...modelId.split('/'), ...assetParts],
            assetParts
        ];
    }

    getUploadedFile(parts) {
        if (!this.uploadedFiles.size) {
            return null;
        }

        return this.uploadedFiles.get(this.normalizePath(parts.join('/'))) || null;
    }

    normalizePath(value) {
        return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
    }

    async getFile(parts) {
        if (!this.rootHandle) {
            return null;
        }

        let handle = this.rootHandle;

        try {
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];

                if (i === parts.length - 1) {
                    const fileHandle = await handle.getFileHandle(part);
                    return fileHandle.getFile();
                }

                handle = await handle.getDirectoryHandle(part);
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    contentType(path) {
        if (path.endsWith('.json')) {
            return 'application/json';
        }
        if (path.endsWith('.txt')) {
            return 'text/plain';
        }
        if (path.endsWith('.onnx') || path.includes('.onnx_data')) {
            return 'application/octet-stream';
        }
        return 'application/octet-stream';
    }
}

export { OfflineModelResolver };
