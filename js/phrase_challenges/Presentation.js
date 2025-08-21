// js/phrase_challenges/Presentation.js
class Presentation {
    constructor(eventBus) {
        console.log('🎯 Presentation: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Presentation: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.enterHandler = () => {
            if (!this.isActive) return;
            this.handleEnter();
        };
        
        this.spaceHandler = () => {
            if (!this.isActive) return;
            this.handleSpace();
        };
        
        this.templateLoadedHandler = (templatePath) => {
            if (!this.isActive) return;
            if (templatePath.includes('presentation.html')) {
                this.injectPhraseIntoTemplate();
            }
        };
        
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 Presentation: Starting phase with data:', data);
        this.isActive = true;
        this.phraseTarget = data.phraseTarget;
        
        // Re-establish event listeners to ensure they work
        this.setupEventListeners();
        
        // Handle template reuse - inject phrase after DOM is ready
        setTimeout(() => {
            this.injectPhraseIntoTemplate();
        }, 100);
        
        console.log('🎯 Presentation: Phase activated');
    }
    
    // Inject phrase into template
    injectPhraseIntoTemplate() {
        console.log('🎯 Presentation: Injecting phrase into template');
        
        if (!this.phraseTarget) {
            console.log('🎯 Presentation: No phrase data yet, waiting...');
            return;
        }
        
        const phraseElement = document.querySelector('.phrase-text');
        if (phraseElement) {
            phraseElement.textContent = this.phraseTarget;
            console.log('🎯 Presentation: Phrase injected:', this.phraseTarget);
        } else {
            console.error('🎯 Presentation: .phrase-text element not found');
        }
    }
    
    // Handle Enter key (skip to solution)
    handleEnter() {
        console.log('🎯 Presentation: Enter pressed - skipping to solution');
        this.complete('skipToSolution');
    }
    
    // Handle Space key (proceed to revision/retrieval)
    handleSpace() {
        console.log('🎯 Presentation: Space pressed - proceeding to revision');
        this.complete('proceedToRevision');
    }
    
    // Complete this phase
    complete(result) {
        console.log('🎯 Presentation: Completing with result:', result);
        this.isActive = false;
        
        if (result === 'skipToSolution') {
            this.eventBus.emit('presentation:skipToSolution');
        } else {
            this.eventBus.emit('presentation:proceedToRevision');
        }
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 Presentation: Cleaning up...');
        this.isActive = false;
        
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        
        console.log('✅ Presentation: Cleanup complete');
    }
}