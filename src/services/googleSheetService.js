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
 * Upserts / appends a job application in the user's personal Google Sheet in real time.
 */
export const upsertApplicationInSheet = async (accessToken, spreadsheetId, job, userProfile) => {
  return appendApplicationToSheet(accessToken, spreadsheetId, job, userProfile);
};

/**
 * Bulk syncs all application records to the user's personal Google Sheet.
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



/**
 * Searches Google Drive for an existing Job Tracker spreadsheet.
 */
export const findExistingJobTrackerSheet = async (accessToken) => {
  if (!accessToken || accessToken.startsWith('simulated_')) return null;

  try {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and name contains 'Job Applications Tracker' and trashed = false&orderBy=createdTime desc&pageSize=1",
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return {
          spreadsheetId: data.files[0].id,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${data.files[0].id}/edit`,
          title: data.files[0].name
        };
      }
    }
  } catch (err) {
    console.warn("Could not search Google Drive for existing tracker:", err);
  }
  return null;
};
