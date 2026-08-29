/**
 * gmailSyncService.js
 * Gmail API Integration
 * Scans user's Gmail for application confirmations, interview invitations, and status updates.
 */

/**
 * Parses company name from sender email header or subject line
 */
const extractCompanyFromEmail = (fromHeader = '', subject = '') => {
  // 1. Check fromHeader e.g. "Atlassian Careers <careers@atlassian.com>"
  const nameMatch = fromHeader.match(/^"?([^"<]+)"?\s*<.*>/);
  if (nameMatch && nameMatch[1]) {
    const rawName = nameMatch[1].replace(/(careers|talent|recruitment|team|jobs|hiring|notifications|no-reply|hr)/gi, '').trim();
    if (rawName.length > 2) return rawName;
  }

  // 2. Check domain e.g. "careers@canva.com"
  const domainMatch = fromHeader.match(/@([a-zA-Z0-9.-]+)\./);
  if (domainMatch && domainMatch[1]) {
    const domainPart = domainMatch[1].toLowerCase();
    if (!['gmail', 'yahoo', 'hotmail', 'outlook', 'workday', 'greenhouse', 'lever', 'smartrecruiters', 'jobvite', 'bamboohr'].includes(domainPart)) {
      return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    }
  }

  // 3. Check Subject line e.g. "Thank you for applying to Canva" or "Application: Senior Engineer at Telstra"
  const subMatch = subject.match(/(?:at|to|with|for)\s+([A-Z][a-zA-Z0-9\s&]+)/i);
  if (subMatch && subMatch[1]) {
    return subMatch[1].split('-')[0].split('|')[0].trim();
  }

  return 'Direct Employer';
};

/**
 * Classifies the email into a job application status
 */
const classifyEmailStatus = (subject = '', snippet = '') => {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (text.includes('interview') || text.includes('invitation to meet') || text.includes('schedule a chat') || text.includes('phone screen') || text.includes('video call')) {
    return 'Interview Scheduled';
  }
  if (text.includes('action required') || text.includes('assessment') || text.includes('test') || text.includes('complete your application')) {
    return 'Action Required / Screening';
  }
  if (text.includes('unsuccessful') || text.includes('not moving forward') || text.includes('other candidates') || text.includes('unfortunately')) {
    return 'Unsuccessful / Closed';
  }
  if (text.includes('offer') || text.includes('contract')) {
    return 'Offer Received 🎉';
  }

  return 'Applied / Confirmation Received';
};

/**
 * Scans user's Gmail inbox for application-related messages
 */
export const scanGmailForApplications = async (accessToken, maxResults = 25) => {
  if (!accessToken) {
    throw new Error('Google OAuth Access Token is required to scan Gmail.');
  }

  const query = 'subject:(application OR "applied to" OR "interview" OR "thank you for applying" OR "application received" OR "candidacy")';
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;

  const listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API query failed: ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];

  if (messages.length === 0) {
    return [];
  }

  // Fetch details for each message
  const detailedResults = [];
  for (const m of messages.slice(0, 15)) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();

      const headers = msgData.payload?.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Job Application';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      const snippet = msgData.snippet || '';

      const company = extractCompanyFromEmail(from, subject);
      const status = classifyEmailStatus(subject, snippet);
      const date = dateHeader ? new Date(dateHeader).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      // Extract Clean Title from Subject
      let title = subject
        .replace(/^(re:|fwd:|thank you for applying:?|application for:?|your application to:?)\s*/gi, '')
        .split(' - ')[0]
        .split(' | ')[0]
        .trim();

      if (!title || title.toLowerCase().includes('thank you') || title.length < 3) {
        title = 'Applied Role';
      }

      detailedResults.push({
        id: `gmail_${m.id}`,
        title: title,
        company: company,
        status: status,
        date: date,
        location: 'Melbourne, VIC',
        source: 'Gmail Inbox Sync',
        score: 92,
        tags: ['Gmail Verified', status],
        notes: `Extracted from email: "${subject}" (${snippet.slice(0, 120)}...)`,
        emailSubject: subject,
        emailSender: from,
        emailSnippet: snippet
      });
    } catch (e) {
      console.warn('Error fetching individual message details:', e);
    }
  }

  return detailedResults;
};
