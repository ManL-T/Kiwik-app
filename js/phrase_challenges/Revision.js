// js/phrase_challenges/Revision.js
class Revision {
    constructor(eventBus) {
        console.log('🎯 Revision: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        this.currentUnit = 0;
        this.semanticUnits = [];
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Revision: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Remove any existing listeners first
        if (this.spaceHandler) {
            this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        }
        if (this.templateLoadedHandler) {
            this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        }
        
        this.spaceHandler = () => {
            if (!this.isActive) return;
            this.handleSpace();
        };
        
        this.templateLoadedHandler = (templatePath) => {
            if (!this.isActive) return;
            if (templatePath.includes('game.html')) {
                this.setupRevisionDisplay();
            }
        };
        
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 Revision: Starting phase with data:', data);
        this.isActive = false; // Don't activate immediately
        this.currentUnit = -1; // Start at -1, first spacebar press goes to 0
        this.phraseTarget = data.phraseTarget;
        this.semanticUnits = data.semanticUnits || [];
        
        console.log('🎯 Revision: Phase activated with', this.semanticUnits.length, 'units');
        
        // Re-establish event listeners to ensure they work
        this.setupEventListeners();
        
        // Set up display and activate after short delay
        setTimeout(() => {
            this.setupRevisionDisplay();
            this.isActive = true;
            console.log('🎯 Revision: Phase activated after delay');
        }, 100);
    }
    
    // Setup revision display when template loads
    setupRevisionDisplay() {
        console.log('🎯 Revision: Setting up revision display');
        
        // Reset to beginning state  
        this.currentUnit = -1;
        
        // Show phrase in header (no highlighting initially)
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.phraseTarget,
            unitTarget: ''
        });
        
        // Show instruction in display area
        const instructionHTML = `
            <div class="translation-option">Tap the spacebar to circle through the translations</div>
        `;
        this.eventBus.emit('ui:updateDisplayContainer', instructionHTML);
    }
    
    // Handle Space key (advance to next semantic unit)
    handleSpace() {
        console.log('🎯 Revision: Space pressed - advancing to next unit');
        this.currentUnit++;
        
        if (this.currentUnit >= this.semanticUnits.length) {
            console.log('🎯 Revision: All units completed');
            this.complete();
        } else {
            console.log('🎯 Revision: Showing unit', this.currentUnit, 'of', this.semanticUnits.length);
            this.showCurrentSemanticUnit();
        }
    }
    
    // Display current semantic unit with translations
    showCurrentSemanticUnit() {
        console.log('🎯 Revision: Displaying semantic unit:', this.currentUnit);
        
        const currentUnit = this.semanticUnits[this.currentUnit];
        console.log('🎯 Revision: Unit target:', currentUnit.unitTarget);
        console.log('🎯 Revision: Translations:', currentUnit.translations);
        
        // Show phrase with highlighting
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.phraseTarget,
            unitTarget: currentUnit.unitTarget
        });
        
        // Show translations in display area
        const translationsHTML = currentUnit.translations.map(translation => 
            `<div class="translation-option">${translation}</div>`
        ).join('');
        
        this.eventBus.emit('ui:updateDisplayContainer', translationsHTML);
    }
    
    // Complete this phase
    complete() {
        console.log('🎯 Revision: Completing revision phase');
        this.isActive = false;
        this.eventBus.emit('revision:completed');
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 Revision: Cleaning up...');
        this.isActive = false;
        
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        
        console.log('✅ Revision: Cleanup complete');
    }
}