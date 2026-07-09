# Attachment Upload Fix

## Problem Identified
Files are not being saved when users submit tickers with attachments. The diagnostic showed:
- 0 attachments in database
- Empty uploads directory
- Files aren't being received by backend (req.files is empty/undefined)

## Quick Fix - Add Debug Logging

Add this logging to `server.js` line 152 (right after `try {` in the `/api/submissions` endpoint):

```javascript
app.post('/api/submissions', upload.array('attachments', 5), async (req, res) => {
    try {
        // DEBUG: Log file upload status
        console.log('\n=== FILE UPLOAD DEBUG ===');
        console.log('Files received:', req.files ? req.files.length : 0);
        if (req.files && req.files.length > 0) {
            console.log('File details:');
            req.files.forEach(f => console.log(`  - ${f.originalname} (${f.size} bytes)`));
        } else {
            console.log('NO FILES RECEIVED - req.files is', req.files);
        }
        console.log('=========================\n');

        const {
            ticker,
            // ... rest of code
```

Then after line 213 (inside the db.run for attachments), add:

```javascript
                ]);
                console.log(`Saved attachment: ${file.originalname} -> ${file.filename}`);
            });
```

## Test It

1. Start the server: `cd server && node server.js`
2. Open watchlist.html in browser
3. Submit a ticker with a PDF attached
4. Check server console for debug output
5. This will show if files are being received

## Likely Root Causes

Based on code analysis, if files aren't being received:

1. **CORS issue** - multipart/form-data might be blocked
2. **Frontend not sending files** - FormData might be empty
3. **Multer silently rejecting files** - file type or size issue

## Next Steps After Testing

Once we see the debug output, we can determine:
- If files are received but not saved → database issue
- If files aren't received at all → frontend or CORS issue
- If Multer is rejecting files → file filter issue

