// js/phrase_challenges/Retrieval.js - Refactored with Template Loading
class Retrieval {
    constructor(eventBus) {
        console.log('🎯 Retrieval: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        this.currentUnit = 0;
        this.semanticUnits = [];
        this.phraseTarget = '';
        
        // Track translation visibility state
        this.translationsVisible = false;
        
        // Store loaded instruction template
        this.instructionHTML = null;
        
        // Load instruction template
        this.loadInstructionTemplate();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Retrieval: Initialization complete');
    }
    
    // Load instruction template from partial
    async loadInstructionTemplate() {
        try {
            const response = await fetch('templates/partials/retrieval-instructions.html');
            this.instructionHTML = await response.text();
            console.log('🎯 Retrieval: Instruction template loaded');
        } catch (error) {
            console.error('🎯 Retrieval: Error loading instruction template:', error);
            // Fallback to hardcoded HTML
            this.instructionHTML = `
                <div class="retrieval-card" onclick="handleEnterKey()" data-key="enter">
                    <div class="retrieval-card-icon">↵</div>
                    <div class="retrieval-card-text">to reveal the translation <nobr>[-3 seconds]</nobr></div>
                </div>
            `;
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Remove any existing listeners first
        if (this.spaceHandler) {
            this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        }
        if (this.enterHandler) {
            this.eventBus.off('navigation:enterPressed', this.enterHandler);
        }
        if (this.templateLoadedHandler) {
            this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        }
        // if (this.timerExpiredHandler) {
        //     this.eventBus.off('timer:expired', this.timerExpiredHandler);
        // }
        
        this.spaceHandler = () => {
            if (!this.isActive) return;
            this.handleSpace();
        };
        
        this.enterHandler = () => {
            if (!this.isActive) return;
            this.handleEnter();
        };
        
        this.templateLoadedHandler = (templatePath) => {
            if (!this.isActive) return;
            if (templatePath.includes('game.html')) {
                this.setupRetrievalDisplay();
            }
        };
        
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
        // this.eventBus.on('timer:expired', this.timerExpiredHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 Retrieval: Starting phase with data:', data);
        this.isActive = false; // Don't activate immediately
        this.currentUnit = -1; // Start at -1, first spacebar press goes to 0
        this.phraseTarget = data.phraseTarget;
        this.semanticUnits = data.semanticUnits || [];
        this.translationsVisible = false;
        
        console.log('🎯 Retrieval: Phase activated with', this.semanticUnits.length, 'units');
        
        // Re-establish event listeners to ensure they work
        this.setupEventListeners();
        
        // Set up display and activate after short delay
        setTimeout(() => {
            this.setupRetrievalDisplay();
            this.isActive = true;
            console.log('🎯 Retrieval: Phase activated after delay');
        }, 100);
    }
    
    // Setup retrieval display when template loads
    setupRetrievalDisplay() {
        console.log('🎯 Retrieval: Setting up retrieval display');
        
        // Reset to beginning state  
        this.currentUnit = -1;
        this.translationsVisible = false;
        
        // Show phrase in header (no highlighting initially)
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.phraseTarget,
            unitTarget: ''
        });
        
        // Show the same instruction card from the beginning
        this.eventBus.emit('ui:updateDisplayContainer', this.instructionHTML);
    }
    
    // Handle Space key (advance to next semantic unit)
    handleSpace() {
        console.log('🎯 Retrieval: Space pressed - advancing to next unit');
        this.currentUnit++;
        this.translationsVisible = false; // Reset translation visibility
        
        if (this.currentUnit >= this.semanticUnits.length) {
            console.log('🎯 Retrieval: All units completed');
            this.complete();
        } else {
            console.log('🎯 Retrieval: Showing unit', this.currentUnit, 'of', this.semanticUnits.length);
            this.updateSemanticUnitDisplay(false); // Show without translations
        }
    }
    
    // Handle Enter key (reveal translations for current unit - P2 specific)
    handleEnter() {
        console.log('🎯 Retrieval: Enter pressed - revealing translations (P2 feature)');
        
        if (this.currentUnit >= 0 && this.currentUnit < this.semanticUnits.length) {
            console.log('🎯 Retrieval: Showing translations for current unit');
            this.translationsVisible = true;
            this.updateSemanticUnitDisplay(true); // Show with translations

            // Apply 3-second timer penalty for peeking
            this.eventBus.emit('timer:penalty', 3);
            
        }
    }
    
    // REFACTORED: Single method to handle semantic unit display
    updateSemanticUnitDisplay(showTranslations) {
        console.log('🎯 Retrieval: Updating semantic unit display, showTranslations:', showTranslations);
        
        const currentUnit = this.semanticUnits[this.currentUnit];
        console.log('🎯 Retrieval: Unit target:', currentUnit.unitTarget);
        
        // Always update phrase highlighting (same for levels 1&2)
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.phraseTarget,
            unitTarget: currentUnit.unitTarget
        });
        
        // Conditional display content
        if (showTranslations) {
            console.log('🎯 Retrieval: Showing translations:', currentUnit.translations);
            
            // Show translations
            const translationsHTML = currentUnit.translations.map(translation => 
                `<div class="translation-option">${translation}</div>`
            ).join('');
            
            this.eventBus.emit('ui:updateDisplayContainer', translationsHTML);
        } else {
            console.log('🎯 Retrieval: Showing instruction card');
            
            // Show instruction card (no translations - level 2 behavior)
            this.eventBus.emit('ui:updateDisplayContainer', this.instructionHTML);
        }
    }
    
    // Complete this phase
    complete() {
        console.log('🎯 Retrieval: Completing retrieval phase');
        this.isActive = false;
        this.eventBus.emit('retrieval:completed');
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 Retrieval: Cleaning up...');
        this.isActive = false;
        
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        
        console.log('✅ Retrieval: Cleanup complete');
    }
}