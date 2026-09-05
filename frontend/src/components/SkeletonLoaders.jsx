import React from 'react';

export const CardSkeleton = () => (
  <div className="rounded-2xl p-5 border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-4 animate-pulse h-[340px]">
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
          <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
        </div>
        <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
      </div>
      
      <div className="space-y-2 pt-2">
        <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
        <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
      </div>
      
      <div className="space-y-2 pt-2">
        <div className="h-2 w-full bg-slate-200 rounded"></div>
        <div className="h-2 w-full bg-slate-200 rounded"></div>
        <div className="h-2 w-2/3 bg-slate-200 rounded"></div>
      </div>
    </div>
    
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="h-5 w-16 bg-slate-200 rounded"></div>
        <div className="h-5 w-16 bg-slate-200 rounded"></div>
        <div className="h-5 w-16 bg-slate-200 rounded"></div>
      </div>
      
      <div className="flex justify-between border-t border-slate-100 pt-3">
        <div className="h-6 w-20 bg-slate-200 rounded-lg"></div>
        <div className="h-6 w-24 bg-slate-200 rounded-lg"></div>
      </div>
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs animate-pulse">
    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex gap-4">
      <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
      <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
      <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
      <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="px-6 py-4 flex gap-4 border-b border-slate-100 last:border-0">
        <div className="h-4 w-1/4 bg-slate-100 rounded"></div>
        <div className="h-4 w-1/4 bg-slate-100 rounded"></div>
        <div className="h-4 w-1/4 bg-slate-100 rounded"></div>
        <div className="h-4 w-1/4 bg-slate-100 rounded"></div>
      </div>
    ))}
  </div>
);

export const KanbanColumnSkeleton = () => (
  <div className="flex-1 min-w-[300px] flex flex-col gap-3 animate-pulse bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
    <div className="flex justify-between items-center px-1 mb-2">
      <div className="h-5 w-32 bg-slate-200 rounded-lg"></div>
      <div className="h-5 w-8 bg-slate-200 rounded-full"></div>
    </div>
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs h-32 flex flex-col gap-3 justify-center">
        <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
        <div className="h-3 w-1/2 bg-slate-100 rounded"></div>
        <div className="flex justify-between mt-auto">
          <div className="h-4 w-16 bg-slate-100 rounded"></div>
          <div className="h-4 w-12 bg-slate-100 rounded"></div>
        </div>
      </div>
    ))}
  </div>
);

export const DashboardGridSkeleton = () => (
  <div className="w-full max-w-[98vw] 2xl:max-w-[2560px] 3xl:max-w-[3400px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
    <div className="h-16 w-full bg-slate-800 rounded-2xl animate-pulse mb-6 border border-slate-700"></div>
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
      {[...Array(12)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const ModalSkeleton = () => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-pulse">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="h-6 w-48 bg-slate-800 rounded"></div>
        <div className="h-6 w-6 bg-slate-800 rounded-full"></div>
      </div>
      <div className="space-y-3 py-4">
        <div className="h-4 w-3/4 bg-slate-800 rounded"></div>
        <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
        <div className="h-32 w-full bg-slate-800/60 rounded-xl"></div>
      </div>
    </div>
  </div>
);

