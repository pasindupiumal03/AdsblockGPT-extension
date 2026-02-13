import React, { useState, useEffect } from 'react';
import logo from '../assets/icons/logo3.webp';

const Popup = () => {
    const [settings, setSettings] = useState({
        adBlockEnabled: true,
        mutationObserverEnabled: true
    });
    const [stats, setStats] = useState({
        blockedAdsCount: 0
    });

    useEffect(() => {
        // Load settings and stats
        chrome.storage.sync.get(['adBlockEnabled'], (result) => {
            setSettings(prev => ({
                ...prev,
                adBlockEnabled: result.adBlockEnabled !== false
            }));
        });

        chrome.storage.local.get(['blockedAdsCount'], (result) => {
            setStats({
                blockedAdsCount: result.blockedAdsCount || 0
            });
        });

        // Listen for storage changes to update stats in real-time
        const storageListener = (changes, area) => {
            if (area === 'local' && changes.blockedAdsCount) {
                setStats(prev => ({ ...prev, blockedAdsCount: changes.blockedAdsCount.newValue }));
            }
            if (area === 'sync' && changes.adBlockEnabled) {
                setSettings(prev => ({ ...prev, adBlockEnabled: changes.adBlockEnabled.newValue }));
            }
        };
        chrome.storage.onChanged.addListener(storageListener);

        return () => {
            chrome.storage.onChanged.removeListener(storageListener);
        };
    }, []);

    const toggleAdBlock = () => {
        const newEnabled = !settings.adBlockEnabled;
        const newSettings = { ...settings, adBlockEnabled: newEnabled };
        setSettings(newSettings);

        chrome.storage.sync.set({ adBlockEnabled: newEnabled }, () => {
            // Broadcast update
            chrome.runtime.sendMessage({ action: "UPDATE_SETTINGS", payload: newSettings });
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "UPDATE_SETTINGS", ...newSettings }).catch(() => { });
                }
            });
        });
    };

    // Calculate time saved: 5 seconds per ad (arbitrary estimation)
    const timeSavedMinutes = Math.floor((stats.blockedAdsCount * 5) / 60);

    const [reportStatus, setReportStatus] = useState({ text: "Report Ad Layout", disabled: false, color: "text-gray-500" });

    const handleReport = async () => {
        setReportStatus({ text: "Scanning...", disabled: true, color: "text-blue-500" });

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || (!tab.url.includes("chatgpt.com") && !tab.url.includes("openai.com"))) {
                setReportStatus({ text: "Not ChatGPT", disabled: false, color: "text-red-500" });
                setTimeout(() => setReportStatus({ text: "Report Ad Layout", disabled: false, color: "text-gray-500" }), 2000);
                return;
            }

            chrome.tabs.sendMessage(tab.id, { action: "GET_SANITIZED_HTML" }, (response) => {
                if (chrome.runtime.lastError || !response || !response.html) {
                    setReportStatus({ text: "Error Scanning", disabled: false, color: "text-red-500" });
                    setTimeout(() => setReportStatus({ text: "Report Ad Layout", disabled: false, color: "text-gray-500" }), 2000);
                    return;
                }

                sendReport(response.html);
            });

        } catch (err) {
            setReportStatus({ text: "Error", disabled: false, color: "text-red-500" });
            setTimeout(() => setReportStatus({ text: "Report Ad Layout", disabled: false, color: "text-gray-500" }), 2000);
        }
    };

    const sendReport = (htmlData) => {
        const WEBHOOK_URL = "https://discord.com/api/webhooks/1470672111038103553/zkuhZvXgJ1auAbCTASubhGNF-wB2iTKVnvnp_uh3mCE8unGTTZBx49B6ZQzrEupkwr_f";
        setReportStatus({ text: "Sending...", disabled: true, color: "text-blue-500" });

        const payload = {
            content: "**New Ad Report Received** ",
            embeds: [{
                title: "Page Dump",
                description: "Attached HTML structure for analysis.",
                color: 15158332,
                fields: [{ name: "Time", value: new Date().toISOString() }]
            }]
        };

        const blob = new Blob([htmlData], { type: 'text/html' });
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(payload));
        formData.append('file', blob, 'page_dump.html');

        fetch(WEBHOOK_URL, {
            method: "POST",
            body: formData
        })
            .then(res => {
                if (res.ok) {
                    setReportStatus({ text: "Report Sent!", disabled: false, color: "text-green-500" });
                } else {
                    throw new Error("Server error");
                }
            })
            .catch(err => {
                setReportStatus({ text: "Failed to Send", disabled: false, color: "text-red-500" });
            })
            .finally(() => {
                setTimeout(() => setReportStatus({ text: "Report Ad Layout", disabled: false, color: "text-gray-500" }), 3000);
            });
    }

    return (
        <div className="w-full h-full min-h-[400px] bg-white text-black font-sans relative flex flex-col items-center justify-between p-6">

            {/* Header */}
            <header className="flex items-center self-start gap-3 w-full mb-8">
                <div>
                    <img src={logo} alt="Logo" className="w-10 h-10 object-cover drop-shadow-sm" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-black">AdsblockGPT</h1>
            </header>

            {/* Main Control */}
            <div className="flex flex-col items-center justify-center flex-1 w-full mb-8">

                {/* Power Button */}
                <button
                    onClick={toggleAdBlock}
                    className={`
                        w-32 h-32 rounded-full border-4 flex items-center justify-center
                        transition-all duration-300 ease-in-out cursor-pointer
                        backdrop-blur-xl relative
                        ${settings.adBlockEnabled
                            ? 'bg-green-50/50 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]'
                            : 'bg-red-50/50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                        }
                    `}
                >
                    {/* Pulse Effect Rings */}
                    {settings.adBlockEnabled && (
                        <>
                            <div className="absolute inset-0 rounded-full border-2 border-green-500 opacity-20 animate-ping"></div>
                            <div className="absolute inset-2 rounded-full border border-green-400 opacity-40 animate-pulse"></div>
                        </>
                    )}

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`w-14 h-14 transition-colors duration-300 relative z-10 ${settings.adBlockEnabled ? 'text-green-500 drop-shadow-md' : 'text-red-500 drop-shadow-md'
                            }`}
                    >
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                </button>

                <div className="mt-8 text-center">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-lg font-bold transition-colors duration-300 ${settings.adBlockEnabled ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {settings.adBlockEnabled ? 'Ads Blocker is activated' : 'Ads Blocker is not activated'}
                    </p>
                </div>
            </div>

            {/* Statistics Footer */}
            <div className="w-full grid grid-cols-2 gap-4 mb-4">
                {/* Blocked Ads */}
                <div className="bg-red-50/80 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center justify-center border border-red-100 shadow-sm">
                    <svg className="w-6 h-6 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="text-2xl font-bold text-gray-800">{stats.blockedAdsCount}</span>
                    <span className="text-xs text-gray-500 font-medium">Ads Blocked</span>
                </div>

                {/* Time Saved */}
                <div className="bg-blue-50/80 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center justify-center border border-blue-100 shadow-sm">
                    <svg className="w-6 h-6 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-2xl font-bold text-gray-800">{timeSavedMinutes}</span>
                    <span className="text-xs text-gray-500 font-medium">Minutes Saved</span>
                </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => chrome.tabs.create({ url: 'https://adsblockgpt.vercel.app/' })}
                    className="text-xs font-semibold text-gray-500 hover:text-black hover:underline transition-all"
                >
                    About Us
                </button>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <button
                    onClick={handleReport}
                    disabled={reportStatus.disabled}
                    className={`text-xs font-semibold underline decoration-dotted hover:decoration-solid ${reportStatus.color} transition-all`}
                >
                    {reportStatus.text}
                </button>
            </div>

        </div>
    );
};

export default Popup;
