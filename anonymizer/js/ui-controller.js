// UIController - Manages UI updates and user interactions
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection

class UIController {
    constructor() {
        this.initialized = false;
        this.notificationTimeout = null;
    }

    /**
     * Initialize UI components
     */
    initialize() {
        this.initialized = true;
        this.setupDragAndDropVisuals();
        console.log('UIController initialized');
    }

    /**
     * Setup drag and drop visual feedback
     */
    setupDragAndDropVisuals() {
        // Add CSS class for drag-over state
        const style = document.createElement('style');
        style.textContent = `
            .drag-over {
                border-color: var(--primary-color) !important;
                background-color: rgba(66, 153, 225, 0.1) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Update entity list display
     * @param {Array} entities - Array of entity objects
     */
    updateEntityList(entities) {
        const listElement = document.getElementById('entitiesList');
        if (!listElement) return;

        // Clear existing list
        listElement.innerHTML = '';

        // Group entities by type
        const groupedEntities = this.groupEntitiesByType(entities);

        // Create entity items
        Object.entries(groupedEntities).forEach(([type, typeEntities]) => {
            typeEntities.forEach(entity => {
                const entityItem = this.createEntityItem(entity);
                listElement.appendChild(entityItem);
            });
        });

        // Update stats
        this.updateEntityStats(entities);
    }

    /**
     * Group entities by type
     * @param {Array} entities - Array of entity objects
     * @returns {Object} - Grouped entities
     */
    groupEntitiesByType(entities) {
        const grouped = {};
        entities.forEach(entity => {
            if (!grouped[entity.type]) {
                grouped[entity.type] = [];
            }
            grouped[entity.type].push(entity);
        });
        return grouped;
    }

    /**
     * Create entity item element
     * @param {Object} entity - Entity object
     * @returns {HTMLElement} - Entity item element
     */
    createEntityItem(entity) {
        const item = document.createElement('div');
        item.className = `entity-item ${entity.active ? '' : 'inactive'}`;
        item.dataset.placeholder = entity.placeholder;

        item.innerHTML = `
            <div>
                <div class="entity-placeholder">${entity.placeholder}</div>
                <div class="entity-original">${this.escapeHtml(entity.original)}</div>
            </div>
            <button class="entity-toggle" data-placeholder="${entity.placeholder}">
                ${entity.active ? '👁️' : '👁️‍🗨️'}
            </button>
        `;

        // Add click handler for toggle
        const toggleBtn = item.querySelector('.entity-toggle');
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dispatchCustomEvent('entityToggle', { placeholder: entity.placeholder });
        });

        return item;
    }

    /**
     * Update entity statistics
     * @param {Array} entities - Array of entity objects
     */
    updateEntityStats(entities) {
        const totalElement = document.getElementById('totalEntities');
        const activeElement = document.getElementById('activeEntities');

        if (totalElement) {
            totalElement.textContent = `Total: ${entities.length}`;
        }

        if (activeElement) {
            const activeCount = entities.filter(e => e.active).length;
            activeElement.textContent = `Active: ${activeCount}`;
        }
    }

    /**
     * Show loading indicator
     * @param {boolean} show - Whether to show loading
     * @param {string} message - Optional loading message
     */
    showLoading(show, message = 'Processing...') {
        const statusElement = document.getElementById('modelStatus');
        if (statusElement) {
            if (show) {
                statusElement.textContent = message;
                statusElement.style.color = 'var(--primary-color)';
            } else {
                statusElement.textContent = '';
            }
        }
    }

    /**
     * Show processing indicator
     * @param {boolean} show - Whether to show processing
     */
    showProcessing(show) {
        const anonymizeBtn = document.getElementById('anonymizeBtn');
        if (anonymizeBtn) {
            if (show) {
                anonymizeBtn.disabled = true;
                anonymizeBtn.innerHTML = '<span class="btn-icon">⏳</span> Processing...';
            } else {
                anonymizeBtn.disabled = false;
                anonymizeBtn.innerHTML = '<span class="btn-icon">🛡️</span> Anonymize';
            }
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Show info message
     * @param {string} message - Info message
     */
    showInfo(message) {
        this.showNotification(message, 'info');
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (error, success, info)
     */
    showNotification(message, type = 'info') {
        // Clear existing notification
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        // Remove existing notification
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // Style notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            animation: 'slideInRight 0.3s ease-out',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px'
        });

        // Set background color based on type
        const colors = {
            error: '#ef4444',
            success: '#22c55e',
            info: '#4299e1'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to document
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        this.notificationTimeout = setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);

        // Add click to dismiss
        notification.addEventListener('click', () => {
            notification.remove();
            if (this.notificationTimeout) {
                clearTimeout(this.notificationTimeout);
            }
        });
    }

    /**
     * Dispatch custom event
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail
     */
    dispatchCustomEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update character count
     * @param {number} count - Character count
     * @param {string} elementId - Element ID to update
     */
    updateCharCount(count, elementId = 'char-count') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = `${count.toLocaleString()} characters`;
        }
    }

    /**
     * Clear all inputs and outputs
     */
    clearAll() {
        const inputs = ['inputText', 'outputText', 'llmInput', 'llmOutput'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });

        const entitiesList = document.getElementById('entitiesList');
        if (entitiesList) {
            entitiesList.innerHTML = '';
        }

        this.updateEntityStats([]);
    }
}

// Add animation keyframes
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styleSheet);

// Export for use in other modules
export { UIController };