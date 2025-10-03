// Anonymizer Core - Main application logic
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection

import { EntityManager } from './entity-manager.js';
import { AIModelProcessor } from './model-loader.js';
import { FileProcessor } from './file-processor.js';
import { UIController } from './ui-controller.js';

// Entity patterns for regex-based detection
const entityPatterns = {
    PERSON_NAME: {
        pattern: /\b([A-Z][a-z]+ ){1,3}[A-Z][a-z]+\b/g,
        priority: 1
    },
    EMAIL: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        priority: 2
    },
    PHONE: {
        pattern: /(\+?1?\s*[-.]?\s*)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g,
        priority: 3
    },
    SSN: {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        priority: 4
    },
    CREDIT_CARD: {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        priority: 5
    },
    ADDRESS: {
        pattern: /\d{1,5}\s+[\w\s]{1,50}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl)\b/gi,
        priority: 6
    },
    DATE: {
        pattern: /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
        priority: 7
    },
    URL: {
        pattern: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
        priority: 8
    },
    IP_ADDRESS: {
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        priority: 9
    }
};

class AnonymizerApp {
    constructor() {
        this.entityManager = new EntityManager();
        this.aiProcessor = new AIModelProcessor();
        this.fileProcessor = new FileProcessor();
        this.uiController = new UIController();
        
        this.currentMode = 'regex';
        this.isProcessing = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.uiController.initialize();
        
        // Set up drag and drop
        this.setupDragAndDrop();
        
        console.log('Anonymizer initialized successfully');
    }

    setupEventListeners() {
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', async (e) => {
            await this.switchModel(e.target.value);
        });

        // Anonymize button
        document.getElementById('anonymizeBtn').addEventListener('click', async () => {
            await this.anonymizeText();
        });

        // Deanonymize button
        document.getElementById('deanonymizeBtn').addEventListener('click', () => {
            this.deanonymizeText();
        });

        // File load
        document.getElementById('loadFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.loadFile(e.target.files[0]);
            }
        });

        // Highlight anonymization
        document.getElementById('anonymizeHighlightBtn').addEventListener('click', () => {
            this.anonymizeHighlighted();
        });

        // Entity export/import
        document.getElementById('exportEntitiesBtn').addEventListener('click', () => {
            this.exportEntities();
        });

        document.getElementById('importEntitiesBtn').addEventListener('click', () => {
            document.getElementById('entitiesFileInput').click();
        });

        document.getElementById('entitiesFileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.importEntities(e.target.files[0]);
            }
        });

        // LLM processing
        document.getElementById('processLlmBtn').addEventListener('click', () => {
            this.processLlmOutput();
        });

        // Clear input
        document.getElementById('clearInputBtn').addEventListener('click', () => {
            this.clearInput();
        });

        // Copy output
        document.getElementById('copyOutputBtn').addEventListener('click', () => {
            this.copyOutput();
        });

        // Entity removal event
        document.addEventListener('entityRemove', (e) => {
            this.removeEntity(e.detail.placeholder);
        });
    }

    setupDragAndDrop() {
        const inputArea = document.getElementById('inputText');
        
        inputArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            inputArea.classList.add('drag-over');
        });

        inputArea.addEventListener('dragleave', () => {
            inputArea.classList.remove('drag-over');
        });

        inputArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            inputArea.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                await this.loadFile(file);
            }
        });
    }

    async switchModel(modelType) {
        this.currentMode = modelType;
        
        if (modelType !== 'regex') {
            try {
                this.uiController.showLoading(true, `Loading ${modelType} model...`);
                await this.aiProcessor.loadModel(modelType);
                this.uiController.showLoading(false);
                this.uiController.showSuccess('AI model loaded successfully');
            } catch (error) {
                this.uiController.showError('Failed to load AI model - using pattern matching');
                this.currentMode = 'regex';
                document.getElementById('modelSelect').value = 'regex';
                this.uiController.showLoading(false);
            }
        }
    }

    async anonymizeText() {
        if (this.isProcessing) return;
        
        const inputText = document.getElementById('inputText').value;
        if (!inputText.trim()) {
            this.uiController.showError('Please enter text to anonymize');
            return;
        }

        this.isProcessing = true;
        this.uiController.showProcessing(true);
        this.entityManager.clear();

        try {
            let anonymizedText = inputText;
            let detectedEntities = [];

            if (this.currentMode === 'regex') {
                // Regex-based processing
                detectedEntities = this.processWithRegex(inputText);
            } else {
                // AI-based processing
                try {
                    detectedEntities = await this.aiProcessor.processText(inputText);
                    // If AI returns no results, fall back to regex
                    if (detectedEntities.length === 0) {
                        this.uiController.showInfo('AI model returned no results - using pattern matching');
                        detectedEntities = this.processWithRegex(inputText);
                    }
                } catch (error) {
                    this.uiController.showError('AI processing failed - using pattern matching');
                    detectedEntities = this.processWithRegex(inputText);
                }
            }

            // Apply anonymization
            anonymizedText = this.applyAnonymization(inputText, detectedEntities);
            
            // Update UI
            document.getElementById('outputText').value = anonymizedText;
            this.uiController.updateEntityList(this.entityManager.exportEntities());
            
            const entityCount = this.entityManager.exportEntities().length;
            this.uiController.showSuccess(`Anonymization complete! Detected ${entityCount} entities`);
            
        } catch (error) {
            console.error('Anonymization error:', error);
            this.uiController.showError('Anonymization failed: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.uiController.showProcessing(false);
        }
    }

    processWithRegex(text) {
        const entities = [];
        
        // Sort patterns by priority
        const sortedPatterns = Object.entries(entityPatterns)
            .sort((a, b) => a[1].priority - b[1].priority);
        
        for (const [type, config] of sortedPatterns) {
            const matches = [...text.matchAll(config.pattern)];
            
            for (const match of matches) {
                // Check if this text is already detected
                if (!this.entityManager.reverseLookup.has(match[0])) {
                    entities.push({
                        text: match[0],
                        type: type,
                        startPos: match.index,
                        endPos: match.index + match[0].length
                    });
                }
            }
        }
        
        return entities;
    }

    applyAnonymization(text, entities) {
        // Sort entities by position (reverse order for replacement)
        entities.sort((a, b) => b.startPos - a.startPos);
        
        let result = text;
        for (const entity of entities) {
            const placeholder = this.entityManager.generatePlaceholder(entity.type, entity.text);
            result = result.substring(0, entity.startPos) + 
                     placeholder + 
                     result.substring(entity.endPos);
        }
        
        return result;
    }

    removeEntity(placeholder) {
        const entity = this.entityManager.getEntity(placeholder);
        if (!entity) return;

        // Restore the entity in the output text
        const outputTextArea = document.getElementById('outputText');
        if (outputTextArea.value) {
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            outputTextArea.value = outputTextArea.value.replace(regex, entity.original);
        }

        // Remove from entity manager
        this.entityManager.entityMap.delete(placeholder);
        this.entityManager.reverseLookup.delete(entity.original);

        // Update UI
        this.uiController.updateEntityList(this.entityManager.exportEntities());
        this.uiController.showSuccess('Entity removed and restored in output');
    }

    deanonymizeText() {
        const outputText = document.getElementById('outputText').value;
        if (!outputText) {
            this.uiController.showError('No text to deanonymize');
            return;
        }

        let deanonymizedText = outputText;
        
        this.entityManager.entityMap.forEach((entity, placeholder) => {
            if (entity.isActive) {
                const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                deanonymizedText = deanonymizedText.replace(regex, entity.original);
            }
        });
        
        document.getElementById('outputText').value = deanonymizedText;
        this.uiController.showSuccess('Text deanonymized successfully');
    }

    anonymizeHighlighted() {
        const outputTextArea = document.getElementById('outputText');
        const selectedText = outputTextArea.value.substring(
            outputTextArea.selectionStart,
            outputTextArea.selectionEnd
        );
        
        if (!selectedText) {
            this.uiController.showError('Please select text to anonymize');
            return;
        }

        // Generate placeholder for selected text
        const placeholder = this.entityManager.generatePlaceholder('CUSTOM', selectedText);
        
        // Replace in output
        const newText = outputTextArea.value.substring(0, outputTextArea.selectionStart) +
                       placeholder +
                       outputTextArea.value.substring(outputTextArea.selectionEnd);
        
        outputTextArea.value = newText;
        this.uiController.updateEntityList(this.entityManager.exportEntities());
        this.uiController.showSuccess('Selected text anonymized');
    }

    async loadFile(file) {
        // Validate file
        const validation = this.fileProcessor.validateFile(file);
        if (!validation.isValid) {
            this.uiController.showError(validation.error);
            return;
        }

        try {
            this.uiController.showLoading(true, 'Loading file...');
            const text = await this.fileProcessor.processFile(file);
            document.getElementById('inputText').value = text;
            this.uiController.showLoading(false);
            this.uiController.showSuccess(`File loaded successfully: ${file.name}`);
        } catch (error) {
            this.uiController.showLoading(false);
            this.uiController.showError(`Failed to load file: ${error.message}`);
        }
    }

    exportEntities() {
        const entities = this.entityManager.exportEntities();
        
        if (entities.length === 0) {
            this.uiController.showError('No entities to export');
            return;
        }

        const csv = this.convertToCSV(entities);
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anonymizer_entities_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiController.showSuccess('Entities exported successfully');
    }

    convertToCSV(entities) {
        const headers = ['Placeholder', 'Original', 'Type', 'Active'];
        const rows = entities.map(e => [
            e.placeholder,
            e.original,
            e.type,
            e.active
        ]);
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    async importEntities(file) {
        try {
            this.uiController.showLoading(true, 'Importing entities...');
            const text = await file.text();
            const entities = this.parseCSV(text);
            this.entityManager.importEntities(entities);
            this.uiController.updateEntityList(entities);
            this.uiController.showLoading(false);
            this.uiController.showSuccess(`Imported ${entities.length} entities`);
        } catch (error) {
            this.uiController.showLoading(false);
            this.uiController.showError('Failed to import entities: ' + error.message);
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        return lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = line.match(/(".*?"|[^,]+)/g)
                    .map(v => v.replace(/"/g, '').trim());
                
                return {
                    placeholder: values[0],
                    original: values[1],
                    type: values[2],
                    active: values[3] === 'true'
                };
            });
    }

    processLlmOutput() {
        const llmInput = document.getElementById('llmInput').value;
        if (!llmInput) {
            this.uiController.showError('Please enter LLM output to process');
            return;
        }

        let processedText = llmInput;
        let replacementCount = 0;
        
        this.entityManager.entityMap.forEach((entity, placeholder) => {
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const matches = processedText.match(regex);
            if (matches) {
                replacementCount += matches.length;
                processedText = processedText.replace(regex, entity.original);
            }
        });
        
        document.getElementById('llmOutput').value = processedText;
        this.uiController.showSuccess(`Restored ${replacementCount} placeholders to original values`);
    }

    clearInput() {
        document.getElementById('inputText').value = '';
        document.getElementById('outputText').value = '';
        document.getElementById('llmInput').value = '';
        document.getElementById('llmOutput').value = '';
        this.entityManager.clear();
        this.uiController.updateEntityList([]);
        this.uiController.showInfo('All fields cleared');
    }

    copyOutput() {
        const outputText = document.getElementById('outputText');
        if (!outputText.value) {
            this.uiController.showError('No text to copy');
            return;
        }
        
        outputText.select();
        document.execCommand('copy');
        this.uiController.showSuccess('Copied to clipboard');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AnonymizerApp();
});