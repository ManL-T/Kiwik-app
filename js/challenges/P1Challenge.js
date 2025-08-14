// P1Challenge - handles all logic for phrase navigation challenge
class P1Challenge {
    constructor(eventBus, uiRenderer) {
        console.log('🎯 P1Challenge: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        
        // Challenge data
        this.fullSentence = "Je l'aperçois entrer dans le café";
        this.states = [
            { unitTarget: "Je l'aperçois", translations: ["I spot him/her", "I notice him/her", "I see him/her"] },
            { unitTarget: "entrer", translations: ["go in", "walk in", "going into"] },
            { unitTarget: "dans", translations: ["in", "inside", "within"] },
            { unitTarget: "le café", translations: ["the coffee shop", "the coffeehouse", "the café"] }
        ];
        
        // Navigation state
        this.currentState = 0;
        
        // Event handler reference for cleanup
        this.spacebarHandler = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ P1Challenge: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('challenge:start', () => {
            this.start();
        });
    }
    
    // Start the challenge
    start() {
        console.log('🎯 P1Challenge: Starting challenge...');
        this.setupChallengeEventHandlers();
        this.updateGameContent();
    }
    
    // Setup challenge-specific event handling
    setupChallengeEventHandlers() {
        this.spacebarHandler = (event) => {
            if (event.key === ' ') {
                event.preventDefault();
                this.nextState();
            }
        };
        
        document.addEventListener('keydown', this.spacebarHandler);
    }
    
    // Challenge logic
    nextState() {
        this.currentState = (this.currentState + 1) % this.states.length;
        this.updateGameContent();
    }
    
    updateGameContent() {
        this.updateHighlightedText();
        this.updateTranslations();
    }
    
    updateHighlightedText() {
        const currentUnitTarget = this.states[this.currentState].unitTarget;
        this.uiRenderer.updateHighlightedText(this.fullSentence, currentUnitTarget);
    }
    
    updateTranslations() {
        const translations = this.states[this.currentState].translations;
        this.uiRenderer.updateTranslations(translations);
    }
    
    // Cleanup method for when challenge ends
    cleanup() {
        if (this.spacebarHandler) {
            document.removeEventListener('keydown', this.spacebarHandler);
            this.spacebarHandler = null;
        }
    }
}