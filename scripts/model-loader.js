// AIModelProcessor - Handles AI model loading and processing
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection
// Uses Hugging Face Transformers.js for local AI processing
//
// IMPORTANT: This implementation uses local token classification models,
// not server-side processing or regex pattern matching.

// Import transformers.js from CDN for browser compatibility
import { AutoModel, AutoTokenizer, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2';

/**
 * Model configuration map - defines all available AI models
 * Each model has specific settings for loading and processing
 */
const MODEL_CONFIG = {
    'openai-privacy-filter': {
        path: 'openai/privacy-filter',
        type: 'pipeline-token-classification',
        description: 'OpenAI Privacy Filter',
        dtype: 'q4',
        device: 'webgpu',
        largeDownload: true
    },
    // AI4Privacy Models (Token Classification)
    'ai-english': {
        path: 'ai4privacy/llama-ai4privacy-english-anonymiser-openpii',
        type: 'token-classification',
        numClasses: 3,
        description: 'AI4Privacy - English (Legacy PoC)'
    },
    'ai-multilingual': {
        path: 'ai4privacy/llama-ai4privacy-multilingual-anonymiser-openpii',
        type: 'token-classification',
        numClasses: 3,
        description: 'AI4Privacy - Multilingual (Legacy PoC)'
    }
};

const PRIVACY_FILTER_LABELS = {
    account_number: 'ACCOUNT_NUMBER',
    private_address: 'ADDRESS',
    private_email: 'EMAIL',
    private_person: 'PERSON_NAME',
    private_phone: 'PHONE',
    private_url: 'URL',
    private_date: 'DATE',
    secret: 'SECRET'
};

class AIModelProcessor {
    constructor() {
        this.tokenizer = null;
        this.model = null;
        this.classifier = null;
        this.modelLoaded = false;
        this.currentModel = null;
        this.currentConfig = null;
        this.loadingCallbacks = [];
    }

    /**
     * Get available models list
     * @returns {Object} - Model configuration map
     */
    static getAvailableModels() {
        return MODEL_CONFIG;
    }

    /**
     * Load AI model for PII detection using token classification
     * @param {string} modelName - Model identifier from dropdown
     * @returns {Promise<void>}
     */
    async loadModel(modelName) {
        const config = MODEL_CONFIG[modelName];
        
        if (!config) {
            throw new Error(`Unknown model: ${modelName}. Available models: ${Object.keys(MODEL_CONFIG).join(', ')}`);
        }

        if (this.modelLoaded && this.currentModel === modelName) {
            this.updateLoadingStatus(`${config.description} ready`);
            return;
        }

        this.unload();

        const modelPath = config.path;
        
        try {
            if (config.type === 'pipeline-token-classification') {
                await this.loadPipelineModel(modelName, config);
                return;
            }

            // Show loading indicator
            this.updateLoadingStatus(`Loading ${config.description} tokenizer...`);
            
            // Load tokenizer from HuggingFace
            this.tokenizer = await AutoTokenizer.from_pretrained(modelPath);
            
            this.updateLoadingStatus(`Loading ${config.description} model (this may take a moment)...`);
            
            // Load model with appropriate settings
            const modelOptions = { dtype: "q8" };
            
            // ONNX models may need different loading
            if (config.onnx) {
                modelOptions.device = 'wasm'; // Use WebAssembly for ONNX models
            }
            
            this.model = await AutoModel.from_pretrained(modelPath, modelOptions);
            
            this.modelLoaded = true;
            this.currentModel = modelName;
            this.currentConfig = config;
            this.updateLoadingStatus(`${config.description} ready`);
            
        } catch (error) {
            console.error('Model loading failed:', error);
            this.modelLoaded = false;
            this.currentConfig = null;
            this.updateLoadingStatus(`Failed to load ${config.description}`);
            throw error;
        }
    }

    async loadPipelineModel(modelName, config) {
        if (config.device === 'webgpu' && !navigator.gpu) {
            throw new Error(`${config.description} requires a browser with WebGPU support. Please use Chrome/Edge or the Regex mode.`);
        }

        const sizeHint = config.largeDownload ? ' The first load downloads about 950 MB and may take a while.' : '';
        this.updateLoadingStatus(`Loading ${config.description} from Hugging Face.${sizeHint}`);

        this.classifier = await pipeline(
            'token-classification',
            config.path,
            {
                device: config.device || 'wasm',
                dtype: config.dtype || 'q8'
            }
        );

        this.modelLoaded = true;
        this.currentModel = modelName;
        this.currentConfig = config;
        this.updateLoadingStatus(`${config.description} ready`);
    }

    /**
     * Process text using the AI model for PII detection
     * This is the CORE FUNCTION - uses token classification, NOT regex
     * 
     * @param {string} text - Input text to analyze
     * @param {number} threshold - Sensitivity threshold (0-1, default 0.3)
     * @returns {Promise<Object>} - { maskedText, replacements }
     */
    async processText(text, threshold = 0.3) {
        if (!this.modelLoaded) {
            throw new Error('Model not loaded');
        }

        if (this.currentConfig?.type === 'pipeline-token-classification') {
            return this.processWithPipeline(text, threshold);
        }

        // Step 1: Tokenize the input text
        const inputs = await this.tokenizer(text);
        const inputTokens = inputs.input_ids.data;
        
        // Step 2: Decode each token to its string representation
        const tokenStrings = Array.from(inputTokens).map(id => 
            this.tokenizer.decode([id], { skip_special_tokens: false })
        );

        // Step 3: Run model inference to get logits
        const { logits } = await this.model(inputs);
        const logitsData = Array.from(logits.data);
        const numTokens = tokenStrings.length;
        const numClasses = this.currentConfig?.numClasses || 3; // B-PRIVATE, I-PRIVATE, O (default 3)

        // Step 4: Reshape logits per token
        const logitsPerToken = [];
        for (let i = 0; i < numTokens; i++) {
            logitsPerToken.push(logitsData.slice(i * numClasses, (i + 1) * numClasses));
        }

        // Step 5: Apply softmax and create token predictions
        const tokenPredictions = tokenStrings.map((token, i) => {
            const probs = this.softmax(logitsPerToken[i]);
            const maxSensitive = Math.max(probs[0], probs[1]); // B-PRIVATE or I-PRIVATE
            return {
                token: token,
                start: i,
                end: i + 1,
                probabilities: {
                    "B-PRIVATE": probs[0],
                    "I-PRIVATE": probs[1],
                    "O": probs[2]
                },
                maxSensitiveScore: maxSensitive
            };
        });

        // Step 6: Aggregate consecutive privacy tokens into entities
        const aggregated = this.aggregatePrivacyTokens(tokenPredictions, threshold);
        
        // Step 7: Create masked text with placeholders
        const { maskedText, replacements } = this.maskText(tokenPredictions, aggregated);
        
        return { maskedText, replacements };
    }

    async processWithPipeline(text, threshold) {
        const predictions = await this.classifier(text, {
            aggregation_strategy: 'simple'
        });
        const spans = this.normalizePipelinePredictions(text, predictions, threshold);
        return this.maskTextBySpans(text, spans);
    }

    normalizePipelinePredictions(text, predictions, threshold) {
        const sortedPredictions = [...(Array.isArray(predictions) ? predictions : [])]
            .filter(prediction => prediction && Number(prediction.score || 0) >= threshold)
            .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        const spans = [];

        for (const prediction of sortedPredictions) {
            const label = prediction.entity_group || prediction.entity || prediction.label;
            const type = this.mapPrivacyFilterLabel(label);
            const located = this.locatePredictionSpan(text, prediction, spans);

            if (!located) {
                continue;
            }

            const { start, end } = located;
            const overlapsExisting = spans.some(span => start < span.end && end > span.start);
            if (overlapsExisting) {
                continue;
            }

            spans.push({
                start,
                end,
                type,
                score: Number(prediction.score || 0),
                original: text.slice(start, end)
            });
        }

        return spans.sort((a, b) => a.start - b.start);
    }

    mapPrivacyFilterLabel(label) {
        const normalizedLabel = String(label || 'PII')
            .replace(/^[BIES]-/, '')
            .toLowerCase();

        return PRIVACY_FILTER_LABELS[normalizedLabel] || normalizedLabel.toUpperCase();
    }

    locatePredictionSpan(text, prediction, existingSpans) {
        if (Number.isInteger(prediction.start) && Number.isInteger(prediction.end)) {
            return this.trimSpanWhitespace(text, prediction.start, prediction.end);
        }

        const word = String(prediction.word || '').replace(/▁/g, ' ');
        const candidates = [word, word.trim()].filter(Boolean);
        let bestMatch = null;

        for (const candidate of candidates) {
            let searchFrom = 0;
            while (searchFrom < text.length) {
                const matchIndex = text.indexOf(candidate, searchFrom);
                if (matchIndex === -1) {
                    break;
                }

                const span = this.trimSpanWhitespace(text, matchIndex, matchIndex + candidate.length);
                if (span && !existingSpans.some(existing => span.start < existing.end && span.end > existing.start)) {
                    bestMatch = span;
                    break;
                }

                searchFrom = matchIndex + Math.max(candidate.length, 1);
            }

            if (bestMatch) {
                break;
            }
        }

        return bestMatch;
    }

    trimSpanWhitespace(text, start, end) {
        let cleanStart = Math.max(0, start);
        let cleanEnd = Math.min(text.length, end);

        while (cleanStart < cleanEnd && /\s/.test(text[cleanStart])) {
            cleanStart++;
        }
        while (cleanEnd > cleanStart && /\s/.test(text[cleanEnd - 1])) {
            cleanEnd--;
        }

        if (cleanStart >= cleanEnd) {
            return null;
        }

        return { start: cleanStart, end: cleanEnd };
    }

    maskTextBySpans(text, spans) {
        const counters = {};
        const replacements = spans.map(span => {
            counters[span.type] = (counters[span.type] || 0) + 1;
            return {
                ...span,
                placeholder: `[${span.type}_${counters[span.type]}]`,
                activation: span.score
            };
        });

        let maskedText = text;
        for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
            maskedText = maskedText.substring(0, replacement.start) +
                replacement.placeholder +
                maskedText.substring(replacement.end);
        }

        return {
            maskedText,
            replacements: replacements.map(({ original, placeholder, activation, type }) => ({
                original,
                placeholder,
                activation,
                type
            }))
        };
    }

    /**
     * Softmax function to convert logits to probabilities
     * @param {number[]} logits - Raw model output scores
     * @returns {number[]} - Probability distribution
     */
    softmax(logits) {
        const expLogits = logits.map(Math.exp);
        const sumExp = expLogits.reduce((a, b) => a + b, 0);
        return expLogits.map(exp => exp / sumExp);
    }

    /**
     * Aggregate consecutive privacy tokens into entity groups
     * This handles the BIO tagging logic - grouping B-PRIVATE followed by I-PRIVATE tokens
     * 
     * @param {Array} tokenPredictions - Token predictions with probabilities
     * @param {number} threshold - Minimum probability to consider as sensitive
     * @returns {Array} - Grouped entity spans
     */
    aggregatePrivacyTokens(tokenPredictions, threshold) {
        const aggregated = [];
        let i = 0;
        const n = tokenPredictions.length;
        
        while (i < n) {
            const currentToken = tokenPredictions[i];
            
            // Skip special tokens
            if (['[CLS]', '[SEP]'].includes(currentToken.token)) {
                i++;
                continue;
            }
            
            // Check if token starts with space (word boundary) or is first word
            const startsWithSpace = currentToken.token.startsWith(' ');
            const isFirstWord = aggregated.length === 0 && i === 0;
            
            if (startsWithSpace || isFirstWord) {
                // Start a new potential entity group
                const group = {
                    tokens: [currentToken],
                    indices: [i],
                    scores: [currentToken.maxSensitiveScore],
                    startsWithSpace: startsWithSpace
                };
                
                i++;
                
                // Continue aggregating tokens that don't start with space (subword tokens)
                while (i < n && 
                       !tokenPredictions[i].token.startsWith(' ') && 
                       !['[CLS]', '[SEP]'].includes(tokenPredictions[i].token)) {
                    group.tokens.push(tokenPredictions[i]);
                    group.indices.push(i);
                    group.scores.push(tokenPredictions[i].maxSensitiveScore);
                    i++;
                }
                
                // Only keep groups where max score exceeds threshold
                if (Math.max(...group.scores) >= threshold) {
                    aggregated.push(group);
                }
            } else {
                i++;
            }
        }
        
        return aggregated;
    }

    /**
     * Create masked text by replacing detected entities with placeholders
     * 
     * @param {Array} tokenPredictions - All token predictions
     * @param {Array} aggregatedGroups - Grouped entity spans to mask
     * @returns {Object} - { maskedText, replacements }
     */
    maskText(tokenPredictions, aggregatedGroups) {
        const maskedTokens = [];
        const replacements = [];
        const maskedIndices = new Set();
        let piiCounter = 1;
        
        // Mark all indices that belong to privacy groups
        aggregatedGroups.forEach(group => {
            group.indices.forEach(idx => maskedIndices.add(idx));
        });

        // Build the masked output
        tokenPredictions.forEach((token, idx) => {
            // Skip special tokens
            if (['[CLS]', '[SEP]'].includes(token.token)) return;
            
            if (maskedIndices.has(idx)) {
                // Check if this is the start of a group
                const group = aggregatedGroups.find(g => g.indices[0] === idx);
                if (group) {
                    // Reconstruct original text from tokens
                    const originalTokens = group.tokens.map(t => t.token);
                    const originalText = originalTokens
                        .map((token, i) => (i === 0 && group.startsWithSpace ? token.trimStart() : token))
                        .join('');
                    
                    // Create placeholder
                    const placeholder = `[PII_${piiCounter}]`;
                    replacements.push({ 
                        original: originalText, 
                        placeholder: placeholder,
                        activation: Math.max(...group.scores)
                    });
                    piiCounter++;
                    
                    // Add masked token with proper spacing
                    const maskWithSpace = group.startsWithSpace ? ` ${placeholder}` : placeholder;
                    maskedTokens.push(maskWithSpace);
                }
            } else {
                maskedTokens.push(token.token);
            }
        });

        // Join tokens and clean up spacing
        const joinedText = maskedTokens.join('');
        // For each line, collapse only spaces and tabs
        const processedLines = joinedText.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim());
        const maskedText = processedLines.join('\n').trim();
        
        return { maskedText, replacements };
    }

    /**
     * Update loading status in UI
     * @param {string} message - Status message
     */
    updateLoadingStatus(message) {
        const statusElement = document.getElementById('modelStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.display = message ? 'inline' : 'none';
        }
        
        // Call registered callbacks
        this.loadingCallbacks.forEach(callback => {
            callback(message);
        });
    }

    /**
     * Register a callback for loading status updates
     * @param {Function} callback - Callback function
     */
    onLoadingStatusUpdate(callback) {
        this.loadingCallbacks.push(callback);
    }

    /**
     * Check if model is loaded
     * @returns {boolean}
     */
    isReady() {
        return this.modelLoaded;
    }

    /**
     * Unload model to free memory
     */
    unload() {
        this.tokenizer = null;
        this.model = null;
        this.classifier = null;
        this.modelLoaded = false;
        this.currentModel = null;
        this.currentConfig = null;
        this.updateLoadingStatus('');
    }

    /**
     * Get current model info
     * @returns {Object} - Model information
     */
    getModelInfo() {
        return {
            name: this.currentModel,
            loaded: this.modelLoaded,
            config: this.currentConfig,
            description: this.currentConfig?.description || 'Unknown'
        };
    }
}

// Export for use in other modules
export { AIModelProcessor };
