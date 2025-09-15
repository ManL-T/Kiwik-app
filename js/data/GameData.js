// js/data/GameData.js
class GameData {
    constructor(eventBus) {
        console.log('📚 GameData: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Data storage
        this.data = null;

        // Setup event listeners
        this.setupEventListeners('selectedSong');
        

        // Load selected song data
        const selectedSong = localStorage.getItem('selectedSong');
        if (!selectedSong) {
            console.error('❌ GameData: No song selected - system flaw detected');
            return;
        }
        console.log('📚 GameData: Loading selected song:', selectedSong);
        this.initializeAsync(selectedSong);

        
        console.log('✅ GameData: Initialization complete');
    }

    setupEventListeners() {
        this.eventBus.on('gameData:requestPhraseData', (phraseId) => {
            this.providePhraseData(phraseId);
        });
    }

    async initializeAsync(selectedSong) {
        await this.loadSongData(selectedSong);
        localStorage.removeItem('selectedSong');  // Only remove after loading completes
        console.log('✅ GameData: Initialization complete');
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
        console.log('📚 GameData: Providing complete challenge data for phrase:', phraseId);
        
        if (!this.data) {
            console.error('❌ GameData: Data not loaded yet, cannot provide phrase data');
            return;
        }
        
        // Find phrase data
        const phrase = this.data.phrases.find(p => p.phraseId === phraseId);
        if (!phrase) {
            console.error('❌ GameData: Phrase not found:', phraseId);
            return;
        }

        // Find solution data
        const solution = this.data.solutions.find(s => s.phraseId === phraseId);
        if (!solution) {
            console.error('❌ GameData: Solution not found for phrase:', phraseId);
            return;
        }

        // Combine into flat object
        const challengeData = {
            phraseId: phrase.phraseId,
            phraseTarget: phrase.phraseTarget,
            semanticUnits: phrase.semanticUnits,
            primaryTranslation: solution.primaryTranslation,
            alternatives: solution.alternatives,
            distractors: solution.distractors,
            targetDistractors: phrase.targetDistractors
        };

        console.log('✅ GameData: Found complete challenge data for:', phrase.phraseTarget);
        console.log('📚 GameData: Solution data included:', solution.primaryTranslation);
        
        this.eventBus.emit('gameData:phraseDataReady', challengeData);
    }
    
    // Helper Methods - Navigate the data structure
    
    getTextById(textId) {
        if (!this.data) return null;
        return this.data.texts.find(text => text.textId === textId);
    }
    
    getPhrasesForText(textId) {
        if (!this.data) return [];
        return this.data.phrases.filter(phrase => {
            // Extract the text part from phraseId (e.g., "text_1_p1" -> "text_1")
            const phraseTextId = phrase.phraseId.substring(0, phrase.phraseId.lastIndexOf('_'));
            return phraseTextId === textId;
        });
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