
// ============================================
// ChatGPT Ad Blocker Configuration
// ============================================

const config = {
    // Protection enabled/disabled state (will be synced with storage)
    enabled: true,

    // Patterns to detect sponsored content
    sponsoredPatterns: [
        /\bsponsored\b/i,
        /\badvertisement\b/i,
        /\bpromoted\b/i,
        /\bpartner content\b/i,
        /\bpaid promotion\b/i,
        /\bad\s*$/i,
        /\[ad\]/i,
        /\(sponsored\)/i,
        /\bthis is an ad\b/i,  // Word boundary to avoid matching "this is an adjective"
    ],

    // CSS selectors that might contain ads
    adSelectors: [
        '[data-sponsored]',
        '[data-ad]',
        '[data-advertisement]',
        '[aria-label*="sponsored" i]',
        '[aria-label*="advertisement" i]',
        '[class*="sponsored" i]',
        '[class*="advertisement" i]',
        '[id*="sponsored" i]',
        '[id*="advertisement" i]',
        '.ad-container',
        '.sponsored-content',
        '.promotion',
        '[data-testid*="ad"]',
        '[data-testid*="sponsored"]',
        'div[role="complementary"]', // Generic sidebar ads
        ".sys-ad-container",
    ],

    // Additional attributes to check
    suspiciousAttributes: [
        'data-ad',
        'data-sponsored',
        'data-promotion',
        'data-partner',
    ]
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
    // CRITICAL: Only check assistant messages, not user messages
    // ============================================

    // Skip user messages entirely (they have class "user-message-bubble-color")
    if (element.classList && element.classList.contains('user-message-bubble-color')) {
        return false;
    }

    // Skip if this element is inside a user message
    if (element.closest && element.closest('.user-message-bubble-color')) {
        return false;
    }

    // Only process assistant messages or specific ad containers
    // Assistant messages have data-message-author-role="assistant"
    const isAssistantMessage = element.getAttribute('data-message-author-role') === 'assistant' ||
        (element.closest && element.closest('[data-message-author-role="assistant"]'));

    const isPotentialAdContainer = config.adSelectors.some(sel => {
        try { return element.matches(sel); } catch (e) { return false; }
    });

    if (!isAssistantMessage && !isPotentialAdContainer) {
        // Continue checking if it matches ad selectors directly, but be careful
    }


    // Check 1: CSS Selectors
    for (const selector of config.adSelectors) {
        try {
            if (element.matches(selector)) {
                return true;
            }
        } catch (e) {
            // Invalid selector, skip
        }
    }

    // Check 2: Suspicious attributes
    if (hasAttribute(element, config.suspiciousAttributes)) {
        return true;
    }

    // Check 3: Text content patterns
    const text = getElementText(element);
    if (text && matchesPattern(text, config.sponsoredPatterns)) {
        return true;
    }

    // Check 4: Aria labels
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && matchesPattern(ariaLabel, config.sponsoredPatterns)) {
        return true;
    }

    // Check 5: Data attributes
    const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}=${attr.value}`);

    for (const dataAttr of dataAttrs) {
        if (matchesPattern(dataAttr, config.sponsoredPatterns)) {
            return true;
        }
    }

    // Check 6: Child elements with sponsored indicators (shallow check)
    // We don't want to traverse too deep or remove parents based on deep children usually,
    // but for specific known structures it's useful.
    if (element.children.length > 0 && element.children.length < 5) {
        const childText = Array.from(element.querySelectorAll('*'))
            .map(child => getElementText(child))
            .join(' ');

        if (childText && matchesPattern(childText, config.sponsoredPatterns)) {
            return true;
        }
    }

    return false;
}

function removeAdElement(element) {
    if (!element || !element.parentNode) return false;

    try {
        // Mark as processed before removing
        processedElements.add(element);

        // Try to find the parent container (message container)
        let targetElement = element;

        // Look for common ChatGPT message containers
        const messageContainer = element.closest('[data-message-id]') ||
            element.closest('.group') ||
            element.closest('[class*="message"]') ||
            element;

        if (messageContainer && messageContainer !== element) {
            targetElement = messageContainer;
        }

        // Hide instead of remove to avoid hydration issues if possible, or just remove
        targetElement.style.display = 'none';

        // Also remove from DOM after a moment to clean up? 
        // Safer to just hide for React apps, but removal works too.
        // targetElement.remove();

        // Increment stats
        chrome.storage.local.get(['blockedAdsCount'], (result) => {
            const currentCount = result.blockedAdsCount || 0;
            const newCount = currentCount + 1;
            chrome.storage.local.set({ blockedAdsCount: newCount });

            // Send message to update badge
            // We use a simple session count or total? Usually badge is per session/page load or total.
            // Let's use total for now, or maybe just "1+"?
            // Actually, badge usually reflects "this page". Let's track a session variable.
            if (!window.sessionBlockedCount) window.sessionBlockedCount = 0;
            window.sessionBlockedCount++;

            try {
                chrome.runtime.sendMessage({
                    action: 'AD_BLOCKED',
                    count: window.sessionBlockedCount
                });
            } catch (e) { }
        });

        console.log('[ChatGPT AdBlocker] Blocked sponsored content:', targetElement);
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
        return; // Protection is OFF, don't scan
    }

    // Scan ONLY assistant messages, not user messages
    // Assistant messages have data-message-author-role="assistant"
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');

    messages.forEach(message => {
        if (isElementSponsored(message)) {
            removeAdElement(message);
        }
    });

    // Also scan for standalone ad elements based on selectors
    config.adSelectors.forEach(selector => {
        try {
            const adElements = document.querySelectorAll(selector);
            adElements.forEach(element => {
                if (!processedElements.has(element)) {
                    // Check if it's really an ad (double check logic inside removes false positives)
                    // or just trust the selector
                    if (isElementSponsored(element) || element.matches(selector)) {
                        removeAdElement(element);
                    }
                }
            });
        } catch (e) {
            // Invalid selector
        }
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
// CSS Injection
// ============================================

function injectBlockingCSS() {
    const styleId = 'chatgpt-adblocker-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;

    style.textContent = `
        /* Hide elements with sponsored indicators */
        [data-sponsored="true"],
        [data-ad="true"],
        [data-advertisement="true"],
        .sponsored-content,
        .ad-container,
        .advertisement,
        [class*="sponsored" i],
        [class*="advertisement" i] {
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
}

// ============================================
// Initialization
// ============================================

const init = async () => {
    // Load setting
    const result = await chrome.storage.local.get(['adBlockEnabled', 'mutationObserverEnabled']);
    config.enabled = result.adBlockEnabled !== false; // Default true

    if (config.enabled) {
        injectBlockingCSS();
        scanForAds();

        if (result.mutationObserverEnabled !== false) {
            setupObserver();
        }
    }
};

// ============================================
// Message Listener
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "UPDATE_SETTINGS") {
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
            if (observer) observer.disconnect();
            // Optionally remove CSS, but usually okay to leave it
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
