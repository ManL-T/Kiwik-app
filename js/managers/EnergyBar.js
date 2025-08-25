// js/managers/EnergyBar.js
class EnergyBar {
    constructor(eventBus) {
        console.log('⚡ EnergyBar: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Energy state
        this.maxLives = 10;
        this.currentLives = 10;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ EnergyBar: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        console.log('⚡ EnergyBar: DEBUG - setupEventListeners called with template filtering');
        this.eventBus.on('energy:initialize', () => {
            this.initialize();
        });
        
        this.eventBus.on('energy:loseLife', () => {
            this.loseLife();
        });
        
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            // Only restore display for game screens that have energy bars
            if (templatePath && templatePath.includes('game.html')) {
                this.restoreDisplay();
            }
        });
    }
    
    // Initialize energy to full (10 lives)
    initialize() {
        console.log('⚡ EnergyBar: Initializing to full energy');
        this.currentLives = this.maxLives;
        this.updateDisplay();
    }
    
    // Lose one life
    loseLife() {
        if (this.currentLives > 0) {
            this.currentLives--;
            console.log('⚡ EnergyBar: Life lost! Current lives:', this.currentLives);
            this.updateDisplay();
            
            // Check for game over
            if (this.currentLives <= 0) {
                console.log('⚡ EnergyBar: Game Over - no lives remaining');
                this.eventBus.emit('energy:gameOver');
            }
        }
    }
    
    // Update visual display via UIRenderer
    updateDisplay() {
        const energyPercentage = (this.currentLives / this.maxLives) * 100;
        console.log('⚡ EnergyBar: Updating display -', this.currentLives, 'lives (', energyPercentage, '%)');
        
        this.eventBus.emit('energy:updateDisplay', energyPercentage);
    }
    
    // Get current lives (for debugging/testing)
    getCurrentLives() {
        return this.currentLives;
    }
    
    // Restore display when templates load (maintains energy across template changes)
    restoreDisplay() {
        console.log('⚡ EnergyBar: Restoring display after template load');
        this.updateDisplay();
    }
}