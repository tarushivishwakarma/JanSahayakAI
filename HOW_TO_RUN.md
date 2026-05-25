# JanSahayak AI – How to Run

## ✅ Correct Way to Open
**Double-click `start.bat`** in the `JanSahayak` folder.

This will:
1. Start a local web server
2. Automatically open http://localhost:8080 in your browser

## ❌ Wrong Way (will NOT work)
**Do NOT** double-click `index.html` directly.  
Opening it as a `file://` URL breaks ES modules and the scheme data won't load.

## Why?
The app uses:
- **ES Modules** (`import/export`) — browsers block these on `file://`
- **`fetch()`** for `schemes.json` — blocked on `file://`
- **Firebase** — requires HTTP context

## Stop the Server
Press `Ctrl+C` in the terminal window that `start.bat` opened.
