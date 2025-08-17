// js/managers/UserProgress.js
class UserProgress {
    constructor(eventBus) {
        console.log('📊 UserProgress: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';
        
        // Persistent user progress data
        this.data = null;
        
        // Current session (in memory only until game over)
        this.currentSession = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load existing progress or create default
        this.loadUserProgress();
        
        console.log('✅ UserProgress: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('userProgress:challengeSkipped', (phraseId) => {
            this.recordSkippedChallenge(phraseId);
        });
        
        this.eventBus.on('userProgress:incorrectAnswer', (phraseId) => {
            this.recordIncorrectAnswer(phraseId);
        });
        
        this.eventBus.on('userProgress:gameStarted', () => {
            this.startNewSession();
        });
        
        this.eventBus.on('userProgress:saveProgress', () => {
            this.saveUserProgress();
        });
    }
    
    // Load progress from localStorage
    loadUserProgress() {
        console.log('📊 UserProgress: Loading from localStorage...');
        
        try {
            const stored = localStorage.getItem(this.storageKey);
            
            if (stored) {
                const parsedData = JSON.parse(stored);
                
                // Check if it's the new format (has sessions array)
                if (parsedData.sessions && Array.isArray(parsedData.sessions)) {
                    this.data = parsedData;
                    console.log('📊 UserProgress: Loaded existing session-based data:', this.data);
                } else {
                    // Old format detected - clear and start fresh
                    console.log('📊 UserProgress: Old format detected, clearing and starting fresh');
                    localStorage.removeItem(this.storageKey);
                    this.data = {
                        gamesPlayed: 0,
                        sessions: []
                    };
                }
            } else {
                // Create default structure for new user
                this.data = {
                    gamesPlayed: 0,
                    sessions: []
                };
                console.log('📊 UserProgress: Created default data structure');
            }
            
            // Notify other modules that progress is loaded
            this.eventBus.emit('userProgress:loaded', this.data);
            
        } catch (error) {
            console.error('📊 UserProgress: Error loading from localStorage:', error);
            // Fallback to default structure
            this.data = {
                gamesPlayed: 0,
                sessions: []
            };
        }
    }
    
    // Start a new session (in memory)
    startNewSession() {
        console.log('📊 UserProgress: Starting new session...');
        
        this.currentSession = {
            sessionId: this.getNextSessionId(),
            timestamp: new Date().toISOString(),
            challenges: {}
        };
        
        console.log('📊 UserProgress: Created session', this.currentSession.sessionId, 'at', this.currentSession.timestamp);
    }
    
    // Get next session ID
    getNextSessionId() {
        if (this.data.sessions.length === 0) {
            return 1;
        }
        
        // Find highest sessionId and add 1
        const maxId = Math.max(...this.data.sessions.map(session => session.sessionId));
        return maxId + 1;
    }
    
    // Save progress to localStorage (finalizes current session)
    saveUserProgress() {
        console.log('📊 UserProgress: Saving to localStorage...');
        
        // Finalize current session if it exists
        if (this.currentSession) {
            console.log('📊 UserProgress: Finalizing session', this.currentSession.sessionId);
            this.data.sessions.push(this.currentSession);
            this.data.gamesPlayed++;
            
            // Clear current session
            this.currentSession = null;
            console.log('📊 UserProgress: Session finalized and added to history');
        }
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            console.log('✅ UserProgress: Saved successfully. Total sessions:', this.data.sessions.length);
        } catch (error) {
            console.error('📊 UserProgress: Error saving to localStorage:', error);
        }
    }
    
    // Record that a challenge was skipped
    recordSkippedChallenge(phraseId) {
        console.log('📊 UserProgress: Recording skipped challenge:', phraseId);
        
        if (!this.currentSession) {
            console.warn('📊 UserProgress: No active session to record skip');
            return;
        }
        
        // Initialize challenge entry if it doesn't exist
        if (!this.currentSession.challenges[phraseId]) {
            this.currentSession.challenges[phraseId] = {
                skipped: false,
                incorrectCount: 0
            };
        }
        
        this.currentSession.challenges[phraseId].skipped = true;
        console.log('📊 UserProgress: Marked challenge as skipped in session', this.currentSession.sessionId);
    }
    
    // Record an incorrect answer
    recordIncorrectAnswer(phraseId) {
        console.log('📊 UserProgress: Recording incorrect answer for:', phraseId);
        
        if (!this.currentSession) {
            console.warn('📊 UserProgress: No active session to record incorrect answer');
            return;
        }
        
        // Initialize challenge entry if it doesn't exist
        if (!this.currentSession.challenges[phraseId]) {
            this.currentSession.challenges[phraseId] = {
                skipped: false,
                incorrectCount: 0
            };
        }
        
        this.currentSession.challenges[phraseId].incorrectCount++;
        console.log('📊 UserProgress: Incorrect count for', phraseId, 'in session', this.currentSession.sessionId + ':', this.currentSession.challenges[phraseId].incorrectCount);
    }
    
    // Get list of skipped challenges from latest session (for P2Challenge filtering)
    getSkippedChallenges() {
        if (this.data.sessions.length === 0) {
            console.log('📊 UserProgress: No sessions found, returning empty skipped list');
            return [];
        }
        
        // Get latest session
        const latestSession = this.data.sessions[this.data.sessions.length - 1];
        const skippedChallenges = [];
        
        for (const [phraseId, challengeData] of Object.entries(latestSession.challenges)) {
            if (challengeData.skipped) {
                skippedChallenges.push(phraseId);
            }
        }
        
        console.log('📊 UserProgress: Returning skipped challenges from latest session:', skippedChallenges);
        return skippedChallenges;
    }
    
    // Get current progress data (for debugging)
    getCurrentData() {
        return {
            persistentData: this.data,
            currentSession: this.currentSession
        };
    }
}