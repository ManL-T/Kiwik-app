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
        const app = document.getElementById('app');
        console.log('🎨 UIRenderer: app innerHTML preview:', app.innerHTML.substring(0, 100));
        const textElement = document.querySelector('.text');
        console.log('🎨 UIRenderer: textElement found:', !!textElement);
        
        if (!textElement) return;
        
        const highlightedText = fullSentence.replace(
            unitTarget,
            `<span class="text-highlight">${unitTarget}</span>`
        );
        
        console.log('🎨 UIRenderer: setting innerHTML:', highlightedText);
        textElement.innerHTML = highlightedText;
    }
    
    // Update translation options in display container
    updateTranslations(translations) {
        console.log('🎨 UIRenderer: updateTranslations called');
        console.log('🎨 UIRenderer: translations:', translations);
        
        const displayContainer = document.querySelector('.display-container');
        console.log('🎨 UIRenderer: displayContainer found:', !!displayContainer);
        
        if (!displayContainer) {
            console.log('🎨 UIRenderer: No displayContainer found, checking available elements...');
            const allElements = document.querySelectorAll('div');
            console.log('🎨 UIRenderer: Available div elements:', Array.from(allElements).map(el => el.className));
            return;
        }
        
        const translationsHTML = translations.map(translation => 
            `<div class="translation-option">${translation}</div>`
        ).join('');
        
        console.log('🎨 UIRenderer: setting translations innerHTML:', translationsHTML);
        displayContainer.innerHTML = translationsHTML;
    }
}