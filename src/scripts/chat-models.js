const CONTEXT_WINDOWS = [
    1024,
    2048,
    4096,
    8192,
    16384,
    32768
];

const DEFAULT_CONTEXT_MEMORY_DELTA_GB = {
    8192: 1,
    16384: 2,
    32768: 4
};

const MODEL_REGISTRY = {
    'gemma-4-e2b': {
        id: 'gemma-4-e2b',
        label: 'Gemma 4 E2B',
        provider: 'Gemma',
        repo: 'onnx-community/gemma-4-E2B-it-ONNX',
        className: 'Gemma4ForConditionalGeneration',
        multimodalClassName: 'Gemma4ForConditionalGeneration',
        dtype: 'q4f16',
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        maxNewTokens: 768,
        midContextMaxNewTokens: 384,
        longContextMaxNewTokens: 256,
        prefillChunkTokens: 4096,
        contextSafetyTokens: 512,
        browserMemoryGb4k: 8,
        contextMemoryDeltaGb: {
            8192: 1,
            16384: 3,
            32768: 6
        },
        multimodal: true,
        status: 'primary'
    },
    'gemma-4-e4b': {
        id: 'gemma-4-e4b',
        label: 'Gemma 4 E4B',
        provider: 'Gemma',
        repo: 'onnx-community/gemma-4-E4B-it-ONNX',
        className: 'Gemma4ForConditionalGeneration',
        multimodalClassName: 'Gemma4ForConditionalGeneration',
        dtype: 'q4f16',
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        maxNewTokens: 512,
        midContextMaxNewTokens: 256,
        longContextMaxNewTokens: 192,
        prefillChunkTokens: 4096,
        contextSafetyTokens: 512,
        browserMemoryGb4k: 11,
        contextMemoryDeltaGb: {
            8192: 1.5,
            16384: 4,
            32768: 8
        },
        multimodal: true,
        status: 'primary'
    },
    'gemma-4-e2b-turbo': {
        id: 'gemma-4-e2b-turbo',
        label: 'Gemma 4 E2B Turbo (Apple Silicon)',
        provider: 'Gemma',
        // Runs the webml-community Gemma4Mobile engine (MIT) with hand-optimized
        // WebGPU compute shaders instead of Transformers.js/onnxruntime-web — much
        // faster on Apple Silicon GPUs. The runner branches on this flag.
        // English only, text only.
        engine: 'gemma4mobile',
        repo: 'google/gemma-4-E2B-it-qat-mobile-transformers',
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        maxNewTokens: 768,
        midContextMaxNewTokens: 384,
        longContextMaxNewTokens: 256,
        contextSafetyTokens: 512,
        browserMemoryGb4k: 4,
        contextMemoryDeltaGb: {
            8192: 1,
            16384: 3,
            32768: 6
        },
        multimodal: false,
        status: 'primary'
    },
    'qwen-3-5-0-8b': {
        id: 'qwen-3-5-0-8b',
        label: 'Qwen3.5 0.8B',
        provider: 'Qwen',
        repo: 'onnx-community/Qwen3.5-0.8B-ONNX',
        className: 'Qwen3_5ForCausalLM',
        multimodalClassName: 'Qwen3_5ForConditionalGeneration',
        dtype: {
            embed_tokens: 'q4',
            vision_encoder: 'fp16',
            decoder_model_merged: 'q4'
        },
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        browserMemoryGb4k: 3,
        contextMemoryDeltaGb: {
            8192: 0.5,
            16384: 1.5,
            32768: 3
        },
        multimodal: true,
        status: 'primary'
    },
    'qwen-3-5-2b': {
        id: 'qwen-3-5-2b',
        label: 'Qwen3.5 2B',
        provider: 'Qwen',
        repo: 'onnx-community/Qwen3.5-2B-ONNX',
        className: 'Qwen3_5ForCausalLM',
        multimodalClassName: 'Qwen3_5ForConditionalGeneration',
        dtype: {
            embed_tokens: 'q4',
            vision_encoder: 'fp16',
            decoder_model_merged: 'q4'
        },
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        browserMemoryGb4k: 5,
        contextMemoryDeltaGb: {
            8192: 1,
            16384: 2.5,
            32768: 5
        },
        multimodal: true,
        status: 'primary'
    },
    'qwen-3-5-4b': {
        id: 'qwen-3-5-4b',
        label: 'Qwen3.5 4B',
        provider: 'Qwen',
        repo: 'onnx-community/Qwen3.5-4B-ONNX',
        className: 'Qwen3_5ForCausalLM',
        multimodalClassName: 'Qwen3_5ForConditionalGeneration',
        dtype: {
            embed_tokens: 'q4',
            vision_encoder: 'fp16',
            decoder_model_merged: 'q4'
        },
        contextWindow: 32768,
        modelContextWindow: 32768,
        defaultContextWindow: 4096,
        browserMemoryGb4k: 8,
        contextMemoryDeltaGb: {
            8192: 1.5,
            16384: 4,
            32768: 8
        },
        multimodal: true,
        status: 'primary'
    }
};

function getModelConfig(modelId) {
    return MODEL_REGISTRY[modelId] || MODEL_REGISTRY['gemma-4-e2b'];
}

function getContextLabel(value) {
    return value >= 1024 ? `${value / 1024}K` : String(value);
}

function formatMemoryGb(value) {
    const rounded = Math.round(Number(value) * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} GB` : `${rounded.toFixed(1)} GB`;
}

function getModelOptionLabel(modelId) {
    const model = getModelConfig(modelId);
    const memory = model.browserMemoryGb4k
        ? `~${formatMemoryGb(model.browserMemoryGb4k)} @ 4K`
        : 'memory varies';

    return `${model.label} (${memory})`;
}

function getContextMemoryDeltaGb(modelId, value) {
    const model = getModelConfig(modelId);
    const contextValue = Number(value);

    if (contextValue <= 4096) {
        return 0;
    }

    if (model.contextMemoryDeltaGb && Object.prototype.hasOwnProperty.call(model.contextMemoryDeltaGb, contextValue)) {
        return model.contextMemoryDeltaGb[contextValue];
    }

    return DEFAULT_CONTEXT_MEMORY_DELTA_GB[contextValue] || 0;
}

function getContextOptionLabel(value, modelId) {
    const base = getContextLabel(value);
    const delta = getContextMemoryDeltaGb(modelId, value);

    if (delta > 0) {
        return `${base} (+${formatMemoryGb(delta)})`;
    }

    return base;
}

function clampContextWindow(modelId, requestedValue) {
    const model = getModelConfig(modelId);
    const requested = Number(requestedValue) || model.defaultContextWindow;
    const supported = CONTEXT_WINDOWS.filter(value => value <= model.contextWindow);
    return supported.reduce((best, value) => value <= requested ? value : best, supported[0]);
}

export {
    CONTEXT_WINDOWS,
    MODEL_REGISTRY,
    getModelConfig,
    getContextLabel,
    getModelOptionLabel,
    getContextOptionLabel,
    clampContextWindow
};
