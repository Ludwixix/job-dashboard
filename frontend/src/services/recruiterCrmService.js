/**
 * Recruiter & Talent Network Relationship CRM Service
 * API communications and relationship cadence calculations.
 */

const API_BASE = '/api/network';

export const SECTOR_OPTIONS = [
  { value: 'all', label: 'All Sectors' },
  { value: 'technology', label: 'Technology & Cloud', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { value: 'healthcare', label: 'Healthcare & Clinical', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { value: 'finance', label: 'Financial Services & Risk', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { value: 'trades', label: 'Trades, WHS & Engineering', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'legal', label: 'Legal, Compliance & Policy', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { value: 'general', label: 'General / Cross-Sector', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
];

export const CONTACT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Contact Types' },
  { value: 'agency_recruiter', label: 'Agency Recruiter', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { value: 'internal_talent', label: 'Internal Talent Partner', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { value: 'hiring_manager', label: 'Hiring Manager / Team Lead', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { value: 'executive_search', label: 'Executive Search Partner', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'peer_referral', label: 'Peer / Alumni Referral', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
];

export const CADENCE_OPTIONS = [
  { days: 7, label: 'Every Week (High Priority Active Roles)' },
  { days: 14, label: 'Every 2 Weeks (Recommended Standard)' },
  { days: 21, label: 'Every 3 Weeks (Warm Pipeline)' },
  { days: 30, label: 'Monthly (Relationship Maintenance)' },
  { days: 60, label: 'Every 2 Months (Long-term Network)' },
  { days: 90, label: 'Quarterly (Dormant Check-in)' },
];

export const INTERACTION_TYPES = [
  { value: 'email_outreach', label: 'Email Outreach', icon: 'Mail', color: 'text-sky-400' },
  { value: 'phone_call', label: 'Phone Call', icon: 'Phone', color: 'text-emerald-400' },
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: 'MessageSquare', color: 'text-blue-400' },
  { value: 'coffee_catchup', label: 'Coffee / Informal Catchup', icon: 'Coffee', color: 'text-amber-400' },
  { value: 'interview_scheduled', label: 'Interview Scheduled', icon: 'Calendar', color: 'text-purple-400' },
  { value: 'offer_discussion', label: 'Offer & Package Discussion', icon: 'Award', color: 'text-rose-400' },
];

export function formatInteractionType(type) {
  const found = INTERACTION_TYPES.find((t) => t.value === type);
  return found || { value: type, label: type.replace(/_/g, ' '), icon: 'MessageCircle', color: 'text-slate-400' };
}

export function formatHealth(health) {
  switch (health) {
    case 'active':
      return {
        label: 'Active',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dot: 'bg-emerald-400 animate-pulse',
      };
    case 'warm':
      return {
        label: 'Warm',
        color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        dot: 'bg-amber-400',
      };
    case 'dormant':
    default:
      return {
        label: 'Dormant',
        color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        dot: 'bg-slate-500',
      };
  }
}

export function calculateCadenceStatus(nextFollowUpDate, currentDate = null) {
  if (!nextFollowUpDate) {
    return {
      status: 'no_schedule',
      label: 'No schedule',
      daysDifference: null,
      daysOverdue: 0,
      badgeColor: 'bg-slate-800/60 text-slate-400 border-slate-700',
    };
  }

  const today = currentDate ? new Date(currentDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(nextFollowUpDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      status: 'overdue',
      label: `${overdue}d overdue`,
      daysDifference: diffDays,
      daysOverdue: overdue,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
    };
  }

  if (diffDays === 0) {
    return {
      status: 'due_today',
      label: 'Due today',
      daysDifference: 0,
      daysOverdue: 0,
      badgeColor: 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-semibold',
    };
  }

  if (diffDays <= 7) {
    return {
      status: 'due_this_week',
      label: `In ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      daysDifference: diffDays,
      daysOverdue: 0,
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    };
  }

  return {
    status: 'upcoming',
    label: `In ${diffDays} days`,
    daysDifference: diffDays,
    daysOverdue: 0,
    badgeColor: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  };
}

export function computeCadenceMetrics(contacts = [], currentDate = null) {
  let overdueCount = 0;
  let dueTodayCount = 0;
  let dueThisWeekCount = 0;
  let upcomingCount = 0;
  const healthCounts = { active: 0, warm: 0, dormant: 0 };
  const overdueContacts = [];

  contacts.forEach((c) => {
    const h = c.relationship_health && healthCounts[c.relationship_health] !== undefined
      ? c.relationship_health
      : 'warm';
    healthCounts[h] += 1;

    const cadence = calculateCadenceStatus(c.next_follow_up_date, currentDate);
    if (cadence.status === 'overdue') {
      overdueCount += 1;
      overdueContacts.push({ ...c, cadence });
    } else if (cadence.status === 'due_today') {
      dueTodayCount += 1;
    } else if (cadence.status === 'due_this_week') {
      dueThisWeekCount += 1;
    } else {
      upcomingCount += 1;
    }
  });

  overdueContacts.sort((a, b) => (b.cadence.daysOverdue || 0) - (a.cadence.daysOverdue || 0));

  return {
    total: contacts.length,
    overdueCount,
    dueTodayCount,
    dueThisWeekCount,
    upcomingCount,
    healthCounts,
    overdueContacts,
  };
}

export function filterContacts(contacts = [], { sector, contactType, health, search } = {}) {
  return contacts.filter((c) => {
    if (sector && sector !== 'all' && c.sector !== sector) return false;
    if (contactType && contactType !== 'all' && c.contact_type !== contactType) return false;
    if (health && health !== 'all' && c.relationship_health !== health) return false;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchOrg = (c.organization || '').toLowerCase().includes(q);
      const matchRole = (c.role || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchOrg && !matchRole && !matchNotes) return false;
    }
    return true;
  });
}

export function createDefaultContact(overrides = {}) {
  return {
    name: '',
    role: '',
    organization: '',
    contact_type: 'agency_recruiter',
    sector: 'technology',
    email: '',
    phone: '',
    linkedin_url: '',
    notes: '',
    relationship_health: 'warm',
    cadence_frequency_days: 14,
    last_interaction_date: null,
    next_follow_up_date: null,
    associated_job_ids: [],
    interactions: [],
    ...overrides,
  };
}

// API Calls with fallback handling
export async function fetchContacts(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
    if (filters.contactType && filters.contactType !== 'all') params.append('contact_type', filters.contactType);
    if (filters.health && filters.health !== 'all') params.append('health', filters.health);
    if (filters.search) params.append('search', filters.search);

    const res = await fetch(`${API_BASE}/contacts?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch contacts: ${res.status}`);
    const data = await res.json();
    return data.contacts || [];
  } catch (err) {
    console.warn('Network CRM fetchContacts error (fallback):', err);
    return [];
  }
}

export async function fetchCadenceRadar() {
  try {
    const res = await fetch(`${API_BASE}/cadence`);
    if (!res.ok) throw new Error(`Failed to fetch cadence radar: ${res.status}`);
    const data = await res.json();
    return data.cadence || null;
  } catch (err) {
    console.warn('Network CRM fetchCadenceRadar error:', err);
    return null;
  }
}

export async function saveContact(contactData) {
  const res = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contactData),
  });
  if (!res.ok) throw new Error(`Failed to save contact: ${res.status}`);
  const data = await res.json();
  return data.contact;
}

export async function deleteContact(contactId) {
  // Support both DELETE and POST /delete fallback
  try {
    const res = await fetch(`${API_BASE}/contacts/${contactId}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;
  } catch {
    // Fallback to POST
  }

  const fallbackRes = await fetch(`${API_BASE}/contacts/${contactId}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: contactId }),
  });
  return fallbackRes.ok;
}

export async function logInteraction(contactId, interactionData) {
  const res = await fetch(`${API_BASE}/contacts/${contactId}/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact_id: contactId, interaction: interactionData }),
  });
  if (!res.ok) throw new Error(`Failed to log interaction: ${res.status}`);
  const data = await res.json();
  return data.contact;
}

export async function seedDefaultContacts() {
  const res = await fetch(`${API_BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to seed default contacts: ${res.status}`);
  const data = await res.json();
  return data.contacts || [];
}
