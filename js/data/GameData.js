// js/data/GameData.js
class GameData {
    constructor(eventBus) {
        console.log('📚 GameData: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Data storage
        this.data = null;

        // Setup event listeners
        this.setupEventListeners();
        
        // Load game data immediately
        this.loadSongData('la_fievre_beginner');
        
        console.log('✅ GameData: Initialization complete');
    }

    setupEventListeners() {
        this.eventBus.on('gameData:requestPhraseData', (phraseId) => {
            this.providePhraseData(phraseId);
        });
    }
    
    // Load JSON file
    async loadSongData(songId) {
        try {
            console.log(`📚 GameData: Loading ${songId}...`);
            const response = await fetch(`data/lessons/french/${songId}.json`);
            this.data = await response.json();
            console.log(`✅ GameData: ${songId} loaded successfully`);
            
            // Notify other modules that data is ready
            this.eventBus.emit('gameData:loaded', this.data.projectMetadata);
        } catch (error) {
            console.error('❌ GameData: Error loading song data:', error);
        }
    }

    providePhraseData(phraseId) {
        console.log('📚 GameData: Providing data for phrase:', phraseId);
        
        if (!this.data) {
            console.error('❌ GameData: Data not loaded yet, cannot provide phrase data');
            return;
        }
        
        const phrase = this.data.phrases.find(p => p.phraseId === phraseId);
        if (phrase) {
            console.log('✅ GameData: Found phrase data:', phrase.phraseTarget);
            this.eventBus.emit('gameData:phraseDataReady', phrase);
        } else {
            console.error('❌ GameData: Phrase not found:', phraseId);
        }
    }
    
    // Helper Methods - Navigate the data structure
    
    getTextById(textId) {
        if (!this.data) return null;
        return this.data.texts.find(text => text.textId === textId);
    }
    
    getPhrasesForText(textId) {
        if (!this.data) return [];
        return this.data.phrases.filter(phrase => phrase.phraseId.startsWith(textId));
    }
    
    getUnitsForPhrase(phraseId) {
        if (!this.data) return [];
        const phrase = this.data.phrases.find(p => p.phraseId === phraseId);
        return phrase ? phrase.semanticUnits : [];
    }
    
    getChallengeForUnit(unitId) {
        if (!this.data) return null;
        return this.data.unitsChallenge.find(challenge => challenge.unitId === unitId);
    }
    
    getSolutionForPhrase(phraseId) {
        if (!this.data) return null;
        return this.data.solutions.find(solution => solution.phraseId === phraseId);
    }
    
    // Get all texts (for text selection)
    getAllTexts() {
        if (!this.data) return [];
        return this.data.texts;
    }
    
    // Get project metadata
    getProjectMetadata() {
        if (!this.data) return null;
        return this.data.projectMetadata;
    }
}