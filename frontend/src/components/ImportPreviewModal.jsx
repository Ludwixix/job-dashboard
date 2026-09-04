import React from 'react';
import { X, CheckCircle2, AlertTriangle, Download, Upload } from 'lucide-react';

export const ImportPreviewModal = ({ isOpen, onClose, data, onConfirm }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="text-indigo-400" />
              Import Preview
            </h2>
            <p className="text-sm text-slate-400 mt-1 font-mono">
              Review {data.length} parsed records before saving to your dashboard.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-slate-950/50">
          {data.length === 0 ? (
            <div className="text-center p-8 text-amber-500 flex flex-col items-center">
              <AlertTriangle size={32} className="mb-2" />
              <p>No valid job records found in the file.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.slice(0, 50).map((job, idx) => (
                <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{job.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{job.company} • {job.location || 'Remote'}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider">
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
              {data.length > 50 && (
                <p className="text-center text-xs text-slate-500 font-mono py-4 italic">
                  ...and {data.length - 50} more records.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-3 rounded-b-3xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(data)}
            disabled={data.length === 0}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-900/20 flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Import {data.length} Records
          </button>
        </div>
      </div>
    </div>
  );
};
