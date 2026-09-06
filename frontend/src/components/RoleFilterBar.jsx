import React, { useState, useMemo } from 'react';
import { 
  Bot, Sparkles, ChevronDown, ChevronUp, Search, Plus, 
  X, Trash2, Check, Layers, SlidersHorizontal, Star, Briefcase
} from 'lucide-react';
import { ROLE_DOMAINS } from '../services/roleClusteringService';

export const RoleFilterBar = ({
  roleArchetypeCounts = [],
  selectedRoleIds = [],
  onSelectRole,
  onSelectAll,
  onClearRoles,
  onResetToProfile,
  onSelectDomain,
  currentProfile,
  profileAutoRoles = [],
  customRoles = [],
  onAddCustomRole,
  onRemoveCustomRole,
  totalJobsCount = 0
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newDomain, setNewDomain] = useState(ROLE_DOMAINS[0] || 'Technology & IT');

  // Compute pinned top roles (e.g., top 5 by count, prioritizing recommended ones)
  const pinnedRoles = useMemo(() => {
    return roleArchetypeCounts.slice(0, 6);
  }, [roleArchetypeCounts]);

  // Group roles by domain
  const groupedRoles = useMemo(() => {
    const groups = {};
    ROLE_DOMAINS.forEach(domain => {
      groups[domain] = [];
    });
    groups['Custom Roles'] = [];

    roleArchetypeCounts.forEach(role => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = (role.title || '').toLowerCase().includes(query);
        const matchesKeywords = (role.keywords || []).some(k => k.toLowerCase().includes(query));
        const matchesCategory = (role.category || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesKeywords && !matchesCategory) {
          return;
        }
      }

      if (role.isCustom) {
        groups['Custom Roles'].push(role);
      } else if (groups[role.category]) {
        groups[role.category].push(role);
      } else {
        if (!groups['Other']) groups['Other'] = [];
        groups['Other'].push(role);
      }
    });

    return groups;
  }, [roleArchetypeCounts, searchTerm]);

  const isAllSelected = selectedRoleIds.length === 0 || selectedRoleIds.length >= roleArchetypeCounts.length;
  const activeCount = isAllSelected ? 'All Active' : `${selectedRoleIds.length} Active`;

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const keywords = newKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (onAddCustomRole) {
      onAddCustomRole({
        title: newTitle.trim(),
        keywords: keywords.length > 0 ? keywords : [newTitle.trim().toLowerCase()],
        category: newDomain
      });
    }

    setNewTitle('');
    setNewKeywords('');
    setShowAddModal(false);
  };

  const handleSelectTopRoles = () => {
    const topIds = roleArchetypeCounts.slice(0, 5).map(r => r.id);
    if (onSelectDomain) {
      onSelectDomain(topIds, true);
    }
  };

  return (
    <div className="bg-[#0f172a]/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden font-mono transition-all">
      {/* Pinned Primary Bar */}
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Header & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Bot size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                <span className="tracking-wide">ROLE TARGETING</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                  isAllSelected
                    ? 'bg-slate-800/80 text-slate-300 border-slate-700'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50 shadow-sm'
                }`}>
                  {activeCount}
                </span>
                {currentProfile?.name && (
                  <span className="text-[10px] text-slate-400 hidden md:inline truncate">
                    • Inferred for <span className="text-slate-300 font-semibold">{currentProfile.name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Presets & Collapse Toggle */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onResetToProfile}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
              title="Filter directly to your candidate profile roles"
            >
              <Sparkles size={11} className="text-indigo-400" />
              <span>🎯 PROFILE TARGET ({profileAutoRoles.length})</span>
            </button>

            <button
              type="button"
              onClick={handleSelectTopRoles}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Select top 5 most common roles"
            >
              <Star size={11} className="text-amber-400" />
              <span>TOP 5</span>
            </button>

            <button
              type="button"
              onClick={onSelectAll}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer active:scale-95 ${
                isAllSelected 
                  ? 'bg-slate-700/80 text-slate-200 border-slate-600' 
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80'
              }`}
            >
              SHOW ALL ({totalJobsCount})
            </button>

            <button
              type="button"
              onClick={onClearRoles}
              className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
              title="Deselect all role filters"
            >
              CLEAR
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-600/40 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Add a custom role archetype"
            >
              <Plus size={11} />
              <span className="hidden sm:inline">CUSTOM ROLE</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Toggle expanded multi-domain role catalog"
            >
              <SlidersHorizontal size={11} className="text-slate-300" />
              <span>{isOpen ? 'COLLAPSE' : `ALL ROLES (${roleArchetypeCounts.length})`}</span>
              {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* Pinned Most Popular / Recommended Roles Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            POPULAR:
          </span>
          {pinnedRoles.map(role => {
            const isSelected = selectedRoleIds.includes(role.id);
            const isRecommended = role.isRecommended;

            return (
              <button
                key={role.id}
                type="button"
                onClick={() => onSelectRole(role.id)}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium shrink-0 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600/25 border-indigo-500/70 text-indigo-100 shadow-sm'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                <span className="truncate max-w-[150px]">{role.title}</span>
                {isRecommended && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    FIT
                  </span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-indigo-900/60 text-indigo-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {role.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded Multi-Domain Drawer */}
      {isOpen && (
        <div className="border-t border-slate-800/80 bg-slate-950/90 p-3.5 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Drawer Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search archetypes by title or keyword (e.g. cloud, nurse, accountant)..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Grouped Domains */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {Object.entries(groupedRoles).map(([domain, roles]) => {
              if (roles.length === 0) return null;

              const domainRoleIds = roles.map(r => r.id);
              const allDomainSelected = domainRoleIds.every(id => selectedRoleIds.includes(id));
              const someDomainSelected = domainRoleIds.some(id => selectedRoleIds.includes(id));
              const totalDomainJobs = roles.reduce((acc, r) => acc + (r.count || 0), 0);

              return (
                <div key={domain} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/70 space-y-2.5">
                  {/* Domain Header */}
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className="text-indigo-400" />
                      <span className="text-xs font-bold text-slate-200">{domain}</span>
                      <span className="text-[10px] text-slate-500">
                        ({roles.length} roles • {totalDomainJobs} jobs)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectDomain) {
                          onSelectDomain(domainRoleIds, !allDomainSelected);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                        allDomainSelected
                          ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200'
                          : someDomainSelected
                          ? 'bg-slate-800 border-slate-700 text-slate-300'
                          : 'bg-transparent border-slate-700/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {allDomainSelected ? 'Deselect Domain' : 'Select Domain'}
                    </button>
                  </div>

                  {/* Domain Role Pills Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {roles.map(role => {
                      const isSelected = selectedRoleIds.includes(role.id);
                      const isRecommended = role.isRecommended;

                      return (
                        <div
                          key={role.id}
                          onClick={() => onSelectRole(role.id)}
                          className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-indigo-950/50 border-indigo-500/60 text-indigo-100 shadow-sm ring-1 ring-indigo-500/30'
                              : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-transparent border border-slate-700'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-[11px] truncate flex items-center gap-1">
                                <span>{role.title}</span>
                                {isRecommended && (
                                  <span className="text-[8px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                                    ⭐ FIT
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] text-slate-500 truncate">
                                {(role.keywords || []).slice(0, 3).join(', ')}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                              isSelected 
                                ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-400/30' 
                                : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                            }`}>
                              {role.count}
                            </span>
                            {role.isCustom && onRemoveCustomRole && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveCustomRole(role.id);
                                }}
                                className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                                title="Delete custom target role"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Add Custom Target Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Role Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Prompt Engineer, Nurse Practitioner, Chief Estimator"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Keywords (comma separated)
                </label>
                <input
                  type="text"
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="e.g. prompt, llm, ai prompt, langchain (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Jobs matching any of these keywords will be classified under your custom role.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Domain Category
                </label>
                <select
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {ROLE_DOMAINS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="Custom">Custom / Specialized</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95 transition-all"
                >
                  Save &amp; Target Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
