// js/data/GameAnalytics.js - Pure tracking module for specific data structures
class GameAnalytics {
    constructor(eventBus, firebaseAdapter) {
        this.eventBus = eventBus;
        this.firebaseAdapter = firebaseAdapter;
        
        // Pure tracking data - mirrors the exact structures needed
        this.trackingData = {
            currentGameId: null,
            
            // Per-game tracking data
            games: {
                // Structure: gameId -> tracking data
                // Example: "fr_en_002" -> { textStats: {...}, stageState: {...}, etc }
            }
        };
        
        // Setup event listeners for pure observation
        this.setupEventListeners();
        
        console.log('📊 GameAnalytics: Initialized - tracking textStats, stageState, gamesHistory, lastStage');
    }

    async loadExistingData(gameId) {
        console.log(`📊 GameAnalytics: Loading existing data for ${gameId}`);
        const statsKey = `stats_${gameId}`;
        
        try {
            let existingData = await this.firebaseAdapter.loadGameDocument(statsKey);
            
            console.log(`📊 GameAnalytics: Raw Firebase data:`, existingData);
            console.log(`📊 GameAnalytics: Data type:`, typeof existingData);
            
            // Parse if it's a string
            if (typeof existingData === 'string') {
                existingData = JSON.parse(existingData);
                console.log(`📊 GameAnalytics: Parsed data:`, existingData);
            }
            
            console.log(`📊 GameAnalytics: Has textStats?`, !!(existingData && existingData.textStats));
            
            if (existingData && existingData.textStats) {
                console.log(`📊 GameAnalytics: Found existing textStats with ${Object.keys(existingData.textStats).length} texts`);
                
                // Load textStats
                this.trackingData.games[gameId].textStats = existingData.textStats;
                
                // Load other existing data if available
                if (existingData.stageState) {
                    this.trackingData.games[gameId].stageState = existingData.stageState;
                }
                if (existingData.gamesHistory) {
                    this.trackingData.games[gameId].gamesHistory = existingData.gamesHistory;
                }
                if (existingData.lastStage) {
                    this.trackingData.games[gameId].lastStage = existingData.lastStage;
                }
                
                console.log(`📊 GameAnalytics: Successfully loaded existing data for ${gameId}`);
            } else {
                console.log(`📊 GameAnalytics: No existing data found for ${gameId} - starting fresh`);
            }
        } catch (error) {
            console.error(`📊 GameAnalytics: Error loading existing data for ${gameId}:`, error);
        }
    }
    
    // Initialize tracking structure for a specific game
    async initializeGameTracking(gameId) {
        console.log(`📊 GameAnalytics: Initialized tracking for ${gameId}`);
        // if (this.trackingData.games[gameId]) return;
        
        if (!this.trackingData.games[gameId]) {
        this.trackingData.games[gameId] = {
            gameId: gameId,
            
            // 1. ATTEMPT TRACKING - Core structure for debug display
            textStats: {
                // Structure: textId -> levels -> attempts data
                // Example:
                // "text_1": {
                //   "level1": {
                //     "rounds": 2,                    // How many complete rounds at this level
                //     "attempts": {                   // Per-phrase attempt results
                //       "text_1_p1": [1, 2],         // First attempt: level 1, Second: level 2
                //       "text_1_p2": [2],            // First attempt: level 2
                //       "text_1_p3": [2]             // First attempt: level 2
                //     }
                //   },
                //   "level2": {
                //     "rounds": 1,
                //     "attempts": {
                //       "text_1_p1": [2],            // Stayed at level 2
                //       "text_1_p2": [3],            // Advanced to level 3
                //       "text_1_p3": ["M"]           // Mastered (skipped + correct)
                //     }
                //   }
                // }
            },
            
            // 2. STAGE STATE - Which texts are active and at what locked levels
            stageState: {
                // Structure: current stage configuration
                activeTexts: [],              // ["text_1", "text_2", "text_3", "text_4"]
                currentStage: 1,              // Current stage number
                currentTextIndex: 0,          // Which text in activeTexts is current
                lastCompletedTextId: null,    // Last text that was completed
                lockedTextLevels: {           // Level each text is locked at for current stage
                    // "text_1": 2,           // This text plays at level 2 for current stage
                    // "text_2": 1,           // This text plays at level 1 for current stage
                }
            },
            
            // 3. GAMES HISTORY - Complete game session records
            gamesHistory: [
                // Structure: array of completed game sessions
                // {
                //   gameNumber: 1,
                //   stages: 3,              // How many stages were completed
                //   textsPlayed: 4,         // How many texts were active when game ended
                //   levelUps: 2             // How many text level-ups occurred this game
                // }
            ],
            
            // 4. LAST STAGE - Resume position data
            lastStage: {
                // Structure: where the last game session ended
                stageNumber: null,        // Last completed stage number
                texts: []                 // Which texts were active in that stage
            },
            
            // 5. CURRENT GAME - Active session tracking
            currentGame: {
                // Structure: current session in progress (null if no active game)
                gameNumber: null,         // Which game number this is
                stages: 0,                // Stages completed in current game
                textsPlayed: 0,           // Texts that became active this game
                levelUps: 0               // Text level-ups in current game
            }
        };
        }
        // Load existing data from Firebase
        await this.loadExistingData(gameId);
        console.log(`📊 GameAnalytics: Initialized tracking for ${gameId}`);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Game initialization
        this.eventBus.on('gameData:loaded', (projectMetadata) => {
            this.trackingData.currentGameId = projectMetadata.gameId;
            this.initializeGameTracking(projectMetadata.gameId);
        });
        
        // Game session events
        this.eventBus.on('userProgress:gameStarted', () => {
            this.onGameStarted();
        });
        
        this.eventBus.on('userProgress:saveProgress', () => {
            this.onGameEnded();
        });
        
        // Core tracking events
        this.eventBus.on('analytics:attemptRecorded', (data) => {
            this.recordAttempt(data.phraseId, data.playedLevel, data.resultingLevel);
        });
        
        this.eventBus.on('userProgress:textLeveledUp', (data) => {
            this.onTextLevelUp(data);
        });
        
        // Stage/Round events
        this.eventBus.on('analytics:stageStarted', (stageData) => {
            this.onStageStarted(stageData);
        });
        
        this.eventBus.on('analytics:roundCompleted', (roundData) => {
            this.onRoundCompleted(roundData);
        });
    }
    
    // ===================
    // EVENT HANDLERS
    // ===================
    
    onGameStarted() {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        
        // Start new game session
        const gameNumber = game.gamesHistory.length + 1;
        game.currentGame = {
            gameNumber: gameNumber,
            stages: 0,
            textsPlayed: 0,
            levelUps: 0
        };
        
        console.log(`📊 GameAnalytics: Started game ${gameNumber} for ${gameId}`);
    }
    
    onGameEnded() {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        if (!game.currentGame) return;
        
        // Archive completed game
        game.gamesHistory.push({...game.currentGame});
        
        // Update lastStage
        game.lastStage = {
            stageNumber: game.stageState.currentStage,
            texts: [...game.stageState.activeTexts]
        };
        
        // Clear current game
        game.currentGame = null;
        
        console.log(`📊 GameAnalytics: Archived game ${game.gamesHistory.length}`);
        
        // Save to Firebase
        this.saveTrackingData();
    }
    
    onAttemptCompleted(phraseId) {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        // This would need to capture the attempt result
        // We need the playedLevel and resultingLevel from UserProgress
        // For now, we'll set up the structure to receive this data
        
        console.log(`📊 GameAnalytics: Attempt completed for ${phraseId} - need playedLevel and resultingLevel`);
    }
    
    onTextLevelUp(data) {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        if (game.currentGame) {
            game.currentGame.levelUps++;
        }
        
        console.log(`📊 GameAnalytics: Text level up - ${data.textId}: ${data.oldLevel} → ${data.newLevel}`);
    }
    
    onStageStarted(stageData) {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        
        // Update stage state
        game.stageState.currentStage = stageData.stageNumber;
        game.stageState.activeTexts = [...stageData.activeTexts];
        game.stageState.lockedTextLevels = {...stageData.lockedTextLevels};
        
        // Increment stages in current game
        if (game.currentGame) {
            game.currentGame.stages++;
            game.currentGame.textsPlayed = stageData.activeTexts.length;
        }
        
        console.log(`📊 GameAnalytics: Stage ${stageData.stageNumber} started with ${stageData.activeTexts.length} texts`);
    }
    
    onStageCompleted(stageData) {
        // Stage completion tracking if needed
        console.log(`📊 GameAnalytics: Stage ${stageData.stageNumber} completed`);
    }
    
    onRoundCompleted(roundData) {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        const textId = roundData.textId;
        const level = roundData.level;
        const levelKey = `level${level}`;
        
        // Initialize textStats structure if needed
        this.ensureTextStatsStructure(game, textId, level);
        
        // Increment round count
        game.textStats[textId][levelKey].rounds++;
        
        console.log(`📊 GameAnalytics: Round completed for ${textId} ${levelKey} - now ${game.textStats[textId][levelKey].rounds} rounds`);
    }
    
    // ===================
    // CORE TRACKING METHODS
    // ===================
    
    // Record an attempt result (this is the key method)
    recordAttempt(phraseId, playedLevel, resultingLevel) {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const game = this.trackingData.games[gameId];
        const textId = this.extractTextId(phraseId);
        const levelKey = `level${playedLevel}`;
        
        // Ensure structure exists
        this.ensureTextStatsStructure(game, textId, playedLevel);
        
        // Initialize phrase attempts array if needed
        if (!game.textStats[textId][levelKey].attempts[phraseId]) {
            game.textStats[textId][levelKey].attempts[phraseId] = [];
        }
        
        // Record the resulting level
        const result = resultingLevel === 'mastered' ? 'M' : resultingLevel;
        game.textStats[textId][levelKey].attempts[phraseId].push(result);
        
        console.log(`📊 GameAnalytics: Recorded attempt - ${phraseId} at ${levelKey} resulted in ${result}`);
        console.log(`📊 GameAnalytics: ${phraseId} attempts at ${levelKey}:`, game.textStats[textId][levelKey].attempts[phraseId]);
    }
    
    // Ensure textStats structure exists for a text/level
    ensureTextStatsStructure(game, textId, level) {
        if (!game.textStats[textId]) {
            game.textStats[textId] = {};
        }
        
        const levelKey = `level${level}`;
        if (!game.textStats[textId][levelKey]) {
            game.textStats[textId][levelKey] = {
                rounds: 0,
                attempts: {}
            };
        }
    }
    
    // ===================
    // DEBUG/QUERY METHODS
    // ===================
    
    // Generate the exact debug display format required
    generateTextStatsDisplay(gameId) {
        if (!gameId || !this.trackingData.games[gameId]) return '';
        
        const game = this.trackingData.games[gameId];
        const textIds = Object.keys(game.textStats).sort();
        const displays = [];
        
        textIds.forEach(textId => {
            const textData = game.textStats[textId];
            const levelDisplays = [];
            
            // Check levels 1, 2, 3 in order
            for (let level = 1; level <= 3; level++) {
                const levelKey = `level${level}`;
                const levelData = textData[levelKey];
                
                // Skip levels with no rounds
                if (!levelData || levelData.rounds === 0) continue;
                
                // Build level display: L1 R2 p1(1,2) p2(M)
                let levelDisplay = `L${level} R${levelData.rounds}`;
                
                // Sort phrase attempts by phrase number
                const sortedAttempts = Object.entries(levelData.attempts).sort((a, b) => {
                    const numA = parseInt(a[0].split('_')[2].substring(1)); // Extract number from p1, p2
                    const numB = parseInt(b[0].split('_')[2].substring(1));
                    return numA - numB;
                });
                
                // Add phrase attempt details
                sortedAttempts.forEach(([phraseId, attempts]) => {
                    const phraseNum = phraseId.split('_')[2]; // Extract p1, p2, etc
                    const attemptStr = attempts.join(',');
                    levelDisplay += ` ${phraseNum}(${attemptStr})`;
                });
                
                levelDisplays.push(levelDisplay);
            }
            
            // Only add text if it has level data
            if (levelDisplays.length > 0) {
                displays.push(`${textId} ${levelDisplays.join(', ')}`);
            }
        });
        
        return displays.join(';<br>');
    }
    
    
    // Get debug info matching the expected format
    getDebugInfo(gameId) {
        const game = this.trackingData.games[gameId];
        if (!game) return 'No tracking data available';
        
        return {
            gamesPlayed: game.gamesHistory.length,
            currentGame: game.currentGame,
            lastStage: game.lastStage,
            stageState: game.stageState,
            textStatsDisplay: this.generateTextStatsDisplay(gameId)
        };
    }
    
    // ===================
    // PERSISTENCE
    // ===================
    
    saveTrackingData() {
        const gameId = this.trackingData.currentGameId;
        if (!gameId) return;
        
        const analyticsKey = `stats_${gameId}`;
        const data = JSON.stringify(this.trackingData.games[gameId], null, 2);
        
        try {
            this.firebaseAdapter.persistToFirestore(analyticsKey, data);
            console.log(`📊 GameAnalytics: Saved tracking data for ${gameId}`);
        } catch (error) {
            console.error(`📊 GameAnalytics: Error saving tracking data:`, error);
        }
    }
    
    loadTrackingData(gameId) {
        const analyticsKey = `analytics_${gameId}`;
        
        try {
            const stored = this.firebaseAdapter.getItem(analyticsKey);
            if (stored) {
                this.trackingData.games[gameId] = JSON.parse(stored);
                console.log(`📊 GameAnalytics: Loaded tracking data for ${gameId}`);
            }
        } catch (error) {
            console.error(`📊 GameAnalytics: Error loading tracking data:`, error);
        }
    }
    
    // ===================
    // HELPER METHODS
    // ===================
    
    extractTextId(phraseId) {
        return phraseId.substring(0, phraseId.lastIndexOf('_'));
    }
}

// INTEGRATION REQUIREMENTS:
// 1. Add to App.js: this.gameAnalytics = new GameAnalytics(this.eventBus, this.firebaseAdapter);
// 2. UserProgress needs to emit attempt data: this.eventBus.emit('analytics:attemptRecorded', {phraseId, playedLevel, resultingLevel});
// 3. ChallengeManager needs to emit stage/round events when they start/complete
// 4. GameAnalytics will provide the exact debug display format needed