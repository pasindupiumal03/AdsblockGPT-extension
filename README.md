
# AdsblockGPT - ChatGPT Ad Blocker 🛡️

## Powerful, Privacy-First Ad Blocking for ChatGPT

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore/detail/your-extension-id)
[![Discord](https://img.shields.io/discord/your-discord-id?logo=discord&label=Support)](https://discord.gg/your-invite)

**AdsblockGPT** is a lightweight, open-source Chrome extension designed to remove sponsored content, sidebar ads, and promotional messages from ChatGPT, ensuring a cleaner, faster, and distraction-free experience.

### ✨ Key Features

-   **🚫 Advanced Ad Blocking**: Detects and removes sponsored messages, "AD" labels, and elusive promotional content using smart regex patterns and CSS selectors.
-   **⚡ Real-Time Protection**: Uses highly optimized MutationObservers to intercept and block ads instantly as they appear in the chat stream.
-   **🔒 Privacy Focused**: 100% local processing. No user data is collected or sent to external servers (except for anonymized ad reports you choose to send).
-   **📊 Statistics Dashboard**: Track the total number of ads blocked and calculate the time saved from interruptions.
-   **🚨 Report Tool**: Encounter a new ad? Use the built-in "Report Ad Layout" feature to securely send sanitized HTML to developers for rapid updates.
-   **🎨 Modern UI**: Includes a sleek popup interface with smooth animations, dark mode compatibility, and easy toggle controls.

### 🚀 Installation (Developer Mode)

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/yourusername/AdsblockGPT.git
    cd AdsblockGPT
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Build the Extension**:
    ```bash
    npm run build
    # or
    yarn build
    ```

4.  **Load in Chrome**:
    -   Navigate to `chrome://extensions/` in your browser.
    -   Enable **"Developer mode"** in the top right corner.
    -   Click **"Load unpacked"**.
    -   Select the `dist` folder generated in your project directory.

### 🛠️ Development

-   **Start Development Server**: runs webpack in watch mode.
    ```bash
    npm run start
    # or
    yarn start
    ```

-   **Build for Production**:
    ```bash
    npm run build
    # or
    yarn build
    ```

### 🤝 Contributing

We welcome contributions! If you encounter unblocked ads or have ideas for improvements:
1.  Use the **"Report Ad Layout"** button in the extension popup.
2.  Open an issue or pull request on our GitHub repository.

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🔗 Links

-   [Official Website](https://adsblockgpt.vercel.app/)
-   [Support & Community](https://discord.gg/your-discord)

---

**Made with ❤️ for a cleaner ChatGPT experience.**