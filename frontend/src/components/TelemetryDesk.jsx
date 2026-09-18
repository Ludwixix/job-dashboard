import React, { useState, useEffect } from 'react';
import { Radio, ChevronDown, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export const TelemetryDesk = ({ onOpenSelfHeal }) => {
 const [telemetry, setTelemetry] = useState({
 providers: {
 seek: { name: 'SEEK', status: 'active', detail: 'API / Browser fallback ready', dot: '🟢' },
 indeed: { name: 'Indeed', status: 'active', detail: 'JobSpy / JSON fallback ready', dot: '🟢' },
 adzuna: { name: 'Adzuna', status: 'active', detail: 'API ready', dot: '🟢' },
 remoteok: { name: 'RemoteOK', status: 'active', detail: 'Global feed active', dot: '🟢' },
 },
 workers: {
 active_scrapes: 0,
 generation_queue_length: 0,
 scheduler_active: true,
 }
 });
 const [isOpen, setIsOpen] = useState(false);
 const [loading, setLoading] = useState(false);

 const fetchTelemetry = async () => {
 try {
 setLoading(true);
 const res = await fetch('/api/telemetry/status');
 if (res.ok) {
 const data = await res.json();
 if (data.providers) {
 setTelemetry(prev => ({
 ...prev,
 providers: {
 seek: {
 name: 'SEEK',
 status: data.providers.seek?.status || 'active',
 detail: data.providers.seek?.has_custom_session ? 'Authenticated session active' : 'API / Browser fallback ready',
 dot: '🟢',
 },
 indeed: {
 name: 'Indeed',
 status: data.providers.indeed?.status || 'active',
 detail: data.providers.indeed?.has_custom_session ? 'Custom session active' : 'JobSpy / JSON fallback ready',
 dot: '🟢',
 },
 adzuna: {
 name: 'Adzuna',
 status: data.providers.adzuna?.status || 'configured',
 detail: data.providers.adzuna?.has_credentials ? 'API credentials active' : 'Standby / Fallback',
 dot: data.providers.adzuna?.has_credentials ? '🟢' : '⚪',
 },
 remoteok: {
 name: 'RemoteOK',
 status: data.providers.remoteok?.status || 'active',
 detail: 'Direct async feed active',
 dot: '🟢',
 },
 },
 workers: data.workers || prev.workers,
 }));
 }
 }
 } catch {
 // Keep optimistic defaults on network hiccup
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchTelemetry();
 const interval = setInterval(fetchTelemetry, 45000);
 return () => clearInterval(interval);
 }, []);

 const providersList = Object.values(telemetry.providers);

 return (
 <div className="relative inline-block font-mono text-xs">
 <button
 onClick={() => setIsOpen(!isOpen)}
 className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition-all cursor-pointer"
 title="Provider Mesh Telemetry Desk"
 >
 <Radio size={12} className={loading ? 'text-amber-400 animate-spin' : 'text-amber-400 animate-pulse'} />
 <span className="font-bold tracking-tight text-[10px] text-slate-400">MESH:</span>
 <div className="flex items-center gap-1 text-[10px]">
 {providersList.map((p) => (
 <span key={p.name} className="flex items-center gap-0.5" title={`${p.name}: ${p.detail}`}>
 <span>{p.dot}</span>
 <span className="hidden xl:inline text-slate-300 font-semibold">{p.name}</span>
 </span>
 ))}
 </div>
 <ChevronDown size={11} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
 </button>

 {isOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
 <div className="absolute right-0 mt-2 w-80 bg-[#111318] border border-amber-500/20 rounded-sm p-4 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
 <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
 <div className="flex items-center gap-2">
 <Layers size={14} className="text-amber-400" />
 <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">CANDIDATE LOGISTICS PORTAL // MENTAT CORE</span>
 </div>
 <button
 onClick={fetchTelemetry}
 className="p-1 hover:bg-slate-800 rounded-sm text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
 title="Refresh telemetry"
 >
 <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
 </button>
 </div>

 <div className="space-y-2.5">
 {providersList.map((p) => (
 <div
 key={p.name}
 onClick={() => {
 if (onOpenSelfHeal) {
 setIsOpen(false);
 onOpenSelfHeal(p.name);
 }
 }}
 className="p-2 rounded-sm bg-[#151821] border border-slate-800/80 hover:border-amber-500/30 flex items-start justify-between gap-2 transition-colors cursor-pointer"
 title="Click to inspect & self-heal source"
 >
 <div className="flex items-center gap-2">
 <span className="text-xs">{p.dot}</span>
 <div>
 <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">{p.name}</div>
 <div className="text-[10px] text-slate-400 leading-tight">{p.detail}</div>
 </div>
 </div>
 <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-sm bg-amber-950/30 border border-amber-500/20 text-amber-300">
 {p.status}
 </span>
 </div>
 ))}
 </div>

 {onOpenSelfHeal && (
 <button
 type="button"
 onClick={() => {
 setIsOpen(false);
 onOpenSelfHeal(null);
 }}
 className="w-full mt-3 px-2.5 py-1.5 rounded-sm bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 hover:text-white font-bold text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
 >
 <span>Scraper Health & Autonomous Self-Healing</span>
 </button>
 )}

 <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">
 <span>SQLite WAL Concurrent</span>
 <span>Autonomous Resilience</span>
 </div>
 </div>
 </>
 )}
 </div>
 );
};
