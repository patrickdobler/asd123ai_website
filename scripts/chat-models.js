const CONTEXT_WINDOWS = [
    1024,
    2048,
    4096,
    8192,
    16384,
    32768,
    65536,
    131072
];

const MODEL_REGISTRY = {
    'gemma-4-e2b': {
        id: 'gemma-4-e2b',
        label: 'Gemma 4 E2B',
        provider: 'Gemma',
        repo: 'onnx-community/gemma-4-E2B-it-ONNX',
        className: 'Gemma4ForCausalLM',
        multimodalClassName: 'Gemma4ForConditionalGeneration',
        dtype: {
            audio_encoder: 'q4',
            embed_tokens: 'q4',
            vision_encoder: 'q4',
            decoder_model_merged: 'q4'
        },
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
        status: 'primary'
    },
    'gemma-4-e4b': {
        id: 'gemma-4-e4b',
        label: 'Gemma 4 E4B',
        provider: 'Gemma',
        repo: 'onnx-community/gemma-4-E4B-it-ONNX',
        className: 'Gemma4ForCausalLM',
        multimodalClassName: 'Gemma4ForConditionalGeneration',
        dtype: {
            audio_encoder: 'q4',
            embed_tokens: 'q4',
            vision_encoder: 'q4',
            decoder_model_merged: 'q4'
        },
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
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
            vision_encoder: 'q4',
            decoder_model_merged: 'q4'
        },
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
        status: 'experimental'
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
            vision_encoder: 'q4',
            decoder_model_merged: 'q4'
        },
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
        status: 'experimental'
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
            vision_encoder: 'q4',
            decoder_model_merged: 'q4'
        },
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
        status: 'experimental'
    },
    'qwen-3-5-9b': {
        id: 'qwen-3-5-9b',
        label: 'Qwen3.5 9B',
        provider: 'Qwen',
        repo: '',
        className: '',
        dtype: 'q4',
        contextWindow: 131072,
        defaultContextWindow: 4096,
        multimodal: true,
        status: 'unavailable',
        disabledReason: 'No verified Transformers.js ONNX repository is enabled for v1.'
    }
};

function getModelConfig(modelId) {
    return MODEL_REGISTRY[modelId] || MODEL_REGISTRY['gemma-4-e2b'];
}

function getContextLabel(value) {
    return value >= 1024 ? `${value / 1024}K` : String(value);
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
    clampContextWindow
};
