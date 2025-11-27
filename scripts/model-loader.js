// AIModelProcessor - Handles AI model loading and processing
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection
// Uses Hugging Face Transformers.js for local AI processing
//
// IMPORTANT: This implementation uses token classification with BIO tagging
// (B-PRIVATE, I-PRIVATE, O) - NOT regex pattern matching.

// Import transformers.js from CDN for browser compatibility
import { AutoModel, AutoTokenizer } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0';

/**
 * Model configuration map - defines all available AI models
 * Each model has specific settings for loading and processing
 */
const MODEL_CONFIG = {
    // AI4Privacy Models (Token Classification)
    'ai-english': {
        path: 'ai4privacy/llama-ai4privacy-english-anonymiser-openpii',
        type: 'token-classification',
        numClasses: 3,
        description: 'AI4Privacy - English'
    },
    'ai-multilingual': {
        path: 'ai4privacy/llama-ai4privacy-multilingual-anonymiser-openpii',
        type: 'token-classification',
        numClasses: 3,
        description: 'AI4Privacy - Multilingual'
    }
};

class AIModelProcessor {
    constructor() {
        this.tokenizer = null;
        this.model = null;
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

        const modelPath = config.path;
        
        try {
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
        this.modelLoaded = false;
        this.currentModel = null;
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