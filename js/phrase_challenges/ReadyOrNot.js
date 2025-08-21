// js/phrase_challenges/ReadyOrNot.js
class ReadyOrNot {
    constructor(eventBus) {
        console.log('🎯 ReadyOrNot: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ ReadyOrNot: Initialization complete');
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
            if (templatePath.includes('post-revision.html')) {
                console.log('🎯 ReadyOrNot: Post-revision template ready');
            }
        };
        
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 ReadyOrNot: Starting phase');
        this.isActive = false; // Don't activate immediately
        
        // Re-establish event listeners to ensure they work
        this.setupEventListeners();
        
        // Activate after a short delay to avoid leftover events
        setTimeout(() => {
            this.isActive = true;
            console.log('🎯 ReadyOrNot: Phase activated after delay');
        }, 100);
    }
    
    // Handle Enter key (proceed to solution)
    handleEnter() {
        console.log('🎯 ReadyOrNot: Enter pressed - proceeding to solution');
        this.complete('proceedToSolution');
    }
    
    // Handle Space key (return to revision)
    handleSpace() {
        console.log('🎯 ReadyOrNot: Space pressed - returning to revision');
        this.complete('returnToRevision');
    }
    
    // Complete this phase
    complete(result) {
        console.log('🎯 ReadyOrNot: Completing with result:', result);
        this.isActive = false;
        
        if (result === 'proceedToSolution') {
            this.eventBus.emit('readyOrNot:proceedToSolution');
        } else {
            this.eventBus.emit('readyOrNot:returnToRevision');
        }
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 ReadyOrNot: Cleaning up...');
        this.isActive = false;
        
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        
        console.log('✅ ReadyOrNot: Cleanup complete');
    }
}