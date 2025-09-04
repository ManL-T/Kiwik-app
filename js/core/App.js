// Main application controller - initialization only
class App {
    constructor() {
        console.log('🚀 App: Initializing...');
        this.eventBus = new EventBus();
        this.uiRenderer = new UIRenderer(this.eventBus);
        this.gameData = new GameData(this.eventBus);
        this.userProgress = new UserProgress(this.eventBus, this.gameData);
        this.timer = new Timer(this.eventBus);
        this.challengeManager = new ChallengeManager(this.eventBus, this.uiRenderer, this.gameData, this.userProgress);
        this.gameSession = new GameSession(this.eventBus, this.uiRenderer, this.challengeManager);        
        this.navigation = new Navigation(this.eventBus);
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});



// Global wrapper functions for template onclick handlers
function startGame() {
    window.app.gameSession.startGame();
}

function startNewGame() {
    // Reload the page to start fresh
    window.location.reload();
}

function backToSite() {
    // Go back to launcher
    window.location.href = 'launcher.html';
}


// Auto-show debug info when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐛 DOMContentLoaded fired');
    setTimeout(() => {
        console.log('🐛 Timeout fired, checking window.app:', !!window.app);
        console.log('🐛 Checking userProgress:', !!window.app?.userProgress);
        if (window.app && window.app.userProgress) {
            console.log('🐛 Calling showDebugInfo...');
            showDebugInfo();
        } else {
            console.log('🐛 App or UserProgress not ready yet');
        }
    }, 500);
});

function clearUserProgress() {
    console.log('🧹 Debug: Button clicked');
    if (window.app && window.app.userProgress) {
        console.log('🧹 Debug: About to call clearProgress');
        window.app.userProgress.clearProgress();
        console.log('🧹 Debug: clearProgress completed');
        
        // Refresh the display
        showDebugInfo();
    }
}

function showDebugInfo() {
    let debugDiv = document.getElementById('debugInfo');
    if (!debugDiv) {
        // Create debug div if it doesn't exist
        debugDiv = document.createElement('div');
        debugDiv.id = 'debugInfo';
        debugDiv.style.cssText = `position: absolute; bottom: 80px; left: 20px; right: 20px; 
                background: rgba(0,0,0,0.9); color: #00ff00; padding: 15px; 
                font-family: monospace; font-size: 11px; 
                max-height: 50vh; overflow-y: auto; border: 1px solid #00ff00;
                border-radius: 5px;`;
        const container = document.querySelector('.game-load-screen');
        if (container) {
            container.appendChild(debugDiv);
        } else {
            return;
        }
    }
    
    const userProgress = window.app.userProgress;
    
    // Get the complete debug info from UserProgress
    const progressInfo = userProgress.getDebugInfo();
    const textStatsInfo = userProgress.getTextStatsDebug();
    
    // Combine both sections
    let html = '<strong style="color: #ffff00;">===== DEBUG INFO =====</strong><br><br>';
    html += progressInfo + '<br>';
    html += textStatsInfo + '<br><br>';
    html += '<strong>Press Debug Button to Clear All Data</strong>';
    
    debugDiv.innerHTML = html;
}

// Auto-refresh every 2 seconds
setInterval(() => {
    if (window.app && window.app.userProgress) {
        showDebugInfo();
    }
}, 2000);