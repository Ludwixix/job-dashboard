/**
 * googleSheetService.js
 * Google Sheets API v4 Integration
 * Automatically creates and updates personalized Job Application Tracker spreadsheets in the user's Google Drive.
 */

const HEADERS = [
  "Match Score",
  "Application Date",
  "Company Name",
  "Job Title",
  "Location / Suburb",
  "Application Status",
  "Compensation / Salary",
  "Source / Channel",
  "Job Ad Link",
  "Google Drive Package",
  "Notes & Telemetry"
];

/**
 * Creates a brand new, fully styled Job Tracker spreadsheet in the user's Google Drive
 */
export const createPersonalJobTrackerSheet = async (accessToken, userProfile) => {
  if (!accessToken) {
    throw new Error('Google OAuth Access Token is required to create a spreadsheet.');
  }

  const title = `Job Applications Tracker — ${userProfile?.name || 'My Applications'}`;

  // 1. Create Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: 'Applications',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Sheet: ${createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Insert Header Row
  const appendHeaderRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applications!A1:K1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        values: [HEADERS]
      })
    }
  );

  if (!appendHeaderRes.ok) {
    console.warn('Could not write headers to sheet:', appendHeaderRes.statusText);
  }

  // 3. Apply Formatting (Dark Indigo Header, Bold White Text)
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.15, green: 0.15, blue: 0.25 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10
                  },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: HEADERS.length
              }
            }
          }
        ]
      })
    });
  } catch (e) {
    console.warn('Formatting request failed (non-critical):', e);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    title
  };
};

/**
 * Formats a job object into a standard row array for the spreadsheet
 */
const formatJobRow = (job, userProfile) => {
  return [
    job.score ? `${job.score}%` : '85%',
    job.date || new Date().toISOString().split('T')[0],
    job.company || 'Unknown Company',
    job.title || 'Untitled Role',
    job.location || userProfile?.location || 'Melbourne, VIC',
    job.status || 'Applied / Confirmation Received',
    job.salary || userProfile?.targetSalary || '$115,000 + Super',
    job.source || 'Direct Portal',
    job.portalLink || job.link || '',
    job.hasCustomDocs ? '✅ Ready in Google Drive' : 'Pending',
    (job.notes || job.why || '').replace(/<[^>]*>/g, '').slice(0, 200)
  ];
};

/**
 * Appends a single job application to the user's personal Google Sheet
 */
export const appendApplicationToSheet = async (accessToken, spreadsheetId, job, userProfile) => {
  if (!accessToken || !spreadsheetId || !job) return { success: false };

  const row = formatJobRow(job, userProfile);

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applications!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          values: [row]
        })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Error appending application to personal Google Sheet:', err);
      return { success: false, error: err };
    }
    return { success: true, action: 'appended' };
  } catch (e) {
    console.error('Failed to append to Google Sheet:', e);
    return { success: false, error: e.message };
  }
};

/**
 * Upserts a job application in the user's personal Google Sheet.
 * Reads existing sheet rows, finds match by Company + Title, updates the row or appends a new one.
 */
export const upsertApplicationInSheet = async (accessToken, spreadsheetId, job, userProfile) => {
  if (!accessToken || !spreadsheetId || !job) return { success: false };
  if (accessToken.startsWith('simulated_')) return { success: false, simulated: true };

  const row = formatJobRow(job, userProfile);
  const targetCompany = String(job.company || '').trim().toLowerCase();
  const targetTitle = String(job.title || '').trim().toLowerCase();

  try {
    // 1. Fetch current rows from the sheet
    const getRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applications!A:K`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (getRes.ok) {
      const data = await getRes.json();
      const existingRows = data.values || [];
      
      // Row 1 (index 0) is headers. Search from row 2 (index 1)
      let foundRowIndex = -1;
      for (let i = 1; i < existingRows.length; i++) {
        const r = existingRows[i];
        const rowComp = String(r[2] || '').trim().toLowerCase();
        const rowTitle = String(r[3] || '').trim().toLowerCase();
        if (rowComp && targetCompany && (rowComp === targetCompany || rowComp.includes(targetCompany) || targetCompany.includes(rowComp))) {
          if (rowTitle && targetTitle && (rowTitle === targetTitle || rowTitle.includes(targetTitle) || targetTitle.includes(rowTitle))) {
            foundRowIndex = i + 1; // 1-based row number for Sheets API
            break;
          }
        }
      }

      if (foundRowIndex > 1) {
        // Update existing row
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applications!A${foundRowIndex}:K${foundRowIndex}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ values: [row] })
          }
        );
        return { success: updateRes.ok, action: 'updated', row: foundRowIndex };
      }
    }

    // If not found or get failed, append new row
    return await appendApplicationToSheet(accessToken, spreadsheetId, job, userProfile);
  } catch (err) {
    console.warn('Google Sheet upsert failed, attempting direct append:', err);
    return await appendApplicationToSheet(accessToken, spreadsheetId, job, userProfile);
  }
};

/**
 * Syncs an array of applications in bulk to the user's Google Sheet
 */
export const syncAllApplicationsToSheet = async (accessToken, spreadsheetId, jobs, userProfile) => {
  if (!accessToken || !spreadsheetId || !jobs || jobs.length === 0) return { count: 0 };
  if (accessToken.startsWith('simulated_')) return { count: 0, simulated: true };

  const rows = jobs.map(j => formatJobRow(j, userProfile));

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Applications!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        values: rows
      })
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Bulk sync failed: ${res.statusText}`);
  }

  return { count: rows.length };
};

