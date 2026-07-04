// FileProcessor - Handles file uploads and text extraction
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection
// Supports .txt, .docx, and .pdf files

class FileProcessor {
    constructor() {
        this.supportedFormats = ['.txt', '.docx', '.pdf'];
    }

    /**
     * Process a file and extract text content
     * @param {File} file - The file to process
     * @returns {Promise<string>} - The extracted text content
     */
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

    /**
     * Read plain text file
     * @param {File} file - The text file
     * @returns {Promise<string>} - The file content
     */
    async readTextFile(file) {
        return await file.text();
    }

    /**
     * Read DOCX file using mammoth.js
     * @param {File} file - The DOCX file
     * @returns {Promise<string>} - The extracted text
     */
    async readDocxFile(file) {
        try {
            // Dynamic import for mammoth
            const mammoth = await this.loadMammoth();
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } catch (error) {
            console.error('Error reading DOCX file:', error);
            throw new Error('Failed to read DOCX file. Please ensure the file is not corrupted.');
        }
    }

    /**
     * Read PDF file using PDF.js
     * @param {File} file - The PDF file
     * @returns {Promise<string>} - The extracted text
     */
    async readPdfFile(file) {
        try {
            // Dynamic import for PDF.js
            const pdfjsLib = await this.loadPdfJs();
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
        } catch (error) {
            console.error('Error reading PDF file:', error);
            throw new Error('Failed to read PDF file. Please ensure the file is not corrupted or password-protected.');
        }
    }

    /**
     * Lazy load mammoth.js from the self-hosted vendor copy (same build the
     * converter uses) — no CDN request, works offline.
     * @returns {Promise<Object>} - The mammoth library
     */
    async loadMammoth() {
        if (!window.mammoth) {
            await this.loadScript('vendor/mammoth.browser.min.js');
        }
        return window.mammoth;
    }

    /**
     * Lazy load the self-hosted PDF.js 6 ESM build (same as the converter).
     * @returns {Promise<Object>} - The PDF.js module
     */
    async loadPdfJs() {
        if (!this.pdfjsModulePromise) {
            this.pdfjsModulePromise = import('../vendor/pdf.min.mjs').then(module => {
                module.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
                return module;
            }).catch(error => {
                this.pdfjsModulePromise = null;
                throw error;
            });
        }
        return this.pdfjsModulePromise;
    }

    /**
     * Load external script dynamically
     * @param {string} src - The script source URL
     * @returns {Promise<void>}
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Validate file before processing
     * @param {File} file - The file to validate
     * @returns {Object} - Validation result with isValid and error message
     */
    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!this.supportedFormats.includes(extension)) {
            return {
                isValid: false,
                error: `File type not supported. Supported formats: ${this.supportedFormats.join(', ')}`
            };
        }
        
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: 'File size exceeds 10MB limit'
            };
        }
        
        return { isValid: true };
    }
}

// Export for use in other modules
export { FileProcessor };