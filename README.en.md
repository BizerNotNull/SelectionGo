# SelectionGo

Chrome/Edge extension built with Manifest V3. Highlight text, open the context menu, and run searches through customizable providers that can appear in the primary menu or an "Search with others" submenu. Configurations (name, URL, and menu level) live in `chrome.storage.sync`, support import/export, and now match the browser language automatically.

## Features
- Adds "Search with XX" entries to the primary context menu when text is selected.
- Creates a "Search with others" secondary menu to hold additional providers.
- Popup page (extension icon) lets you:
  - Add or remove custom search providers.
  - Edit names and URLs (use `SelectionGo`, `{{query}}`, or `{{selection}}` as placeholders for selected text).
  - Choose whether each provider stays in the primary or secondary menu.
  - Auto-select the UI language on install based on browser locale; manual toggle between Chinese / English.
  - Save edits instantly—no extra "Save" click required.
  - Import / export JSON configuration files.
- When a search URL contains one of the supported placeholders it is replaced directly; if no placeholder exists, the extension tries to overwrite common query parameters (`q`, `keyword`, `wd`, etc.) before appending a `q=` parameter.

## Development / Testing
1. Open `chrome://extensions` or `edge://extensions` and enable Developer Mode.
2. Click "Load unpacked" and choose this repository folder.
3. Select text on any page and right-click to see the generated menu entries.
4. Adjust providers from the popup (extension icon) and verify that changes sync instantly with the context menu.
