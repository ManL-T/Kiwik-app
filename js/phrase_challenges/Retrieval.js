// js/phrase_challenges/Retrieval.js
class Retrieval {
    constructor(eventBus) {
        console.log('🎯 Retrieval: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        this.currentUnit = 0;
        this.semanticUnits = [];
        this.translationsVisible = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Retrieval: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.spaceHandler = () => {
            if (!this.isActive) return;
            this.handleSpace();
        };
        
        this.enterHandler = () => {
            if (!this.isActive) return;
            this.handleEnter();
        };
        
        this.timerExpiredHandler = () => {
            if (!this.isActive) return;
            this.handleTimerExpired();
        };
        
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('timer:expired', this.timerExpiredHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 Retrieval: Starting phase with data:', data);
        this.isActive = true;
        this.currentUnit = 0;
        this.semanticUnits = data.semanticUnits || [];
        this.translationsVisible = false;
        
        // Start timer for retrieval phase
        console.log('🎯 Retrieval: Starting timer');
        this.eventBus.emit('timer:start');
        
        // TODO: Load template and display first semantic unit (translations hidden)
        console.log('🎯 Retrieval: Phase activated with', this.semanticUnits.length, 'units');
    }
    
    // Handle Space key (hide translations and advance to next unit)
    handleSpace() {
        console.log('🎯 Retrieval: Space pressed - hiding translations and advancing');
        this.translationsVisible = false;
        this.currentUnit++;
        
        if (this.currentUnit >= this.semanticUnits.length) {
            console.log('🎯 Retrieval: All units completed');
            this.complete();
        } else {
            console.log('🎯 Retrieval: Showing unit', this.currentUnit, 'of', this.semanticUnits.length, '(translations hidden)');
            // TODO: Display next semantic unit with translations hidden
        }
    }
    
    // Handle Enter key (reveal translations for current unit)
    handleEnter() {
        console.log('🎯 Retrieval: Enter pressed - revealing translations');
        this.translationsVisible = true;
        // TODO: Show translations for current unit
        // TODO: Implement timer penalty (reduce by 3 seconds)
    }
    
    // Handle timer expiration
    handleTimerExpired() {
        console.log('🎯 Retrieval: Timer expired during retrieval phase');
        this.complete();
    }
    
    // Complete this phase
    complete() {
        console.log('🎯 Retrieval: Completing retrieval phase');
        this.isActive = false;
        
        // Stop timer
        console.log('🎯 Retrieval: Stopping timer');
        this.eventBus.emit('timer:stop');
        
        this.eventBus.emit('retrieval:completed');
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 Retrieval: Cleaning up...');
        this.isActive = false;
        
        // Stop timer if still running
        this.eventBus.emit('timer:stop');
        
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('timer:expired', this.timerExpiredHandler);
        
        console.log('✅ Retrieval: Cleanup complete');
    }
}