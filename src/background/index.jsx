
// Default settings
const DEFAULT_SETTINGS = {
    adBlockEnabled: true,
    mutationObserverEnabled: true,
    logBlockedAds: false
};

const DEFAULT_RULES = {
    "version": 1.1,
    "css_selectors": [
        "[data-testid='ad-slot']",
        "[data-testid*='ad-unit']",
        "[data-testid*='brand']",
        ".sponsored-message",
        ".ad-card",
        ".ad-unit",
        ".brand-identifier",
        ".ask-chatgpt",
        ".sponsored-follow-up",
        "div[aria-label*='Sponsored' i]",
        "div[aria-label*='Sponsor' i]"
    ],
    "keywords": [
        "Sponsored", 
        "Sponsor", 
        "Promoted", 
        "Ad", 
        "Advertisement", 
        "Ask ChatGPT", 
        "Follow-up",
        "Brand"
    ],
    "text_threshold": 120
};

// Listen for install
chrome.runtime.onInstalled.addListener(() => {
    console.log("ChatGPT Ad Blocker installed.");
    // Initialize storage if not present
    chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
        console.log("Default settings initialized.");
    });

    // Set default rules locally
    chrome.storage.local.set({ adBlockRules: DEFAULT_RULES }, () => {
        console.log("Default AdBlock Rules initialized.");
    });
});


// Communication with popup/options/content
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_SETTINGS') {
        chrome.storage.sync.get(['adBlockEnabled', 'mutationObserverEnabled', 'logBlockedAds'], (items) => {
            sendResponse(items);
        });
        return true;
    }

    if (request.action === 'UPDATE_SETTINGS') {
        chrome.storage.sync.set(request.payload, () => {
            chrome.tabs.query({ url: ["*://chatgpt.com/*", "*://chat.openai.com/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "UPDATE_SETTINGS",
                        ...request.payload
                    }).catch((e) => { });
                });
            });
            sendResponse({ status: 'ok' });
        });
        return true;
    }

    if (request.action === 'AD_BLOCKED') {
        // Update badge for the specific tab
        if (sender.tab && sender.tab.id) {
            chrome.action.setBadgeText({
                text: request.count.toString(),
                tabId: sender.tab.id
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#4B5563', // Gray-600 to match dark theme
                tabId: sender.tab.id
            });
        }
    }
});
