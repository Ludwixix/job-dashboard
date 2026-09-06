import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Calendar,
  Clock,
  Mail,
  Phone,
  ExternalLink,
  Plus,
  Search,
  Building2,
  Briefcase,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Award,
  Coffee,
  RefreshCw,
  Trash2,
  Edit3,
  CheckCircle2,
  ChevronRight,
  Send,
} from 'lucide-react';
import {
  SECTOR_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  CADENCE_OPTIONS,
  INTERACTION_TYPES,
  formatHealth,
  calculateCadenceStatus,
  computeCadenceMetrics,
  filterContacts,
  createDefaultContact,
  formatInteractionType,
  fetchContacts,
  saveContact,
  deleteContact,
  logInteraction,
  seedDefaultContacts,
} from '../services/recruiterCrmService';

export function RecruiterRelationshipModal({
  isOpen,
  onClose,
  initialContactId = null,
  activeJob = null,
  onOpenFollowUpEmail = null,
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'radar' | 'timeline' | 'form'
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedHealth, setSelectedHealth] = useState('all');

  // Contact form state
  const [editingContact, setEditingContact] = useState(createDefaultContact());

  // Interaction log form state
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [interactionData, setInteractionData] = useState({
    type: 'email_outreach',
    date: new Date().toISOString().split('T')[0],
    summary: '',
    outcome: '',
  });

  const loadContactsData = async () => {
    setLoading(true);
    try {
      const data = await fetchContacts();
      setContacts(data || []);
      if (!selectedContactId && data && data.length > 0) {
        setSelectedContactId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load CRM contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContactsData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialContactId) {
      setSelectedContactId(initialContactId);
      setActiveTab('timeline');
    }
  }, [initialContactId]);

  const selectedContact = useMemo(() => {
    return contacts.find((c) => c.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  const filteredContacts = useMemo(() => {
    return filterContacts(contacts, {
      sector: selectedSector,
      contactType: selectedType,
      health: selectedHealth,
      search: searchQuery,
    });
  }, [contacts, selectedSector, selectedType, selectedHealth, searchQuery]);

  const cadenceMetrics = useMemo(() => {
    return computeCadenceMetrics(contacts);
  }, [contacts]);

  const handleStartAdd = () => {
    setEditingContact(createDefaultContact({
      sector: activeJob?.stream || 'technology',
      associated_job_ids: activeJob?.id ? [activeJob.id] : [],
      organization: activeJob?.company || '',
    }));
    setActiveTab('form');
  };

  const handleStartEdit = (contact) => {
    setEditingContact({ ...contact });
    setActiveTab('form');
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!editingContact.name?.trim()) return;

    setLoading(true);
    try {
      const saved = await saveContact(editingContact);
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setSelectedContactId(saved.id);
      setActiveTab('timeline');
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Remove this recruiter from your network CRM?')) return;
    setLoading(true);
    try {
      await deleteContact(contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      if (selectedContactId === contactId) {
        setSelectedContactId(null);
        setActiveTab('directory');
      }
    } catch (err) {
      console.error('Failed to delete contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogInteractionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedContactId || !interactionData.summary.trim()) return;

    setLoading(true);
    try {
      const updated = await logInteraction(selectedContactId, interactionData);
      setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setLogFormOpen(false);
      setInteractionData({
        type: 'email_outreach',
        date: new Date().toISOString().split('T')[0],
        summary: '',
        outcome: '',
      });
    } catch (err) {
      console.error('Failed to log interaction:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedContacts = async () => {
    setLoading(true);
    try {
      const seeded = await seedDefaultContacts();
      setContacts(seeded);
    } catch (err) {
      console.error('Failed to seed contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl shadow-indigo-950/40 text-slate-100 overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Recruiter & Talent CRM
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {contacts.length} Contacts
                </span>
                {cadenceMetrics.overdueCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {cadenceMetrics.overdueCount} Overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Strategic talent network management, touchpoint cadence, and recruiter relationship hub
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'directory'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Directory & Network
            </button>

            <button
              onClick={() => setActiveTab('radar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'radar'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Cadence Radar
              {cadenceMetrics.overdueCount > 0 && (
                <span className="w-4 h-4 text-[10px] rounded-full bg-rose-500 text-white flex items-center justify-center font-bold">
                  {cadenceMetrics.overdueCount}
                </span>
              )}
            </button>

            {selectedContact && (
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                  activeTab === 'timeline'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Contact Timeline ({selectedContact.name})
              </button>
            )}

            <button
              onClick={handleStartAdd}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                activeTab === 'form'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Contact
            </button>
          </div>

          <div className="flex items-center gap-2">
            {contacts.length === 0 && (
              <button
                onClick={handleSeedContacts}
                disabled={loading}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors"
              >
                Seed AU Agencies
              </button>
            )}
            <button
              onClick={loadContactsData}
              disabled={loading}
              title="Refresh contacts"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: DIRECTORY & FILTERS */}
          {activeTab === 'directory' && (
            <div className="space-y-5">
              {/* Search & Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <div className="relative sm:col-span-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, company, notes..."
                    className="w-full bg-slate-900 border border-slate-700/70 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {SECTOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {CONTACT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={selectedHealth}
                  onChange={(e) => setSelectedHealth(e.target.value)}
                  className="bg-slate-900 border border-slate-700/70 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Relationship Health</option>
                  <option value="active">Active</option>
                  <option value="warm">Warm</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>

              {/* Contacts Grid */}
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-dashed border-slate-800 bg-slate-950/30">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-300">No recruiter contacts match current filters</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try broadening your filters or add new recruitment partners to track interactions.
                  </p>
                  <button
                    onClick={handleStartAdd}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Recruiter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredContacts.map((contact) => {
                    const cadence = calculateCadenceStatus(contact.next_follow_up_date);
                    const health = formatHealth(contact.relationship_health);
                    const sectorOpt = SECTOR_OPTIONS.find((s) => s.value === contact.sector);

                    return (
                      <div
                        key={contact.id}
                        className="group relative rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 transition-all p-4 flex flex-col justify-between"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                                  {contact.name}
                                </h3>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${health.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                                  {health.label}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-slate-300 mt-0.5 flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {contact.organization || 'Independent'}
                                {contact.role && <span className="text-slate-500">• {contact.role}</span>}
                              </p>
                            </div>

                            {/* Cadence Status Badge */}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${cadence.badgeColor}`}>
                              {cadence.label}
                            </span>
                          </div>

                          {/* Tags & Sector */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            {sectorOpt && (
                              <span className={`px-2 py-0.5 text-[10px] rounded border ${sectorOpt.badge}`}>
                                {sectorOpt.label.split(' ')[0]}
                              </span>
                            )}
                            <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                              {contact.contact_type.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Notes */}
                          {contact.notes && (
                            <p className="text-xs text-slate-400 mt-2.5 line-clamp-2 italic">
                              "{contact.notes}"
                            </p>
                          )}
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                title={`Email ${contact.email}`}
                                className="p-1.5 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                title={`Call ${contact.phone}`}
                                className="p-1.5 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {contact.linkedin_url && (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open LinkedIn Profile"
                                className="p-1.5 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedContactId(contact.id);
                                setActiveTab('timeline');
                              }}
                              className="px-2.5 py-1 rounded-md bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1 transition-colors"
                            >
                              Timeline ({contact.interactions?.length || 0})
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CADENCE & OVERDUE RADAR */}
          {activeTab === 'radar' && (
            <div className="space-y-6">
              {/* Radar Metric Banners */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Overdue</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <p className="text-2xl font-black text-rose-200 mt-1">{cadenceMetrics.overdueCount}</p>
                  <p className="text-[11px] text-rose-400/80 mt-0.5">Need immediate touchpoint</p>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Due Today</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-amber-200 mt-1">{cadenceMetrics.dueTodayCount}</p>
                  <p className="text-[11px] text-amber-400/80 mt-0.5">Scheduled for today</p>
                </div>

                <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Due This Week</span>
                    <Calendar className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-2xl font-black text-sky-200 mt-1">{cadenceMetrics.dueThisWeekCount}</p>
                  <p className="text-[11px] text-sky-400/80 mt-0.5">Within 7 days</p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active Health</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-black text-emerald-200 mt-1">{cadenceMetrics.healthCounts.active}</p>
                  <p className="text-[11px] text-emerald-400/80 mt-0.5">Engaged in last 30d</p>
                </div>
              </div>

              {/* Overdue Follow-up List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-400" />
                    Follow-Up Radar: Action Required
                  </h3>
                  <span className="text-xs text-slate-400">Sorted by days overdue</span>
                </div>

                {cadenceMetrics.overdueContacts.length === 0 ? (
                  <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-300">All follow-ups are on schedule!</p>
                    <p className="text-xs text-emerald-400/70 mt-0.5">
                      No overdue recruiter touchpoints detected across your network.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cadenceMetrics.overdueContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="p-4 rounded-xl border border-rose-500/30 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{contact.name}</span>
                            <span className="text-xs text-slate-400 font-medium">({contact.organization})</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              {contact.cadence.daysOverdue}d overdue
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Cadence: Every {contact.cadence_frequency_days || 14} days • Last touched: {contact.last_interaction_date || 'Never'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenFollowUpEmail && contact.email && (
                            <button
                              onClick={() => {
                                onOpenFollowUpEmail({
                                  recipientName: contact.name,
                                  recipientEmail: contact.email,
                                  company: contact.organization,
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Draft Email
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedContactId(contact.id);
                              setLogFormOpen(true);
                              setActiveTab('timeline');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Log Touchpoint
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT DETAIL & INTERACTION TIMELINE */}
          {activeTab === 'timeline' && selectedContact && (
            <div className="space-y-6">
              {/* Contact Profile Summary Card */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-white">{selectedContact.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${formatHealth(selectedContact.relationship_health).color}`}>
                      {formatHealth(selectedContact.relationship_health).label}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${calculateCadenceStatus(selectedContact.next_follow_up_date).badgeColor}`}>
                      {calculateCadenceStatus(selectedContact.next_follow_up_date).label}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-300 mt-1 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedContact.organization}</span>
                    <span className="text-slate-500">•</span>
                    <span>{selectedContact.role}</span>
                    <span className="text-slate-500">•</span>
                    <span className="capitalize">{selectedContact.sector} Sector</span>
                  </p>

                  {selectedContact.notes && (
                    <p className="text-xs text-slate-400 mt-2 italic bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                      {selectedContact.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartEdit(selectedContact)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Edit Contact"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(selectedContact.id)}
                    className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white transition-colors border border-rose-800/50"
                    title="Delete Contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setLogFormOpen(!logFormOpen)}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30"
                  >
                    <Plus className="w-4 h-4" />
                    {logFormOpen ? 'Cancel' : 'Log Interaction'}
                  </button>
                </div>
              </div>

              {/* Interaction Form Drawer */}
              {logFormOpen && (
                <form
                  onSubmit={handleLogInteractionSubmit}
                  className="p-5 rounded-xl border border-indigo-500/40 bg-indigo-950/20 space-y-4 animate-in slide-in-from-top duration-200"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    Log Recruiter Touchpoint
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Interaction Channel</label>
                      <select
                        value={interactionData.type}
                        onChange={(e) => setInteractionData({ ...interactionData, type: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      >
                        {INTERACTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={interactionData.date}
                        onChange={(e) => setInteractionData({ ...interactionData, date: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Conversation Summary</label>
                    <textarea
                      rows={2}
                      value={interactionData.summary}
                      onChange={(e) => setInteractionData({ ...interactionData, summary: e.target.value })}
                      placeholder="What was discussed? E.g. Discussed staff infrastructure role; agreed to check back post-board approval."
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Actionable Next Steps / Outcome</label>
                    <input
                      type="text"
                      value={interactionData.outcome}
                      onChange={(e) => setInteractionData({ ...interactionData, outcome: e.target.value })}
                      placeholder="E.g. Expecting interview invitation next Tuesday."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setLogFormOpen(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                    >
                      Record Touchpoint
                    </button>
                  </div>
                </form>
              )}

              {/* Chronological Timeline */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Touchpoint Timeline ({selectedContact.interactions?.length || 0})
                </h4>

                {(!selectedContact.interactions || selectedContact.interactions.length === 0) ? (
                  <div className="text-center py-8 rounded-xl border border-dashed border-slate-800 bg-slate-950/20">
                    <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No interactions recorded with this recruiter yet.</p>
                    <button
                      onClick={() => setLogFormOpen(true)}
                      className="mt-3 px-3 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      + Log your first conversation
                    </button>
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
                    {selectedContact.interactions
                      .slice()
                      .reverse()
                      .map((interaction, idx) => {
                        const typeInfo = formatInteractionType(interaction.type);

                        return (
                          <div key={interaction.id || idx} className="relative group">
                            {/* Timeline node */}
                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 flex items-center justify-center" />

                            <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/50 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${typeInfo.color}`}>
                                    {typeInfo.label}
                                  </span>
                                  <span className="text-[11px] text-slate-500">• {interaction.date}</span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-200 mt-2 font-normal leading-relaxed">
                                {interaction.summary}
                              </p>

                              {interaction.outcome && (
                                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-start gap-1.5 text-xs text-indigo-300">
                                  <span className="font-semibold text-indigo-400">Outcome:</span>
                                  <span>{interaction.outcome}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ADD / EDIT CONTACT FORM */}
          {activeTab === 'form' && (
            <form onSubmit={handleSaveContact} className="max-w-2xl mx-auto space-y-4">
              <h3 className="text-sm font-bold text-white mb-2">
                {editingContact.id ? 'Edit Recruiter Contact' : 'Add Recruiter or Talent Partner'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingContact.name}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                    placeholder="E.g. Sarah Jenkins"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Organization / Agency *</label>
                  <input
                    type="text"
                    required
                    value={editingContact.organization}
                    onChange={(e) => setEditingContact({ ...editingContact, organization: e.target.value })}
                    placeholder="E.g. Hays, Canva, Michael Page"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Role / Specialization</label>
                  <input
                    type="text"
                    value={editingContact.role}
                    onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                    placeholder="E.g. Cloud & DevOps Practice Lead"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Industry Sector</label>
                  <select
                    value={editingContact.sector}
                    onChange={(e) => setEditingContact({ ...editingContact, sector: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {SECTOR_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Contact Type</label>
                  <select
                    value={editingContact.contact_type}
                    onChange={(e) => setEditingContact({ ...editingContact, contact_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {CONTACT_TYPE_OPTIONS.filter((c) => c.value !== 'all').map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Relationship Cadence</label>
                  <select
                    value={editingContact.cadence_frequency_days}
                    onChange={(e) => setEditingContact({ ...editingContact, cadence_frequency_days: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {CADENCE_OPTIONS.map((c) => (
                      <option key={c.days} value={c.days}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingContact.email}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                    placeholder="recruiter@agency.com.au"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editingContact.phone}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                    placeholder="+61 400 000 000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">LinkedIn Profile URL</label>
                  <input
                    type="url"
                    value={editingContact.linkedin_url}
                    onChange={(e) => setEditingContact({ ...editingContact, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/recruiter-handle"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">Contextual Notes & Focus Areas</label>
                  <textarea
                    rows={3}
                    value={editingContact.notes}
                    onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                    placeholder="Specializes in Tier-1 ASX enterprise roles; prefers phone calls on Thursdays..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30"
                >
                  Save Recruiter Profile
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

export default RecruiterRelationshipModal;

