// ASD123.ai AI Text Tools - Shared JavaScript

// Theme Manager
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.applyTheme(this.theme);
        this.initToggle();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.updateToggleState(theme);
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.theme = newTheme;
        this.applyTheme(newTheme);
    }

    initToggle() {
        // Wait for DOM to be ready to find the toggle
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupToggleListener());
        } else {
            this.setupToggleListener();
        }
    }

    setupToggleListener() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            // Remove existing listener to prevent duplicates if called multiple times
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
            
            newToggle.addEventListener('change', () => this.toggleTheme());
            this.updateToggleState(this.theme);
        }
    }

    updateToggleState(theme) {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.checked = theme === 'dark';
        }
    }
}

// Navigation Manager
class NavigationManager {
    constructor() {
        this.currentPage = this.detectCurrentPage();
        this.setActiveNavItem();
        this.initToolsMenu();
    }
    
    detectCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page.replace('.html', '');
    }
    
    setActiveNavItem() {
        document.querySelectorAll('.nav-link, .nav-tool-item').forEach(link => {
            link.classList.remove('nav-link--active');
        });
        
        const linkedPage = {
            'text-cleaner-guide': 'text-cleaner',
            'anonymizer-guide': 'anonymizer',
            'chat-guide': 'chat',
            'context-guide': 'context'
        }[this.currentPage] || this.currentPage;
        const activeLink = document.querySelector(`.nav-links a[href*="${linkedPage}"]`);
        if (activeLink) {
            activeLink.classList.add('nav-link--active');
            const toolsMenu = activeLink.closest('.nav-tools');
            const toolsTrigger = toolsMenu?.querySelector('.nav-tools-trigger');
            if (toolsTrigger) {
                toolsTrigger.classList.add('nav-link--active');
            }
        }
    }

    initToolsMenu() {
        document.querySelectorAll('.nav-tools').forEach(menu => {
            const trigger = menu.querySelector('.nav-tools-trigger');
            const panel = menu.querySelector('.nav-tools-menu');

            if (!trigger || !panel) {
                return;
            }

            const setOpen = isOpen => {
                menu.classList.toggle('nav-tools--open', isOpen);
                trigger.setAttribute('aria-expanded', String(isOpen));
            };

            trigger.addEventListener('click', event => {
                event.preventDefault();
                setOpen(!menu.classList.contains('nav-tools--open'));
            });

            trigger.addEventListener('keydown', event => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setOpen(true);
                    panel.querySelector('a')?.focus();
                }
            });

            document.addEventListener('click', event => {
                if (!menu.contains(event.target)) {
                    setOpen(false);
                }
            });

            document.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    setOpen(false);
                    trigger.focus();
                }
            });
        });
    }
}

// Utility Functions
const utils = {
    // Debounce function for performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Format number with locale-specific formatting
    formatNumber(num) {
        return num.toLocaleString();
    },
    
    // Check if user prefers reduced motion
    prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    
    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy text: ', err);
            return false;
        }
    }
};

// Character Counter Component
class CharacterCounter {
    constructor(textareaId, counterId) {
        this.textarea = document.getElementById(textareaId);
        this.counter = document.getElementById(counterId);
        
        if (this.textarea && this.counter) {
            this.updateCount = utils.debounce(this.updateCount.bind(this), 100);
            this.textarea.addEventListener('input', this.updateCount);
            this.updateCount(); // Initial count
        }
    }
    
    updateCount() {
        const count = this.textarea.value.length;
        this.counter.textContent = `${utils.formatNumber(count)} characters`;
    }
}

// Privacy Notice Component
class PrivacyNotice {
    constructor() {
        this.hasShown = localStorage.getItem('asd123-privacy-notice-shown');
        if (!this.hasShown) {
            this.showNotice();
        }
    }
    
    showNotice() {
        // TODO: Implement privacy notice modal/banner
        console.log('Privacy notice: All processing happens in your browser');
        localStorage.setItem('asd123-privacy-notice-shown', 'true');
    }
}

// WebMCP Integration
class WebMCPManager {
    constructor() {
        this.controller = new AbortController();
        this.init();
    }

    init() {
        const modelContext = navigator.modelContext;
        if (!modelContext || (
            typeof modelContext.registerTool !== 'function' &&
            typeof modelContext.provideContext !== 'function'
        )) {
            return;
        }

        this.registerTool({
            name: 'asd123_get_page_info',
            description: 'Return basic information about the current ASD123.ai page and available local browser tools.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: async () => ({
                title: document.title,
                url: window.location.href,
                pathname: window.location.pathname,
                tools: [
                    'text-cleaner: local text cleanup and normalization',
                    'anonymizer: local PII anonymization and redaction',
                    'chat: local WebGPU AI chat with browser-stored history',
                    'context: local context window estimation for text and documents'
                ],
                privacy: 'ASD123.ai text tools run in the browser. User text is not sent to ASD123.ai servers for processing.'
            })
        });

        this.registerTool({
            name: 'asd123_navigate',
            description: 'Navigate to a main ASD123.ai tool or documentation page.',
            inputSchema: {
                type: 'object',
                properties: {
                    page: {
                        type: 'string',
                        enum: ['home', 'text-cleaner', 'anonymizer', 'chat', 'context', 'documentation', 'text-cleaner-guide', 'anonymizer-guide', 'chat-guide', 'context-guide', 'privacy', 'terms']
                    }
                },
                required: ['page'],
                additionalProperties: false
            },
            execute: async ({ page }) => {
                const routes = {
                    home: '/',
                    'text-cleaner': '/text-cleaner',
                    anonymizer: '/anonymizer',
                    chat: '/chat',
                    context: '/context',
                    documentation: '/documentation',
                    'text-cleaner-guide': '/text-cleaner-guide',
                    'anonymizer-guide': '/anonymizer-guide',
                    'chat-guide': '/chat-guide',
                    'context-guide': '/context-guide',
                    privacy: '/privacy',
                    terms: '/terms'
                };
                window.location.href = routes[page] || '/';
                return { navigatedTo: routes[page] || '/' };
            }
        });

        this.registerTool({
            name: 'asd123_fill_text_cleaner',
            description: 'Fill the Text Cleaner input area with text on the text-cleaner page.',
            inputSchema: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text to place into the Text Cleaner input field.'
                    }
                },
                required: ['text'],
                additionalProperties: false
            },
            execute: async ({ text }) => {
                const textarea = document.getElementById('text-cleaner-textarea');
                if (!textarea) {
                    return { ok: false, error: 'Optimizer input is not available on this page.' };
                }
                textarea.value = text;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.focus();
                return { ok: true, characters: text.length };
            }
        });

        this.registerTool({
            name: 'asd123_fill_anonymizer',
            description: 'Fill the Anonymizer input area with text on the anonymizer page.',
            inputSchema: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text to place into the anonymizer input field.'
                    }
                },
                required: ['text'],
                additionalProperties: false
            },
            execute: async ({ text }) => {
                const textarea = document.getElementById('inputText');
                if (!textarea) {
                    return { ok: false, error: 'Anonymizer input is not available on this page.' };
                }
                textarea.value = text;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.focus();
                return { ok: true, characters: text.length };
            }
        });
    }

    registerTool(tool) {
        try {
            if (typeof navigator.modelContext.registerTool === 'function') {
                navigator.modelContext.registerTool(tool, { signal: this.controller.signal });
                return;
            }

            if (typeof navigator.modelContext.provideContext === 'function') {
                navigator.modelContext.provideContext({ tools: [tool] }, { signal: this.controller.signal });
            }
        } catch (error) {
            console.warn(`WebMCP tool registration failed for ${tool.name}:`, error);
        }
    }
}

// Initialize shared components when DOM is loaded
// Initialize theme immediately to prevent flash
const themeManager = new ThemeManager();

document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    new NavigationManager();
    
    // Re-initialize toggle listener in case it wasn't found earlier
    themeManager.setupToggleListener();
    
    // Initialize character counter if elements exist
    if (document.getElementById('text-cleaner-textarea')) {
        new CharacterCounter('text-cleaner-textarea', 'char-count');
    }
    
    // Initialize privacy notice
    new PrivacyNotice();

    // Register WebMCP tools when supported by the browser
    new WebMCPManager();
    
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationManager, utils, CharacterCounter, PrivacyNotice, ThemeManager, WebMCPManager };
}
