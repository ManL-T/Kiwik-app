// js/managers/ChallengeManager.js
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData) {
        console.log('🎯 ChallengeManager: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        
        // Sequence tracking
        this.currentTextIndex = 0;
        this.currentPhraseIndex = 0;
        this.currentChallenge = null;
        this.sequenceData = []; // Will be populated by buildSequenceFromData()
        this.isShowingTextCover = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ ChallengeManager: Initialization complete');
    }

    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('challenge:complete', () => {
            this.handleChallengeComplete();
        });
        
        this.eventBus.on('gameData:loaded', () => {
            this.buildSequenceFromData();
        });
        
        // Add spacebar handling for text-cover phase
        this.eventBus.on('navigation:spacePressed', () => {
            if (this.isShowingTextCover) {
                this.handleTextCoverSpacebar();
            }
        });
    }
    
    // Build the challenge sequence from available data
    buildSequenceFromData() {
        console.log('🎯 ChallengeManager: Building sequence from GameData...');
        
        // Get all available texts
        const allTexts = this.gameData.getAllTexts();
        
        // Sort texts by numeric order (text_1, text_2, text_3, etc.)
        allTexts.sort((a, b) => {
            const numA = parseInt(a.textId.split('_')[1]);
            const numB = parseInt(b.textId.split('_')[1]);
            return numA - numB;
        });
        
        console.log('🎯 ChallengeManager: Found texts:', allTexts.length);
        
        // Build sequence data dynamically
        this.sequenceData = [];
        
        allTexts.forEach(text => {
            console.log(`🎯 ChallengeManager: Text ${text.textId}:`, text.title);
            const phrases = this.gameData.getPhrasesForText(text.textId);
            console.log(`🎯 ChallengeManager: - ${phrases.length} phrases available`);
            
            // Extract phrase IDs for this text
            const phraseIds = phrases.map(phrase => phrase.phraseId);
            this.sequenceData.push(phraseIds);
            
            phrases.forEach(phrase => {
                console.log(`🎯 ChallengeManager:   - ${phrase.phraseId}: ${phrase.phraseTarget}`);
            });
        });
        
        console.log('🎯 ChallengeManager: Sequence data built:', this.sequenceData.length, 'texts');
    }
    
    
    // Handle challenge completion
    handleChallengeComplete() {
        console.log('🎯 ChallengeManager: Challenge completed!');
        
        // Move to next phrase
        this.currentPhraseIndex++;
        console.log('🎯 ChallengeManager: Advanced to phrase index:', this.currentPhraseIndex);
        
        // Check if there's a next phrase in current text
        let nextPhraseId = this.getCurrentPhraseId();
        
        // If no more phrases in current text, try next text
        if (!nextPhraseId) {
            console.log('🎯 ChallengeManager: No more phrases in current text, checking next text...');
            this.currentTextIndex++;
            this.currentPhraseIndex = 0;
            console.log('🎯 ChallengeManager: Advanced to text index:', this.currentTextIndex);
            
            nextPhraseId = this.getCurrentPhraseId();
        }
        
        if (nextPhraseId) {
            console.log('🎯 ChallengeManager: Next phrase available:', nextPhraseId);
            this.createChallenge();
        } else {
            console.log('🎯 ChallengeManager: No more phrases available - session complete');
        }
    }


    createChallenge() {
        // Clean up previous challenge if it exists
        if (this.currentChallenge && this.currentChallenge.cleanup) {
            this.currentChallenge.cleanup();
        }
        
        // Get current phrase ID
        const phraseId = this.getCurrentPhraseId();
        
        // show text cover if first phrase of a (new) text
        if (this.currentPhraseIndex === 0) {
            this.showTextCover(phraseId);
        } else {
            // Create new challenge
            this.currentChallenge = new P1Challenge(this.eventBus, this.uiRenderer, phraseId);
            this.eventBus.emit('challenge:start');
        }
    }

    showTextCover(phraseId) {
        console.log('🎯 ChallengeManager: Showing text cover for phrase:', phraseId);
        
        this.isShowingTextCover = true;
        
        // Extract textId from phraseId (e.g., "text_1_p1" → "text_1")
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        this.eventBus.emit('ui:loadTextCover', textId);
    }

    handleTextCoverSpacebar() {
        console.log('🎯 ChallengeManager: Text cover spacebar pressed, proceeding to challenge');
        
        this.isShowingTextCover = false;
        
        // Get current phrase ID and create challenge
        const phraseId = this.getCurrentPhraseId();
        this.currentChallenge = new P1Challenge(this.eventBus, this.uiRenderer, phraseId);
        this.eventBus.emit('challenge:start');
    }

    
    // Get current phrase ID based on sequence position
    getCurrentPhraseId() {
        // Check if sequence data is available
        if (!this.sequenceData.length) {
            console.log('🎯 ChallengeManager: No sequence data available yet');
            return null;
        }
        
        // Check if current text index is valid
        if (this.currentTextIndex >= this.sequenceData.length) {
            console.log('🎯 ChallengeManager: No more texts available');
            return null; // No more texts available
        }
        
        const currentTextPhrases = this.sequenceData[this.currentTextIndex];
        
        // Check if current phrase index is valid for this text
        if (this.currentPhraseIndex >= currentTextPhrases.length) {
            console.log('🎯 ChallengeManager: No more phrases in current text');
            return null; // No more phrases in current text
        }
        
        return currentTextPhrases[this.currentPhraseIndex];
    }

     // Clean up current challenge (called during game over)
    cleanupCurrentChallenge() {
        console.log('🎯 ChallengeManager: Cleaning up current challenge for game over');
        
        if (this.currentChallenge && this.currentChallenge.cleanup) {
            console.log('🎯 ChallengeManager: Calling cleanup on active challenge');
            this.currentChallenge.cleanup();
            this.currentChallenge = null;
        } else {
            console.log('🎯 ChallengeManager: No active challenge to clean up');
        }
    }
}