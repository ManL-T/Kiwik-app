// js/managers/UserProgress.js - Phase 1: Add New Systems
class UserProgress {
    constructor(eventBus, gameData) {
        console.log(`📊 UserProgress: [${new Date().toISOString()}] Initializing with batch cycling support...`);
        
        // Store references
        this.eventBus = eventBus;
        this.gameData = gameData;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';
        
        // Data structure
        this.data = null;
        
        // Ready state
        this.isReady = false;

        // Session tracking for current gameplay session
        this.currentSession = {
            phraseAttempts: {} // Tracks current session data per phrase
        };
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load or initialize progress
        this.loadUserProgress();
        
        // Mark as ready and emit event (following project pattern)
        this.isReady = true;
        this.eventBus.emit('userProgress:ready');
        
        console.log(`✅ UserProgress: [${new Date().toISOString()}] Batch cycling support complete and ready`);
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

        // Track skipped phrases
        this.eventBus.on('userProgress:phraseSkipped', (phraseId) => {
            try {
                console.log(`📊 UserProgress: RECEIVED userProgress:phraseSkipped with phraseId: ${phraseId}`);
                this.initSessionPhrase(phraseId);
                this.currentSession.phraseAttempts[phraseId].skipped = true;
                console.log(`📊 UserProgress: Tracked skip for ${phraseId}`);
            } catch (error) {
                console.error('📊 UserProgress: ERROR in skipToSolution handler:', error);
            }
        });

        // Track incorrect attempts  
        this.eventBus.on('challenge:wrongAnswer', (phraseId) => {
            console.log(`📊 UserProgress: RECEIVED challenge:wrongAnswer with phraseId: ${phraseId}`);
            this.initSessionPhrase(phraseId);
            this.currentSession.phraseAttempts[phraseId].incorrectCount++;
            console.log(`📊 UserProgress: Tracked incorrect attempt for ${phraseId}, total: ${this.currentSession.phraseAttempts[phraseId].incorrectCount}`);
        });

        // Track correct answers and check completion/mastery  
        this.eventBus.on('userProgress:correctAnswer', (phraseId) => {
            console.log(`📊 UserProgress: RECEIVED userProgress:correctAnswer with phraseId: ${phraseId}`);
            this.initSessionPhrase(phraseId);
            this.currentSession.phraseAttempts[phraseId].correct = true;
            console.log(`📊 UserProgress: Tracked correct answer for ${phraseId}`);
            
            // Check for phrase completion/mastery
            this.checkPhraseCompletionAndMastery(phraseId);
        });
                
        // Handle saving
        this.eventBus.on('userProgress:saveProgress', () => {
            this.saveUserProgress();
        });

        this.eventBus.on('userProgress:displayData', () => {
            this.displayProgressData();
        });

        // handle userprogress display in load-game screen
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            if (templatePath && templatePath.includes('load-game.html')) {
                console.log('📊 UserProgress: Load game template detected - injecting progress display');
                setTimeout(() => {
                    this.injectProgressDisplay();
                }, 100); // Small delay to ensure DOM is ready
            }
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
                    
                    // NEW: Initialize new systems if missing
                    this.initializeNewSystems();
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
    
    // NEW: Initialize new systems if missing from existing data
    initializeNewSystems() {
        console.log('📊 UserProgress: Checking for new systems in existing data...');
        
        let needsSave = false;
        
        // Add text level tracking if missing
        if (!this.data.textLevels) {
            console.log('📊 UserProgress: Adding textLevels system to existing data');
            this.data.textLevels = {};
            needsSave = true;
        }
        
        // Add batch cycling if missing OR if batch structure exists but cycling is null
        if (!this.data.batchCycling) {
            console.log('📊 UserProgress: Adding batchCycling system to existing data');
            
            if (this.data.batchStructure && this.data.batchStructure.length > 0) {
                console.log('📊 UserProgress: Found existing batch structure, initializing cycling');
                this.initializeBatchCycling(this.data.batchStructure);
            } else {
                console.log('📊 UserProgress: No batch structure available, cycling will be initialized later');
                this.data.batchCycling = {
                    allBatches: [],
                    currentBatchIndex: 0,
                    batchRunCounts: [],
                    cyclePhase: 'initial'
                };
            }
            needsSave = true;
        }
        
        if (needsSave) {
            console.log('📊 UserProgress: Saving updated data with new systems');
            this.saveUserProgress();
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
                       // Note: batchStructure, textLevels, and batchCycling are optional for migration
                       
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
            batchStructure: null, // Will be generated by ChallengeManager
            phraseProgress: {}, // Will be populated when GameData loads
            sessions: [], // Keep for historical tracking
            
            // NEW SYSTEMS:
            textLevels: {}, // "text_1": 1, "text_2": 2, etc.
            batchCycling: {
                allBatches: [],
                currentBatchIndex: 0,
                batchRunCounts: [],
                cyclePhase: 'initial' // 'initial' or 'maintenance'
            }
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
        let newTextsCount = 0;
        
        phrases.forEach(phrase => {
            // Initialize phrase progress if missing
            if (!this.data.phraseProgress[phrase.phraseId]) {
                this.data.phraseProgress[phrase.phraseId] = {
                    level: 1, // All phrases start at level 1
                    attempts: []
                };
                newPhrasesCount++;
            }
            
            // NEW: Initialize text levels if missing
            const textId = phrase.phraseId.substring(0, phrase.phraseId.lastIndexOf('_'));
            if (!this.data.textLevels[textId]) {
                this.data.textLevels[textId] = 1; // All texts start at level 1
                newTextsCount++;
            }
        });
        
        console.log('📊 UserProgress: Initialized', newPhrasesCount, 'new phrases');
        console.log('📊 UserProgress: Initialized', newTextsCount, 'new text levels');
        console.log('📊 UserProgress: Total phrases in progress:', Object.keys(this.data.phraseProgress).length);
        
        // Save after initialization
        this.saveUserProgress();
    }
    
    // NEW: Initialize batch cycling system
    initializeBatchCycling(batchStructure) {
        console.log('📊 UserProgress: Initializing batch cycling system...');
        console.log('📊 UserProgress: Batch structure:', batchStructure);
        
        this.data.batchCycling = {
            allBatches: [...batchStructure], // Clone the array
            currentBatchIndex: 0,
            batchRunCounts: new Array(batchStructure.length).fill(0),
            cyclePhase: 'initial'
        };
        
        console.log('📊 UserProgress: Batch cycling initialized:', this.data.batchCycling);
        this.saveUserProgress();
    }
    
    // NEW: Get current batch from cycling system
    getCurrentBatchFromCycling() {
        console.log('📊 UserProgress: Getting current batch from cycling system...');
        
        if (!this.data.batchCycling || !this.data.batchCycling.allBatches.length) {
            console.warn('📊 UserProgress: Batch cycling not initialized, falling back to currentPosition.batch');
            return this.data.currentPosition.batch;
        }
        
        const cycling = this.data.batchCycling;
        const currentBatch = cycling.allBatches[cycling.currentBatchIndex];
        
        console.log('📊 UserProgress: Current batch from cycling:', currentBatch);
        console.log('📊 UserProgress: Batch index:', cycling.currentBatchIndex);
        console.log('📊 UserProgress: Run counts:', cycling.batchRunCounts);
        console.log('📊 UserProgress: Cycle phase:', cycling.cyclePhase);
        
        return currentBatch;
    }
    
    // NEW: Advance to next batch in cycling system
    advanceToNextBatch() {
        console.log('📊 UserProgress: Advancing to next batch in cycling system...');
        
        const cycling = this.data.batchCycling;
        const currentRunCount = cycling.batchRunCounts[cycling.currentBatchIndex];
        
        console.log('📊 UserProgress: Current batch index:', cycling.currentBatchIndex);
        console.log('📊 UserProgress: Current run count:', currentRunCount);
        console.log('📊 UserProgress: Cycle phase:', cycling.cyclePhase);
        
        if (cycling.cyclePhase === 'initial') {
            if (currentRunCount < 2) {
                // Stay on current batch, increment run count
                cycling.batchRunCounts[cycling.currentBatchIndex]++;
                console.log('📊 UserProgress: Staying on current batch, incremented run count to:', cycling.batchRunCounts[cycling.currentBatchIndex]);
            } else {
                // Move to next batch
                cycling.currentBatchIndex++;
                console.log('📊 UserProgress: Moving to next batch, index now:', cycling.currentBatchIndex);
                
                if (cycling.currentBatchIndex >= cycling.allBatches.length) {
                    // All batches run twice, switch to maintenance
                    console.log('📊 UserProgress: All batches completed twice, switching to maintenance phase');
                    cycling.cyclePhase = 'maintenance';
                    cycling.currentBatchIndex = 0;
                    // Reset run counts for maintenance phase
                    cycling.batchRunCounts = cycling.batchRunCounts.map(() => 0);
                }
                cycling.batchRunCounts[cycling.currentBatchIndex] = 1; // First run of this batch
            }
        } else {
            // Maintenance phase: cycle through once each
            cycling.currentBatchIndex = (cycling.currentBatchIndex + 1) % cycling.allBatches.length;
            console.log('📊 UserProgress: Maintenance phase - cycled to batch index:', cycling.currentBatchIndex);
        }
        
        const nextBatch = cycling.allBatches[cycling.currentBatchIndex];
        console.log('📊 UserProgress: Next batch:', nextBatch);
        
        // Update currentPosition for compatibility
        this.data.currentPosition.batch = nextBatch;
        this.data.currentPosition.lastUpdated = new Date().toISOString();
        
        this.saveUserProgress();
        return nextBatch;
    }
    
    // NEW: Check if current batch has any available (non-mastered) texts
    hasAvailableTextsInCurrentBatch() {
        const currentBatch = this.getCurrentBatchFromCycling();
        
        for (const textNum of currentBatch) {
            const textId = `text_${textNum}`;
            if (!this.isTextMastered(textId)) {
                return true;
            }
        }
        
        console.log('📊 UserProgress: Current batch has no available texts (all mastered)');
        return false;
    }
    
    // NEW: Skip empty batches and find next available batch
    findNextAvailableBatch() {
        console.log('📊 UserProgress: Finding next available batch...');
        
        let attempts = 0;
        const maxAttempts = this.data.batchCycling.allBatches.length + 1; // Prevent infinite loops
        
        while (!this.hasAvailableTextsInCurrentBatch() && attempts < maxAttempts) {
            console.log('📊 UserProgress: Current batch empty, advancing...');
            this.advanceToNextBatch();
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            console.warn('📊 UserProgress: All batches appear to be empty - game might be complete');
            return null;
        }
        
        return this.getCurrentBatchFromCycling();
    }

    // new logic 28th august 
    checkPhraseCompletionAndMastery(phraseId) {
        console.log(`📊 UserProgress: Checking completion and mastery for ${phraseId}`);
        
        const sessionData = this.currentSession.phraseAttempts[phraseId];
        if (!sessionData) {
            console.warn(`📊 UserProgress: No session data for ${phraseId}`);
            return;
        }
        
        console.log(`📊 UserProgress: Session data - skipped: ${sessionData.skipped}, correct: ${sessionData.correct}, incorrectCount: ${sessionData.incorrectCount}`);
        
        // Check for mastery first (skip + correct + no incorrect)
        if (sessionData.skipped && sessionData.correct && sessionData.incorrectCount === 0) {
            console.log(`🎉 UserProgress: Phrase ${phraseId} MASTERED! (skipped + correct + no incorrect)`);
            this.setPhraseLevel(phraseId, "mastered");
            this.saveSessionAttempt(phraseId);
            this.checkTextLevelProgression(phraseId);
            return;
        }
        
        // Check for normal completion (correct + no incorrect)
        if (sessionData.correct && sessionData.incorrectCount === 0) {
            console.log(`✅ UserProgress: Phrase ${phraseId} COMPLETED at current level`);
            this.advancePhraseLevel(phraseId);
            this.saveSessionAttempt(phraseId);
            this.checkTextLevelProgression(phraseId);
            return;
        }
        
        // Just save the attempt (not completed)
        console.log(`📊 UserProgress: Phrase ${phraseId} attempted but not completed`);
        this.saveSessionAttempt(phraseId);
    }


    // New method to advance phrase level (1→2→3→mastered)
    advancePhraseLevel(phraseId) {
        if (!this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        
        const currentLevel = this.data.phraseProgress[phraseId].level;
        console.log(`📊 UserProgress: Advancing ${phraseId} from level ${currentLevel}`);
        
        if (currentLevel === 1) {
            this.setPhraseLevel(phraseId, 2);
            console.log(`📊 UserProgress: ${phraseId} advanced to level 2`);
        } else if (currentLevel === 2) {
            this.setPhraseLevel(phraseId, 3);
            console.log(`📊 UserProgress: ${phraseId} advanced to level 3`);
        } else if (currentLevel === 3) {
            this.setPhraseLevel(phraseId, "mastered");
            console.log(`📊 UserProgress: ${phraseId} completed level 3 - now MASTERED!`);
        } else {
            console.warn(`📊 UserProgress: Cannot advance ${phraseId} from level ${currentLevel}`);
        }
    }

    // New method to set phrase level and save
    setPhraseLevel(phraseId, level) {
        if (!this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        
        const oldLevel = this.data.phraseProgress[phraseId].level;
        this.data.phraseProgress[phraseId].level = level;
        this.saveUserProgress();
        
        console.log(`📊 UserProgress: ${phraseId} level changed from ${oldLevel} to ${level}`);
    }

    // New method to check text level progression after phrase level changes
    checkTextLevelProgression(phraseId) {
        console.log(`📊 UserProgress: Checking text level progression for phrase: ${phraseId}`);
        
        // Extract textId from phraseId
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        console.log(`📊 UserProgress: Checking text: ${textId}`);
        
        // Get all phrases for this text
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        console.log(`📊 UserProgress: Found ${allPhrasesInText.length} phrases in ${textId}`);
        
        // Get current text level
        const currentTextLevel = this.getTextLevel(textId);
        console.log(`📊 UserProgress: Current text level: ${currentTextLevel}`);
        
        // Check if all non-mastered phrases are at the same level
        const phraseLevels = allPhrasesInText.map(phrase => {
            const phraseLevel = this.data.phraseProgress[phrase.phraseId]?.level || 1;
            console.log(`📊 UserProgress: Phrase ${phrase.phraseId} is at level ${phraseLevel}`);
            return phraseLevel;
        });
        
        // Filter out mastered phrases
        const nonMasteredLevels = phraseLevels.filter(level => level !== "mastered");
        console.log(`📊 UserProgress: Non-mastered phrase levels: [${nonMasteredLevels.join(', ')}]`);
        
        // Check if all non-mastered phrases are at the same level
        if (nonMasteredLevels.length === 0) {
            console.log(`🎉 UserProgress: Text ${textId} is fully MASTERED! All phrases mastered.`);
            this.eventBus.emit('userProgress:textMastered', textId);
            return;
        }
        
        // Check if all non-mastered phrases are at the same level
        const firstLevel = nonMasteredLevels[0];
        const allSameLevel = nonMasteredLevels.every(level => level === firstLevel);
        
        if (allSameLevel && firstLevel > currentTextLevel) {
            console.log(`🎉 UserProgress: Text ${textId} leveled up from ${currentTextLevel} to ${firstLevel}!`);
            this.setTextLevel(textId, firstLevel);
            this.eventBus.emit('userProgress:textLeveledUp', { textId, oldLevel: currentTextLevel, newLevel: firstLevel });
        } else if (allSameLevel) {
            console.log(`📊 UserProgress: Text ${textId} all phrases at level ${firstLevel}, text already at level ${currentTextLevel}`);
        } else {
            console.log(`📊 UserProgress: Text ${textId} phrases at mixed levels: [${nonMasteredLevels.join(', ')}]`);
        }
    }


    
    // NEW: Get current level for a specific text
    getTextLevel(textId) {
        if (!this.data.textLevels) {
            console.warn('📊 UserProgress: textLevels not initialized, returning default level 1');
            return 1;
        }
        
        return this.data.textLevels[textId] || 1;
    }
    
    // NEW: Set level for a specific text
    setTextLevel(textId, level) {
        console.log(`📊 UserProgress: Setting ${textId} to level ${level}`);
        
        if (!this.data.textLevels) {
            this.data.textLevels = {};
        }
        
        this.data.textLevels[textId] = level;
        this.saveUserProgress();
    }
    
    // NEW: Check if all phrases in a text are completed for current session
    isTextCompletedInCurrentSession(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is completed in current session...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        for (const phrase of allPhrasesInText) {
            const phraseId = phrase.phraseId;
            
            // Skip mastered phrases (they don't need to be completed again)
            if (this.isPhraseMastered(phraseId)) {
                continue;
            }
            
            // Check if phrase was completed in current session
            const sessionData = this.currentSession.phraseAttempts[phraseId];
            if (!sessionData || !sessionData.correct || sessionData.incorrectCount > 0) {
                console.log(`📊 UserProgress: ${phraseId} not completed in current session`);
                return false;
            }
        }
        
        console.log(`📊 UserProgress: ${textId} is completed in current session`);
        return true;
    }
    
    // NEW: Check if text is fully mastered (all phrases mastered)
    isTextMastered(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is mastered...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        const allMastered = allPhrasesInText.every(phrase => {
            return this.isPhraseMastered(phrase.phraseId);
        });
        
        console.log(`📊 UserProgress: ${textId} mastery status: ${allMastered}`);
        return allMastered;
    }
    
    // Get batch structure
    getBatchStructure() {
        console.log('📊 UserProgress: Getting batch structure...');
        
        if (!this.data || !this.data.batchStructure) {
            console.log('📊 UserProgress: No batch structure found');
            return null;
        }
        
        console.log('📊 UserProgress: Returning batch structure:', this.data.batchStructure);
        return this.data.batchStructure;
    }
    
    // Set batch structure (called by ChallengeManager when first generated)
    setBatchStructure(batchStructure) {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] setBatchStructure called with:`, batchStructure);
        
        if (!this.data) {
            console.error(`❌ UserProgress: [${timestamp}] CRITICAL ERROR - No data structure to update!`);
            return false;
        }
        
        if (!this.isReady) {
            console.error(`❌ UserProgress: [${timestamp}] CRITICAL ERROR - UserProgress not ready when setBatchStructure called!`);
            return false;
        }
        
        console.log(`📊 UserProgress: [${timestamp}] Data structure exists, proceeding with batch structure save...`);
        console.log(`📊 UserProgress: [${timestamp}] Current data.batchStructure before update:`, this.data.batchStructure);
        
        this.data.batchStructure = batchStructure;
        
        console.log(`📊 UserProgress: [${timestamp}] Batch structure assigned to data.batchStructure:`, this.data.batchStructure);
        
        // ALWAYS initialize batch cycling when batch structure is set
        console.log(`📊 UserProgress: [${timestamp}] Initializing batch cycling system...`);
        this.initializeBatchCycling(batchStructure);
        
        // Save immediately after setting batch structure
        console.log(`📊 UserProgress: [${timestamp}] About to save to localStorage...`);
        const saveResult = this.saveUserProgress();
        
        if (!saveResult) {
            console.error(`❌ UserProgress: [${timestamp}] Save failed after setBatchStructure!`);
            return false;
        }
        
        console.log(`✅ UserProgress: [${timestamp}] setBatchStructure completed successfully`);
        return true;
    }
    
    // Validation method
    validateBatchStructureSave(expectedBatchStructure, timestamp) {
        console.log(`📊 UserProgress: [${timestamp}] Starting validation...`);
        
        // Get what was actually saved
        const savedBatchStructure = this.getBatchStructure();
        
        console.log(`📊 UserProgress: [${timestamp}] Expected:`, expectedBatchStructure);
        console.log(`📊 UserProgress: [${timestamp}] Actually saved:`, savedBatchStructure);
        
        // Check if savedBatchStructure is null
        if (!savedBatchStructure) {
            return {
                success: false,
                error: 'getBatchStructure returned null after save',
                details: {
                    expected: expectedBatchStructure,
                    actual: savedBatchStructure,
                    dataStructure: this.data,
                    localStorage: localStorage.getItem(this.storageKey)
                }
            };
        }
        
        // Deep comparison
        const expectedStr = JSON.stringify(expectedBatchStructure);
        const actualStr = JSON.stringify(savedBatchStructure);
        
        if (expectedStr !== actualStr) {
            return {
                success: false,
                error: 'Saved batch structure differs from expected',
                details: {
                    expected: expectedBatchStructure,
                    actual: savedBatchStructure,
                    expectedStr,
                    actualStr
                }
            };
        }
        
        console.log(`✅ UserProgress: [${timestamp}] Validation successful - structures match`);
        return { success: true };
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

        if (data.level === "mastered") {
            phrase.level = "mastered";
        }
        
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

    // Save current session attempt to phraseProgress (called after each challenge)
    saveSessionAttempt(phraseId) {
        const sessionData = this.currentSession.phraseAttempts[phraseId];
        if (!sessionData) {
            console.log(`📊 UserProgress: No session data to save for ${phraseId}`);
            return;
        }
        
        // Create attempt record from session data
        const attempt = {
            timestamp: new Date().toISOString(),
            skipped: sessionData.skipped,
            incorrectCount: sessionData.incorrectCount,
            peeked: false, // TODO: Will need this for LEVEL_2 retrieval phase
            peekedUnits: [], // TODO: Will need this for LEVEL_2 retrieval phase  
            correctAnswer: sessionData.correct
        };
        
        // Add to phraseProgress attempts
        if (!this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        
        this.data.phraseProgress[phraseId].attempts.push(attempt);
        
        // Save to localStorage
        this.saveUserProgress();
        
        console.log(`📊 UserProgress: Saved session attempt for ${phraseId}:`, attempt);
    }


    // Initialize session tracking for a phrase if not exists
    initSessionPhrase(phraseId) {
        if (!this.currentSession.phraseAttempts[phraseId]) {
            this.currentSession.phraseAttempts[phraseId] = {
                skipped: false,
                correct: false,
                incorrectCount: 0
            };
        }
    }

    // Check mastery condition and update if mastered
    checkAndProcessMastery(phraseId) {
        const attempt = this.currentSession.phraseAttempts[phraseId];
        
        // Always save the session attempt first
        this.saveSessionAttempt(phraseId);
        
        // Then check for mastery
        if (attempt.skipped && attempt.correct && attempt.incorrectCount === 0) {
            // Mark as mastered
            this.data.phraseProgress[phraseId].level = "mastered";
            console.log(`📊 UserProgress: Phrase mastered: ${phraseId}`);
            
            
            // Save again with mastery status
            this.saveUserProgress();

            // Check if this completed the entire text into Mastery
            this.checkTextMastery(phraseId);
        }
    }

    // Check if all phrases in a text are mastered - checkTextLevelProgression is meant to do the same thing, but I don't know if it really is working
    // checkTextMastery(phraseId) {
    //     console.log(`📊 UserProgress: Checking text mastery for phrase: ${phraseId}`);
        
    //     // Extract textId from phraseId (e.g., "text_1_p3" → "text_1")
    //     const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
    //     console.log(`📊 UserProgress: Extracted textId: ${textId}`);
        
    //     // Get all phrases for this text from GameData
    //     const allPhrasesInText = this.gameData.getPhrasesForText(textId);
    //     console.log(`📊 UserProgress: Found ${allPhrasesInText.length} phrases in ${textId}`);
        
    //     // Check if all phrases in this text are mastered
    //     const allMastered = allPhrasesInText.every(phrase => {
    //         const isMastered = this.isPhraseMastered(phrase.phraseId);
    //         console.log(`📊 UserProgress: Phrase ${phrase.phraseId} mastered: ${isMastered}`);
    //         return isMastered;
    //     });
        
    //     if (allMastered) {
    //         console.log(`🎉 UserProgress: Text ${textId} is now MASTERED! All phrases mastered.`);
    //         this.eventBus.emit('userProgress:textMastered', textId);
    //     } else {
    //         console.log(`📊 UserProgress: Text ${textId} not yet mastered`);
    //     }
    // }

    // Check if phrase is mastered (for ChallengeManager)
    isPhraseMastered(phraseId) {
        if (!this.data.phraseProgress[phraseId]) return false;
        const level = this.data.phraseProgress[phraseId].level;
        const isMastered = level === "mastered";
        console.log(`📊 UserProgress: Checking ${phraseId} mastery - level: ${level}, mastered: ${isMastered}`);
        return isMastered;
    }

    // NEW: Initialize batch cycling system
    initializeBatchCycling(batchStructure) {
        console.log('📊 UserProgress: Initializing batch cycling system...');
        console.log('📊 UserProgress: Batch structure:', batchStructure);
        
        this.data.batchCycling = {
            allBatches: [...batchStructure], // Clone the array
            currentBatchIndex: 0,
            batchRunCounts: new Array(batchStructure.length).fill(0),
            cyclePhase: 'initial'
        };
        
        console.log('📊 UserProgress: Batch cycling initialized:', this.data.batchCycling);
        this.saveUserProgress();
    }
    
    // NEW: Get current batch from cycling system
    getCurrentBatchFromCycling() {
        console.log('📊 UserProgress: Getting current batch from cycling system...');
        
        if (!this.data.batchCycling || !this.data.batchCycling.allBatches.length) {
            console.warn('📊 UserProgress: Batch cycling not initialized, falling back to currentPosition.batch');
            return this.data.currentPosition.batch;
        }
        
        const cycling = this.data.batchCycling;
        const currentBatch = cycling.allBatches[cycling.currentBatchIndex];
        
        console.log('📊 UserProgress: Current batch from cycling:', currentBatch);
        console.log('📊 UserProgress: Batch index:', cycling.currentBatchIndex);
        console.log('📊 UserProgress: Run counts:', cycling.batchRunCounts);
        console.log('📊 UserProgress: Cycle phase:', cycling.cyclePhase);
        
        return currentBatch;
    }
    
    // NEW: Advance to next batch in cycling system
    advanceToNextBatch() {
        console.log('📊 UserProgress: Advancing to next batch in cycling system...');
        
        const cycling = this.data.batchCycling;
        const currentRunCount = cycling.batchRunCounts[cycling.currentBatchIndex];
        
        console.log('📊 UserProgress: Current batch index:', cycling.currentBatchIndex);
        console.log('📊 UserProgress: Current run count:', currentRunCount);
        console.log('📊 UserProgress: Cycle phase:', cycling.cyclePhase);
        
        if (cycling.cyclePhase === 'initial') {
            if (currentRunCount < 2) {
                // Stay on current batch, increment run count
                cycling.batchRunCounts[cycling.currentBatchIndex]++;
                console.log('📊 UserProgress: Staying on current batch, incremented run count to:', cycling.batchRunCounts[cycling.currentBatchIndex]);
            } else {
                // Move to next batch
                cycling.currentBatchIndex++;
                console.log('📊 UserProgress: Moving to next batch, index now:', cycling.currentBatchIndex);
                
                if (cycling.currentBatchIndex >= cycling.allBatches.length) {
                    // All batches run twice, switch to maintenance
                    console.log('📊 UserProgress: All batches completed twice, switching to maintenance phase');
                    cycling.cyclePhase = 'maintenance';
                    cycling.currentBatchIndex = 0;
                    // Reset run counts for maintenance phase
                    cycling.batchRunCounts = cycling.batchRunCounts.map(() => 0);
                }
                cycling.batchRunCounts[cycling.currentBatchIndex] = 1; // First run of this batch
            }
        } else {
            // Maintenance phase: cycle through once each
            cycling.currentBatchIndex = (cycling.currentBatchIndex + 1) % cycling.allBatches.length;
            console.log('📊 UserProgress: Maintenance phase - cycled to batch index:', cycling.currentBatchIndex);
        }
        
        const nextBatch = cycling.allBatches[cycling.currentBatchIndex];
        console.log('📊 UserProgress: Next batch:', nextBatch);
        
        // Update currentPosition for compatibility
        this.data.currentPosition.batch = nextBatch;
        this.data.currentPosition.lastUpdated = new Date().toISOString();
        
        this.saveUserProgress();
        return nextBatch;
    }
    
    // NEW: Check if current batch has any available (non-mastered) texts
    hasAvailableTextsInCurrentBatch() {
        const currentBatch = this.getCurrentBatchFromCycling();
        
        for (const textNum of currentBatch) {
            const textId = `text_${textNum}`;
            if (!this.isTextMastered(textId)) {
                return true;
            }
        }
        
        console.log('📊 UserProgress: Current batch has no available texts (all mastered)');
        return false;
    }
    
    // NEW: Skip empty batches and find next available batch
    findNextAvailableBatch() {
        console.log('📊 UserProgress: Finding next available batch...');
        
        let attempts = 0;
        const maxAttempts = this.data.batchCycling.allBatches.length + 1; // Prevent infinite loops
        
        while (!this.hasAvailableTextsInCurrentBatch() && attempts < maxAttempts) {
            console.log('📊 UserProgress: Current batch empty, advancing...');
            this.advanceToNextBatch();
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            console.warn('📊 UserProgress: All batches appear to be empty - game might be complete');
            return null;
        }
        
        return this.getCurrentBatchFromCycling();
    }
    
    // NEW: Get current level for a specific text
    getTextLevel(textId) {
        if (!this.data.textLevels) {
            console.warn('📊 UserProgress: textLevels not initialized, returning default level 1');
            return 1;
        }
        
        return this.data.textLevels[textId] || 1;
    }
    
    // NEW: Set level for a specific text
    setTextLevel(textId, level) {
        console.log(`📊 UserProgress: Setting ${textId} to level ${level}`);
        
        if (!this.data.textLevels) {
            this.data.textLevels = {};
        }
        
        this.data.textLevels[textId] = level;
        this.saveUserProgress();
    }
    
    // NEW: Check if all phrases in a text are completed for current session
    isTextCompletedInCurrentSession(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is completed in current session...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        for (const phrase of allPhrasesInText) {
            const phraseId = phrase.phraseId;
            
            // Skip mastered phrases (they don't need to be completed again)
            if (this.isPhraseMastered(phraseId)) {
                continue;
            }
            
            // Check if phrase was completed in current session
            const sessionData = this.currentSession.phraseAttempts[phraseId];
            if (!sessionData || !sessionData.correct || sessionData.incorrectCount > 0) {
                console.log(`📊 UserProgress: ${phraseId} not completed in current session`);
                return false;
            }
        }
        
        console.log(`📊 UserProgress: ${textId} is completed in current session`);
        return true;
    }
    
    // NEW: Check if text is fully mastered (all phrases mastered)
    isTextMastered(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is mastered...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        const allMastered = allPhrasesInText.every(phrase => {
            return this.isPhraseMastered(phrase.phraseId);
        });
        
        console.log(`📊 UserProgress: ${textId} mastery status: ${allMastered}`);
        return allMastered;
    }
    
    // Save progress to localStorage
    saveUserProgress() {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] saveUserProgress called`);
        console.log(`📊 UserProgress: [${timestamp}] Data to save:`, this.data);
        
        try {
            console.log(`📊 UserProgress: [${timestamp}] Attempting JSON.stringify...`);
            const jsonString = JSON.stringify(this.data, null, 2);
            console.log(`📊 UserProgress: [${timestamp}] JSON.stringify successful, length: ${jsonString.length}`);
            console.log(`📊 UserProgress: [${timestamp}] First 500 chars of JSON:`, jsonString.substring(0, 500));
            
            console.log(`📊 UserProgress: [${timestamp}] Attempting localStorage.setItem with key '${this.storageKey}'...`);
            localStorage.setItem(this.storageKey, jsonString);
            console.log(`✅ UserProgress: [${timestamp}] localStorage.setItem completed`);
            
            // Verify the save by reading it back immediately
            console.log(`📊 UserProgress: [${timestamp}] Verifying save by reading back from localStorage...`);
            const readBack = localStorage.getItem(this.storageKey);
            
            if (!readBack) {
                console.error(`❌ UserProgress: [${timestamp}] CRITICAL: localStorage.getItem returned null immediately after save!`);
                return false;
            }
            
            console.log(`✅ UserProgress: [${timestamp}] Read-back successful, length: ${readBack.length}`);
            
            // Parse to ensure it's valid JSON
            try {
                const parsed = JSON.parse(readBack);
                console.log(`✅ UserProgress: [${timestamp}] Read-back JSON parsing successful`);
                console.log(`📊 UserProgress: [${timestamp}] Read-back batchStructure:`, parsed.batchStructure);
                return true;
            } catch (parseError) {
                console.error(`❌ UserProgress: [${timestamp}] Read-back JSON parsing failed:`, parseError);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ UserProgress: [${timestamp}] Error saving progress:`, error);
            console.error(`📊 UserProgress: [${timestamp}] Error details - message:`, error.message);
            console.error(`📊 UserProgress: [${timestamp}] Error details - stack:`, error.stack);
            console.error(`📊 UserProgress: [${timestamp}] localStorage available:`, typeof Storage !== 'undefined');
            console.error(`📊 UserProgress: [${timestamp}] localStorage quota info:`, this.getStorageInfo());
            return false;
        }
    }

    // helper method to initialize phrase progress
    initializeSinglePhrase(phraseId) {
        console.log(`📊 UserProgress: Initializing phrase ${phraseId} at level 1`);
        this.data.phraseProgress[phraseId] = {
            level: 1, // All phrases start at level 1
            attempts: []
        };
    }
    
    // Helper method to get storage information for debugging
    getStorageInfo() {
        try {
            const used = new Blob(Object.values(localStorage)).size;
            return {
                used: used,
                usedMB: (used / (1024 * 1024)).toFixed(2),
                available: typeof navigator.storage !== 'undefined'
            };
        } catch (e) {
            return { error: e.message };
        }
    }
    
    // Debug method - clear all progress
    clearProgress() {
        console.log('🧹 UserProgress: Clearing all progress data...');
        localStorage.removeItem(this.storageKey);
        this.createFreshProgressData();
        console.log('✅ UserProgress: Progress cleared, fresh data created');
        
        // IMPORTANT: Clear batch cycling data so it gets regenerated
        if (this.data.batchCycling) {
            this.data.batchCycling = null;
            console.log('🧹 UserProgress: Cleared batch cycling data for regeneration');
        }
        
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

    // USER STATS IN LOAD-GAME SCREEN DISPLAY METHODS

    // Main method - returns formatted HTML string with all user progress data
    getDisplayData() {
        console.log('📊 UserProgress: getDisplayData() called');
        
        if (!this.data) {
            console.warn('📊 UserProgress: No data available for display');
            return '<div class="progress-error">No user progress data available</div>';
        }
        
        console.log('📊 UserProgress: Formatting display data...');
        
        return `
            <div class="progress-display">
                ${this.formatCurrentPosition()}
                ${this.formatBatchStructure()}
                ${this.formatBatchCompletionState()}
                ${this.formatTextProgressDetail()}
                ${this.formatCurrentSessionChallenges()}
                ${this.formatDetailedAttemptHistory()}
                ${this.formatHistoricalSummary()}
            </div>
        `;
    }

    // Format current position section
    formatCurrentPosition() {
        console.log('📊 UserProgress: Formatting current position...');
        
        if (!this.data.currentPosition) {
            console.warn('📊 UserProgress: No currentPosition data');
            return '<div class="progress-section"><strong>Current Position:</strong><br>No position data available</div>';
        }
        
        const pos = this.data.currentPosition;
        return `
            <div class="progress-section">
                <strong>Current Position:</strong><br>
                - Batch: [${pos.batch ? pos.batch.join(',') : 'none'}]<br>
                - Level: ${pos.level || 'none'}<br>
                - Last Updated: ${pos.lastUpdated || 'never'}
            </div>
        `;
    }

    // Format batch structure section
    formatBatchStructure() {
        console.log('📊 UserProgress: Formatting batch structure...');
        
        if (!this.data.batchStructure) {
            console.warn('📊 UserProgress: No batchStructure data');
            return '<div class="progress-section"><strong>Batch Structure:</strong><br>No batch structure available</div>';
        }
        
        const batches = this.data.batchStructure.map((batch, index) => 
            `- Batch ${index + 1}: [${batch.join(',')}]`
        ).join('<br>');
        
        return `
            <div class="progress-section">
                <strong>Batch Structure:</strong><br>
                ${batches}
            </div>
        `;
    }

    // Format batch completion state section
    formatBatchCompletionState() {
        console.log('📊 UserProgress: Formatting batch completion state...');
        
        if (!this.data.batchCompletionState) {
            console.warn('📊 UserProgress: No batchCompletionState data');
            return '<div class="progress-section"><strong>Batch Completion State:</strong><br>No completion state available</div>';
        }
        
        const state = this.data.batchCompletionState;
        const level1Status = this.formatCompletionLevel(state.level1, 'LEVEL_1');
        const level2Status = this.formatCompletionLevel(state.level2, 'LEVEL_2');
        
        return `
            <div class="progress-section">
                <strong>Batch Completion State:</strong><br>
                ${level1Status}<br>
                ${level2Status}
            </div>
        `;
    }

    // Helper method to format completion level
    formatCompletionLevel(levelData, levelName) {
        if (!levelData) {
            console.warn(`📊 UserProgress: No data for ${levelName}`);
            return `- ${levelName}: No data`;
        }
        
        const textStatuses = Object.entries(levelData).map(([textId, completed]) => 
            `${textId}${completed ? '✓' : '✗'}`
        ).join(', ');
        
        return `- ${levelName}: ${textStatuses}`;
    }

    // Format text progress detail section
    formatTextProgressDetail() {
        console.log('📊 UserProgress: Formatting text progress detail...');
        
        if (!this.data.phraseProgress) {
            console.warn('📊 UserProgress: No phraseProgress data');
            return '<div class="progress-section"><strong>Text Progress Detail:</strong><br>No phrase progress available</div>';
        }
        
        // Group phrases by text
        const textGroups = {};
        Object.keys(this.data.phraseProgress).forEach(phraseId => {
            const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
            if (!textGroups[textId]) {
                textGroups[textId] = { completed: [], mastered: [] };
            }
            
            const phraseNum = phraseId.split('_')[2]; // Get 'p1', 'p2', etc.
            textGroups[textId].completed.push(phraseNum);
            
            if (this.data.phraseProgress[phraseId].level === 'mastered') {
                textGroups[textId].mastered.push(phraseNum);
            }
        });
        
        const textDetails = Object.entries(textGroups).map(([textId, data]) => {
            const completed = data.completed.length ? data.completed.join(',') : 'none';
            const mastered = data.mastered.length ? data.mastered.join(',') : 'none';
            return `- ${textId}: completed: ${completed} | mastered: ${mastered}`;
        }).join('<br>');
        
        return `
            <div class="progress-section">
                <strong>Text Progress Detail:</strong><br>
                ${textDetails}
            </div>
        `;
    }

    // Format current session challenges section
    formatCurrentSessionChallenges() {
        console.log('📊 UserProgress: Formatting current session challenges...');
        
        if (!this.currentSession || !this.currentSession.phraseAttempts) {
            console.warn('📊 UserProgress: No currentSession data');
            return '<div class="progress-section"><strong>Current Session Challenges:</strong><br>No current session data</div>';
        }
        
        const sessionPhrases = Object.keys(this.currentSession.phraseAttempts);
        if (sessionPhrases.length === 0) {
            return '<div class="progress-section"><strong>Current Session Challenges:</strong><br>No challenges in current session</div>';
        }
        
        // Group by text and level (assuming current level from currentPosition)
        const currentLevel = this.data.currentPosition?.level || 'UNKNOWN';
        const textGroups = {};
        
        sessionPhrases.forEach(phraseId => {
            const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
            if (!textGroups[textId]) {
                textGroups[textId] = [];
            }
            const phraseNum = phraseId.split('_')[2]; // Get 'p1', 'p2', etc.
            textGroups[textId].push(phraseNum);
        });
        
        const sessionDetails = Object.entries(textGroups).map(([textId, phrases]) => 
            `- ${textId} ${currentLevel}: ${phrases.join(',')}`
        ).join('<br>');
        
        return `
            <div class="progress-section">
                <strong>Current Session Challenges:</strong><br>
                ${sessionDetails}
            </div>
        `;
    }

    // Format detailed attempt history section
    formatDetailedAttemptHistory() {
        console.log('📊 UserProgress: Formatting detailed attempt history...');
        
        if (!this.data.phraseProgress) {
            console.warn('📊 UserProgress: No phraseProgress for attempt history');
            return '<div class="progress-section"><strong>Detailed Attempt History:</strong><br>No attempt history available</div>';
        }
        
        const phraseEntries = Object.entries(this.data.phraseProgress);
        if (phraseEntries.length === 0) {
            return '<div class="progress-section"><strong>Detailed Attempt History:</strong><br>No phrase attempts recorded</div>';
        }
        
        const attemptDetails = phraseEntries.map(([phraseId, data]) => {
            const attempts = data.attempts || [];
            const attemptList = attempts.map(attempt => {
                const peekedUnits = attempt.peekedUnits ? JSON.stringify(attempt.peekedUnits) : '[]';
                return `  - [${attempt.timestamp}] skipped=${attempt.skipped}, incorrectCount=${attempt.incorrectCount}, peeked=${attempt.peeked}, peekedUnits=${peekedUnits}, correctAnswer=${attempt.correctAnswer}`;
            }).join('<br>');
            
            return `- ${phraseId}: level=${data.level}, attempts=${attempts.length}<br>${attemptList}`;
        }).join('<br>');
        
        return `
            <div class="progress-section">
                <strong>Detailed Attempt History:</strong><br>
                ${attemptDetails}
            </div>
        `;
    }

    // Format historical summary section
    formatHistoricalSummary() {
        console.log('📊 UserProgress: Formatting historical summary...');
        
        const gamesPlayed = this.data.gamesPlayed || 0;
        const totalPhraseRecords = this.data.phraseProgress ? Object.keys(this.data.phraseProgress).length : 0;
        
        return `
            <div class="progress-section">
                <strong>All Historical Data:</strong><br>
                - Total phrase records: ${totalPhraseRecords}<br>
                - Games played: ${gamesPlayed}
            </div>
        `;
    }

    displayProgressData() {
        console.log('📊 UserProgress: displayProgressData called');
        const displayData = this.getDisplayData();
        this.eventBus.emit('ui:updateProgressDisplay', displayData);
    }

    injectProgressDisplay() {
        console.log('📊 UserProgress: injectProgressDisplay called');
        const progressInfo = document.getElementById('progressInfo');
        if (progressInfo) {
            const displayData = this.getDisplayData();
            progressInfo.innerHTML = displayData;
            console.log('✅ UserProgress: Progress display injected directly');
        } else {
            console.error('❌ UserProgress: progressInfo element not found');
        }
    }
}