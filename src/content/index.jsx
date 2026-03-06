
// ============================================
// ChatGPT Ad Blocker Configuration
// ============================================

const config = {
    // Protection enabled/disabled state (will be synced with storage)
    enabled: true,

    // NO LONGER USING KEYWORD MATCHING TO PREVENT BROAD BLOCKING
    sponsoredPatterns: [],

    // STRICT SELECTORS FOR MARCH 2026 ADS
    adSelectors: [
        '[aria-label="Ad options"]',
        'img[src*="bzrcdn.openai.com"]',
        '[role="link"].bg-token-bg-tertiary',
        'h3' // Will be filtered in isElementSponsored for exact text "Sponsored"
    ],

    suspiciousAttributes: []
};

// ============================================
// State
// ============================================

let processedElements = new WeakSet();
let observer = null;
window.sessionBlockedCount = 0;

// ============================================
// Utility Functions
// ============================================

function getElementText(element) {
    return (element.textContent || element.innerText || '').trim();
}

function hasAttribute(element, attributes) {
    return attributes.some(attr => element.hasAttribute(attr));
}

function matchesPattern(text, patterns) {
    return patterns.some(pattern => pattern.test(text));
}

// ============================================
// Ad Detection Functions
// ============================================

function isElementSponsored(element) {
    // Skip if already processed
    if (processedElements.has(element)) {
        return false;
    }

    // ============================================
    // CRITICAL: Protection for User & Assistant Content
    // ============================================

    // 1. Never block the input field or its parents
    if (element.id === 'prompt-textarea' || element.tagName === 'TEXTAREA' || element.closest('#prompt-textarea') || element.closest('form')) {
        return false;
    }

    // 2. Never block user messages 
    if (element.getAttribute('data-message-author-role') === 'user' || element.classList.contains('user-message-bubble-color') || element.closest('.user-message-bubble-color')) {
        return false;
    }

    // 3. STRICT: Detect ONLY specific ad components provided by user
    const text = getElementText(element);
    
    const isAdHeader = element.tagName === 'H3' && text === 'Sponsored';
    const isAdOptions = element.getAttribute('aria-label') === 'Ad options';
    const isAdImage = element.tagName === 'IMG' && element.src && element.src.includes('bzrcdn.openai.com');
    const isAdCard = element.getAttribute('role') === 'link' && element.classList.contains('bg-token-bg-tertiary');

    if (isAdHeader || isAdOptions || isAdImage || isAdCard) {
        // Double check it's not a message bubble itself
        if (element.hasAttribute('data-message-id')) return false;
        return true;
    }

    return false;
}

function removeAdElement(element) {
    if (!element || !element.parentNode) return false;

    try {
        // Mark as processed before removing
        processedElements.add(element);

        // ============================================
        // SMART HIDING: Find the ad block container
        // ============================================
        
        // If we found a small anchor (like the Ad options button), 
        // we want to hide the whole ad box, not just the button.
        let targetElement = element;
        
        const isAnchor = element.getAttribute('aria-label') === 'Ad options' || 
                         element.tagName === 'IMG' || 
                         element.tagName === 'H3' ||
                         element.tagName === 'BUTTON';

        if (isAnchor) {
            // Find the closest wrapper that usually contains the ad block components
            // (Typically 1-3 levels up for ChatGPT ads)
            const wrapper = element.closest('.flex.flex-col') || 
                            element.closest('[role="link"]') ||
                            element.closest('.flex.items-center.justify-between') ||
                            element.parentElement;
            
            if (wrapper && !wrapper.hasAttribute('data-message-id')) {
                targetElement = wrapper;
            }
        }

        // Apply hiding to the target container
        targetElement.style.display = 'none';
        targetElement.style.visibility = 'hidden';
        targetElement.style.height = '0px';
        targetElement.style.margin = '0px';
        targetElement.style.padding = '0px';
        targetElement.style.overflow = 'hidden';

        // Increment stats
        chrome.storage.local.get(['blockedAdsCount'], (result) => {
            const currentCount = result.blockedAdsCount || 0;
            const newCount = currentCount + 1;
            chrome.storage.local.set({ blockedAdsCount: newCount });

            if (!window.sessionBlockedCount) window.sessionBlockedCount = 0;
            window.sessionBlockedCount++;

            try {
                chrome.runtime.sendMessage({
                    action: 'AD_BLOCKED',
                    count: window.sessionBlockedCount
                });
            } catch (e) { }
        });

        console.log('[ChatGPT AdBlocker] Blocked ad unit:', targetElement);
        return true;
    } catch (error) {
        console.error(`[ChatGPT AdBlocker] Error removing ad element: ${error.message}`);
        return false;
    }
}

// ============================================
// Main Scanning Function
// ============================================

function scanForAds() {
    // Check if protection is enabled
    if (!config.enabled) {
        return; 
    }

    // NEW LOGIC: Instead of scanning the whole message bubble, 
    // we scan specifically for known AD components within the page.
    // This prevents the AI's actual text from being hidden.

    config.adSelectors.forEach(selector => {
        try {
            const adElements = document.querySelectorAll(selector);
            adElements.forEach(element => {
                // Double check it's not user content
                if (processedElements.has(element)) return;
                
                // We use isElementSponsored to verify it's a real ad element
                // and NOT a user message container
                if (isElementSponsored(element)) {
                    removeAdElement(element);
                }
            });
        } catch (e) { }
    });
}

// ============================================
// Mutation Observer
// ============================================

function setupObserver() {
    // Disconnect existing observer
    if (observer) {
        observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
        // Check if protection is enabled
        if (!config.enabled) {
            return;
        }

        let shouldScan = false;

        for (const mutation of mutations) {
            // Check added nodes
            if (mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node itself is sponsored
                        if (isElementSponsored(node)) {
                            removeAdElement(node);
                        } else {
                            shouldScan = true;
                        }
                    }
                }
            }

            // Check attribute changes
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target.nodeType === Node.ELEMENT_NODE && isElementSponsored(target)) {
                    removeAdElement(target);
                }
            }
        }

        if (shouldScan) {
            // Debounce could be added here if needed
            scanForAds();
        }
    });

    // Observe the entire document
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-sponsored', 'data-ad', 'aria-label']
    });
}

// ============================================
// CSS Injection & Removal
// ============================================

const STYLE_ID = 'chatgpt-adblocker-styles';

function removeBlockingCSS() {
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
        console.log('[ChatGPT AdBlocker] Protection disabled: CSS removed.');
    }
}

function injectBlockingCSS() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
        /* Hide elements with sponsored indicators, but EXCLUDE user content */
        [data-sponsored="true"]:not(form *),
        [data-ad="true"]:not(form *),
        [data-advertisement="true"]:not(form *),
        .sponsored-content:not([data-message-author-role="user"] *),
        .ad-container:not(form *),
        .advertisement:not([data-message-author-role="user"] *),
        [class*="sponsored" i]:not(form *):not([data-message-author-role="user"] *),
        [class*="advertisement" i]:not(form *):not([data-message-author-role="user"] *) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
        }
    `;

    document.head.appendChild(style);
    console.log('[ChatGPT AdBlocker] Protection enabled: CSS injected.');
}

// ============================================
// Initialization
// ============================================

const init = async () => {
    // Load setting using SYNC storage (to match background/popup)
    const result = await chrome.storage.sync.get(['adBlockEnabled', 'mutationObserverEnabled']);
    config.enabled = result.adBlockEnabled !== false; // Default true

    if (config.enabled) {
        injectBlockingCSS();
        scanForAds();

        if (result.mutationObserverEnabled !== false) {
            setupObserver();
        }
    } else {
        removeBlockingCSS();
    }
};

// ============================================
// Message Listener
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "UPDATE_SETTINGS") {
        const wasEnabled = config.enabled;
        config.enabled = request.adBlockEnabled;
        
        if (config.enabled) {
            injectBlockingCSS();
            scanForAds();
            if (request.mutationObserverEnabled) {
                setupObserver();
            } else {
                if (observer) observer.disconnect();
            }
        } else {
            // Extension turned OFF
            if (observer) observer.disconnect();
            removeBlockingCSS();
            // Refresh counts for the session
            window.sessionBlockedCount = 0;
        }
    }
});

// ============================================
// Reporting & Sanitization
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_SANITIZED_HTML") {
        try {
            const cleanHTML = getSanitizedHTML();
            sendResponse({ html: cleanHTML });
        } catch (e) {
            console.error("[ChatGPT AdBlocker] Error sanitizing HTML:", e);
            sendResponse({ error: e.message });
        }
    }
    // Return true is required for async sendResponse
    if (request.action === "GET_SANITIZED_HTML") return true;
});

function getSanitizedHTML() {
    const clone = document.body.cloneNode(true);

    // Remove scripts and media
    clone.querySelectorAll('script, style, iframe, svg, img, video').forEach(el => el.remove());

    // Redact user chat history
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.length > 150) {
            node.nodeValue = "[REDACTED_CONTENT]";
        }
    }
    return clone.innerHTML;
}

// Run
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
