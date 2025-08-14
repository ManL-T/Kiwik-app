// UI Rendering module - handles all template loading and DOM updates
class UIRenderer {
    constructor(eventBus) {
        console.log('🎨 UIRenderer: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ UIRenderer: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('ui:loadTemplate', (templatePath) => {
            this.loadTemplate(templatePath);
        });
        
        this.eventBus.on('ui:updateHighlightedText', (data) => {
            this.updateHighlightedText(data.fullSentence, data.unitTarget);
        });
        
        this.eventBus.on('ui:updateTranslations', (translations) => {
            this.updateTranslations(translations);
        });
    }
    
    // Template loading
    async loadTemplate(templatePath) {
        try {
            const app = document.getElementById('app');
            const response = await fetch(templatePath);
            const html = await response.text();
            app.innerHTML = html;
        } catch (error) {
            console.error('Error loading template:', error);
        }
    }
    
    // Update highlighted text in game screen
    updateHighlightedText(fullSentence, unitTarget) {
        const textElement = document.querySelector('.text');
        if (!textElement) return;
        
        const highlightedText = fullSentence.replace(
            unitTarget,
            `<span class="text-highlight">${unitTarget}</span>`
        );
        
        textElement.innerHTML = highlightedText;
    }
    
    // Update translation options in display container
    updateTranslations(translations) {
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        const translationsHTML = translations.map(translation => 
            `<div class="translation-option">${translation}</div>`
        ).join('');
        
        displayContainer.innerHTML = translationsHTML;
    }
}