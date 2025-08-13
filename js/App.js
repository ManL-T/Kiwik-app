// Main application controller
class App {
    constructor() {
        console.log('🚀 App: Initializing...');
        
        // Initialize UIRenderer
        this.uiRenderer = new UIRenderer();
        
        // Game data
        this.fullSentence = "Je l'aperçois entrer dans le café";
        this.states = [
            { unitTarget: "Je l'aperçois", translations: ["I spot him/her", "I glimpse him/her", "I see him/her"] },
            { unitTarget: "entrer", translations: ["go in", "walk in", "going into"] },
            { unitTarget: "dans", translations: ["in", "inside", "within"] },
            { unitTarget: "le café", translations: ["the coffee shop", "the coffeehouse", "the café"] }
        ];
        
        // Navigation state
        this.currentState = 0;
        
        // Initialize
        this.setupEventHandlers();
        this.loadGameLoadScreen();
        
        console.log('✅ App: Initialization complete');
    }
    
    // Template loading function
    async loadTemplate(templatePath) {
        await this.uiRenderer.loadTemplate(templatePath);
    }
    
    // Event handling
    setupEventHandlers() {
        document.addEventListener('keydown', (event) => {
            const currentScreen = this.getCurrentScreen();
            
            if (currentScreen === 'game-load') {
                if (event.key === 'Enter') {
                    this.startGame();
                } else if (event.key === 'Escape') {
                    this.goBackToLauncher();
                }
            } else if (currentScreen === 'game') {
                if (event.key === ' ') {
                    event.preventDefault();
                    this.nextState();
                } else if (event.key === 'Escape') {
                    this.goBackToLauncher();
                }
            }
        });
    }
    
    // Navigation functions
    goBackToLauncher() {
        window.location.href = 'launcher.html';
    }
    
    async loadGameLoadScreen() {
        await this.loadTemplate('templates/screens/load-game.html');
    }
    
    async startGame() {
        await this.loadTemplate('templates/screens/game.html');
        this.updateGameContent();
    }
    
    // Game logic
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
    
    // Helper function to determine current screen
    getCurrentScreen() {
        const app = document.getElementById('app');
        if (app.innerHTML.includes('game-load-screen')) {
            return 'game-load';
        }
        if (app.innerHTML.includes('game-screen')) {
            return 'game';
        }
        return 'unknown';
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Global wrapper functions for template onclick handlers
function startGame() {
    window.app.startGame();
}

function goBackToLauncher() {
    window.app.goBackToLauncher();
}