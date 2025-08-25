// js/managers/UserProgress.js - Clean Implementation
class UserProgress {
    constructor(eventBus, gameData) {
        console.log('📊 UserProgress: Initializing clean implementation...');
        
        // Store references
        this.eventBus = eventBus;
        this.gameData = gameData;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';
        
        // Data structure
        this.data = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load or initialize progress
        this.loadUserProgress();
        
        console.log('✅ UserProgress: Clean implementation complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        console.log('📊 UserProgress: Setting up event listeners...');
        
        // Wait for GameData to load before initializing phrases
        this.eventBus.on('gameData:loaded', () => {
            console.log('📊 UserProgress: GameData loaded, initializing phrase progress...');
            this.initializePhraseProgress();
        });
        
        // Handle game start
        this.eventBus.on('userProgress:gameStarted', () => {
            console.log('📊 UserProgress: Game started');
            // Could create new session here if needed
        });
        
        // Handle progress updates
        this.eventBus.on('userProgress:updatePhrase', (data) => {
            this.updatePhraseProgress(data);
        });
        
        // Handle saving
        this.eventBus.on('userProgress:saveProgress', () => {
            this.saveUserProgress();
        });
    }
    
    // Load progress from localStorage or create default
    loadUserProgress() {
        console.log('📊 UserProgress: Loading user progress from localStorage...');
        
        try {
            const stored = localStorage.getItem(this.storageKey);
            console.log('📊 UserProgress: Raw localStorage data:', stored);
            
            if (stored) {
                const parsedData = JSON.parse(stored);
                console.log('📊 UserProgress: Parsed localStorage data:', parsedData);
                
                // Validate structure
                if (this.isValidProgressData(parsedData)) {
                    this.data = parsedData;
                    console.log('✅ UserProgress: Loaded existing valid progress data');
                } else {
                    console.log('⚠️ UserProgress: Invalid data structure, creating fresh data');
                    this.createFreshProgressData();
                }
            } else {
                console.log('📊 UserProgress: No existing data, creating fresh data');
                this.createFreshProgressData();
            }
            
            console.log('📊 UserProgress: Final data structure:', this.data);
            
        } catch (error) {
            console.error('❌ UserProgress: Error loading progress:', error);
            this.createFreshProgressData();
        }
    }
    
    // Validate progress data structure
    isValidProgressData(data) {
        console.log('📊 UserProgress: Validating data structure...');
        
        const isValid = data && 
                       typeof data.gamesPlayed === 'number' &&
                       data.currentPosition &&
                       data.currentPosition.batch &&
                       data.currentPosition.level &&
                       data.phraseProgress &&
                       typeof data.phraseProgress === 'object';
                       
        console.log('📊 UserProgress: Data validation result:', isValid);
        return isValid;
    }
    
    // Create fresh progress data structure
    createFreshProgressData() {
        console.log('📊 UserProgress: Creating fresh progress data structure...');
        
        this.data = {
            gamesPlayed: 0,
            currentPosition: {
                batch: [1, 2],
                level: "LEVEL_1",
                lastUpdated: new Date().toISOString()
            },
            phraseProgress: {}, // Will be populated when GameData loads
            sessions: [] // Keep for historical tracking
        };
        
        console.log('📊 UserProgress: Fresh data created:', this.data);
    }
    
    // Initialize phrase progress from GameData (upfront approach)
    initializePhraseProgress() {
        console.log('📊 UserProgress: Initializing phrase progress upfront...');
        
        if (!this.gameData || !this.gameData.data) {
            console.error('❌ UserProgress: GameData not available for phrase initialization');
            return;
        }
        
        const phrases = this.gameData.data.phrases;
        console.log('📊 UserProgress: Found', phrases.length, 'phrases to initialize');
        
        let newPhrasesCount = 0;
        phrases.forEach(phrase => {
            if (!this.data.phraseProgress[phrase.phraseId]) {
                this.data.phraseProgress[phrase.phraseId] = {
                    level: 1, // All phrases start at LEVEL_1
                    attempts: []
                };
                newPhrasesCount++;
            }
        });
        
        console.log('📊 UserProgress: Initialized', newPhrasesCount, 'new phrases');
        console.log('📊 UserProgress: Total phrases in progress:', Object.keys(this.data.phraseProgress).length);
        console.log('📊 UserProgress: Complete phraseProgress structure:', this.data.phraseProgress);
        
        // Save after initialization
        this.saveUserProgress();
    }
    
    // Get resume position for ChallengeManager
    getResumePosition() {
        console.log('📊 UserProgress: Getting resume position...');
        
        if (!this.data || !this.data.currentPosition) {
            console.log('📊 UserProgress: No position data, returning default');
            return { batch: [1, 2], level: "LEVEL_1" };
        }
        
        const position = {
            batch: this.data.currentPosition.batch,
            level: this.data.currentPosition.level
        };
        
        console.log('📊 UserProgress: Returning resume position:', position);
        return position;
    }
    
    // Update phrase progress
    updatePhraseProgress(data) {
        console.log('📊 UserProgress: Updating phrase progress for:', data.phraseId);
        console.log('📊 UserProgress: Update data:', data);
        
        if (!this.data.phraseProgress[data.phraseId]) {
            console.log('📊 UserProgress: Phrase not found, creating new entry');
            this.data.phraseProgress[data.phraseId] = {
                level: 1,
                attempts: []
            };
        }
        
        const phrase = this.data.phraseProgress[data.phraseId];
        
        // Add new attempt
        const attempt = {
            timestamp: new Date().toISOString(),
            skipped: data.skipped || false,
            incorrectCount: data.incorrectCount || 0,
            peeked: data.peeked || false,
            peekedUnits: data.peekedUnits || [],
            correctAnswer: data.correctAnswer || false
        };
        
        phrase.attempts.push(attempt);
        console.log('📊 UserProgress: Added attempt:', attempt);
        console.log('📊 UserProgress: Updated phrase data:', phrase);
        
        // TODO: Add skip detection logic here
        // TODO: Add level advancement logic here
    }
    
    // Update current position (called after batch completion)
    updateCurrentPosition(batch, level) {
        console.log('📊 UserProgress: Updating current position to batch:', batch, 'level:', level);
        
        this.data.currentPosition = {
            batch: batch,
            level: level,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('📊 UserProgress: Updated position:', this.data.currentPosition);
        this.saveUserProgress();
    }
    
    // Save progress to localStorage
    saveUserProgress() {
        console.log('📊 UserProgress: Saving progress to localStorage...');
        console.log('📊 UserProgress: Data to save:', this.data);
        
        try {
            const jsonString = JSON.stringify(this.data, null, 2);
            localStorage.setItem(this.storageKey, jsonString);
            console.log('✅ UserProgress: Successfully saved to localStorage');
            console.log('📊 UserProgress: Saved JSON:', jsonString);
        } catch (error) {
            console.error('❌ UserProgress: Error saving progress:', error);
        }
    }
    
    // Debug method - clear all progress
    clearProgress() {
        console.log('🧹 UserProgress: Clearing all progress data...');
        localStorage.removeItem(this.storageKey);
        this.createFreshProgressData();
        console.log('✅ UserProgress: Progress cleared, fresh data created');
        
        // Re-initialize phrase progress if GameData is available
        if (this.gameData && this.gameData.data) {
            console.log('🧹 UserProgress: Re-initializing phrase progress after clear...');
            this.initializePhraseProgress();
        }
    }
    
    // Get current data (for debugging)
    getCurrentData() {
        return this.data;
    }
}