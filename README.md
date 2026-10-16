# Cobra Barcode Generator

Static website for Cobra's barcode label workflow, with the Chrome extension bridge for fetching Return Address CSV data from the already-authenticated Delhivery RPC session.

## Deploy to GitHub + Vercel

1. Create/open the GitHub repository.
2. Upload the **contents of this folder** to the repository root (do not upload the enclosing folder or ZIP as a single file). `index.html`, `vercel.json`, `advanced-app.js`, `ui.js`, `style.css`, `extension/`, and `FILE09/` should be visible at the repository root.
3. Import the repository into Vercel. Framework Preset: `Other`; leave build and output directory blank.
4. Deploy the project.

## Install/update the Chrome extension

1. Open `/FILE09/` on the deployed website and download the extension ZIP, or use the root `cobra-rpc-extension.zip`.
2. Extract it to a permanent folder.
3. In Chrome, open `chrome://extensions/`, enable Developer mode, remove the previous Cobra bridge if necessary, then click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Open the extension's **Details** and set **Site access** to allow `https://cobra-web-09-676r.vercel.app` (or choose “On all sites” only if you intentionally want that broader permission).
5. Ensure the extension is enabled, then refresh the Cobra website.
6. Sign in to Delhivery RPC in the same Chrome profile before fetching Waybills.

The extension manifest allows the current Vercel host `cobra-web-09-e5c4.vercel.app` and the previous host `cobra-web-09-676r.vercel.app`. If you change the Vercel project/domain, update `host_permissions` and `content_scripts.matches` in `extension/manifest.json`, rebuild `cobra-rpc-extension.zip`, and reinstall/reload the extension.

## Important

The extension UI gate is not server-side authentication and should not be treated as protection for confidential information. This static site does not store RPC credentials. The browser extension uses the logged-in RPC session.
