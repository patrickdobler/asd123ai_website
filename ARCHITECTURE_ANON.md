# Anonymizer Feature Architecture & Implementation Guide

## Overview
Build a privacy-focused text anonymization tool that processes all data locally in the browser. The tool will detect and anonymize PII (Personally Identifiable Information) using both regex patterns and AI models, with the ability to reverse the process for deanonymization.

## Core Requirements

### 1. Privacy & Security
- **All processing must occur locally in the browser** - no data transmission to servers
- Implement secure key management for reversible anonymization
- Store anonymization mappings temporarily in browser memory (not localStorage for sensitive data)

### 2. Input Methods
- Text area for direct input
- File upload support for `.txt`, `.docx`, `.pdf` files
- Drag-and-drop functionality for files

### 3. Processing Models
- **Fast Mode** (Regex-based): "Quick Scan" - Instant pattern matching
- **AI English**: Using `ai4privacy/llama-ai4privacy-english-anonymiser-openpii`
- **AI Multilingual**: Using `ai4privacy/llama-ai4privacy-multilingual-anonymiser-openpii`

### 4. Output Features
- Anonymized text display with placeholder format: `[ENTITY_TYPE_N]`
- Entity detection panel showing all identified PII
- Reversible anonymization with entity mapping
- Highlight-to-anonymize functionality
- Copy/export detected entities as CSV
- Upload entity file for deanonymization
- LLM output processing with placeholder preservation

## Technical Architecture

### File Structure
```
/anonymizer/
├── anonymizer.html
├── js/
│   ├── anonymizer-core.js
│   ├── entity-manager.js
│   ├── model-loader.js
│   ├── file-processor.js
│   └── ui-controller.js
├── css/
│   └── anonymizer.css
└── models/
    └── (models loaded dynamically)
```

## Implementation Details

### 1. Core Processing Logic

#### Regex Pattern Engine (from CamoText approach, modified)
```javascript
// Entity patterns - unique implementation avoiding direct copy
const entityPatterns = {
  PERSON_NAME: {
    // Enhanced pattern for names
    pattern: /\b([A-Z][a-z]+ ){1,3}[A-Z][a-z]+\b/g,
    priority: 1
  },
  EMAIL: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    priority: 2
  },
  PHONE: {
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}/g,
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

// Entity detection and mapping system
class EntityManager {
  constructor() {
    this.entityMap = new Map();
    this.entityCounters = {};
    this.reverseLookup = new Map();
  }

  generatePlaceholder(type, originalText) {
    if (!this.entityCounters[type]) {
      this.entityCounters[type] = 0;
    }
    this.entityCounters[type]++;
    
    const placeholder = `[${type}_${this.entityCounters[type]}]`;
    this.entityMap.set(placeholder, {
      original: originalText,
      type: type,
      index: this.entityCounters[type],
      isActive: true
    });
    this.reverseLookup.set(originalText, placeholder);
    
    return placeholder;
  }

  toggleEntity(placeholder) {
    const entity = this.entityMap.get(placeholder);
    if (entity) {
      entity.isActive = !entity.isActive;
    }
  }

  exportEntities() {
    const entities = Array.from(this.entityMap.entries()).map(([key, value]) => ({
      placeholder: key,
      original: value.original,
      type: value.type,
      active: value.isActive
    }));
    return entities;
  }

  importEntities(entityData) {
    this.clear();
    entityData.forEach(entity => {
      this.entityMap.set(entity.placeholder, {
        original: entity.original,
        type: entity.type,
        index: parseInt(entity.placeholder.match(/_(\d+)\]/)[1]),
        isActive: entity.active
      });
      this.reverseLookup.set(entity.original, entity.placeholder);
      
      const type = entity.type;
      const index = parseInt(entity.placeholder.match(/_(\d+)\]/)[1]);
      this.entityCounters[type] = Math.max(this.entityCounters[type] || 0, index);
    });
  }

  clear() {
    this.entityMap.clear();
    this.entityCounters = {};
    this.reverseLookup.clear();
  }
}
```

#### AI Model Integration (from HuggingFace approach, enhanced)
```javascript
// Model loader with transformers.js
import { AutoModel, AutoTokenizer } from '@huggingface/transformers';

class AIModelProcessor {
  constructor() {
    this.tokenizer = null;
    this.model = null;
    this.modelLoaded = false;
    this.currentModel = null;
  }

  async loadModel(modelName) {
    const modelPath = modelName === 'ai-english' 
      ? 'ai4privacy/llama-ai4privacy-english-anonymiser-openpii'
      : 'ai4privacy/llama-ai4privacy-multilingual-anonymiser-openpii';
    
    try {
      // Show loading indicator
      this.updateLoadingStatus('Loading AI model...');
      
      this.tokenizer = await AutoTokenizer.from_pretrained(modelPath);
      this.model = await AutoModel.from_pretrained(modelPath, { 
        dtype: "q8",
        progress_callback: (progress) => {
          this.updateLoadingStatus(`Loading model: ${Math.round(progress * 100)}%`);
        }
      });
      
      this.modelLoaded = true;
      this.currentModel = modelName;
      this.updateLoadingStatus('Model ready');
      
    } catch (error) {
      console.error('Model loading failed:', error);
      this.updateLoadingStatus('Model loading failed');
      throw error;
    }
  }

  async processText(text, threshold = 0.3) {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const inputs = await this.tokenizer(text);
    const { logits } = await this.model(inputs);
    
    // Process predictions
    const predictions = this.extractEntities(logits, inputs, threshold);
    return predictions;
  }

  extractEntities(logits, inputs, threshold) {
    // Entity extraction logic
    const entities = [];
    // Process logits to identify entities
    // Return array of {text, type, startPos, endPos}
    return entities;
  }

  updateLoadingStatus(message) {
    // Update UI with loading status
    const statusElement = document.getElementById('modelStatus');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }
}
```

### 2. File Processing (Enhanced from CamoText)
```javascript
class FileProcessor {
  constructor() {
    this.supportedFormats = ['.txt', '.docx', '.pdf'];
  }

  async processFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    switch(extension) {
      case 'txt':
        return await this.readTextFile(file);
      case 'docx':
        return await this.readDocxFile(file);
      case 'pdf':
        return await this.readPdfFile(file);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  async readTextFile(file) {
    return await file.text();
  }

  async readDocxFile(file) {
    // Dynamic import for docx processing
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  async readPdfFile(file) {
    // Dynamic import for PDF processing
    const pdfjsLib = await import('pdfjs-dist');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  }
}
```

### 3. UI Implementation

#### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anonymizer - Privacy-First Text Protection</title>
    <link rel="stylesheet" href="css/anonymizer.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <header class="anonymizer-header">
            <h1>Anonymizer</h1>
            <p class="subtitle">Safeguard sensitive information locally in your browser</p>
            <div class="privacy-badge">
                <span class="badge-icon">🔒</span>
                <span>All processing happens locally - No data leaves your device</span>
            </div>
        </header>

        <!-- Model Selection -->
        <div class="model-selection">
            <label for="modelSelect">Processing Mode:</label>
            <select id="modelSelect" class="model-dropdown">
                <option value="regex">Quick Scan (Pattern Matching)</option>
                <option value="ai-english">AI English (Advanced Detection)</option>
                <option value="ai-multilingual">AI Multilingual (Multiple Languages)</option>
            </select>
            <span id="modelStatus" class="model-status"></span>
        </div>

        <!-- Main Content Area -->
        <div class="content-grid">
            <!-- Input Section -->
            <div class="input-section">
                <h2>Input Text</h2>
                <div class="input-controls">
                    <button id="loadFileBtn" class="btn btn-secondary">
                        <span class="btn-icon">📁</span> Load File
                    </button>
                    <button id="clearInputBtn" class="btn btn-secondary">
                        <span class="btn-icon">🗑️</span> Clear
                    </button>
                </div>
                <textarea id="inputText" class="text-area" 
                    placeholder="Enter or paste your text here, or drag and drop a file..."></textarea>
                <input type="file" id="fileInput" accept=".txt,.docx,.pdf" style="display: none;">
            </div>

            <!-- Output Section -->
            <div class="output-section">
                <h2>Anonymized Output</h2>
                <div class="output-controls">
                    <button id="anonymizeBtn" class="btn btn-primary">
                        <span class="btn-icon">🛡️</span> Anonymize
                    </button>
                    <button id="deanonymizeBtn" class="btn btn-secondary">
                        <span class="btn-icon">🔓</span> Deanonymize
                    </button>
                    <button id="copyOutputBtn" class="btn btn-secondary">
                        <span class="btn-icon">📋</span> Copy
                    </button>
                </div>
                <textarea id="outputText" class="text-area" readonly 
                    placeholder="Anonymized text will appear here..."></textarea>
                
                <!-- Highlight Controls -->
                <div class="highlight-controls">
                    <button id="anonymizeHighlightBtn" class="btn btn-secondary">
                        Anonymize Selected Text
                    </button>
                </div>
            </div>

            <!-- Detected Entities Panel -->
            <div class="entities-panel">
                <h2>Detected Entities</h2>
                <div class="entities-controls">
                    <button id="exportEntitiesBtn" class="btn btn-secondary">
                        <span class="btn-icon">💾</span> Export CSV
                    </button>
                    <button id="importEntitiesBtn" class="btn btn-secondary">
                        <span class="btn-icon">📥</span> Import
                    </button>
                    <input type="file" id="entitiesFileInput" accept=".csv" style="display: none;">
                </div>
                
                <div id="entitiesList" class="entities-list">
                    <!-- Dynamically populated entity list -->
                </div>
                
                <div class="entity-stats">
                    <span id="totalEntities">Total: 0</span>
                    <span id="activeEntities">Active: 0</span>
                </div>
            </div>
        </div>

        <!-- LLM Integration Section -->
        <div class="llm-section">
            <h2>LLM Output Processing</h2>
            <p class="section-description">
                Paste LLM responses containing anonymized placeholders to restore original values
            </p>
            <div class="llm-controls">
                <textarea id="llmInput" class="text-area llm-input" 
                    placeholder="Paste LLM output with [ENTITY_N] placeholders here..."></textarea>
                <button id="processLlmBtn" class="btn btn-primary">
                    <span class="btn-icon">🔄</span> Restore Original Values
                </button>
                <textarea id="llmOutput" class="text-area llm-output" readonly 
                    placeholder="Deanonymized text will appear here..."></textarea>
            </div>
        </div>
    </div>

    <script type="module" src="js/anonymizer-core.js"></script>
</body>
</html>
```

#### CSS Styling (Consistent with optimizer.html)
```css
/* Anonymizer specific styles - consistent with existing design */
.anonymizer-header {
    text-align: center;
    padding: 2rem 0;
    border-bottom: 2px solid var(--border-color);
}

.privacy-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--success-bg);
    color: var(--success-color);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    margin-top: 1rem;
}

.model-selection {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border-radius: 8px;
    margin: 1rem 0;
}

.content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 1.5rem;
    margin: 2rem 0;
}

.entities-panel {
    grid-column: span 2;
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
}

.entities-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 0.75rem;
    margin: 1rem 0;
}

.entity-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border-radius: 6px;
    transition: all 0.2s ease;
}

.entity-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.entity-item.inactive {
    opacity: 0.5;
    text-decoration: line-through;
}

.entity-placeholder {
    font-family: monospace;
    font-weight: bold;
    color: var(--primary-color);
}

.entity-original {
    color: var(--text-secondary);
    font-size: 0.9rem;
}

.entity-toggle {
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    background: var(--button-bg);
    border: none;
    border-radius: 4px;
    transition: background 0.2s;
}

.entity-toggle:hover {
    background: var(--button-hover-bg);
}

.llm-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--card-bg);
    border-radius: 8px;
}

.llm-controls {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    align-items: center;
}

.llm-input, .llm-output {
    height: 150px;
}

/* Responsive Design */
@media (max-width: 768px) {
    .content-grid {
        grid-template-columns: 1fr;
    }
    
    .entities-panel {
        grid-column: 1;
    }
    
    .llm-controls {
        grid-template-columns: 1fr;
    }
}
```

### 4. Main Application Logic

```javascript
// anonymizer-core.js
import { EntityManager } from './entity-manager.js';
import { AIModelProcessor } from './model-loader.js';
import { FileProcessor } from './file-processor.js';
import { UIController } from './ui-controller.js';

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
        this.uiController.showLoading(true);
        await this.aiProcessor.loadModel(modelType);
        this.uiController.showLoading(false);
      } catch (error) {
        this.uiController.showError('Failed to load AI model');
        this.currentMode = 'regex';
        document.getElementById('modelSelect').value = 'regex';
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
        detectedEntities = await this.aiProcessor.processText(inputText);
      }

      // Apply anonymization
      anonymizedText = this.applyAnonymization(inputText, detectedEntities);
      
      // Update UI
      document.getElementById('outputText').value = anonymizedText;
      this.uiController.updateEntityList(this.entityManager.exportEntities());
      
    } catch (error) {
      console.error('Anonymization error:', error);
      this.uiController.showError('Anonymization failed');
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

  deanonymizeText() {
    const outputText = document.getElementById('outputText').value;
    if (!outputText) return;

    let deanonymizedText = outputText;
    
    this.entityManager.entityMap.forEach((entity, placeholder) => {
      if (entity.isActive) {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        deanonymizedText = deanonymizedText.replace(regex, entity.original);
      }
    });
    
    document.getElementById('outputText').value = deanonymizedText;
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
  }

  async loadFile(file) {
    try {
      const text = await this.fileProcessor.processFile(file);
      document.getElementById('inputText').value = text;
    } catch (error) {
      this.uiController.showError(`Failed to load file: ${error.message}`);
    }
  }

  exportEntities() {
    const entities = this.entityManager.exportEntities();
    const csv = this.convertToCSV(entities);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entities_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      const text = await file.text();
      const entities = this.parseCSV(text);
      this.entityManager.importEntities(entities);
      this.uiController.updateEntityList(entities);
    } catch (error) {
      this.uiController.showError('Failed to import entities');
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
    if (!llmInput) return;

    let processedText = llmInput;
    
    this.entityManager.entityMap.forEach((entity, placeholder) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      processedText = processedText.replace(regex, entity.original);
    });
    
    document.getElementById('llmOutput').value = processedText;
  }

  clearInput() {
    document.getElementById('inputText').value = '';
    document.getElementById('outputText').value = '';
    document.getElementById('llmInput').value = '';
    document.getElementById('llmOutput').value = '';
    this.entityManager.clear();
    this.uiController.updateEntityList([]);
  }

  copyOutput() {
    const outputText = document.getElementById('outputText');
    outputText.select();
    document.execCommand('copy');
    this.uiController.showSuccess('Copied to clipboard');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AnonymizerApp();
});
```

## User Interface Design Guidelines

### Layout Principles
1. **Clean, intuitive three-panel layout**:
   - Left: Input area with file controls
   - Right: Output area with anonymized text
   - Bottom: Entity management panel

2. **Visual Consistency**:
   - Match existing optimizer.html design system
   - Use same color variables, spacing, and typography
   - Maintain responsive behavior patterns

3. **User-Friendly Features**:
   - **Clear visual feedback**: Processing indicators, success/error messages
   - **Drag-and-drop zones**: Visual highlighting on hover
   - **Entity cards**: Interactive cards showing placeholder → original mapping
   - **Toggle switches**: Easy enable/disable for each detected entity
   - **Progress indicators**: Show model loading and processing status
   - **Keyboard shortcuts**: Ctrl+A (anonymize), Ctrl+D (deanonymize), Ctrl+C (copy)

### Accessibility Requirements
- ARIA labels for all interactive elements
- Keyboard navigation support
- High contrast mode compatibility
- Screen reader friendly entity descriptions

## Performance Optimizations

### 1. Lazy Loading
```javascript
// Load heavy dependencies only when needed
const loadPdfProcessor = async () => {
  if (!window.pdfjsLib) {
    const pdfjsLib = await import('pdfjs-dist');
    window.pdfjsLib = pdfjsLib;
  }
  return window.pdfjsLib;
};

const loadDocxProcessor = async () => {
  if (!window.mammoth) {
    const mammoth = await import('mammoth');
    window.mammoth = mammoth;
  }
  return window.mammoth;
};
```

### 2. Web Workers for Heavy Processing
```javascript
// worker.js - Process large texts in background
self.addEventListener('message', async (e) => {
  const { action, data } = e.data;
  
  if (action === 'anonymize') {
    const result = await processInWorker(data);
    self.postMessage({ action: 'complete', result });
  }
});

async function processInWorker(data) {
  // Heavy regex processing moved to worker
  // Prevents UI blocking
  return processedData;
}
```

### 3. Debouncing and Throttling
```javascript
// Debounce entity list updates
const debouncedUpdateEntityList = debounce((entities) => {
  uiController.updateEntityList(entities);
}, 300);

// Throttle progress updates
const throttledProgressUpdate = throttle((progress) => {
  uiController.updateProgress(progress);
}, 100);
```

## Security Considerations

### 1. Content Security Policy
```javascript
// Ensure no external data transmission
const CSP_HEADER = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self'";
```

### 2. Input Sanitization
```javascript
// Sanitize all user inputs
function sanitizeInput(text) {
  return text
    .replace(/[<>]/g, '') // Remove potential HTML
    .slice(0, 1000000); // Limit size to 1MB
}
```

### 3. Secure Entity Storage
```javascript
// Use session-only storage, clear on page unload
class SecureEntityStorage {
  constructor() {
    this.storage = new Map();
    
    window.addEventListener('beforeunload', () => {
      this.clear();
    });
  }
  
  store(key, value) {
    // Encrypt sensitive data in memory
    const encrypted = this.simpleEncrypt(value);
    this.storage.set(key, encrypted);
  }
  
  retrieve(key) {
    const encrypted = this.storage.get(key);
    return encrypted ? this.simpleDecrypt(encrypted) : null;
  }
  
  clear() {
    this.storage.clear();
  }
  
  simpleEncrypt(text) {
    // Basic obfuscation for in-memory storage
    return btoa(encodeURIComponent(text));
  }
  
  simpleDecrypt(encrypted) {
    return decodeURIComponent(atob(encrypted));
  }
}
```

## Testing Requirements

### Unit Tests
- Entity detection accuracy for each pattern type
- Model loading and processing
- File format handling
- CSV export/import integrity
- Deanonymization accuracy

### Integration Tests
- End-to-end anonymization flow
- File upload → process → export workflow
- LLM output restoration
- Cross-browser compatibility

### Performance Tests
- Large file handling (up to 10MB)
- Model loading times
- UI responsiveness during processing

## Deployment Checklist

1. **File Structure Verification**
   - Ensure consistency with architecture_plan.md
   - Verify all module paths are correct

2. **Dependencies**
   - Bundle transformers.js for AI models
   - Include PDF.js and Mammoth.js for file processing
   - Minimize and compress all JavaScript

3. **Browser Compatibility**
   - Test on Chrome, Firefox, Safari, Edge
   - Ensure mobile responsiveness
   - Verify offline functionality

4. **Documentation**
   - User guide for all features
   - API documentation for entity manager
   - Troubleshooting guide

## Integration Points

### With Existing Codebase
1. **Shared Utilities**
   - Use existing file processing utilities if available
   - Leverage common UI components from optimizer.html
   - Share CSS variables and theme system

2. **Navigation Integration**
   - Add to main navigation menu
   - Implement consistent routing
   - Share authentication/session management if applicable

3. **Data Flow**
   - Allow text transfer between optimizer and anonymizer
   - Share export formats for consistency
   - Unified error handling system

## Advanced Features (Future Enhancements)

### 1. Custom Entity Patterns
```javascript
// Allow users to define custom patterns
class CustomPatternManager {
  addPattern(name, regex, priority) {
    this.customPatterns.set(name, {
      pattern: new RegExp(regex, 'gi'),
      priority: priority
    });
  }
}
```

### 2. Batch Processing
```javascript
// Process multiple files simultaneously
async function batchProcess(files) {
  const results = await Promise.all(
    files.map(file => processFile(file))
  );
  return combineResults(results);
}
```

### 3. Entity Learning
```javascript
// Learn from user corrections
class EntityLearning {
  recordCorrection(original, corrected, context) {
    // Store corrections for pattern improvement
    this.corrections.push({
      original,
      corrected,
      context,
      timestamp: Date.now()
    });
  }
  
  suggestPatternImprovements() {
    // Analyze corrections to suggest better patterns
    return this.analyzeCorrections();
  }
}
```

## Error Handling

```javascript
// Comprehensive error handling
class ErrorHandler {
  constructor() {
    this.errorLog = [];
  }
  
  handle(error, context) {
    console.error(`Error in ${context}:`, error);
    
    this.errorLog.push({
      error: error.message,
      context,
      timestamp: Date.now(),
      stack: error.stack
    });
    
    // User-friendly error messages
    const userMessage = this.getUserMessage(error, context);
    this.showUserError(userMessage);
  }
  
  getUserMessage(error, context) {
    const messages = {
      'model-loading': 'Unable to load AI model. Falling back to pattern matching.',
      'file-processing': 'Unable to process file. Please check the format.',
      'anonymization': 'Anonymization failed. Please try again.',
      'export': 'Unable to export entities. Please try again.'
    };
    
    return messages[context] || 'An unexpected error occurred.';
  }
  
  showUserError(message) {
    // Display error in UI
    const errorElement = document.createElement('div');
    errorElement.className = 'error-notification';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);
    
    setTimeout(() => errorElement.remove(), 5000);
  }
}
```

## Implementation Notes

### Critical Requirements
1. **No server communication** - All processing must be client-side
2. **Memory management** - Clear large objects after use
3. **Progressive enhancement** - Basic features work without AI models
4. **Graceful degradation** - Fall back to regex if AI fails

### Code Style Guidelines
1. Use ES6+ modules for organization
2. Implement proper error boundaries
3. Follow existing project conventions from architecture_plan.md
4. Document all public methods with JSDoc
5. Use semantic HTML for accessibility

### Performance Targets
- Initial load: < 2 seconds
- Model loading: < 10 seconds
- Text processing: < 100ms per 1000 words (regex)
- Text processing: < 500ms per 1000 words (AI)
- Entity list update: < 50ms

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (responsive design)

## Final Implementation Steps

1. **Phase 1: Core Functionality**
   - Implement regex-based detection
   - Basic UI with input/output
   - Entity management system

2. **Phase 2: AI Integration**
   - Add transformers.js integration
   - Implement model loading UI
   - Add fallback mechanisms

3. **Phase 3: Advanced Features**
   - File processing (PDF, DOCX)
   - CSV export/import
   - LLM output processing

4. **Phase 4: Polish**
   - Performance optimizations
   - Comprehensive error handling
   - User documentation

Remember to maintain consistency with the existing optimizer.html design system and follow the structure defined in architecture_plan.md throughout the implementation.