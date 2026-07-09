# Attachment Issue - Complete Analysis & Fix

## Executive Summary

**Problem:** File attachments uploaded during ticker submission are not visible in the review/results view.

**Root Cause:** Files are not being saved to the database or disk. The frontend appears to upload files, but the backend is not receiving them (req.files is empty/undefined).

**Status:** Display code is already correct ✓ - Issue is only with file upload/storage ✗

---

## Investigation Results

### 1. Database Check
```
=== ALL Attachments in Database ===
All attachments: []  ← EMPTY!
```

### 2. Uploads Directory Check
```
drwxr-xr-x uploads/  ← EMPTY! (only . and .. entries)
```

### 3. Code Analysis

#### Backend (server/server.js) ✓ Code looks correct
- Line 150: Endpoint configured with multer: `upload.array('attachments', 5)` ✓
- Line 201-214: Attachments inserted into database IF req.files exists ✓
- Line 264: Attachments fetched and returned with submission ✓
- Line 623-632: File download endpoint exists ✓

**Issue:** No error handling or logging when req.files is empty - silently skipped!

#### Frontend (watchlist-app.js) ✓ Code looks correct
- Line 626-629: Files appended to FormData correctly ✓
- Line 218-229: Attachments displayed when submission.attachments exists ✓
- Line 780-789: Attachments shown in review form ✓
- Line 224: Download link format: `${API_URL}/files/${att.filepath}` ✓

**Frontend is doing everything right!**

---

## Why Files Aren't Being Received

Possible causes (in order of likelihood):

### 1. **Frontend/Browser Issue** (Most Likely)
- Files not actually being selected by user
- Browser blocking file selection
- FormData not including files due to same-origin policy

### 2. **Multer Silently Rejecting Files**
- File type not in allowed list (but would throw error)
- File size exceeds 25MB limit (multer silently skips)
- Multer middleware error not being caught

### 3. **CORS Blocking multipart/form-data**
- Though CORS config looks correct for localhost and production

---

## The Fix

### Step 1: Add Debug Logging

Add to `server/server.js` at line 152 (right after `try {`):

```javascript
app.post('/api/submissions', upload.array('attachments', 5), async (req, res) => {
    try {
        // DEBUG: Log file upload status
        console.log('\n=== SUBMISSION DEBUG ===');
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Files received:', req.files ? req.files.length : 0);
        if (req.files && req.files.length > 0) {
            console.log('File details:');
            req.files.forEach(f => console.log(`  - ${f.originalname} (${f.size} bytes)`));
        } else {
            console.log('NO FILES - req.files is:', req.files);
        }
        console.log('========================\n');

        const {
            ticker,
            companyName,
            // ... rest continues
```

### Step 2: Add Success Logging

After line 212 (inside attachments forEach), add:

```javascript
                ]);
                console.log(`✓ Saved: ${file.originalname} -> ${file.filename}`);
            });
```

### Step 3: Add No-Files Warning

After line 214 (closing brace of forEach), add:

```javascript
        } else {
            console.log('[WARNING] No attachments received in request');
        }
```

### Step 4: Add Multer Error Handler

After line 91 (after multer config), add:

```javascript
// Multer error handler
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
        next(err);
    }
});
```

---

## Testing Protocol

1. **Start server with logging:**
   ```bash
   cd server
   node server.js
   ```

2. **Open browser console** (F12) and go to oldlogancapital.com/watchlist

3. **Submit a test ticker with a small PDF** (<1MB):
   - Submitter: Paxton Thompson
   - Ticker: TEST
   - Company: Test Company
   - Fill all required fields
   - **Attach a PDF file**
   - Submit

4. **Check server console output:**
   - Look for "=== SUBMISSION DEBUG ==="
   - Check if "Files received: 0" or "Files received: 1"

5. **Verify in database:**
   ```bash
   node check-attachments.js
   ```

---

## Expected Outcomes

### If Files ARE Received (req.files has data):
```
=== SUBMISSION DEBUG ===
Files received: 1
File details:
  - test.pdf (45231 bytes)
========================
✓ Saved: test.pdf -> 1736234567-123456789.pdf
```
→ **Issue:** Database/save logic (unlikely based on code review)

### If Files are NOT Received (req.files is empty/undefined):
```
=== SUBMISSION DEBUG ===
Files received: 0
NO FILES - req.files is: undefined
========================
[WARNING] No attachments received in request
```
→ **Issue:** Frontend not sending files OR multer not processing them

---

## Frontend Debugging (If Files Not Received)

Add to `watchlist-app.js` line 627 (in handleSubmit function):

```javascript
    // Add files
    const files = document.getElementById('attachments').files;
    console.log('DEBUG: Files to upload:', files.length);
    for (let i = 0; i < files.length; i++) {
        console.log(`  File ${i}:`, files[i].name, files[i].size, files[i].type);
        formData.append('attachments', files[i]);
    }

    // DEBUG: Log FormData contents
    console.log('FormData contents:');
    for (let [key, value] of formData.entries()) {
        if (value instanceof File) {
            console.log(`  ${key}:`, value.name, value.size);
        } else {
            console.log(`  ${key}:`, value);
        }
    }
```

---

## Next Steps After Diagnosis

1. **If frontend shows files but backend doesn't receive them:**
   - Check browser network tab for the request payload
   - Verify Content-Type is `multipart/form-data` with boundary
   - Check for CORS errors in browser console

2. **If Multer is silently rejecting:**
   - Check file types against allowed list
   - Try with different file types
   - Reduce file size below 1MB

3. **If files ARE being received and saved:**
   - Run `check-attachments.js` to verify DB
   - Check `server/uploads/` directory for files
   - Issue is with display logic (unlikely - code looks correct)

---

## Display Code Verification

The display code is already correct and will work once files are being saved:

**In viewSubmission() function (watchlist-app.js:218-229):**
```javascript
if (submission.attachments && submission.attachments.length > 0) {
    html += `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem;">Attachments</h3>
            <ul class="attachment-list">
                ${submission.attachments.map(att => `
                    <li><a href="${API_URL}/files/${att.filepath}" target="_blank">📎 ${att.filename}</a></li>
                `).join('')}
            </ul>
        </div>
    `;
}
```

This code:
- ✓ Checks if attachments exist
- ✓ Creates download links
- ✓ Opens in new tab (target="_blank")
- ✓ Uses correct API endpoint (/api/files/:filename)

---

## File Type Handling

Current backend supports:
- PDFs (`.pdf`)
- Images (`.png`, `.jpg`, `.jpeg`)
- Spreadsheets (`.xlsx`, `.xls`, `.csv`)
- Documents (`.doc`, `.docx`)

The `/api/files/:filename` endpoint (server.js:623-632) serves files with `res.download()`, which:
- Sets correct Content-Type headers
- Triggers download for most file types
- PDFs/images will open in browser if browser supports
- Other types will download

**This is already correct behavior! No changes needed for file type handling.**

---

## Summary

### What's Working ✓
- Frontend file selection UI
- Frontend FormData construction
- Backend multer configuration
- Backend database schema
- Backend file download endpoint
- Display code in review view

### What's Broken ✗
- Files not reaching backend (req.files is empty)
- No error handling/logging for missing files

### Priority Fix
**Add debug logging first** to diagnose WHERE files are getting lost in the pipeline. Once we see the logs, the exact issue will be clear and we can apply the appropriate fix.

