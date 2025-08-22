// Game Session controller - handles all game's session logic and flow
class GameSession {
    constructor(eventBus, uiRenderer, challengeManager) {
        console.log('🎮 GameSession: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.challengeManager = challengeManager;

        // Create EnergyBar instance
        this.energyBar = new EnergyBar(this.eventBus);
        
        // Challenge instance
        this.p1Challenge = null;
        
        // Game state
        this.gameStarted = false;
        
        // Load key handler references
        this.loadScreenKeyHandler = null;
        this.gameOverKeyHandler = null; 

        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize
        this.loadGameLoadScreen();
        
        console.log('✅ GameSession: Initialization complete');
    }
    
    async loadGameLoadScreen() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/load-game.html');
        this.setupLoadScreenKeyHandler();
    }

    setupEventListeners() {
        this.eventBus.on('challenge:wrongAnswer', () => {
            this.handleEnergyLoss('wrongAnswer');
        });

        this.eventBus.on('timer:expired', () => {
            this.handleTimerExpired();
        });

        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            if (templatePath.includes('game-over.html')) {
                this.setupGameOverKeyHandler();
            }
        });

        // handle timer expiration 
        this.eventBus.on('challenge:timerExpired', () => {
            this.handleTimerExpired();
        });
    }
    
    handleEnergyLoss(reason) {
        console.log(`🎮 GameSession: Energy lost due to: ${reason}`);
        this.eventBus.emit('energy:loseLife');
        
        const currentLives = this.energyBar.getCurrentLives();
        console.log(`🎮 GameSession: Current lives after loss: ${currentLives}`);
        
        if (currentLives <= 0 && reason !== 'timerExpired')  {
            console.log('🎮 GameSession: Game Over - no lives remaining');
            
            // Clean up immediately when we detect game over
            this.challengeManager.cleanupCurrentChallenge();
            
            this.handleGameOver();
        } else if (currentLives <= 3) {
            console.log('🎮 GameSession: Low energy warning');
        }
    }

    handleTimerExpired() {
        console.log('🎮 GameSession: Timer expired - waiting for overlay to complete');
        
        // DON'T call handleEnergyLoss immediately
        // Wait for overlay to complete, THEN trigger energy loss
        setTimeout(() => {
            console.log('🎮 GameSession: Overlay complete - now handling energy loss');
            this.handleEnergyLoss('timerExpired');
            
            // After energy loss, check game state with additional delay for feedback
            setTimeout(() => {
                const currentLives = this.energyBar.getCurrentLives();
                if (currentLives > 0) {
                    console.log('🎮 GameSession: Energy feedback shown - progressing to next challenge');
                    this.progressToNextChallenge();
                }
                // Game over handled by handleEnergyLoss if lives <= 0
            }, 1500); // 1.5s to see energy bar reduction
            
        }, 2000); // 2s overlay duration
    }

    progressToNextChallenge() {
        console.log('🎮 GameSession: Requesting progression to next challenge');
        this.eventBus.emit('session:progressToNextChallenge');
    }

    setupLoadScreenKeyHandler() {
        this.loadScreenKeyHandler = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.startGame();
            }
        };
        
        document.addEventListener('keydown', this.loadScreenKeyHandler);
    }
    
    removeLoadScreenKeyHandler() {
        if (this.loadScreenKeyHandler) {
            document.removeEventListener('keydown', this.loadScreenKeyHandler);
            this.loadScreenKeyHandler = null;
        }
    }
    
    async startGame() {
        // Prevent multiple starts
        if (this.gameStarted) {
            console.log('🎮 GameSession: Game already started, ignoring');
            return;
        }
        this.gameStarted = true;

        this.eventBus.emit('userProgress:gameStarted');
        
        // Remove load screen key handler to prevent enter key events progagation from load-game screen
        this.removeLoadScreenKeyHandler();
        
        // Start the game logic - no template loading
        console.log('🎮 GameSession: Starting game logic...');
        
        // TODO: Create ChallengeSequencer to decide which challenge to load
        // For now, directly create P1Challenge
        this.challengeManager.createChallenge();
    }

    async handleGameOver() {
        console.log('🎮 GameSession: Game Over - saving progress');
        this.eventBus.emit('userProgress:saveProgress');

        console.log('🎮 GameSession: Loading game over screen');
        await this.uiRenderer.loadTemplate('templates/screens/game-over.html');
        this.setupGameOverKeyHandler(); // Now we know DOM is ready
    }

    setupGameOverKeyHandler() {
        const options = document.querySelectorAll(".game-over-option");
        console.log('🎮 GameSession: Found game over options:', options.length);
        console.log('🎮 GameSession: DOM content:', document.querySelector('#app').innerHTML.substring(0, 200));
        let currentIndex = -1; // no selection initially
        
        this.gameOverKeyHandler = (e) => {
        if (e.code === "Space") {
            e.preventDefault();
            e.stopPropagation(); // Stop Navigation.js from seeing it
            currentIndex = (currentIndex + 1) % options.length;

            // DEBUG: Log what we're doing
            console.log('🎮 DEBUG: Current index:', currentIndex);
            console.log('🎮 DEBUG: Total options:', options.length);

            // Remove selected class from all
            options.forEach((opt, index) => {
                opt.classList.remove("game-over-option-selected");
                console.log('🎮 DEBUG: Removed selected from option', index, ':', opt.textContent);
            });
            
            // Add selected class to current
            options[currentIndex].classList.add("game-over-option-selected");
            console.log('🎮 DEBUG: Added selected to option', currentIndex, ':', options[currentIndex].textContent);
            console.log('🎮 DEBUG: Element classes now:', options[currentIndex].classList.toString());
            console.log('🎮 DEBUG: Element computed style:', getComputedStyle(options[currentIndex]).backgroundColor);
        }

        if (e.code === "Enter" && currentIndex >= 0) {
            e.preventDefault();
            e.stopPropagation();
            options[currentIndex].click();
            console.log('🎮 GameSession: Clicked option:', currentIndex);
        }
    };
        
        document.addEventListener("keydown", this.gameOverKeyHandler);

     }


    removeGameOverKeyHandler() {
        if (this.gameOverKeyHandler) {
            document.removeEventListener('keydown', this.gameOverKeyHandler);
            this.gameOverKeyHandler = null;
        }
    }
 }
