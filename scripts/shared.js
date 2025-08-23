// ASD123 AI Text Tools - Shared JavaScript

// Navigation Manager
class NavigationManager {
    constructor() {
        this.currentPage = this.detectCurrentPage();
        this.setActiveNavItem();
    }
    
    detectCurrentPage() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || 'index.html';
        return page.replace('.html', '');
    }
    
    setActiveNavItem() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('nav-link--active');
        });
        
        const activeLink = document.querySelector(`[href*="${this.currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('nav-link--active');
        }
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

// Initialize shared components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    new NavigationManager();
    
    // Initialize character counter if elements exist
    if (document.getElementById('optimizer-textarea')) {
        new CharacterCounter('optimizer-textarea', 'char-count');
    }
    
    // Initialize privacy notice
    new PrivacyNotice();
    
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
    module.exports = { NavigationManager, utils, CharacterCounter, PrivacyNotice };
}