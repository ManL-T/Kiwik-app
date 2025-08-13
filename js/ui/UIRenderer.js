// UI Rendering module - handles all template loading and DOM updates
class UIRenderer {
    constructor() {
        console.log('🎨 UIRenderer: Initializing...');
        console.log('✅ UIRenderer: Initialization complete');
    }
    
    // Template loading
    async loadTemplate(templatePath) {
        try {
            const app = document.getElementById('app');
            if (!app) {
                console.error('App element not found');
                return;
            }
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