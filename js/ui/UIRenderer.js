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
        
        this.eventBus.on('ui:updateDisplayContainer', (html) => {
            this.updateDisplayContainer(html);
        });
        
        this.eventBus.on('ui:multipleChoice', (html) => {
            this.multipleChoice(html);
        });
    }
    
    // Template loading
    async loadTemplate(templatePath) {
        try {
            const app = document.getElementById('app');
            const response = await fetch(templatePath);
            const html = await response.text();
            app.innerHTML = html;
            this.eventBus.emit('ui:templateLoaded', templatePath);
        } catch (error) {
            console.error('Error loading template:', error);
        }
    }
    
    // Update highlighted text in game screen
    updateHighlightedText(fullSentence, unitTarget) {
        console.log('🎨 UIRenderer: updateHighlightedText called');
        console.log('🎨 UIRenderer: fullSentence:', fullSentence);
        console.log('🎨 UIRenderer: unitTarget:', unitTarget);
        
        const textElement = document.querySelector('.text');
        if (!textElement) return;
        
        // If no unitTarget, show plain text (for decision phases)
        if (!unitTarget) {
            console.log('🎨 UIRenderer: Showing plain text - no highlighting');
            textElement.innerHTML = fullSentence;
            return;
        }
        
        // Apply highlighting (for revision phase)
        const highlightedText = fullSentence.replace(
            unitTarget,
            `<span class="text-highlight">${unitTarget}</span>`
        );
        
        console.log('🎨 UIRenderer: setting highlighted innerHTML:', highlightedText);
        textElement.innerHTML = highlightedText;
    }
    
    // Update translation options in display container
    updateTranslations(translations) {
        console.log('🎨 UIRenderer: updateTranslations called');
        console.log('🎨 UIRenderer: translations:', translations);
        
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        const translationsHTML = translations.map(translation => 
            `<div class="translation-option">${translation}</div>`
        ).join('');
        
        console.log('🎨 UIRenderer: setting translations innerHTML:', translationsHTML);
        displayContainer.innerHTML = translationsHTML;
    }
    
    // Update display container with custom HTML
    updateDisplayContainer(html) {
        console.log('🎨 UIRenderer: updateDisplayContainer called');
        console.log('🎨 UIRenderer: html:', html);
        
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        displayContainer.innerHTML = html;
    }
    
    // Multiple choice layout - renders directly into display area
    multipleChoice(html) {
        console.log('🎨 UIRenderer: multipleChoice called');
        console.log('🎨 UIRenderer: html:', html);
        
        const displayArea = document.querySelector('.display-area');
        if (!displayArea) return;
        
        displayArea.innerHTML = html;
    }
}