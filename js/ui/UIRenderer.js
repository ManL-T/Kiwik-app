// UI Rendering module - handles all template loading and DOM updates
class UIRenderer {
    constructor(eventBus) {
        console.log('🎨 UIRenderer: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ UIRenderer: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('ui:loadTemplate', (templatePath) => {
            this.loadTemplate(templatePath);
        });

        this.eventBus.on('ui:loadTextCover', ({ textId, data }) => {
            this.loadTextCover(textId, data);
        });

        this.eventBus.on('ui:showOverlay', (overlayData) => {
            this.showOverlay(overlayData);
        });
        
        this.eventBus.on('energy:updateDisplay', (energyPercentage) => {
            this.updateEnergyBar(energyPercentage);
        });
        
        this.eventBus.on('timer:tick', (currentTime) => {
            this.updateTimerDisplay(currentTime);
        });
        
        this.eventBus.on('ui:updateHighlightedText', (data) => {
            this.updateHighlightedText(data.fullSentence, data.unitTarget);
        });
        
        this.eventBus.on('ui:updateTranslations', (translations) => {
            this.updateTranslations(translations);
        });
        
        this.eventBus.on('ui:updateDisplayContainer', (html) => {
            this.updateDisplayContainer(html);
        });
        
        this.eventBus.on('ui:updateDisplayChoice', (html) => {
            this.updateDisplayChoice(html);
        });

        this.eventBus.on('ui:updateProgressDisplay', (displayData) => {
            this.updateProgressDisplay(displayData);
        });
    }
    
    // Template loading
    async loadTemplate(templatePath) {
        try {
            const app = document.getElementById('app');
            const response = await fetch(templatePath);
            const html = await response.text();
            app.innerHTML = html;
            this.eventBus.emit('ui:templateLoaded', templatePath);
        } catch (error) {
            console.error('Error loading template:', error);
        }
    }

    // Load text cover with image or fallback
    async loadTextCover(textId, data) {
        console.log('🖼️ UIRenderer: Loading dynamic text cover for:', textId);
            console.log('🖼️ UIRenderer: Text cover data:', data);
            
            try {
                const templatePath = 'templates/screens/text-cover.html';
                console.log('🖼️ UIRenderer: Loading template:', templatePath);
                
                const response = await fetch(templatePath);
                if (!response.ok) {
                    throw new Error(`Failed to load template: ${response.status}`);
                }
                
                let html = await response.text();
                console.log('🖼️ UIRenderer: Template loaded, injecting data...');
                
                // Replace placeholders with actual data
                html = html.replace('{{level}}', data.level);
                html = html.replace('{{round}}', data.round);
                html = html.replace('{{title}}', data.title);
                
                // Generate phrases HTML
                const phrasesHtml = this.generatePhrasesHtml(data.phrases);
                html = html.replace('{{phrases}}', phrasesHtml);
                
                // Load into DOM
                const app = document.getElementById('app');
                app.innerHTML = html;
                
                console.log('✅ UIRenderer: Dynamic text cover loaded successfully');
                this.eventBus.emit('ui:templateLoaded', templatePath);
                
            } catch (error) {
                console.error('❌ UIRenderer: Error loading text cover:', error);
                this.showFallbackTextCover(textId);
            }
    }

    generatePhrasesHtml(phrases) {
        console.log('🖼️ UIRenderer: Generating phrases HTML for', phrases.length, 'phrases');
        
        return phrases.map(phrase => {
            return `<div class="phrase-item phrase-status-${phrase.status}">
                <span class="phrase-icon">${phrase.icon}</span>
                <span class="phrase-text">${phrase.text}</span>
            </div>`;
        }).join('');
    }

    // Fallback method for when template loading fails
    showFallbackTextCover(textId) {
        console.log('🖼️ UIRenderer: Showing fallback text cover for:', textId);
        
        const fallbackHtml = `
            <div class="text-cover-screen" id="textCoverScreen">
                <div class="fallback-text">Starting ${textId.replace('_', ' ')}</div>
            </div>
        `;
        
        this.appContainer.innerHTML = fallbackHtml;
        this.eventBus.emit('ui:templateLoaded', 'templates/screens/text-cover.html');
    }
    
    // Update highlighted text in game screen
    updateHighlightedText(fullSentence, unitTarget) {
        console.log('🎨 UIRenderer: updateHighlightedText called');
        console.log('🎨 UIRenderer: fullSentence:', fullSentence);
        console.log('🎨 UIRenderer: unitTarget:', unitTarget);
        
        const textElement = document.querySelector('.text');
        if (!textElement) return;
        
        // If no unitTarget, show plain text (for decision phases)
        if (!unitTarget) {
            console.log('🎨 UIRenderer: Showing plain text - no highlighting');
            textElement.innerHTML = fullSentence;
            return;
        }
        
        // Apply highlighting (for revision phase)
        const highlightedText = fullSentence.replace(
            unitTarget,
            `<span class="text-highlight">${unitTarget}</span>`
        );
        
        console.log('🎨 UIRenderer: setting highlighted innerHTML:', highlightedText);
        textElement.innerHTML = highlightedText;
    }
    
    // Update translation options in display container
    updateTranslations(translations) {
        console.log('🎨 UIRenderer: updateTranslations called');
        console.log('🎨 UIRenderer: translations:', translations);
        
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        const translationsHTML = translations.map(translation => 
            `<div class="translation-option">${translation}</div>`
        ).join('');
        
        console.log('🎨 UIRenderer: setting translations innerHTML:', translationsHTML);
        displayContainer.innerHTML = translationsHTML;
    }
    
    // Update display container with custom HTML
    updateDisplayContainer(html) {
        console.log('🎨 UIRenderer: updateDisplayContainer called');
        console.log('🎨 UIRenderer: html:', html);
        
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        displayContainer.innerHTML = html;
    }

    // Update display container with choice options (for solution phase)
    updateDisplayChoice(html) {
        console.log('🎨 UIRenderer: updateDisplayChoice called');
        console.log('🎨 UIRenderer: html:', html);
        
        const displayContainer = document.querySelector('.display-container');
        if (!displayContainer) return;
        
        displayContainer.innerHTML = html;
    }

    // Update energy bar display
    updateEnergyBar(energyPercentage) {
        console.log('🎨 UIRenderer: updateEnergyBar called');
        console.log('🎨 UIRenderer: energyPercentage:', energyPercentage);
        
        const progressBar = document.querySelector('.progress-bar');
        console.log('🎨 UIRenderer: progressBar element found:', progressBar); // ← ADD THIS LINE
        if (!progressBar) return;
        
        progressBar.style.width = `${energyPercentage}%`;
    }
    
    // Update timer display
    updateTimerDisplay(currentTime) {
        console.log('🎨 UIRenderer: updateTimerDisplay called');
        console.log('🎨 UIRenderer: currentTime:', currentTime);

        // DEBUG: Add stack trace when currentTime is 12
        if (currentTime === 12) {
        console.log('🐛 DEBUG: Stack trace for currentTime=12:');
        console.trace();
    }
        
        const timerElement = document.querySelector('.timer-display');
        if (!timerElement) return;
        
        timerElement.textContent = currentTime;
    }

    // Show overlay on top of current content
    async showOverlay(overlayData) {
        console.log('🎨 UIRenderer: showOverlay called');
        console.log('🎨 UIRenderer: overlayData:', overlayData);
        
        try {
            // Fetch overlay template
            const response = await fetch(overlayData.templatePath);
            const html = await response.text();
            console.log('🎨 UIRenderer: Fetched HTML:', html.substring(0, 200)); // Add this line

            
            // Parse HTML and extract overlay content
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const overlayElement = doc.querySelector('.overlay-backdrop');
            
            if (!overlayElement) {
                console.error('🎨 UIRenderer: .overlay-backdrop not found in template');
                return;
            }
            
            // Append overlay to document body
            document.body.appendChild(overlayElement);
            console.log('🎨 UIRenderer: Overlay displayed');
            
            // Auto-remove after duration
            setTimeout(() => {
                if (overlayElement && overlayElement.parentNode) {
                    overlayElement.parentNode.removeChild(overlayElement);
                    console.log('🎨 UIRenderer: Overlay removed after', overlayData.duration, 'ms');
                    this.eventBus.emit('ui:overlayHidden');
                }
            }, overlayData.duration);
            
        } catch (error) {
            console.error('🎨 UIRenderer: Error showing overlay:', error);
        }
    }
    


}