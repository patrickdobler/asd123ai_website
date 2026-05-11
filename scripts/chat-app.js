import {
    CONTEXT_WINDOWS,
    MODEL_REGISTRY,
    clampContextWindow,
    getContextLabel,
    getModelConfig
} from './chat-models.js';
import { ChatStorage } from './chat-storage.js';
import { ChatFileProcessor } from './chat-files.js';
import { OfflineModelResolver } from './chat-offline.js';

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@next';
const TRANSFORMERS_LOCAL = '../vendor/transformers.min.js';
const DEFAULT_MODEL_ID = 'gemma-4-e2b';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_NEW_TOKENS = 768;
const SYSTEM_PROMPT = 'You are ASD123.ai Chat, a helpful local assistant. Answer in English by default. Be concise, accurate, and never claim that user data leaves the browser.';

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class ChatModelRunner {
    constructor(statusCallback) {
        this.statusCallback = statusCallback;
        this.hf = null;
        this.processor = null;
        this.model = null;
        this.currentModelId = null;
        this.loading = false;
    }

    async ensure(modelId) {
        if (this.currentModelId === modelId && this.model && this.processor) {
            return;
        }

        const config = getModelConfig(modelId);
        if (config.status === 'unavailable') {
            throw new Error(config.disabledReason || 'This model is not available.');
        }

        if (!navigator.gpu) {
            throw new Error('WebGPU is not available in this browser. Use a recent Chrome or Edge build.');
        }

        this.loading = true;
        this.updateStatus('Loading runtime...');

        try {
            this.hf = this.hf || await this.loadTransformers();

            const ModelClass = this.hf[config.className];
            if (!ModelClass) {
                throw new Error(`${config.className} is not available in the loaded Transformers.js runtime.`);
            }

            this.updateStatus(`Loading ${config.label} processor...`);
            this.processor = await this.hf.AutoProcessor.from_pretrained(config.repo, {
                progress_callback: info => this.handleProgress(info, config.label)
            });

            this.updateStatus(`Loading ${config.label} model...`);
            this.model = await ModelClass.from_pretrained(config.repo, {
                dtype: config.dtype,
                device: 'webgpu',
                progress_callback: info => this.handleProgress(info, config.label)
            });

            this.currentModelId = modelId;
            this.updateStatus(`${config.label} ready`);
        } finally {
            this.loading = false;
        }
    }

    async loadTransformers() {
        const source = window.location.protocol === 'file:' ? TRANSFORMERS_LOCAL : TRANSFORMERS_CDN;
        const module = await import(source);

        if (module.env) {
            module.env.allowLocalModels = true;
            module.env.allowRemoteModels = true;
        }

        return module;
    }

    handleProgress(info, label) {
        if (!info) {
            return;
        }

        if (info.status === 'progress_total' && Number.isFinite(info.progress)) {
            this.updateStatus(`${label} ${Math.round(info.progress)}%`);
            return;
        }

        if (info.status === 'download' && info.name) {
            this.updateStatus(`Downloading ${info.name}`);
            return;
        }

        if (info.status === 'ready') {
            this.updateStatus(`${label} component ready`);
        }
    }

    updateStatus(message) {
        if (this.statusCallback) {
            this.statusCallback(message);
        }
    }

    async generate({ modelId, messages, contextWindow, temperature, onToken }) {
        await this.ensure(modelId);

        const modelMessages = this.buildModelMessages(messages, contextWindow);
        const imageAttachments = this.lastImageAttachments || [];
        const images = await this.loadImages(imageAttachments);
        const prompt = this.processor.apply_chat_template(modelMessages, {
            enable_thinking: false,
            add_generation_prompt: true
        });
        const inputs = await this.prepareInputs(prompt, images);
        let streamed = '';

        const streamer = new this.hf.TextStreamer(this.processor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: text => {
                streamed += text;
                onToken?.(this.cleanAssistantText(streamed), text);
            }
        });

        const generationOptions = {
            ...inputs,
            max_new_tokens: DEFAULT_MAX_NEW_TOKENS,
            do_sample: Number(temperature) > 0,
            temperature: Number(temperature) || DEFAULT_TEMPERATURE,
            streamer
        };

        const outputs = await this.model.generate(generationOptions);
        const decoded = this.decodeOutputs(outputs, inputs);
        return this.cleanAssistantText(decoded || streamed);
    }

    buildModelMessages(messages, contextWindow) {
        const budget = Math.max(512, Number(contextWindow) - DEFAULT_MAX_NEW_TOKENS - 256);
        const selected = [];
        let used = this.estimateTokens(SYSTEM_PROMPT);

        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const estimate = this.estimateTokens(message.content) + this.estimateAttachmentTokens(message.attachments);

            if (selected.length && used + estimate > budget) {
                break;
            }

            selected.unshift(message);
            used += estimate;
        }

        this.lastImageAttachments = selected
            .flatMap(message => Array.isArray(message.attachments) ? message.attachments : [])
            .filter(attachment => attachment.kind === 'image');

        return [
            {
                role: 'system',
                content: [{ type: 'text', text: SYSTEM_PROMPT }]
            },
            ...selected.map(message => this.toModelMessage(message))
        ];
    }

    toModelMessage(message) {
        if (message.role === 'assistant') {
            return {
                role: 'assistant',
                content: [{ type: 'text', text: message.content }]
            };
        }

        const content = [];
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];

        attachments.filter(attachment => attachment.kind === 'image').forEach(() => {
            content.push({ type: 'image' });
        });

        const textAttachments = attachments
            .filter(attachment => attachment.kind === 'text' && attachment.text)
            .map(attachment => {
                const trimmed = attachment.text.length > 20000
                    ? `${attachment.text.slice(0, 20000)}\n\n[Attachment truncated locally]`
                    : attachment.text;
                return `\n\n[Attached file: ${attachment.name}]\n${trimmed}`;
            })
            .join('');

        content.push({
            type: 'text',
            text: `${message.content || ''}${textAttachments}`.trim()
        });

        return {
            role: 'user',
            content
        };
    }

    async loadImages(attachments) {
        if (!attachments.length) {
            return [];
        }

        const RawImage = this.hf.RawImage;
        if (!RawImage || typeof RawImage.read !== 'function') {
            throw new Error('The loaded Transformers.js runtime does not expose RawImage for image inputs.');
        }

        const images = [];
        for (const attachment of attachments) {
            images.push(await RawImage.read(attachment.dataUrl));
        }
        return images;
    }

    async prepareInputs(prompt, images) {
        if (!images.length) {
            return this.processor(prompt, { add_special_tokens: false });
        }

        if (images.length === 1) {
            return this.processor(prompt, images[0], { add_special_tokens: false });
        }

        return this.processor(prompt, images, { add_special_tokens: false });
    }

    decodeOutputs(outputs, inputs) {
        try {
            const promptLength = inputs?.input_ids?.dims?.at(-1) || 0;
            const generated = typeof outputs.slice === 'function'
                ? outputs.slice(null, [promptLength, null])
                : outputs;
            const decoded = this.processor.batch_decode(generated, {
                skip_special_tokens: true
            });
            return Array.isArray(decoded) ? decoded[0] : String(decoded || '');
        } catch (error) {
            return '';
        }
    }

    cleanAssistantText(text) {
        return String(text || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/<\|channel\|>thought[\s\S]*?<\|channel\|>/gi, '')
            .replace(/<\|channel\|>thought[\s\S]*?<channel\|>/gi, '')
            .replace(/<\|im_end\|>/g, '')
            .replace(/<\/s>/g, '')
            .trim();
    }

    estimateTokens(text) {
        return Math.ceil(String(text || '').length / 4);
    }

    estimateAttachmentTokens(attachments) {
        return (attachments || []).reduce((total, attachment) => {
            if (attachment.kind === 'image') {
                return total + 512;
            }
            return total + this.estimateTokens(attachment.text || '');
        }, 0);
    }
}

class LocalChatApp {
    constructor() {
        this.storage = new ChatStorage();
        this.fileProcessor = new ChatFileProcessor();
        this.offlineResolver = new OfflineModelResolver(this.storage);
        this.runner = new ChatModelRunner(message => this.setModelStatus(message));
        this.chats = [];
        this.currentChat = null;
        this.pendingAttachments = [];
        this.generating = false;
        this.elements = {};
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        this.populateModels();
        this.populateContextWindows();

        try {
            const restored = await this.offlineResolver.restore();
            this.setOfflineStatus(restored ? 'Offline folder connected' : 'Online model downloads enabled');
        } catch (error) {
            this.setOfflineStatus('Online model downloads enabled');
        }

        this.chats = await this.storage.listChats();
        if (this.chats.length) {
            await this.openChat(this.chats[0].id);
        } else {
            await this.createNewChat({ persist: false });
        }

        this.updateContextOptions();
        this.renderHistory();
        this.renderMessages();
    }

    cacheElements() {
        [
            'chatHistory',
            'messageList',
            'messageInput',
            'sendBtn',
            'newChatBtn',
            'deleteAllBtn',
            'exportChatBtn',
            'modelSelect',
            'contextSelect',
            'temperatureInput',
            'temperatureValue',
            'modelStatus',
            'offlineStatus',
            'loadModelBtn',
            'offlineFolderBtn',
            'folderInput',
            'attachBtn',
            'fileInput',
            'attachmentList',
            'currentChatTitle'
        ].forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
    }

    bindEvents() {
        this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.elements.deleteAllBtn.addEventListener('click', () => this.deleteAllChats());
        this.elements.exportChatBtn.addEventListener('click', () => this.exportCurrentChat());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.loadModelBtn.addEventListener('click', () => this.loadSelectedModel());
        this.elements.offlineFolderBtn.addEventListener('click', () => this.chooseOfflineFolder());
        this.elements.folderInput.addEventListener('change', event => this.chooseOfflineFileList(event.target.files));
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', event => this.handleFiles(event.target.files));
        this.elements.modelSelect.addEventListener('change', () => this.handleModelChange());
        this.elements.contextSelect.addEventListener('change', () => this.saveCurrentSettings());
        this.elements.temperatureInput.addEventListener('input', () => {
            this.elements.temperatureValue.textContent = Number(this.elements.temperatureInput.value).toFixed(1);
            this.saveCurrentSettings();
        });
        this.elements.messageInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.messageInput.addEventListener('input', () => this.resizeComposer());
    }

    populateModels() {
        const primary = document.createElement('optgroup');
        primary.label = 'Primary';
        const experimental = document.createElement('optgroup');
        experimental.label = 'Experimental';
        const unavailable = document.createElement('optgroup');
        unavailable.label = 'Not enabled';

        Object.values(MODEL_REGISTRY).forEach(config => {
            const option = document.createElement('option');
            option.value = config.id;
            option.textContent = config.status === 'experimental'
                ? `${config.label} (experimental)`
                : config.label;
            option.disabled = config.status === 'unavailable';
            option.title = config.disabledReason || config.repo;

            if (config.status === 'primary') {
                primary.appendChild(option);
            } else if (config.status === 'experimental') {
                experimental.appendChild(option);
            } else {
                unavailable.appendChild(option);
            }
        });

        this.elements.modelSelect.append(primary, experimental, unavailable);
    }

    populateContextWindows() {
        CONTEXT_WINDOWS.forEach(value => {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = getContextLabel(value);
            this.elements.contextSelect.appendChild(option);
        });
    }

    async createNewChat({ persist = false } = {}) {
        const now = new Date().toISOString();
        const modelId = this.elements.modelSelect?.value || DEFAULT_MODEL_ID;
        const chat = {
            id: createId('chat'),
            title: 'New Chat',
            createdAt: now,
            updatedAt: now,
            modelId,
            contextWindow: getModelConfig(modelId).defaultContextWindow,
            temperature: DEFAULT_TEMPERATURE,
            messages: [],
            isDraft: !persist
        };

        this.currentChat = persist ? await this.storage.saveChat(chat) : chat;
        this.chats = await this.storage.listChats();
        this.pendingAttachments = [];
        this.elements.messageInput.value = '';
        this.applyChatSettings();
        this.renderPendingAttachments();
        this.resizeComposer();
        this.renderHistory();
        this.renderMessages();
        this.elements.messageInput.focus();
    }

    async openChat(id) {
        const chat = await this.storage.getChat(id);
        if (!chat) {
            return;
        }

        this.currentChat = chat;
        this.applyChatSettings();
        this.renderHistory();
        this.renderMessages();
    }

    applyChatSettings() {
        if (!this.currentChat) {
            return;
        }

        this.elements.modelSelect.value = this.currentChat.modelId || DEFAULT_MODEL_ID;
        this.updateContextOptions();
        this.elements.contextSelect.value = String(clampContextWindow(
            this.elements.modelSelect.value,
            this.currentChat.contextWindow
        ));
        this.elements.temperatureInput.value = String(this.currentChat.temperature ?? DEFAULT_TEMPERATURE);
        this.elements.temperatureValue.textContent = Number(this.elements.temperatureInput.value).toFixed(1);
        this.elements.currentChatTitle.textContent = this.currentChat.title || 'New Chat';
    }

    async saveCurrentSettings() {
        if (!this.currentChat) {
            return;
        }

        this.currentChat.modelId = this.elements.modelSelect.value;
        this.currentChat.contextWindow = Number(this.elements.contextSelect.value);
        this.currentChat.temperature = Number(this.elements.temperatureInput.value);

        if (this.currentChat.isDraft) {
            return;
        }

        this.currentChat = await this.storage.saveChat(this.currentChat);
        this.chats = await this.storage.listChats();
        this.renderHistory();
    }

    async handleModelChange() {
        const modelId = this.elements.modelSelect.value;
        const model = getModelConfig(modelId);
        this.updateContextOptions();
        this.elements.contextSelect.value = String(model.defaultContextWindow);
        await this.saveCurrentSettings();
        this.setModelStatus(`${model.label} selected`);
    }

    updateContextOptions() {
        const model = getModelConfig(this.elements.modelSelect.value || DEFAULT_MODEL_ID);

        [...this.elements.contextSelect.options].forEach(option => {
            const value = Number(option.value);
            option.disabled = value > model.contextWindow;
        });
    }

    renderHistory() {
        this.elements.chatHistory.textContent = '';

        if (!this.chats.length) {
            const empty = document.createElement('div');
            empty.className = 'chat-history-empty';
            empty.textContent = 'No chats yet';
            this.elements.chatHistory.appendChild(empty);
            return;
        }

        this.chats.forEach(chat => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `chat-history-item${this.currentChat?.id === chat.id ? ' chat-history-item--active' : ''}`;
            button.addEventListener('click', () => this.openChat(chat.id));

            const title = document.createElement('span');
            title.className = 'chat-history-title';
            title.textContent = chat.title || 'New Chat';

            const meta = document.createElement('span');
            meta.className = 'chat-history-meta';
            meta.textContent = this.formatDate(chat.updatedAt);

            button.append(title, meta);
            this.elements.chatHistory.appendChild(button);
        });
    }

    renderMessages() {
        this.elements.messageList.textContent = '';
        this.elements.currentChatTitle.textContent = this.currentChat?.title || 'New Chat';

        if (!this.currentChat?.messages?.length) {
            const empty = document.createElement('div');
            empty.className = 'chat-empty-state';
            empty.textContent = 'Start a local conversation';
            this.elements.messageList.appendChild(empty);
            return;
        }

        this.currentChat.messages.forEach((message, index) => {
            this.elements.messageList.appendChild(this.renderMessage(message, index));
        });

        this.scrollMessagesToEnd();
    }

    renderMessage(message, index) {
        const article = document.createElement('article');
        article.className = `chat-message chat-message--${message.role}`;
        article.dataset.messageId = message.id;

        const header = document.createElement('div');
        header.className = 'chat-message-header';

        const role = document.createElement('span');
        role.className = 'chat-message-role';
        role.textContent = message.role === 'user' ? 'You' : 'ASD123.ai';
        header.appendChild(role);

        if (message.role === 'user') {
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'chat-icon-btn';
            edit.title = 'Edit and regenerate';
            edit.setAttribute('aria-label', 'Edit and regenerate');
            edit.innerHTML = this.icon('edit');
            edit.addEventListener('click', () => this.editMessage(message.id, index));
            header.appendChild(edit);
        }

        const body = document.createElement('div');
        body.className = 'chat-message-body';
        body.textContent = message.content || '';

        const attachments = this.renderMessageAttachments(message.attachments || []);
        article.append(header, body);

        if (attachments) {
            article.appendChild(attachments);
        }

        return article;
    }

    renderMessageAttachments(attachments) {
        if (!attachments.length) {
            return null;
        }

        const list = document.createElement('div');
        list.className = 'chat-message-attachments';

        attachments.forEach(attachment => {
            const chip = document.createElement('span');
            chip.className = 'chat-attachment-chip';
            chip.textContent = attachment.kind === 'image'
                ? `Image: ${attachment.name}`
                : `File: ${attachment.name}`;
            list.appendChild(chip);
        });

        return list;
    }

    editMessage(messageId, index) {
        const article = this.elements.messageList.querySelector(`[data-message-id="${messageId}"]`);
        const message = this.currentChat.messages.find(item => item.id === messageId);
        if (!article || !message) {
            return;
        }

        article.textContent = '';

        const editor = document.createElement('textarea');
        editor.className = 'chat-edit-input';
        editor.value = message.content;

        const actions = document.createElement('div');
        actions.className = 'chat-edit-actions';

        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'btn btn-primary btn-small';
        save.textContent = 'Send';
        save.addEventListener('click', () => this.confirmEdit(messageId, index, editor.value));

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary btn-small';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => this.renderMessages());

        actions.append(save, cancel);
        article.append(editor, actions);
        editor.focus();
    }

    async confirmEdit(messageId, index, value) {
        const text = value.trim();
        if (!text) {
            return;
        }

        const message = this.currentChat.messages.find(item => item.id === messageId);
        if (!message) {
            return;
        }

        message.content = text;
        this.currentChat.messages = this.currentChat.messages.slice(0, index + 1);
        await this.persistCurrentChat();
        this.renderMessages();
        await this.generateAssistantReply();
    }

    async sendMessage() {
        if (this.generating || !this.currentChat) {
            return;
        }

        const text = this.elements.messageInput.value.trim();
        if (!text && !this.pendingAttachments.length) {
            return;
        }

        const userMessage = {
            id: createId('msg'),
            role: 'user',
            content: text || 'Please analyze the attached file.',
            attachments: this.pendingAttachments,
            createdAt: new Date().toISOString()
        };

        this.currentChat.messages.push(userMessage);
        this.elements.messageInput.value = '';
        this.pendingAttachments = [];
        this.renderPendingAttachments();
        this.resizeComposer();

        if (this.currentChat.title === 'New Chat') {
            this.currentChat.title = this.generateTitle(userMessage.content);
        }

        await this.persistCurrentChat();
        this.renderMessages();
        await this.generateAssistantReply();
    }

    async generateAssistantReply() {
        const assistantMessage = {
            id: createId('msg'),
            role: 'assistant',
            content: '',
            attachments: [],
            createdAt: new Date().toISOString()
        };

        this.currentChat.messages.push(assistantMessage);
        this.generating = true;
        this.setControlsDisabled(true);
        this.renderMessages();

        try {
            const content = await this.runner.generate({
                modelId: this.currentChat.modelId,
                messages: this.currentChat.messages.filter(message => message.id !== assistantMessage.id),
                contextWindow: this.currentChat.contextWindow,
                temperature: this.currentChat.temperature,
                onToken: text => {
                    assistantMessage.content = text;
                    this.updateAssistantMessage(assistantMessage.id, text);
                }
            });

            assistantMessage.content = content || assistantMessage.content || 'No response was generated.';
            this.updateAssistantMessage(assistantMessage.id, assistantMessage.content);
            await this.persistCurrentChat();
        } catch (error) {
            assistantMessage.content = `Local generation failed: ${error.message}`;
            this.updateAssistantMessage(assistantMessage.id, assistantMessage.content);
            await this.persistCurrentChat();
            this.setModelStatus('Generation failed');
        } finally {
            this.generating = false;
            this.setControlsDisabled(false);
            this.chats = await this.storage.listChats();
            this.renderHistory();
        }
    }

    updateAssistantMessage(messageId, text) {
        const article = this.elements.messageList.querySelector(`[data-message-id="${messageId}"]`);
        if (!article) {
            return;
        }

        const body = article.querySelector('.chat-message-body');
        if (body) {
            body.textContent = text;
        }
        this.scrollMessagesToEnd();
    }

    async persistCurrentChat() {
        this.currentChat.modelId = this.elements.modelSelect.value;
        this.currentChat.contextWindow = Number(this.elements.contextSelect.value);
        this.currentChat.temperature = Number(this.elements.temperatureInput.value);
        delete this.currentChat.isDraft;
        this.currentChat = await this.storage.saveChat(this.currentChat);
        this.chats = await this.storage.listChats();
    }

    async loadSelectedModel() {
        try {
            await this.runner.ensure(this.elements.modelSelect.value);
        } catch (error) {
            this.setModelStatus(error.message);
        }
    }

    async chooseOfflineFolder() {
        try {
            if (!this.offlineResolver.supportsDirectoryPicker()) {
                this.elements.folderInput.click();
                this.setOfflineStatus('Select the included models folder');
                return;
            }

            const folderName = await this.offlineResolver.chooseFolder();
            this.setOfflineStatus(`Offline folder: ${folderName}`);
        } catch (error) {
            this.setOfflineStatus(error.message);
        }
    }

    async chooseOfflineFileList(fileList) {
        this.elements.folderInput.value = '';

        try {
            const count = this.offlineResolver.useFileList(fileList);
            this.setOfflineStatus(`Offline files connected: ${count}`);
        } catch (error) {
            this.setOfflineStatus(error.message);
        }
    }

    async handleFiles(fileList) {
        const files = [...fileList];
        this.elements.fileInput.value = '';

        for (const file of files) {
            try {
                const attachment = await this.fileProcessor.process(file);
                this.pendingAttachments.push(attachment);
            } catch (error) {
                this.setModelStatus(error.message);
            }
        }

        this.renderPendingAttachments();
    }

    renderPendingAttachments() {
        this.elements.attachmentList.textContent = '';

        this.pendingAttachments.forEach(attachment => {
            const chip = document.createElement('span');
            chip.className = 'chat-attachment-chip chat-attachment-chip--pending';
            chip.textContent = attachment.kind === 'image' ? `Image: ${attachment.name}` : `File: ${attachment.name}`;

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'chat-chip-remove';
            remove.title = 'Remove attachment';
            remove.textContent = 'x';
            remove.addEventListener('click', () => {
                this.pendingAttachments = this.pendingAttachments.filter(item => item.id !== attachment.id);
                this.renderPendingAttachments();
            });

            chip.appendChild(remove);
            this.elements.attachmentList.appendChild(chip);
        });
    }

    async deleteAllChats() {
        const confirmed = window.confirm('Delete all local chat history on this browser?');
        if (!confirmed) {
            return;
        }

        await this.storage.clearChats();
        this.chats = [];
        await this.createNewChat({ persist: false });
        this.setModelStatus('Local chat history deleted');
    }

    exportCurrentChat() {
        if (!this.currentChat) {
            return;
        }

        const markdown = this.toMarkdown(this.currentChat);
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this.slugify(this.currentChat.title || 'chat')}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    toMarkdown(chat) {
        const model = getModelConfig(chat.modelId);
        const lines = [
            `# ${chat.title || 'Chat Export'}`,
            '',
            `- Exported: ${new Date().toISOString()}`,
            `- Model: ${model.label}`,
            `- Context: ${getContextLabel(chat.contextWindow)}`,
            `- Temperature: ${chat.temperature}`,
            ''
        ];

        chat.messages.forEach(message => {
            lines.push(`## ${message.role === 'user' ? 'User' : 'Assistant'}`, '');

            if (message.attachments?.length) {
                lines.push('Attachments:', '');
                message.attachments.forEach(attachment => {
                    lines.push(`- ${attachment.kind}: ${attachment.name}`);
                });
                lines.push('');
            }

            lines.push(message.content || '', '');
        });

        return lines.join('\n');
    }

    generateTitle(text) {
        const words = String(text || '')
            .replace(/[^\w\s-]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7);

        if (!words.length) {
            return 'New Chat';
        }

        return words.join(' ');
    }

    resizeComposer() {
        const input = this.elements.messageInput;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }

    setControlsDisabled(disabled) {
        this.elements.sendBtn.disabled = disabled;
        this.elements.loadModelBtn.disabled = disabled;
        this.elements.modelSelect.disabled = disabled;
        this.elements.contextSelect.disabled = disabled;
        this.elements.temperatureInput.disabled = disabled;
    }

    setModelStatus(message) {
        this.elements.modelStatus.textContent = message || 'Ready';
    }

    setOfflineStatus(message) {
        this.elements.offlineStatus.textContent = message;
    }

    formatDate(value) {
        if (!value) {
            return '';
        }

        return new Intl.DateTimeFormat('en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(value));
    }

    scrollMessagesToEnd() {
        requestAnimationFrame(() => {
            this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight;
        });
    }

    slugify(value) {
        return String(value || 'chat')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'chat';
    }

    icon(name) {
        const icons = {
            edit: '<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
        };
        return icons[name] || '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new LocalChatApp();
    window.asd123ChatApp = app;
    app.init().catch(error => {
        const status = document.getElementById('modelStatus');
        if (status) {
            status.textContent = error.message;
        }
    });
});
