// UIController - Manages UI updates and user interactions
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection

class UIController {
    constructor() {
        this.initialized = false;
        this.notificationTimeout = null;
        this.currentView = 'tiles'; // 'tiles' or 'list'
        this.currentSort = 'appearance'; // 'appearance' or 'alphabetical'
    }

    /**
     * Initialize UI components
     */
    initialize() {
        this.initialized = true;
        this.setupDragAndDropVisuals();
        this.setupViewToggle();
        this.setupSyncScroll();
        this.setupSortingControl();
        this.setupResizeHandle();
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
     * Setup synchronized scrolling between textareas
     */
    setupSyncScroll() {
        const inputText = document.getElementById('inputText');
        const outputText = document.getElementById('outputText');
        
        if (!inputText || !outputText) return;
        
        let isScrolling = false;
        
        inputText.addEventListener('scroll', () => {
            if (!isScrolling) {
                isScrolling = true;
                outputText.scrollTop = inputText.scrollTop;
                outputText.scrollLeft = inputText.scrollLeft;
                setTimeout(() => { isScrolling = false; }, 10);
            }
        });
        
        outputText.addEventListener('scroll', () => {
            if (!isScrolling) {
                isScrolling = true;
                inputText.scrollTop = outputText.scrollTop;
                inputText.scrollLeft = outputText.scrollLeft;
                setTimeout(() => { isScrolling = false; }, 10);
            }
        });
        
        // Add synchronized resizing for main textboxes
        this.setupSyncResize(inputText, outputText);
        
        // Setup synchronized resizing for LLM textboxes
        this.setupLlmSyncResize();
    }

    /**
     * Setup synchronized resizing between textareas
     */
    setupSyncResize(inputText, outputText) {
        let isResizing = false;
        
        // Create ResizeObserver for input textarea
        const inputObserver = new ResizeObserver(entries => {
            if (isResizing) return;
            
            for (let entry of entries) {
                isResizing = true;
                const newHeight = entry.target.offsetHeight;
                outputText.style.height = newHeight + 'px';
                setTimeout(() => { isResizing = false; }, 10);
            }
        });
        
        // Create ResizeObserver for output textarea
        const outputObserver = new ResizeObserver(entries => {
            if (isResizing) return;
            
            for (let entry of entries) {
                isResizing = true;
                const newHeight = entry.target.offsetHeight;
                inputText.style.height = newHeight + 'px';
                setTimeout(() => { isResizing = false; }, 10);
            }
        });
        
        // Start observing both textareas
        inputObserver.observe(inputText);
        outputObserver.observe(outputText);
    }

    /**
     * Setup synchronized resizing for LLM processing textboxes
     */
    setupLlmSyncResize() {
        const llmInput = document.getElementById('llmInput');
        const llmOutput = document.getElementById('llmOutput');
        
        if (!llmInput || !llmOutput) return;
        
        let isResizing = false;
        
        // Create ResizeObserver for LLM input textarea
        const llmInputObserver = new ResizeObserver(entries => {
            if (isResizing) return;
            
            for (let entry of entries) {
                isResizing = true;
                const newHeight = entry.target.offsetHeight;
                llmOutput.style.height = newHeight + 'px';
                setTimeout(() => { isResizing = false; }, 10);
            }
        });
        
        // Create ResizeObserver for LLM output textarea
        const llmOutputObserver = new ResizeObserver(entries => {
            if (isResizing) return;
            
            for (let entry of entries) {
                isResizing = true;
                const newHeight = entry.target.offsetHeight;
                llmInput.style.height = newHeight + 'px';
                setTimeout(() => { isResizing = false; }, 10);
            }
        });
        
        // Start observing both LLM textareas
        llmInputObserver.observe(llmInput);
        llmOutputObserver.observe(llmOutput);
    }

    /**
     * Setup view toggle button
     */
    setupViewToggle() {
        const viewToggleBtn2 = document.getElementById('viewToggleBtn2');
        
        if (viewToggleBtn2) {
            // Initialize button with correct icon based on initial state
            this.updateViewToggleButtons();
            
            viewToggleBtn2.addEventListener('click', () => {
                this.currentView = this.currentView === 'tiles' ? 'list' : 'tiles';
                this.updateViewToggleButtons();
                // Re-render entities with new view
                const event = new CustomEvent('viewChanged', { detail: { view: this.currentView } });
                document.dispatchEvent(event);
            });
        }
    }

    /**
     * Setup sorting control
     */
    setupSortingControl() {
        const sortSelect = document.getElementById('sortEntitiesSelect');
        if (!sortSelect) return;
        
        sortSelect.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            const event = new CustomEvent('sortChanged', { detail: { sort: this.currentSort } });
            document.dispatchEvent(event);
        });
    }

    /**
     * Update view toggle button text
     */
    updateViewToggleButtons() {
        const viewToggleText2 = document.getElementById('viewToggleText2');
        const viewToggleBtn2 = document.getElementById('viewToggleBtn2');
        
        const newText = this.currentView === 'tiles' ? 'List View' : 'Tiles View';
        // SVG for list view
        const listViewSVG = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" x2="21" y1="6" y2="6"/>
            <line x1="8" x2="21" y1="12" y2="12"/>
            <line x1="8" x2="21" y1="18" y2="18"/>
            <line x1="3" x2="3.01" y1="6" y2="6"/>
            <line x1="3" x2="3.01" y1="12" y2="12"/>
            <line x1="3" x2="3.01" y1="18" y2="18"/>
        </svg>`;
        // SVG for tiles view
        const tilesViewSVG = `<svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="7" height="7" x="3" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="14" rx="1"/>
            <rect width="7" height="7" x="3" y="14" rx="1"/>
        </svg>`;
        
        if (viewToggleText2) {
            viewToggleText2.textContent = newText;
        }
        
        if (viewToggleBtn2) {
            const icon = viewToggleBtn2.querySelector('.btn-icon');
            if (icon) {
                // Replace the SVG instead of using textContent
                const newSVG = this.currentView === 'tiles' ? listViewSVG : tilesViewSVG;
                icon.outerHTML = newSVG;
            }
        }
    }

    /**
     * Setup resize handle for input/output containers
     */
    setupResizeHandle() {
        const resizeHandle = document.getElementById('resizeHandle');
        if (!resizeHandle) return;
        
        const container = resizeHandle.parentElement;
        const leftPanel = container.querySelector('.text-section-half:first-child');
        const rightPanel = container.querySelector('.text-section-half:last-child');
        
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startLeftWidth = leftPanel.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const containerWidth = container.offsetWidth;
            const deltaX = e.clientX - startX;
            const newLeftWidth = startLeftWidth + deltaX;
            const newLeftPercent = (newLeftWidth / containerWidth) * 100;
            
            // Limit resize between 20% and 80%
            if (newLeftPercent >= 20 && newLeftPercent <= 80) {
                leftPanel.style.flex = `0 0 ${newLeftPercent}%`;
                rightPanel.style.flex = `0 0 ${100 - newLeftPercent}%`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
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

        // Apply sorting based on currentSort
        const sortedEntities = this.sortEntities([...entities]);

        // Update view class based on currentView
        listElement.className = this.currentView === 'tiles' ? 'entities-list-compact' : 'entities-list-view';

        // Create entity items
        sortedEntities.forEach(entity => {
            const entityItem = this.createEntityItem(entity);
            listElement.appendChild(entityItem);
        });

        // Update stats
        this.updateEntityStats(entities);
    }

    /**
     * Sort entities based on current sort mode
     * @param {Array} entities - Array of entity objects
     * @returns {Array} - Sorted entities
     */
    sortEntities(entities) {
        const entitiesCopy = [...entities];
        
        if (this.currentSort === 'alphabetical') {
            // Sort by entity type names alphabetically
            return entitiesCopy.sort((a, b) => {
                // First sort by type, then by number within type
                const typeA = a.type.toLowerCase();
                const typeB = b.type.toLowerCase();
                
                if (typeA !== typeB) {
                    return typeA.localeCompare(typeB);
                }
                
                // If same type, sort by number
                const numA = parseInt(a.placeholder.match(/_(\d+)\]/)?.[1] || 0);
                const numB = parseInt(b.placeholder.match(/_(\d+)\]/)?.[1] || 0);
                return numA - numB;
            });
        } else {
            // Sort by appearance in anonymized output
            const outputText = document.getElementById('outputText')?.value || '';
            if (!outputText) {
                // Fallback to placeholder number if no output text
                return entitiesCopy.sort((a, b) => {
                    const numA = parseInt(a.placeholder.match(/_(\d+)\]/)?.[1] || 0);
                    const numB = parseInt(b.placeholder.match(/_(\d+)\]/)?.[1] || 0);
                    return numA - numB;
                });
            }
            
            // Sort by actual position in output text. Positions are computed
            // once up front — indexOf inside the comparator would rescan the
            // whole output on every comparison.
            const positions = new Map(
                entitiesCopy.map(e => [e.placeholder, outputText.indexOf(e.placeholder)])
            );
            return entitiesCopy.sort((a, b) => {
                const posA = positions.get(a.placeholder);
                const posB = positions.get(b.placeholder);

                // If either placeholder is not found, put it at the end
                if (posA === -1 && posB === -1) return 0;
                if (posA === -1) return 1;
                if (posB === -1) return -1;

                return posA - posB;
            });
        }
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
        const description = document.createElement('span');
        description.className = 'entity-text';
        const placeholder = document.createElement('span');
        placeholder.className = 'entity-placeholder';
        placeholder.textContent = entity.placeholder;
        const original = document.createElement('span');
        original.className = 'entity-original';
        original.textContent = entity.original;
        description.append(placeholder, original);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'entity-remove';
        remove.title = 'Remove entity';
        remove.setAttribute('aria-label', `Remove ${entity.original}`);
        remove.innerHTML = '<svg class="remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7"/></svg>';
        remove.addEventListener('click', () => this.dispatchCustomEvent('entityRemove', { placeholder: entity.placeholder }));
        item.append(description, remove);
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
                statusElement.style.display = 'inline';
            } else {
                statusElement.textContent = '';
                statusElement.style.display = 'none';
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
                anonymizeBtn.classList.add('processing');
            } else {
                anonymizeBtn.disabled = false;
                anonymizeBtn.classList.remove('processing');
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

        // Style notification - smaller and consistent with optimizer
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            zIndex: '9999',
            animation: 'slideInRight 0.3s ease-out',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            maxWidth: '350px'
        });

        // Set background color based on type - E Ink theme (consistent)
        const colors = {
            error: 'rgba(60, 60, 60, 0.95)',
            success: 'rgba(40, 40, 40, 0.95)',
            info: 'rgba(50, 50, 50, 0.95)'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.style.color = '#e4e4dc';
        notification.style.border = '1px solid rgba(10, 10, 10, 0.4)';

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
