// Main application controller - initialization only
class App {
    constructor() {
        console.log('🚀 App: Initializing...');
        this.eventBus = new EventBus();
        
        // Create shared FirebaseAdapter first
        this.firebaseAdapter = new window.FirebaseAdapter();
        
        // Create AuthManager early (depends on FirebaseAdapter)
        this.authManager = new AuthManager(this.eventBus, this.firebaseAdapter);
        
        this.uiRenderer = new UIRenderer(this.eventBus);
        this.gameData = new GameData(this.eventBus);
        this.UserProgress = new UserProgress(this.eventBus, this.gameData, this.firebaseAdapter);
        this.timer = new Timer(this.eventBus);
        this.challengeManager = new ChallengeManager(this.eventBus, this.uiRenderer, this.gameData, this.UserProgress);
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
    // Go back to index.html, the old launcher
    window.location.href = 'index.html';
}


// Auto-show debug info when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🐛 DOMContentLoaded fired');
    setTimeout(() => {
        console.log('🐛 Timeout fired, checking window.app:', !!window.app);
        console.log('🐛 Checking UserProgress:', !!window.app?.UserProgress);
        if (window.app && window.app.UserProgress) {
            console.log('🐛 Calling showDebugInfo...');
            showDebugInfo();
        } else {
            console.log('🐛 App or UserProgress not ready yet');
        }
    }, 500);
});

function clearUserProgress() {
    console.log('🧹 Debug: Button clicked');
    if (window.app && window.app.UserProgress) {
        console.log('🧹 Debug: About to call clearProgress');
        window.app.UserProgress.clearProgress();
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
    
    const UserProgress = window.app.UserProgress;
    
    // Get the complete debug info from UserProgress
    const progressInfo = UserProgress.getDebugInfo();
    const textStatsInfo = UserProgress.getTextStatsDebug();
    
    // Combine both sections
    let html = '<strong style="color: #ffff00;">===== DEBUG INFO =====</strong><br><br>';

    // Format progressInfo object
    html += '<strong style="color: #00ffff;">📊 PROGRESS:</strong><br>';
    html += `Games Played: ${progressInfo.gamesPlayed}<br>`;
    html += `Total Phrases: ${progressInfo.totalPhrases} | Mastered: ${progressInfo.masteredPhrases} (${progressInfo.masteredPercentage}%)<br>`;
    html += `Total Texts: ${progressInfo.totalTexts}<br>`;
    html += `Current Stage: ${progressInfo.currentStage}<br><br>`;

    // Format textStatsInfo object  
    html += '<strong style="color: #00ffff;">📚 TEXT STATS:</strong><br>';
    Object.entries(textStatsInfo).forEach(([textId, textData]) => {
        html += `${textId}: L1(${textData.level1?.rounds || 0}) L2(${textData.level2?.rounds || 0}) L3(${textData.level3?.rounds || 0})<br>`;
    });

    html += '<br><strong>Press Debug Button to Clear All Data</strong>';

    debugDiv.innerHTML = html;
}

// Auto-refresh every 2 seconds
setInterval(() => {
    if (window.app && window.app.UserProgress) {
        showDebugInfo();
    }
}, 2000);