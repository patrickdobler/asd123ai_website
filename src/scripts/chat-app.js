import {
    CONTEXT_WINDOWS,
    MODEL_REGISTRY,
    clampContextWindow,
    getContextOptionLabel,
    getContextLabel,
    getModelConfig,
    getModelOptionLabel
} from './chat-models.js?v=20260512-chat-public';
import { ChatStorage } from './chat-storage.js?v=20260512-chat-public';
import { ChatFileProcessor } from './chat-files.js?v=20260512-chat-public';
import { OfflineModelResolver } from './chat-offline.js?v=20260512-chat-public';

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const TRANSFORMERS_LOCAL = 'vendor/transformers.local.mjs';
const TRANSFORMERS_IIFE = 'vendor/transformers.iife.js';
const ORT_WEBGPU_IIFE = 'vendor/ort.webgpu.bundle.iife.js';
const DEFAULT_MODEL_ID = 'gemma-4-e2b';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_NEW_TOKENS = 768;
const CONTEXT_SAFETY_TOKENS = 128;
const MESSAGE_OVERHEAD_TOKENS = 18;
const ATTACHMENT_TEXT_CHAR_LIMIT = 20000;
const CONTEXT_WARNING_RATIO = 0.85;
const AUTO_COMPACT_RATIO = 0.88;
const AUTO_COMPACT_RECENT_MESSAGES = 8;
const AUTO_COMPACT_MAX_SUMMARY_TOKENS = 1800;
const AUTO_COMPACT_MIN_OLD_MESSAGES = 4;
const GEMMA_MID_CONTEXT_TOKENS = 8192;
const GEMMA_LONG_CONTEXT_TOKENS = 16384;
const GEMMA_DTYPE_Q4F16 = 'q4f16';
const SYSTEM_PROMPT = [
    'You are ASD123.ai Chat, a helpful local assistant that runs in the user’s browser.',
    'Reply in the same language the user uses, unless the user explicitly asks for another language.',
    'Be direct and concise. For summarization, extraction, rewriting, translation, classification, or formatting tasks, provide the requested output immediately without introductory phrases such as “Sure”, “Here is”, or “I can help”.',
    'Never claim that prompts, files, chat history, or generated text leave the browser.'
].join(' ');

function isOfflineBundle() {
    return Boolean(window.asd123OfflineBundle) || document.body?.classList.contains('chat-offline-bundle');
}

function createId(prefix) {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class LocalDynamicCache {
    constructor(entries = null) {
        if (entries) {
            Object.assign(this, entries);
        }
    }

    get_seq_length() {
        for (const [name, tensor] of Object.entries(this)) {
            if (name.startsWith('past_key_values.') && Array.isArray(tensor?.dims)) {
                return tensor.dims.at(-2) || 0;
            }
        }
        return 0;
    }

    update(entries) {
        Object.entries(entries || {}).forEach(([key, value]) => {
            const existing = this[key];
            if (existing && existing !== value) {
                try {
                    existing.dispose?.();
                } catch (error) {
                    // Cache tensors are best-effort disposable across runtimes.
                }
            }
            this[key] = value;
        });
    }

    async dispose() {
        await Promise.all(Object.values(this).map(async tensor => {
            try {
                const disposed = tensor?.dispose?.();
                if (disposed && typeof disposed.then === 'function') {
                    await disposed;
                }
            } catch (error) {
                // Cache disposal should never mask the original generation result.
            }
        }));
    }
}

class ChatModelRunner {
    constructor(statusCallback) {
        this.statusCallback = statusCallback;
        this.hf = null;
        this.processor = null;
        this.model = null;
        // Custom WebGPU-kernel engine (Gemma4Mobile) — a separate runtime that
        // coexists with Transformers.js; only one model is resident at a time.
        this.gmModel = null;
        this.gmModule = null;
        this.currentModelKey = null;
        this.activeDtypeLabel = null;
        this.loading = false;
        this.abortController = null;
        this.abortReason = '';
        this.fetchAbortPatched = false;
        this.abortableFetch = null;
    }

    beginAbortableOperation(reason = 'operation') {
        if (!this.abortController || this.abortController.signal.aborted) {
            this.abortController = new AbortController();
        }
        this.abortReason = reason;
        return this.abortController;
    }

    finishAbortableOperation(controller) {
        if (!controller || this.abortController === controller) {
            this.abortController = null;
            this.abortReason = '';
        }
    }

    cancelCurrentOperation() {
        if (!this.abortController || this.abortController.signal.aborted) {
            return false;
        }

        this.abortController.abort();
        return true;
    }

    throwIfAborted() {
        if (!this.abortController?.signal?.aborted) {
            return;
        }

        const error = new Error(`${this.abortReason || 'Operation'} stopped by user.`);
        error.name = 'AbortError';
        throw error;
    }

    isAbortError(error) {
        return error?.name === 'AbortError' ||
            /aborted|abort|stopped by user/i.test(error?.message || String(error || ''));
    }

    async ensure(modelId, wantsMultimodal = false, { force = false } = {}) {
        this.throwIfAborted();
        const modelKey = `${modelId}:${wantsMultimodal ? 'multimodal' : 'text'}`;
        if (!force && this.currentModelKey === modelKey && ((this.model && this.processor) || this.gmModel)) {
            return;
        }

        const config = getModelConfig(modelId);
        if (config.status === 'unavailable') {
            throw new Error(config.disabledReason || 'This model is not available.');
        }

        if (!navigator.gpu) {
            throw new Error('WebGPU is not available in this browser. Use a recent Chrome or Edge build.');
        }

        if (config.engine === 'gemma4mobile') {
            await this.ensureGemma4Mobile(modelId, modelKey, config);
            return;
        }

        this.loading = true;
        this.updateStatus('Loading runtime...');

        try {
            if (force) {
                await this.resetLoadedModel();
            }

            this.hf = this.hf || await this.loadTransformers();
            this.throwIfAborted();

            const ModelClass = this.resolveModelClass(config, wantsMultimodal);
            if (!ModelClass) {
                throw new Error(`${this.getClassName(config, wantsMultimodal)} is not available in the loaded Transformers.js runtime. Try clearing the browser cache and reloading /chat.`);
            }

            this.updateStatus(`Loading ${config.label} processor...`);
            this.processor = await this.hf.AutoProcessor.from_pretrained(config.repo, {
                progress_callback: info => {
                    this.throwIfAborted();
                    this.handleProgress(info, config.label);
                }
            });
            this.throwIfAborted();

            this.model = await this.loadModelWithDtypeFallback(ModelClass, config, wantsMultimodal);

            this.currentModelKey = modelKey;
            await this.warmup(config);
            this.updateStatus(`${config.label} ${wantsMultimodal ? 'multimodal' : 'text'} ready${this.activeDtypeLabel ? ` (${this.activeDtypeLabel})` : ''}`);
        } catch (error) {
            const message = this.describeLoadError(error);
            await this.resetLoadedModel();
            this.updateStatus(message);
            throw new Error(message);
        } finally {
            this.loading = false;
        }
    }

    // Load the custom WebGPU-kernel engine (served same-origin by our Worker
    // proxy). Frees any Transformers.js model first so two large models never
    // contend for VRAM, then loads weights and warms the kernels.
    async ensureGemma4Mobile(modelId, modelKey, config) {
        this.loading = true;
        this.updateStatus(`Loading ${config.label} engine...`);

        try {
            await this.resetLoadedModel();
            this.throwIfAborted();

            if (!this.gmModule) {
                const url = new URL('vendor/gemma4mobile-engine.js', window.location.href).href;
                this.gmModule = await import(/* @vite-ignore */ url);
            }
            const Gemma4Mobile = this.gmModule.Gemma4Mobile;
            if (typeof Gemma4Mobile?.load !== 'function') {
                throw new Error('The Gemma 4 Apple Silicon engine could not be loaded.');
            }
            this.throwIfAborted();

            this.updateStatus(`Downloading ${config.label}...`);
            this.gmModel = await Gemma4Mobile.load(null, {
                onProgress: info => {
                    this.throwIfAborted();
                    const pct = info && typeof info.fraction === 'number' ? Math.round(info.fraction * 100) : null;
                    const stage = info?.status || 'loading';
                    this.updateStatus(pct != null ? `${config.label}: ${stage} ${pct}%` : `${config.label}: ${stage}`);
                }
            });
            this.throwIfAborted();

            this.updateStatus(`Warming up ${config.label}...`);
            await this.gmModel.warmup?.();
            this.throwIfAborted();

            this.currentModelKey = modelKey;
            this.updateStatus(`${config.label} ready`);
        } catch (error) {
            await this.resetLoadedModel();
            const message = error?.message || String(error || 'Failed to load the Gemma 4 Apple Silicon engine.');
            this.updateStatus(this.isAbortError(error) ? 'Model loading stopped.' : message);
            throw this.isAbortError(error) ? error : new Error(message);
        } finally {
            this.loading = false;
        }
    }

    async loadModelWithDtypeFallback(ModelClass, config, wantsMultimodal) {
        const candidates = this.getDtypeCandidates(config, wantsMultimodal);
        let lastError = null;

        for (let index = 0; index < candidates.length; index++) {
            const candidate = candidates[index];
            this.updateStatus(`Loading ${config.label} model (${candidate.label})...`);

            try {
                const model = await ModelClass.from_pretrained(config.repo, {
                    dtype: candidate.dtype,
                    device: 'webgpu',
                    progress_callback: info => {
                        this.throwIfAborted();
                        this.handleProgress(info, config.label);
                    }
                });
                this.throwIfAborted();
                this.activeDtypeLabel = candidate.label;
                return model;
            } catch (error) {
                if (this.isAbortError(error)) {
                    throw error;
                }

                lastError = error;
                const fallback = candidates[index + 1];

                if (!fallback || !this.shouldTryDtypeFallback(error)) {
                    break;
                }

                this.updateStatus(`${config.label} ${candidate.label} files unavailable; trying ${fallback.label}...`);
            }
        }

        throw lastError;
    }

    // Compile the WebGPU shaders up front with a tiny throwaway generation, so
    // the user's first real prompt doesn't pay the kernel-compilation stall.
    // Best-effort: a warmup hiccup must never block a model that loaded fine.
    // (A non-abort failure is swallowed; abort is re-thrown to honour Stop.)
    async warmup(config) {
        if (typeof this.model?.generate !== 'function' || !this.processor) {
            return;
        }

        let inputs = null;
        let outputs = null;

        try {
            this.throwIfAborted();
            this.updateStatus(`Warming up ${config.label}...`);
            const prompt = this.formatPrompt([{ role: 'user', content: 'Hi' }], config);
            inputs = await this.prepareInputs(prompt, [], config);
            this.throwIfAborted();
            // max_new_tokens: 2 exercises prefill plus the steady-state
            // decode-with-KV-cache path, which is where most shaders compile.
            outputs = await this.model.generate({
                ...inputs,
                max_new_tokens: 2,
                do_sample: false
            });
            this.throwIfAborted();
        } catch (error) {
            if (this.isAbortError(error)) {
                throw error;
            }
            // Warmup is purely an optimization; never surface its failures.
        } finally {
            await this.disposeTensorTree(outputs);
            await this.disposeTensorTree(inputs);
        }
    }

    getDtypeCandidates(config, wantsMultimodal) {
        if (config.provider === 'Gemma') {
            return [
                {
                    label: 'q4f16',
                    dtype: GEMMA_DTYPE_Q4F16
                }
            ];
        }

        return [
            {
                label: this.formatDtypeLabel(config.dtype),
                dtype: config.dtype
            }
        ];
    }

    shouldTryDtypeFallback(error) {
        const message = error?.message || String(error || '');
        return /q4f16|Offline model file not found|not found|404/i.test(message);
    }

    formatDtypeLabel(dtype) {
        if (typeof dtype === 'string') {
            return dtype;
        }

        const values = Object.values(dtype || {}).filter(Boolean);
        return [...new Set(values)].join('/') || 'default';
    }

    async resetLoadedModel() {
        const model = this.model;
        const gmModel = this.gmModel;
        this.model = null;
        this.processor = null;
        this.gmModel = null;
        this.currentModelKey = null;
        this.activeDtypeLabel = null;

        try {
            const disposed = model?.dispose?.();
            if (disposed && typeof disposed.then === 'function') {
                await disposed;
            }
        } catch (error) {
            // Some browser runtimes do not expose explicit disposal.
        }

        try {
            await gmModel?.reset?.();
            const disposed = gmModel?.dispose?.() ?? gmModel?.destroy?.();
            if (disposed && typeof disposed.then === 'function') {
                await disposed;
            }
        } catch (error) {
            // The kernel engine may not expose explicit disposal.
        }
    }

    getTransformersSource() {
        if (isOfflineBundle() || window.location.protocol === 'file:') {
            return new URL(TRANSFORMERS_LOCAL, window.location.href).href;
        }

        return TRANSFORMERS_CDN;
    }

    async loadTransformers() {
        if (isOfflineBundle()) {
            return this.loadOfflineTransformers();
        }

        const source = this.getTransformersSource();
        const module = await import(source);

        this.configureRuntime(module, { offline: false });

        return module;
    }

    async loadOfflineTransformers() {
        if (!globalThis.Transformers) {
            await this.loadClassicScript(ORT_WEBGPU_IIFE);
            await this.loadClassicScript(TRANSFORMERS_IIFE);
        }

        if (!globalThis.Transformers) {
            throw new Error('Offline Transformers.js runtime was not loaded.');
        }

        const module = globalThis.Transformers;
        await this.configureRuntime(module, { offline: true });

        return module;
    }

    async configureRuntime(module, { offline = false } = {}) {
        if (!module?.env) {
            return;
        }

        module.env.allowLocalModels = true;
        module.env.allowRemoteModels = true;
        this.patchFetchForAbort();
        module.env.fetch = window.fetch.bind(window);

        if (offline) {
            module.env.useBrowserCache = false;
            module.env.useWasmCache = false;
            module.env.useCustomCache = false;
            module.env.customCache = null;
            module.env.experimental_useCrossOriginStorage = false;
            await this.clearTransformersBrowserCache(module);
        }

        const onnx = module.env.backends?.onnx || globalThis.ORT_WEBGPU?.env;
        if (onnx?.wasm) {
            if (offline) {
                onnx.wasm.wasmPaths = this.getOfflineWasmPaths();
            }
            onnx.wasm.proxy = false;
            onnx.wasm.numThreads = 1;
        }
        if (onnx?.webgpu) {
            onnx.webgpu.powerPreference = 'high-performance';
        }
    }

    getOfflineWasmPaths() {
        const embedded = window.asd123OrtWasmPaths;
        if (embedded?.wasm) {
            const paths = { wasm: embedded.wasm };
            if (embedded.mjs) {
                paths.mjs = new URL(embedded.mjs, window.location.href).href;
            }
            return paths;
        }

        const vendorBase = new URL('vendor/', window.location.href);
        return {
            wasm: new URL('ort-wasm-simd-threaded.asyncify.wasm', vendorBase).href,
            mjs: new URL('ort-wasm-simd-threaded.asyncify.mjs', vendorBase).href
        };
    }

    patchFetchForAbort() {
        if (this.fetchAbortPatched || typeof window.fetch !== 'function') {
            return;
        }

        const runner = this;
        const baseFetch = window.fetch.bind(window);
        this.abortableFetch = baseFetch;

        window.fetch = function fetchWithChatAbort(input, init = undefined) {
            const signal = runner.abortController?.signal;
            if (!signal || signal.aborted || init?.signal) {
                return baseFetch(input, init);
            }

            return baseFetch(input, {
                ...(init || {}),
                signal
            });
        };

        this.fetchAbortPatched = true;
    }

    async clearTransformersBrowserCache(module) {
        if (!('caches' in window) || !module?.env?.cacheKey) {
            return;
        }

        try {
            await window.caches.delete(module.env.cacheKey);
        } catch (error) {
            // Cache access can be unavailable for file:// launches.
        }
    }

    loadClassicScript(path) {
        const source = new URL(path, window.location.href).href;
        const existing = [...document.scripts].find(script => script.src === source);
        if (existing?.dataset.loaded === 'true') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = existing || document.createElement('script');
            script.src = source;
            script.async = false;
            script.onload = () => {
                script.dataset.loaded = 'true';
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load local script: ${path}`));

            if (!existing) {
                document.head.appendChild(script);
            }
        });
    }

    handleProgress(info, label) {
        if (!info) {
            return;
        }

        if (info.status === 'progress_total' && Number.isFinite(info.progress)) {
            const progress = Math.round(info.progress);
            this.updateStatus(progress >= 100 ? `Preparing ${label} WebGPU session from local files...` : `${label} ${progress}%`);
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

    getClassName(config, wantsMultimodal) {
        return wantsMultimodal ? config.multimodalClassName || config.className : config.className;
    }

    resolveModelClass(config, wantsMultimodal) {
        const className = this.getClassName(config, wantsMultimodal);
        const preferred = this.hf[className];
        if (preferred) {
            return preferred;
        }

        if (wantsMultimodal && config.multimodal && this.hf.AutoModelForImageTextToText) {
            return this.hf.AutoModelForImageTextToText;
        }

        return this.hf.AutoModelForCausalLM || null;
    }

    describeLoadError(error) {
        const message = error?.message || String(error || 'Unknown model load error');

        if (message.includes('embed_tokens_q4f16.onnx_data')) {
            return 'The browser could not create the Gemma q4f16 WebGPU session. Close other heavy tabs, reload the page, and load the model again.';
        }

        if (message.includes('Unknown error occurred in memory copy') || message.includes("Can't create a session")) {
            return 'The browser could not create the WebGPU session for this model. Try Qwen3.5 0.8B first, close other heavy tabs, or reduce cached model data and reload.';
        }

        return message;
    }

    async generate({ modelId, messages, contextWindow, temperature, onToken }) {
        this.throwIfAborted();
        const runConfig = getModelConfig(modelId);
        if (runConfig.engine === 'gemma4mobile') {
            return this.generateGemma4Mobile({ modelId, config: runConfig, messages, contextWindow, onToken });
        }

        const context = this.measureContext(messages, contextWindow, modelId);
        if (context.blocked) {
            throw new Error(this.formatContextError(context));
        }

        const modelMessages = this.buildModelMessages(messages, context);
        const imageAttachments = this.lastImageAttachments || [];
        await this.ensure(modelId, imageAttachments.length > 0);

        let inputs = null;
        let generationInputs = null;
        let outputs = null;

        try {
            const images = await this.loadImages(imageAttachments);
            this.throwIfAborted();
            const config = getModelConfig(modelId);
            const prompt = this.formatPrompt(modelMessages, config);
            inputs = await this.prepareInputs(prompt, images, config);
            this.throwIfAborted();
            const exactInputTokens = this.getInputTokenCount(inputs);
            const maxNewTokens = this.getMaxNewTokens(modelId, exactInputTokens);
            const exactContext = this.measureExactContext(exactInputTokens, contextWindow, modelId, maxNewTokens);
            if (exactContext.blocked) {
                throw new Error(this.formatContextError(exactContext));
            }

            generationInputs = await this.prepareGenerationInputs(inputs, config, exactInputTokens, images);
            const generationInputTokens = this.getInputTokenCount(generationInputs);
            const result = await this.generateWithRetry({
                inputs: generationInputs,
                inputTokenCount: generationInputTokens,
                maxNewTokens,
                modelId,
                temperature,
                onToken
            });
            outputs = result.outputs;
            const decoded = this.decodeOutputs(outputs, generationInputs);
            return this.cleanAssistantText(decoded || result.streamed);
        } finally {
            await this.disposeTensorTree(outputs);
            if (generationInputs && generationInputs !== inputs) {
                await this.disposeTensorTree(generationInputs);
            }
            await this.disposeTensorTree(inputs);
        }
    }

    // Generation path for the custom WebGPU-kernel engine. It exposes a
    // streaming async iterable instead of Transformers.js's generate()+streamer,
    // so there is no ONNX tensor lifecycle, chunked prefill, or image handling.
    async generateGemma4Mobile({ modelId, config, messages, contextWindow, onToken }) {
        this.throwIfAborted();
        const context = this.measureContext(messages, contextWindow, modelId);
        if (context.blocked) {
            throw new Error(this.formatContextError(context));
        }

        const modelMessages = this.buildModelMessages(messages, context);
        await this.ensure(modelId, false);
        this.throwIfAborted();

        const turns = this.toGemma4MobileTurns(modelMessages);
        const maxNewTokens = this.getMaxNewTokens(modelId, context.used);

        await this.gmModel.reset?.();
        this.throwIfAborted();

        let reply = '';
        const stream = this.gmModel.generate(turns, {
            maxNewTokens,
            signal: this.abortController?.signal
        });

        for await (const chunk of stream) {
            this.throwIfAborted();
            reply = typeof chunk === 'string' ? chunk : (chunk?.text ?? reply);
            onToken?.(this.cleanAssistantText(reply), '');
        }

        this.throwIfAborted();
        return this.cleanAssistantText(reply);
    }

    // Map our message list to the engine's [{role:'user'|'assistant', content}]
    // format. Gemma has no system role, so the system prompt is folded into the
    // first user turn; image parts are dropped (this engine is text-only).
    toGemma4MobileTurns(modelMessages) {
        const turns = [];
        let systemText = '';

        for (const message of modelMessages) {
            const text = this.extractTextContent(message.content);
            if (message.role === 'system') {
                systemText += (systemText ? '\n' : '') + text;
                continue;
            }
            turns.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: text });
        }

        if (systemText) {
            const firstUser = turns.find(turn => turn.role === 'user');
            if (firstUser) {
                firstUser.content = `${systemText}\n\n${firstUser.content}`.trim();
            } else {
                turns.unshift({ role: 'user', content: systemText });
            }
        }

        return turns.length ? turns : [{ role: 'user', content: '' }];
    }

    extractTextContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .map(part => (typeof part === 'string' ? part : (part?.text || '')))
                .join(' ')
                .trim();
        }
        return content?.text || '';
    }

    async generateWithRetry({ inputs, inputTokenCount, maxNewTokens, modelId, temperature, onToken }) {
        this.throwIfAborted();
        let allowSampling = this.shouldSample(modelId, temperature, inputTokenCount);
        const config = getModelConfig(modelId);

        if (!allowSampling && config.provider === 'Gemma') {
            this.updateStatus('Using stable Gemma decoding for the browser runtime');
        }

        try {
            return await this.runGeneration({
                inputs,
                inputTokenCount,
                maxNewTokens,
                temperature,
                doSample: allowSampling,
                onToken
            });
        } catch (error) {
            if (!allowSampling || !this.isUnalignedAccessError(error)) {
                throw error;
            }

            this.updateStatus('Sampling hit a browser alignment limit; retrying stable decoding...');
            onToken?.('', '');

            return this.runGeneration({
                inputs,
                inputTokenCount,
                maxNewTokens,
                temperature,
                doSample: false,
                onToken
            });
        }
    }

    async runGeneration({ inputs, inputTokenCount, maxNewTokens, temperature, doSample, onToken }) {
        this.throwIfAborted();
        let streamed = '';

        const streamer = new this.hf.TextStreamer(this.processor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: text => {
                this.throwIfAborted();
                streamed += text;
                onToken?.(this.cleanAssistantText(streamed), text);
            }
        });

        const generationOptions = {
            ...inputs,
            max_new_tokens: maxNewTokens,
            max_length: inputTokenCount + maxNewTokens,
            do_sample: doSample,
            streamer
        };

        if (doSample) {
            generationOptions.temperature = Number(temperature) || DEFAULT_TEMPERATURE;
        }

        const outputs = await this.model.generate(generationOptions);
        this.throwIfAborted();
        return { outputs, streamed };
    }

    shouldSample(modelId, temperature, inputTokenCount) {
        const config = getModelConfig(modelId);
        if (config.provider === 'Gemma') {
            return false;
        }

        return Number(temperature) > 0;
    }

    isUnalignedAccessError(error) {
        return /unaligned accesses/i.test(error?.message || String(error || ''));
    }

    formatPrompt(modelMessages, config) {
        try {
            return this.processor.apply_chat_template(modelMessages, {
                enable_thinking: false,
                add_generation_prompt: true
            });
        } catch (error) {
            if (config.provider === 'Gemma' && /trim|chat template|apply_chat_template/i.test(error?.message || '')) {
                this.updateStatus(`${config.label} using compatible chat template`);
                return this.formatGemmaPrompt(modelMessages);
            }
            throw error;
        }
    }

    buildModelMessages(messages, measuredContext) {
        const selected = measuredContext?.selected || this.measureContext(messages).selected;

        this.lastImageAttachments = selected
            .flatMap(message => Array.isArray(message.attachments) ? message.attachments : [])
            .filter(attachment => attachment.kind === 'image');

        return [
            {
                role: 'system',
                content: SYSTEM_PROMPT
            },
            ...selected.map(message => this.toModelMessage(message))
        ];
    }

    measureContext(messages, contextWindow = 4096, modelId = DEFAULT_MODEL_ID) {
        const limit = this.getInputTokenLimit(contextWindow, modelId);
        const selected = [];
        let used = this.estimateTokens(SYSTEM_PROMPT) + MESSAGE_OVERHEAD_TOKENS;

        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const estimate = this.estimateMessageTokens(message);

            if (selected.length && used + estimate > limit) {
                break;
            }

            selected.unshift(message);
            used += estimate;
        }

        const over = Math.max(0, used - limit);
        const effectiveContextWindow = this.getEffectiveContextWindow(contextWindow, modelId);
        return {
            used,
            limit,
            over,
            selected,
            modelId,
            requestedContextWindow: Number(contextWindow) || effectiveContextWindow,
            effectiveContextWindow,
            blocked: over > 0,
            warning: over === 0 && used / limit >= CONTEXT_WARNING_RATIO,
            truncated: selected.length < messages.length,
            percent: limit ? Math.round((used / limit) * 100) : 100
        };
    }

    measureExactContext(inputTokens, contextWindow = 4096, modelId = DEFAULT_MODEL_ID, maxNewTokens = null) {
        const used = Math.max(0, Number(inputTokens) || 0);
        const limit = this.getInputTokenLimit(contextWindow, modelId, maxNewTokens);
        const over = Math.max(0, used - limit);
        const effectiveContextWindow = this.getEffectiveContextWindow(contextWindow, modelId);

        return {
            used,
            limit,
            over,
            selected: [],
            modelId,
            requestedContextWindow: Number(contextWindow) || effectiveContextWindow,
            effectiveContextWindow,
            blocked: over > 0,
            warning: over === 0 && used / limit >= CONTEXT_WARNING_RATIO,
            truncated: false,
            exact: true,
            percent: limit ? Math.round((used / limit) * 100) : 100
        };
    }

    getEffectiveContextWindow(contextWindow = 4096, modelId = DEFAULT_MODEL_ID) {
        const requested = Number(contextWindow) || 4096;
        const model = getModelConfig(modelId);
        return Math.min(requested, model.contextWindow || requested);
    }

    getInputTokenLimit(contextWindow = 4096, modelId = DEFAULT_MODEL_ID, maxNewTokens = null) {
        const reservedOutputTokens = maxNewTokens ?? this.getMaxNewTokens(modelId);
        return Math.max(512, this.getEffectiveContextWindow(contextWindow, modelId) - reservedOutputTokens - this.getContextSafetyTokens(modelId));
    }

    getMaxNewTokens(modelId = DEFAULT_MODEL_ID, inputTokenCount = null) {
        const config = getModelConfig(modelId);
        const base = config.maxNewTokens || DEFAULT_MAX_NEW_TOKENS;
        const tokens = Number(inputTokenCount) || 0;

        if (config.provider === 'Gemma' && tokens >= GEMMA_LONG_CONTEXT_TOKENS) {
            return Math.min(base, config.longContextMaxNewTokens || 256);
        }
        if (config.provider === 'Gemma' && tokens >= GEMMA_MID_CONTEXT_TOKENS) {
            return Math.min(base, config.midContextMaxNewTokens || 384);
        }

        return base;
    }

    getContextSafetyTokens(modelId = DEFAULT_MODEL_ID) {
        return getModelConfig(modelId).contextSafetyTokens || CONTEXT_SAFETY_TOKENS;
    }

    estimateMessageTokens(message) {
        return MESSAGE_OVERHEAD_TOKENS +
            this.estimateTokens(message?.content || '') +
            this.estimateAttachmentTokens(message?.attachments || []);
    }

    formatContextError(context) {
        const overPercent = context.limit ? Math.ceil((context.over / context.limit) * 100) : 0;
        const safeWindow = getContextLabel(context.effectiveContextWindow || context.requestedContextWindow || 4096);
        return `Context limit exceeded before generation: ${this.formatTokens(context.over)} over the WebGPU-safe ${safeWindow} input budget (${overPercent}% too much). Select a smaller prompt/attachment set or a lighter model.`;
    }

    formatTokens(value) {
        return `${this.formatTokenNumber(value)} tokens`;
    }

    formatTokenNumber(value) {
        const tokens = Math.max(0, Math.round(Number(value) || 0));
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}K`;
        }
        return String(tokens);
    }

    toModelMessage(message) {
        if (this.isCompactMessage(message)) {
            return {
                role: 'user',
                content: `[Local compact summary of earlier conversation]\n${message.content || ''}`
            };
        }

        if (message.role === 'assistant') {
            return {
                role: 'assistant',
                content: message.content || ''
            };
        }

        const attachments = Array.isArray(message.attachments) ? message.attachments : [];
        const hasImages = attachments.some(attachment => attachment.kind === 'image');

        const textAttachments = attachments
            .filter(attachment => attachment.kind === 'text' && attachment.text)
            .map(attachment => {
                const trimmed = attachment.text.length > ATTACHMENT_TEXT_CHAR_LIMIT
                    ? `${attachment.text.slice(0, ATTACHMENT_TEXT_CHAR_LIMIT)}\n\n[Attachment truncated locally]`
                    : attachment.text;
                return `\n\n[Attached file: ${attachment.name}]\n${trimmed}`;
            })
            .join('');
        const text = `${message.content || ''}${textAttachments}`.trim();

        if (!hasImages) {
            return {
                role: 'user',
                content: text
            };
        }

        const content = [];
        attachments.filter(attachment => attachment.kind === 'image').forEach(() => {
            content.push({ type: 'image' });
        });
        content.push({ type: 'text', text });

        return {
            role: 'user',
            content
        };
    }

    isCompactMessage(message) {
        return message?.role === 'compact' || message?.compact === true;
    }

    formatGemmaPrompt(messages) {
        const bos = this.processor?.tokenizer?.bos_token || '';
        const turns = [bos];

        messages.forEach(message => {
            const role = message.role === 'assistant' ? 'model' : message.role;
            turns.push(`<|turn>${role}\n`);
            turns.push(this.flattenGemmaContent(message.content, role === 'model'));
            turns.push('<turn|>\n');
        });

        turns.push('<|turn>model\n');
        return turns.join('');
    }

    flattenGemmaContent(content, stripThinking = false) {
        if (Array.isArray(content)) {
            return content.map(item => {
                if (item?.type === 'image') {
                    return '\n\n<|image|>\n\n';
                }
                if (item?.type === 'audio') {
                    return '<|audio|>';
                }
                if (item?.type === 'video') {
                    return '\n\n<|video|>\n\n';
                }
                const text = item?.text || '';
                return stripThinking ? this.cleanAssistantText(text) : String(text).trim();
            }).join('');
        }

        const text = String(content || '');
        return stripThinking ? this.cleanAssistantText(text) : text.trim();
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
            this.throwIfAborted();
            images.push(await RawImage.read(attachment.dataUrl));
        }
        return images;
    }

    async prepareInputs(prompt, images, config) {
        const options = { add_special_tokens: false };

        if (config.provider === 'Gemma') {
            const imageInput = images.length === 1 ? images[0] : images.length ? images : null;
            return this.processor(prompt, imageInput, null, options);
        }

        if (!images.length) {
            return this.processor(prompt, undefined, options);
        }

        if (images.length === 1) {
            return this.processor(prompt, images[0], options);
        }

        return this.processor(prompt, images, options);
    }

    async prepareGenerationInputs(inputs, config, inputTokenCount, images) {
        if (!this.shouldUseChunkedPrefill(inputs, config, inputTokenCount, images)) {
            return inputs;
        }

        const chunkSize = config.prefillChunkTokens || 1024;
        const prefillEnd = inputTokenCount - 1;
        let cache = null;

        this.updateStatus(`Prefilling ${config.label} context in ${this.formatTokenNumber(chunkSize)}-token chunks`);

        try {
            for (let start = 0; start < prefillEnd; start += chunkSize) {
                this.throwIfAborted();
                const end = Math.min(prefillEnd, start + chunkSize);
                const feeds = this.createPrefillFeeds(inputs, start, end, cache);
                let outputs = null;

                try {
                    outputs = await this.model.forward(feeds);
                    this.throwIfAborted();
                    cache = this.extractPastKeyValues(outputs, cache);
                    await this.disposeForwardOutputs(outputs, cache);
                } finally {
                    await this.disposePrefillFeeds(feeds);
                }

                if (prefillEnd > chunkSize) {
                    const progress = Math.min(99, Math.round((end / prefillEnd) * 100));
                    this.updateStatus(`Prefilling ${config.label} context ${progress}%`);
                }
            }
            this.throwIfAborted();
        } catch (error) {
            await cache?.dispose?.();
            throw error;
        }

        return {
            input_ids: inputs.input_ids.slice(null, [prefillEnd, inputTokenCount]),
            attention_mask: inputs.attention_mask.slice(null, [0, inputTokenCount]),
            past_key_values: cache
        };
    }

    shouldUseChunkedPrefill(inputs, config, inputTokenCount, images) {
        if (config.provider !== 'Gemma' || images.length > 0 || !this.activeDtypeLabel?.includes('q4f16')) {
            return false;
        }
        if (!inputs?.input_ids || !inputs?.attention_mask || typeof this.model?.forward !== 'function') {
            return false;
        }

        const chunkSize = config.prefillChunkTokens || 1024;
        return Number(inputTokenCount) > chunkSize + 1;
    }

    createPrefillFeeds(inputs, start, end, cache) {
        const feeds = {
            input_ids: inputs.input_ids.slice(null, [start, end]),
            attention_mask: inputs.attention_mask.slice(null, [0, end])
        };

        if (cache) {
            feeds.past_key_values = cache;
        }

        return feeds;
    }

    async disposePrefillFeeds(feeds) {
        await this.disposeTensorTree(feeds?.input_ids);
        await this.disposeTensorTree(feeds?.attention_mask);
    }

    extractPastKeyValues(outputs, cache = null) {
        const entries = Object.create(null);

        for (const [name, value] of Object.entries(outputs || {})) {
            if (!name.startsWith('present')) {
                continue;
            }

            const key = name
                .replace('present_ssm', 'past_ssm')
                .replace('present_conv', 'past_conv')
                .replace('present_recurrent', 'past_recurrent')
                .replace('present', 'past_key_values');
            entries[key] = value;
        }

        if (!Object.keys(entries).length) {
            throw new Error('Gemma prefill did not return a key/value cache.');
        }

        if (cache) {
            cache.update(entries);
            return cache;
        }

        return new LocalDynamicCache(entries);
    }

    async disposeForwardOutputs(outputs, cache) {
        const cacheTensors = new Set(Object.values(cache || {}));

        for (const value of Object.values(outputs || {})) {
            if (cacheTensors.has(value)) {
                continue;
            }
            await this.disposeTensorTree(value);
        }
    }

    disposeTensor(tensor) {
        try {
            tensor?.dispose?.();
        } catch (error) {
            // Disposal support varies between Tensor implementations.
        }
    }

    decodeOutputs(outputs, inputs) {
        let generated = null;
        try {
            const promptLength = inputs?.input_ids?.dims?.at(-1) || 0;
            generated = typeof outputs?.slice === 'function'
                ? outputs.slice(null, [promptLength, null])
                : outputs;
            const decoded = this.processor.batch_decode(generated, {
                skip_special_tokens: true
            });
            return Array.isArray(decoded) ? decoded[0] : String(decoded || '');
        } catch (error) {
            return '';
        } finally {
            if (generated && generated !== outputs) {
                this.disposeTensorTree(generated);
            }
        }
    }

    async disposeTensorTree(value, seen = new Set()) {
        if (!value || typeof value !== 'object' || seen.has(value) || ArrayBuffer.isView(value)) {
            return;
        }

        seen.add(value);

        if (typeof value.dispose === 'function') {
            try {
                const disposed = value.dispose();
                if (disposed && typeof disposed.then === 'function') {
                    await disposed;
                }
            } catch (error) {
                // Tensor disposal is best-effort across browser runtimes.
            }
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                await this.disposeTensorTree(item, seen);
            }
            return;
        }

        for (const item of Object.values(value)) {
            await this.disposeTensorTree(item, seen);
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
        const value = String(text || '');
        const cjk = (value.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
        const nonCjk = Math.max(0, value.length - cjk);
        return Math.ceil(nonCjk / 3 + cjk * 1.5);
    }

    estimateAttachmentTokens(attachments) {
        return (attachments || []).reduce((total, attachment) => {
            if (attachment.kind === 'image') {
                return total + 512;
            }
            return total + this.estimateTokens(String(attachment.text || '').slice(0, ATTACHMENT_TEXT_CHAR_LIMIT));
        }, 0);
    }

    getInputTokenCount(inputs) {
        const inputIds = inputs?.input_ids;
        if (!inputIds) {
            return 0;
        }

        const dims = Array.isArray(inputIds.dims) ? inputIds.dims : [];
        const lastDim = Number(dims.at(-1));
        if (Number.isFinite(lastDim) && lastDim > 0) {
            return lastDim;
        }

        return Number(inputIds.data?.length) || 0;
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
        this.operationActive = false;
        this.operationController = null;
        this.operationType = '';
        this.contextBlocked = false;
        this.offlineBundle = isOfflineBundle();
        this.offlineControlsAvailable = false;
        this.elements = {};
    }

    async init() {
        this.cacheElements();
        this.offlineControlsAvailable = Boolean(
            (this.elements.offlineFolderBtn || this.offlineBundle) &&
            this.elements.folderInput
        );
        this.bindEvents();
        this.populateModels();
        this.populateContextWindows();

        if (this.offlineBundle) {
            this.offlineResolver.enableBundledModels();
            try {
                const restored = await this.offlineResolver.restore();
                this.setOfflineStatus(restored ? 'Offline model folder connected' : 'Bundled model files enabled');
            } catch (error) {
                this.setOfflineStatus('Bundled model files enabled');
            }
        }

        if (this.offlineControlsAvailable && !this.offlineBundle) {
            try {
                const restored = await this.offlineResolver.restore();
                this.setOfflineStatus(restored ? 'Offline model folder connected' : 'Select the included models folder');
            } catch (error) {
                this.setOfflineStatus('Select the included models folder');
            }
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
            'modelStatus',
            'offlineStatus',
            'loadModelBtn',
            'stopBtn',
            'offlineFolderBtn',
            'folderInput',
            'attachBtn',
            'fileInput',
            'attachmentList',
            'currentChatTitle',
            'contextBudget',
            'contextBudgetFill',
            'contextBudgetText'
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
        this.elements.stopBtn?.addEventListener('click', () => this.stopCurrentOperation());
        if (this.elements.offlineFolderBtn) {
            this.elements.offlineFolderBtn.addEventListener('click', () => this.chooseOfflineFolder());
        }
        if (this.elements.folderInput) {
            this.elements.folderInput.addEventListener('change', event => this.chooseOfflineFileList(event.target.files));
        }
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', event => this.handleFiles(event.target.files));
        this.elements.modelSelect.addEventListener('change', () => this.handleModelChange());
        this.elements.contextSelect.addEventListener('change', () => this.handleContextChange());
        this.elements.messageInput.addEventListener('keydown', event => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.messageInput.addEventListener('input', () => {
            this.resizeComposer();
            this.updateContextBudget();
        });
    }

    populateModels() {
        this.elements.modelSelect.textContent = '';

        Object.values(MODEL_REGISTRY).forEach(config => {
            if (config.status === 'unavailable') {
                return;
            }

            const option = document.createElement('option');
            option.value = config.id;
            option.textContent = getModelOptionLabel(config.id);
            option.title = `Estimated browser memory at 4K context: ${option.textContent}. Actual usage depends on browser, GPU, and loaded context.`;
            this.elements.modelSelect.appendChild(option);
        });
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
        this.updateContextBudget();
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
        this.updateContextBudget();
    }

    applyChatSettings() {
        if (!this.currentChat) {
            return;
        }

        this.elements.modelSelect.value = this.currentChat.modelId || DEFAULT_MODEL_ID;
        this.updateContextOptions();
        const clampedContextWindow = clampContextWindow(
            this.elements.modelSelect.value,
            this.currentChat.contextWindow
        );
        this.currentChat.contextWindow = clampedContextWindow;
        this.elements.contextSelect.value = String(clampedContextWindow);
        this.elements.currentChatTitle.textContent = this.getDisplayTitle(this.currentChat);
        this.updateContextBudget();
    }

    async saveCurrentSettings() {
        if (!this.currentChat) {
            return;
        }

        this.currentChat.modelId = this.elements.modelSelect.value;
        this.currentChat.contextWindow = clampContextWindow(
            this.currentChat.modelId,
            this.elements.contextSelect.value
        );
        this.elements.contextSelect.value = String(this.currentChat.contextWindow);
        this.currentChat.temperature = this.currentChat.temperature ?? DEFAULT_TEMPERATURE;

        if (this.currentChat.isDraft) {
            return;
        }

        this.currentChat = await this.storage.saveChat(this.currentChat);
        this.chats = await this.storage.listChats();
        this.renderHistory();
        this.updateContextBudget();
    }

    async handleModelChange() {
        const modelId = this.elements.modelSelect.value;
        const model = getModelConfig(modelId);
        this.updateContextOptions();
        this.elements.contextSelect.value = String(model.defaultContextWindow);
        await this.saveCurrentSettings();
        this.setModelStatus(`${model.label} selected`);
        this.updateContextBudget();
    }

    async handleContextChange() {
        await this.saveCurrentSettings();
        const label = getContextLabel(Number(this.elements.contextSelect.value));
        this.setModelStatus(`Context ${label} selected`);
        this.updateContextBudget();
    }

    updateContextOptions() {
        const model = getModelConfig(this.elements.modelSelect.value || DEFAULT_MODEL_ID);

        [...this.elements.contextSelect.options].forEach(option => {
            const value = Number(option.value);
            option.textContent = getContextOptionLabel(value, model.id);
            option.disabled = value > model.contextWindow;
            option.title = option.disabled
                ? `${model.label} is capped at ${getContextLabel(model.contextWindow)} in this browser/WebGPU build.`
                : value > 4096
                    ? `Estimated extra browser memory compared with 4K context for ${model.label}.`
                    : '';
        });
    }

    getProspectiveMessages() {
        const messages = [...(this.currentChat?.messages || [])];
        const text = this.elements.messageInput?.value?.trim() || '';

        if (text || this.pendingAttachments.length) {
            messages.push(this.createDraftUserMessage(text));
        }

        return messages;
    }

    createDraftUserMessage(text = this.elements.messageInput.value.trim()) {
        return {
            id: createId('draft'),
            role: 'user',
            content: text || 'Please analyze the attached file.',
            attachments: this.pendingAttachments,
            createdAt: new Date().toISOString()
        };
    }

    getCurrentContextMeasure(messages = this.getProspectiveMessages()) {
        const modelId = this.elements.modelSelect.value || this.currentChat?.modelId || DEFAULT_MODEL_ID;
        return this.runner.measureContext(
            messages,
            Number(this.elements.contextSelect.value || getModelConfig(modelId).defaultContextWindow),
            modelId
        );
    }

    compactMessagesForContext(messages, { force = false } = {}) {
        const measure = this.getCurrentContextMeasure(messages);
        const shouldCompact = force ||
            measure.blocked ||
            measure.truncated ||
            (measure.limit > 0 && measure.used / measure.limit >= AUTO_COMPACT_RATIO);

        if (!shouldCompact || messages.length <= AUTO_COMPACT_RECENT_MESSAGES + AUTO_COMPACT_MIN_OLD_MESSAGES) {
            return { messages, measure, changed: false, compactedCount: 0 };
        }

        const splitIndex = Math.max(AUTO_COMPACT_MIN_OLD_MESSAGES, messages.length - AUTO_COMPACT_RECENT_MESSAGES);
        const olderMessages = messages.slice(0, splitIndex);
        const recentMessages = messages.slice(splitIndex);
        const compactedCount = olderMessages.reduce((total, message) => {
            if (this.runner.isCompactMessage(message)) {
                return total + (message.sourceMessageCount || 1);
            }
            return total + 1;
        }, 0);

        if (compactedCount < AUTO_COMPACT_MIN_OLD_MESSAGES) {
            return { messages, measure, changed: false, compactedCount: 0 };
        }

        const summaryTarget = this.getCompactSummaryTarget(measure);
        const compactMessage = this.createCompactMessage(olderMessages, summaryTarget, compactedCount);
        let nextMessages = [compactMessage, ...recentMessages];
        let nextMeasure = this.getCurrentContextMeasure(nextMessages);

        if (nextMeasure.blocked) {
            const smallerSummary = this.createCompactMessage(olderMessages, Math.max(280, Math.floor(summaryTarget / 2)), compactedCount);
            nextMessages = [smallerSummary, ...recentMessages];
            nextMeasure = this.getCurrentContextMeasure(nextMessages);
        }

        return {
            messages: nextMessages,
            measure: nextMeasure,
            changed: true,
            compactedCount
        };
    }

    getCompactSummaryTarget(measure) {
        return Math.max(280, Math.min(
            AUTO_COMPACT_MAX_SUMMARY_TOKENS,
            Math.floor((measure?.limit || 4096) * 0.22)
        ));
    }

    createCompactMessage(messages, targetTokens, sourceMessageCount) {
        return {
            id: createId('compact'),
            role: 'compact',
            compact: true,
            sourceMessageCount,
            createdAt: new Date().toISOString(),
            content: this.createCompactSummary(messages, targetTokens)
        };
    }

    createCompactSummary(messages, targetTokens) {
        const perMessageSizes = [700, 420, 240, 140];
        const header = [
            'Earlier conversation compacted locally to fit the context window.',
            'Use this as background. The most recent messages remain verbatim below.'
        ];

        for (const maxChars of perMessageSizes) {
            const lines = [...header, ''];
            messages.forEach(message => {
                if (this.runner.isCompactMessage(message)) {
                    lines.push(this.compactExistingSummary(message.content, maxChars * 2));
                    lines.push('');
                    return;
                }

                const role = this.getMessageRoleLabel(message);
                const content = this.compactTextForSummary(message.content || '', maxChars);
                const attachments = this.compactAttachmentsForSummary(message.attachments || [], Math.floor(maxChars / 2));
                lines.push(`${role}: ${content || '[empty]'}`);
                if (attachments) {
                    lines.push(attachments);
                }
                lines.push('');
            });

            const summary = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            if (this.runner.estimateTokens(summary) <= targetTokens) {
                return summary;
            }
        }

        const fallback = [
            ...header,
            '',
            this.compactTextForSummary(
                messages.map(message => `${this.getMessageRoleLabel(message)}: ${message.content || ''}`).join('\n'),
                Math.max(900, targetTokens * 3)
            )
        ].join('\n');

        return this.truncateToEstimatedTokens(fallback, targetTokens);
    }

    compactExistingSummary(content, maxChars) {
        return this.compactTextForSummary(String(content || '').replace(/^Earlier conversation compacted locally[^\n]*\n?/i, ''), maxChars);
    }

    compactTextForSummary(text, maxChars) {
        const compacted = String(text || '')
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (compacted.length <= maxChars) {
            return compacted;
        }

        return `${compacted.slice(0, Math.max(0, maxChars - 24)).trim()} ... [truncated]`;
    }

    compactAttachmentsForSummary(attachments, maxChars) {
        const lines = (attachments || []).map(attachment => {
            if (attachment.kind === 'image') {
                return `[Image attachment: ${attachment.name}]`;
            }

            const excerpt = attachment.text
                ? ` excerpt: ${this.compactTextForSummary(attachment.text, maxChars)}`
                : '';
            return `[File attachment: ${attachment.name}${excerpt}]`;
        });

        return lines.join('\n');
    }

    truncateToEstimatedTokens(text, targetTokens) {
        let value = String(text || '');
        while (this.runner.estimateTokens(value) > targetTokens && value.length > 200) {
            value = `${value.slice(0, Math.floor(value.length * 0.72)).trim()} ... [truncated]`;
        }
        return value;
    }

    updateContextBudget() {
        if (!this.elements.contextBudget || !this.currentChat) {
            return null;
        }

        const measure = this.getCurrentContextMeasure();
        const percent = Math.max(0, Math.min(measure.percent, 140));
        const fill = this.elements.contextBudgetFill;
        const text = this.elements.contextBudgetText;
        const contextLabel = getContextLabel(Number(this.elements.contextSelect.value));
        const safeContextLabel = getContextLabel(measure.effectiveContextWindow);
        const used = this.runner.formatTokenNumber(measure.used);
        const limit = this.runner.formatTokenNumber(measure.limit);

        fill.style.width = `${Math.min(percent, 100)}%`;
        this.elements.contextBudget.classList.toggle('chat-context-budget--warning', measure.warning);
        this.elements.contextBudget.classList.toggle('chat-context-budget--blocked', measure.blocked);

        if (measure.blocked) {
            text.textContent = `Context ${measure.percent}% used · ${this.runner.formatTokens(measure.over)} over the ${safeContextLabel} WebGPU budget`;
        } else if (measure.warning) {
            text.textContent = `Context ${measure.percent}% used · ${used} / ${limit} input tokens`;
        } else {
            text.textContent = `Context ${measure.percent}% used · ${used} / ${limit} input tokens`;
        }

        if (!measure.blocked && safeContextLabel !== contextLabel) {
            text.textContent += ` · capped to ${safeContextLabel} for WebGPU`;
        }

        if (measure.truncated && !measure.blocked) {
            text.textContent += ' · older messages may be trimmed';
        }

        this.contextBlocked = measure.blocked;
        this.elements.sendBtn.disabled = this.generating || this.operationActive || this.contextBlocked;
        return measure;
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
            title.textContent = this.getDisplayTitle(chat);

            const meta = document.createElement('span');
            meta.className = 'chat-history-meta';
            meta.textContent = this.formatDate(chat.updatedAt);

            button.append(title, meta);
            this.elements.chatHistory.appendChild(button);
        });
    }

    renderMessages() {
        this.elements.messageList.textContent = '';
        this.elements.currentChatTitle.textContent = this.getDisplayTitle(this.currentChat);

        if (!this.currentChat?.messages?.length) {
            const empty = document.createElement('div');
            empty.className = 'chat-empty-state';
            const emptyTitle = document.createElement('strong');
            emptyTitle.textContent = 'Start a local chat';
            const emptyText = document.createElement('span');
            emptyText.textContent = 'Choose a model, attach files if needed, and send a message.';
            empty.append(emptyTitle, emptyText);
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
        article.className = `chat-message chat-message--${this.getMessageClassRole(message)}`;
        article.dataset.messageId = message.id;

        const avatar = document.createElement('div');
        avatar.className = 'chat-message-avatar';
        avatar.textContent = this.getMessageAvatar(message);

        const content = document.createElement('div');
        content.className = 'chat-message-content';

        const header = document.createElement('div');
        header.className = 'chat-message-header';

        const role = document.createElement('span');
        role.className = 'chat-message-role';
        role.textContent = this.getMessageRoleLabel(message);
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

        const body = this.renderMessageBody(message.content || '');
        const attachments = this.renderMessageAttachments(message.attachments || []);
        content.append(header, body);

        if (attachments) {
            content.appendChild(attachments);
        }

        article.append(avatar, content);
        return article;
    }

    getMessageClassRole(message) {
        return this.runner.isCompactMessage(message) ? 'compact' : message.role;
    }

    getMessageRoleLabel(message) {
        if (this.runner.isCompactMessage(message)) {
            return 'Context summary';
        }
        return message.role === 'user' ? 'You' : 'Assistant';
    }

    getMessageAvatar(message) {
        if (this.runner.isCompactMessage(message)) {
            return 'C';
        }
        return message.role === 'user' ? 'Y' : 'A';
    }

    renderMessageBody(text) {
        const body = document.createElement('div');
        body.className = 'chat-message-body';
        const parts = String(text || '').replace(/\r\n?/g, '\n').split(/```([\w-]*)\n?([\s\S]*?)```/g);

        for (let i = 0; i < parts.length; i += 3) {
            this.appendMarkdownBlocks(body, parts[i]);

            if (i + 2 < parts.length) {
                const language = parts[i + 1];
                const code = parts[i + 2];
                const pre = document.createElement('pre');
                const codeElement = document.createElement('code');
                if (language) {
                    codeElement.dataset.language = language;
                }
                codeElement.textContent = code.trim();
                pre.appendChild(codeElement);
                body.appendChild(pre);
            }
        }

        if (!body.childNodes.length) {
            const paragraph = document.createElement('p');
            paragraph.textContent = '';
            body.appendChild(paragraph);
        }

        return body;
    }

    appendMarkdownBlocks(container, text) {
        const lines = String(text || '').split('\n');
        let paragraph = [];
        let list = null;

        const flushParagraph = () => {
            if (!paragraph.length) {
                return;
            }

            const element = document.createElement('p');
            this.appendInlineMarkdown(element, paragraph.join('\n'));
            container.appendChild(element);
            paragraph = [];
        };

        const closeList = () => {
            list = null;
        };

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmed = line.trim();

            if (!trimmed) {
                flushParagraph();
                closeList();
                continue;
            }

            if (this.isMarkdownTable(lines, index)) {
                flushParagraph();
                closeList();
                const result = this.createMarkdownTable(lines, index);
                container.appendChild(result.table);
                index = result.nextIndex - 1;
                continue;
            }

            const horizontalRule = trimmed.match(/^([-*_])(?:\s*\1){2,}$/);
            if (horizontalRule) {
                flushParagraph();
                closeList();
                container.appendChild(document.createElement('hr'));
                continue;
            }

            const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                flushParagraph();
                closeList();
                const level = Math.min(heading[1].length + 1, 5);
                const element = document.createElement(`h${level}`);
                this.appendInlineMarkdown(element, heading[2].replace(/\s+#+$/, '').trim());
                container.appendChild(element);
                continue;
            }

            const quote = trimmed.match(/^>\s?(.*)$/);
            if (quote) {
                flushParagraph();
                closeList();
                const blockquote = document.createElement('blockquote');
                this.appendInlineMarkdown(blockquote, quote[1]);
                container.appendChild(blockquote);
                continue;
            }

            const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
            const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
            if (unordered || ordered) {
                flushParagraph();
                const type = unordered ? 'ul' : 'ol';
                if (!list || list.tagName.toLowerCase() !== type) {
                    list = document.createElement(type);
                    container.appendChild(list);
                }

                const item = document.createElement('li');
                this.appendInlineMarkdown(item, (unordered || ordered)[1]);
                list.appendChild(item);
                continue;
            }

            closeList();
            paragraph.push(trimmed);
        }

        flushParagraph();
    }

    appendInlineMarkdown(container, text) {
        const source = String(text || '');
        const patterns = [
            {
                type: 'code',
                regex: /`([^`\n]+)`/
            },
            {
                type: 'link',
                regex: /\[([^\]\n]+)\]\(([^)\s]+)\)/
            },
            {
                type: 'strong',
                regex: /\*\*([^*]+)\*\*|__([^_]+)__/
            },
            {
                type: 'em',
                regex: /(^|[\s([{])\*([^*\n]+)\*|(^|[\s([{])_([^_\n]+)_/
            }
        ];

        let remaining = source;
        while (remaining) {
            const next = this.findNextInlineMatch(remaining, patterns);
            if (!next) {
                container.appendChild(document.createTextNode(remaining));
                break;
            }

            if (next.match.index > 0) {
                container.appendChild(document.createTextNode(remaining.slice(0, next.match.index)));
            }

            const element = this.createInlineElement(next);
            if (element) {
                container.appendChild(element);
            } else {
                container.appendChild(document.createTextNode(next.match[0]));
            }

            remaining = remaining.slice(next.match.index + next.match[0].length);
        }
    }

    findNextInlineMatch(text, patterns) {
        return patterns.reduce((best, pattern) => {
            const match = pattern.regex.exec(text);
            if (!match) {
                return best;
            }

            if (!best || match.index < best.match.index) {
                return { ...pattern, match };
            }

            return best;
        }, null);
    }

    createInlineElement(matchInfo) {
        const { type, match } = matchInfo;

        if (type === 'code') {
            const code = document.createElement('code');
            code.textContent = match[1];
            return code;
        }

        if (type === 'link') {
            const href = this.getSafeLink(match[2]);
            if (!href) {
                return null;
            }

            const link = document.createElement('a');
            link.href = href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = match[1];
            return link;
        }

        if (type === 'strong') {
            const strong = document.createElement('strong');
            this.appendInlineMarkdown(strong, match[1] || match[2] || '');
            return strong;
        }

        if (type === 'em') {
            const prefix = match[1] || match[3] || '';
            const emphasis = document.createElement('em');
            this.appendInlineMarkdown(emphasis, match[2] || match[4] || '');

            if (!prefix) {
                return emphasis;
            }

            const fragment = document.createDocumentFragment();
            fragment.appendChild(document.createTextNode(prefix));
            fragment.appendChild(emphasis);
            return fragment;
        }

        return null;
    }

    getSafeLink(value) {
        try {
            const url = new URL(value, window.location.origin);
            if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
                return null;
            }
            return url.href;
        } catch (error) {
            return null;
        }
    }

    isMarkdownTable(lines, index) {
        if (index + 1 >= lines.length) {
            return false;
        }

        const header = lines[index].trim();
        const divider = lines[index + 1].trim();
        return header.includes('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(divider);
    }

    createMarkdownTable(lines, startIndex) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headerCells = this.parseTableRow(lines[startIndex]);
        const headerRow = document.createElement('tr');

        headerCells.forEach(cell => {
            const th = document.createElement('th');
            this.appendInlineMarkdown(th, cell);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        let index = startIndex + 2;
        while (index < lines.length && lines[index].trim().includes('|')) {
            const row = document.createElement('tr');
            this.parseTableRow(lines[index]).forEach(cell => {
                const td = document.createElement('td');
                this.appendInlineMarkdown(td, cell);
                row.appendChild(td);
            });
            tbody.appendChild(row);
            index++;
        }

        if (tbody.childNodes.length) {
            table.appendChild(tbody);
        }

        return { table, nextIndex: index };
    }

    parseTableRow(line) {
        return line.trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map(cell => cell.trim());
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
        article.className = 'chat-message chat-message--editing';

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

        const panel = document.createElement('div');
        panel.className = 'chat-edit-panel';

        actions.append(save, cancel);
        panel.append(editor, actions);
        article.appendChild(panel);
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

        const proposedMessages = this.currentChat.messages.slice(0, index + 1).map(item => {
            if (item.id !== messageId) {
                return item;
            }
            return { ...item, content: text };
        });
        const compacted = this.compactMessagesForContext(proposedMessages);
        const measure = compacted.measure;
        if (measure.blocked) {
            this.setModelStatus(this.runner.formatContextError(measure));
            this.updateContextBudget();
            return;
        }

        this.currentChat.messages = compacted.messages;
        if (compacted.changed) {
            this.setModelStatus(`Compacted ${compacted.compactedCount} older messages locally.`);
        }
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
            ...this.createDraftUserMessage(text),
            id: createId('msg')
        };
        const compacted = this.compactMessagesForContext([...(this.currentChat.messages || []), userMessage]);
        const measure = compacted.measure;
        if (measure.blocked) {
            this.setModelStatus(this.runner.formatContextError(measure));
            this.updateContextBudget();
            this.elements.messageInput.focus();
            return;
        }

        this.currentChat.messages = compacted.messages;
        this.elements.messageInput.value = '';
        this.pendingAttachments = [];
        this.renderPendingAttachments();
        this.resizeComposer();
        this.updateContextBudget();

        if (compacted.changed) {
            this.setModelStatus(`Compacted ${compacted.compactedCount} older messages locally.`);
        }

        if (this.currentChat.title === 'New Chat') {
            this.currentChat.title = this.generateTitle(userMessage.content);
        }

        await this.persistCurrentChat();
        this.renderMessages();
        await this.generateAssistantReply();
    }

    async generateAssistantReply() {
        const compacted = this.compactMessagesForContext(this.currentChat.messages);
        if (compacted.changed && !compacted.measure.blocked) {
            this.currentChat.messages = compacted.messages;
            this.setModelStatus(`Compacted ${compacted.compactedCount} older messages locally.`);
            await this.persistCurrentChat();
        }

        const assistantMessage = {
            id: createId('msg'),
            role: 'assistant',
            content: '',
            attachments: [],
            createdAt: new Date().toISOString()
        };

        this.currentChat.messages.push(assistantMessage);
        this.generating = true;
        const operation = this.beginOperation('generation');
        this.setControlsDisabled(true);
        this.renderMessages();

        try {
            await this.prepareOfflineModelAccess(this.currentChat.modelId);
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
            if (this.runner.isAbortError(error)) {
                assistantMessage.content = assistantMessage.content || 'Generation stopped.';
                this.updateAssistantMessage(assistantMessage.id, assistantMessage.content);
                await this.persistCurrentChat();
                await this.runner.resetLoadedModel();
                this.setModelStatus('Generation stopped. Reload the model to continue.');
                return;
            }

            const message = this.describeGenerationFailure(error);
            assistantMessage.content = `Local generation failed: ${message}`;
            this.updateAssistantMessage(assistantMessage.id, assistantMessage.content);
            await this.persistCurrentChat();
            await this.runner.resetLoadedModel();
            this.setModelStatus('Generation failed. Reload the model to continue.');
        } finally {
            this.generating = false;
            this.endOperation(operation);
            this.setControlsDisabled(false);
            this.chats = await this.storage.listChats();
            this.renderHistory();
            this.updateContextBudget();
        }
    }

    beginOperation(type) {
        const controller = this.runner.beginAbortableOperation(type);
        this.operationActive = true;
        this.operationController = controller;
        this.operationType = type;
        this.updateStopButton();
        return controller;
    }

    endOperation(controller) {
        if (controller && this.operationController !== controller) {
            return;
        }

        this.runner.finishAbortableOperation(controller);
        this.operationActive = false;
        this.operationController = null;
        this.operationType = '';
        this.updateStopButton();
    }

    stopCurrentOperation() {
        if (!this.operationActive) {
            return;
        }

        const label = this.operationType === 'loading' ? 'model loading' : 'generation';
        const stopped = this.runner.cancelCurrentOperation();
        if (stopped) {
            this.setModelStatus(`Stopping ${label}...`);
        }
        this.updateStopButton({ stopping: true });
    }

    describeGenerationFailure(error) {
        const message = error?.message || String(error || 'Unknown generation error');

        if (/unaligned accesses/i.test(message)) {
            return 'The browser WebAssembly runtime hit an alignment trap inside the local Gemma q4f16 WebGPU session. Reload the model once; if it repeats, use 8K/16K with a shorter latest message until the browser runtime catches up with native runners.';
        }

        if (/Integer overflow|OrtRun/i.test(message)) {
            const measure = this.getCurrentContextMeasure(this.currentChat?.messages || []);
            if (measure.blocked) {
                return this.runner.formatContextError(measure);
            }

            const model = getModelConfig(this.currentChat?.modelId || DEFAULT_MODEL_ID);
            return `${model.label} overflowed the WebGPU session even though the UI budget allowed the prompt. Reload the model and check that it becomes ready with q4f16; make sure the offline bundle includes the q4f16 model files before using larger context windows.`;
        }

        return message;
    }

    async prepareOfflineModelAccess(modelId) {
        if (!this.offlineBundle) {
            return;
        }

        this.offlineResolver.enableBundledModels();

        const model = getModelConfig(modelId);
        const modelFilesAvailable = await this.offlineResolver.canReadModel(model.repo);
        if (modelFilesAvailable) {
            this.setOfflineStatus('Using bundled model files');
            return;
        }

        if (this.offlineResolver.supportsDirectoryPicker()) {
            this.setModelStatus('Select the offline-chat folder once so the browser may read local model files.');
            const folderName = await this.offlineResolver.chooseFolder();
            this.setOfflineStatus(`Offline folder: ${folderName}`);
            return;
        }

        if (this.elements.folderInput) {
            this.elements.folderInput.click();
            throw new Error('Select the offline-chat folder in the file picker, then click Load Model again.');
        }

        throw new Error('Browser blocked direct access to local model files. Use Chrome or Edge and allow folder access when prompted.');
    }

    updateAssistantMessage(messageId, text) {
        const article = this.elements.messageList.querySelector(`[data-message-id="${messageId}"]`);
        if (!article) {
            return;
        }

        const shouldAutoScroll = this.isMessageListNearBottom();
        const body = article.querySelector('.chat-message-body');
        if (body) {
            body.replaceWith(this.renderMessageBody(text));
        }

        if (shouldAutoScroll) {
            this.scrollMessagesToEnd();
        }
    }

    async persistCurrentChat() {
        this.currentChat.modelId = this.elements.modelSelect.value;
        this.currentChat.contextWindow = Number(this.elements.contextSelect.value);
        this.currentChat.temperature = this.currentChat.temperature ?? DEFAULT_TEMPERATURE;
        delete this.currentChat.isDraft;
        this.currentChat = await this.storage.saveChat(this.currentChat);
        this.chats = await this.storage.listChats();
    }

    async loadSelectedModel() {
        const operation = this.beginOperation('loading');
        this.setControlsDisabled(true);

        try {
            const modelId = this.elements.modelSelect.value;
            const label = getContextLabel(Number(this.elements.contextSelect.value));
            this.setModelStatus(`Reloading model for ${label} context...`);
            await this.prepareOfflineModelAccess(modelId);
            await this.runner.ensure(modelId, false, { force: true });
            this.updateContextBudget();
        } catch (error) {
            if (this.runner.isAbortError(error)) {
                await this.runner.resetLoadedModel();
                this.setModelStatus('Model loading stopped.');
            } else {
                this.setModelStatus(error.message);
            }
        } finally {
            this.endOperation(operation);
            this.setControlsDisabled(false);
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
        if (this.elements.folderInput) {
            this.elements.folderInput.value = '';
        }

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
                this.setModelStatus(`Processing ${file.name} locally...`);
                await this.yieldToBrowser();
                const attachment = await this.fileProcessor.process(file);
                this.pendingAttachments.push(attachment);
                this.renderPendingAttachments();
                this.updateContextBudget();
            } catch (error) {
                this.setModelStatus(error.message);
            }
        }

        this.renderPendingAttachments();
        const measure = this.updateContextBudget();
        if (measure?.blocked) {
            this.setModelStatus(this.runner.formatContextError(measure));
        } else if (files.length) {
            this.setModelStatus('Attachment ready');
        }
    }

    yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
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
                this.updateContextBudget();
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
        anchor.download = `${this.slugify(this.getDisplayTitle(this.currentChat) || 'chat')}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    toMarkdown(chat) {
        const model = getModelConfig(chat.modelId);
        const lines = [
            `# ${this.getDisplayTitle(chat) || 'Chat Export'}`,
            '',
            `- Exported: ${new Date().toISOString()}`,
            `- Model: ${model.label}`,
            `- Context: ${getContextLabel(chat.contextWindow)}`,
            ''
        ];

        chat.messages.forEach(message => {
            lines.push(`## ${this.getMessageRoleLabel(message)}`, '');

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
            .normalize('NFC')
            .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7);

        if (!words.length) {
            return 'New Chat';
        }

        return words.join(' ');
    }

    getDisplayTitle(chat) {
        if (!chat) {
            return 'New Chat';
        }

        const title = chat.title || 'New Chat';
        const firstUserMessage = (chat.messages || []).find(message => message.role === 'user' && message.content);
        if (!firstUserMessage) {
            return title;
        }

        const fixedTitle = this.generateTitle(firstUserMessage.content);
        if (title === 'New Chat' || title === this.generateLegacyTitle(firstUserMessage.content)) {
            return fixedTitle;
        }

        return title;
    }

    generateLegacyTitle(text) {
        const words = String(text || '')
            .replace(/[^\w\s-]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 7);

        return words.length ? words.join(' ') : 'New Chat';
    }

    resizeComposer() {
        const input = this.elements.messageInput;
        const maxHeight = 180;
        input.style.height = 'auto';
        const nextHeight = Math.min(input.scrollHeight, maxHeight);
        input.style.height = `${nextHeight}px`;
        input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    setControlsDisabled(disabled) {
        const blocked = disabled || this.operationActive;
        this.elements.sendBtn.disabled = blocked || this.contextBlocked;
        this.elements.loadModelBtn.disabled = blocked;
        this.elements.modelSelect.disabled = blocked;
        this.elements.contextSelect.disabled = blocked;
        this.updateStopButton();

        if (!blocked) {
            this.updateContextBudget();
        }
    }

    updateStopButton({ stopping = false } = {}) {
        const button = this.elements.stopBtn;
        if (!button) {
            return;
        }

        button.hidden = !this.operationActive;
        button.disabled = !this.operationActive || stopping;
        button.setAttribute('aria-busy', stopping ? 'true' : 'false');
        button.title = this.operationType === 'loading'
            ? 'Stop model loading'
            : 'Stop generation';
    }

    setModelStatus(message) {
        this.elements.modelStatus.textContent = message || 'Ready';
    }

    setOfflineStatus(message) {
        if (this.elements.offlineStatus) {
            this.elements.offlineStatus.textContent = message;
        }
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

    isMessageListNearBottom(threshold = 96) {
        const list = this.elements.messageList;
        if (!list) {
            return true;
        }

        return list.scrollHeight - list.scrollTop - list.clientHeight <= threshold;
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
