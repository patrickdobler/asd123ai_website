// EntityManager - Manages entity detection, mapping, and anonymization
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection

class EntityManager {
    constructor() {
        this.entityMap = new Map();
        this.entityCounters = {};
        this.reverseLookup = new Map();
    }

    /**
     * Generate a placeholder for a detected entity
     * @param {string} type - The entity type (e.g., 'PERSON_NAME', 'EMAIL')
     * @param {string} originalText - The original text to anonymize
     * @returns {string} - The generated placeholder
     */
    generatePlaceholder(type, originalText) {
        // Deduplicate: if the exact same text was already anonymized, reuse its placeholder
        const existingPlaceholder = this.reverseLookup.get(originalText);
        if (existingPlaceholder) {
            return existingPlaceholder;
        }

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

    /**
     * Toggle the active state of an entity
     * @param {string} placeholder - The placeholder to toggle
     */
    toggleEntity(placeholder) {
        const entity = this.entityMap.get(placeholder);
        if (entity) {
            entity.isActive = !entity.isActive;
        }
    }

    /**
     * Export all entities as an array
     * @returns {Array} - Array of entity objects
     */
    exportEntities() {
        const entities = Array.from(this.entityMap.entries()).map(([key, value]) => ({
            placeholder: key,
            original: value.original,
            type: value.type,
            active: value.isActive
        }));
        return entities;
    }

    /**
     * Import entities from an array
     * @param {Array} entityData - Array of entity objects
     */
    importEntities(entityData) {
        this.clear();
        entityData.forEach(entity => {
            // Malformed rows (no [TYPE_n] placeholder) are skipped, not fatal
            const index = parseInt(entity.placeholder?.match(/_(\d+)\]/)?.[1] ?? '', 10);
            if (!entity.placeholder || Number.isNaN(index)) return;
            this.entityMap.set(entity.placeholder, {
                original: entity.original,
                type: entity.type,
                index: index,
                isActive: entity.active
            });
            this.reverseLookup.set(entity.original, entity.placeholder);

            this.entityCounters[entity.type] = Math.max(this.entityCounters[entity.type] || 0, index);
        });
    }

    /**
     * Clear all entities
     */
    clear() {
        this.entityMap.clear();
        this.entityCounters = {};
        this.reverseLookup.clear();
    }

    /**
     * Get entity by placeholder
     * @param {string} placeholder - The placeholder to look up
     * @returns {Object|null} - The entity object or null
     */
    getEntity(placeholder) {
        return this.entityMap.get(placeholder) || null;
    }

    /**
     * Get all active entities
     * @returns {Array} - Array of active entity objects
     */
    getActiveEntities() {
        return this.exportEntities().filter(e => e.active);
    }

    /**
     * Get entity count by type
     * @returns {Object} - Object with entity counts by type
     */
    getEntityStats() {
        const stats = {};
        this.entityMap.forEach((entity, placeholder) => {
            if (!stats[entity.type]) {
                stats[entity.type] = { total: 0, active: 0 };
            }
            stats[entity.type].total++;
            if (entity.isActive) {
                stats[entity.type].active++;
            }
        });
        return stats;
    }
}

// Export for use in other modules
export { EntityManager };