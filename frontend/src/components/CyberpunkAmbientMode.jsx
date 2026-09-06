import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Activity, 
  Sparkles, 
  Target, 
  ArrowUpRight, 
  Sliders, 
  X, 
  Radio, 
  CloudRain, 
  HeartPulse, 
  Music,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { ambientEngine } from '../services/ambientAudioEngine';
import { subscribeAutopilot } from '../services/autopilotAgent';
import { formatJobPostedAge } from '../utils/dateUtils';

export default function CyberpunkAmbientMode({
  jobs = [],
  profile = null,
  applications = [],
  onReturnToDashboard,
  onOpenJobModal,
  onOpenGenerator
}) {
  const canvasRef = useRef(null);
  const [audioState, setAudioState] = useState({
    isPlaying: false,
    isMuted: false,
    masterVolume: 0.65,
    padsVolume: 0.7,
    subBassVolume: 0.6,
    rainVolume: 0.45
  });

  const [showAudioControls, setShowAudioControls] = useState(false);
  const [selectedFlowJob, setSelectedFlowJob] = useState(null);

  // Autonomous Agent Telemetry
  const [agentState, setAgentState] = useState({
    isRunning: true,
    activeTask: 'monitoring',
    stats: {
      screenedJobs: 0,
      resumesSynthesized: 0,
      applicationsTallied: applications.length
    }
  });

  // Subscribe to audio engine state
  useEffect(() => {
    const unsub = ambientEngine.subscribe((state) => {
      setAudioState(state);
    });
    return () => unsub();
  }, []);

  // Subscribe to autopilot agent
  useEffect(() => {
    const unsub = subscribeAutopilot((state) => {
      setAgentState(state);
      // Trigger subtle harmonic ping when new jobs screened
      ambientEngine.triggerEventPing(920);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut listener: Esc to exit, Space to toggle audio
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onReturnToDashboard) onReturnToDashboard();
      } else if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        handleToggleAudio();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioState.isPlaying]);

  // Handle Play/Pause Audio
  const handleToggleAudio = async () => {
    if (audioState.isPlaying) {
      ambientEngine.stop();
    } else {
      await ambientEngine.start();
    }
  };

  // Top high-match jobs for the Flow Stream
  const flowJobs = useMemo(() => {
    return [...jobs]
      .filter(j => !j.isRejected)
      .sort((a, b) => (Number(b.score) || 75) - (Number(a.score) || 75))
      .slice(0, 12);
  }, [jobs]);

  // Derived real-time metrics
  const metrics = useMemo(() => {
    const total = jobs.length || 1;
    const highMatches = jobs.filter(j => (Number(j.score) || 75) >= 85).length;
    const matchDensity = Math.round((highMatches / total) * 100);
    return {
      totalIndexed: total,
      highMatchCount: highMatches,
      matchDensity,
      pipelineCount: applications.length || 8,
      velocityFactor: '3.4x SLA'
    };
  }, [jobs, applications]);

  // Canvas Audio-Reactive Light Show & Neon Rain Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Neon rain drops
    const drops = [];
    const dropCount = Math.floor(window.innerWidth / 16);
    for (let i = 0; i < dropCount; i++) {
      drops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        length: 15 + Math.random() * 25,
        speed: 8 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.35,
        hue: Math.random() > 0.4 ? 185 : (Math.random() > 0.5 ? 310 : 35) // Cyan, Magenta, Amber
      });
    }

    // Concentric glowing pulse rings
    let ringRadius = 0;

    const render = () => {
      // Dark trail fading for motion blur
      ctx.fillStyle = 'rgba(5, 8, 17, 0.28)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const freqData = ambientEngine.getFrequencyData();
      const waveData = ambientEngine.getWaveformData();

      // Calculate bass power (low bins 0-10)
      let bassEnergy = 0;
      for (let i = 0; i < 10; i++) {
        bassEnergy += freqData[i] || 0;
      }
      bassEnergy = bassEnergy / 10; // 0 to 255
      const bassFactor = bassEnergy / 255;

      // 1. Draw Neon Rain Streaks
      drops.forEach((d) => {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${d.hue}, 95%, 65%, ${d.opacity * (0.8 + bassFactor * 0.5)})`;
        ctx.lineWidth = 1.2;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.length);
        ctx.stroke();

        d.y += d.speed + (bassFactor * 4);
        d.x -= 0.6; // subtle wind drift
        if (d.y > canvas.height) {
          d.y = -d.length;
          d.x = Math.random() * canvas.width;
        }
      });

      // 2. Center Radial Pulsing Rings (Synced to Sub-Bass Heartbeat)
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.42;

      ringRadius = (ringRadius + 0.8 + bassFactor * 2.5) % (Math.min(canvas.width, canvas.height) * 0.45);

      [ringRadius, (ringRadius + 80) % 300, (ringRadius + 160) % 300].forEach((r, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        const ringAlpha = Math.max(0, 0.25 - (r / 300)) * (0.6 + bassFactor * 1.2);
        ctx.strokeStyle = idx % 2 === 0 
          ? `rgba(0, 240, 255, ${ringAlpha})` 
          : `rgba(217, 70, 239, ${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = idx % 2 === 0 ? '#00f0ff' : '#d946ef';
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 3. Audio Waveform Oscilloscope across bottom
      const sliceWidth = canvas.width / waveData.length;
      ctx.beginPath();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';

      let x = 0;
      for (let i = 0; i < waveData.length; i++) {
        const v = waveData[i] / 128.0;
        const y = (canvas.height - 40) + ((v - 1.0) * 35);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#050811] text-slate-100 select-none font-sans">
      {/* Background Interactive Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-none" 
      />

      {/* Foreground Ambient HUD Overlay */}
      <div className="relative z-10 flex flex-col h-full justify-between p-6 sm:p-8 pointer-events-auto">
        
        {/* Top Minimalist Header HUD */}
        <div className="flex items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold backdrop-blur-md shadow-lg shadow-cyan-950/40">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>CYBERPUNK AMBIENT // REALTIME FLOWS</span>
            </div>
            <span className="hidden sm:inline-block text-slate-500 font-normal">
              {profile?.title || 'Senior Systems Engineer'}
            </span>
          </div>

          {/* Sound Controls & Return Button */}
          <div className="flex items-center gap-2">
            {/* Audio Play/Pause Button */}
            <button
              onClick={handleToggleAudio}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer backdrop-blur-md ${
                audioState.isPlaying 
                  ? 'bg-cyan-950/90 text-cyan-300 border-cyan-400 shadow-md shadow-cyan-950/60' 
                  : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-cyan-500 hover:text-white'
              }`}
              title="Toggle Dystopian Ambient Pads & Pulses"
            >
              {audioState.isPlaying ? <Pause size={13} className="text-cyan-400" /> : <Play size={13} className="text-cyan-400 fill-cyan-400" />}
              <span>{audioState.isPlaying ? 'AMBIENT LIVE' : 'START SOUNDSCAPE'}</span>
            </button>

            {/* Mute Toggle */}
            <button
              onClick={() => ambientEngine.toggleMute()}
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
              title={audioState.isMuted ? "Unmute Soundscape" : "Mute Soundscape"}
            >
              {audioState.isMuted ? <VolumeX size={15} className="text-rose-400" /> : <Volume2 size={15} className="text-cyan-400" />}
            </button>

            {/* Sound Layer Controls Dropdown Toggle */}
            <button
              onClick={() => setShowAudioControls(prev => !prev)}
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
              title="Sound Layers & Balance"
            >
              <Sliders size={15} />
            </button>

            {/* Return to Main Dashboard */}
            <button
              onClick={onReturnToDashboard}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white transition-all cursor-pointer font-bold backdrop-blur-md"
              title="Return to Main Dashboard (Esc)"
            >
              <X size={14} />
              <span className="hidden sm:inline">RETURN</span>
              <span className="text-[10px] text-slate-400 font-normal">[ESC]</span>
            </button>
          </div>
        </div>

        {/* Audio Layers Popover Card */}
        {showAudioControls && (
          <div className="absolute right-6 top-20 w-72 bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl space-y-3 font-mono text-xs z-30 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-cyan-400 font-bold">
              <span>AMBIENT SOUND ARCHITECTURE</span>
              <button onClick={() => setShowAudioControls(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>

            {/* Master Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Master Gain</span>
                <span>{Math.round(audioState.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioState.masterVolume}
                onChange={(e) => ambientEngine.setMasterVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Dystopian Pads */}
            <div className="space-y-1 pt-1 border-t border-slate-800/60">
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Music size={11} className="text-purple-400" /> Dystopian Pads (Saw/Tri)
                </span>
                <span>{Math.round(audioState.padsVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioState.padsVolume}
                onChange={(e) => ambientEngine.setLayerVolume('pads', parseFloat(e.target.value))}
                className="w-full accent-purple-400 cursor-pointer"
              />
            </div>

            {/* Sub-Bass Pulse */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <HeartPulse size={11} className="text-cyan-400" /> Sub-Bass Pulse (55Hz)
                </span>
                <span>{Math.round(audioState.subBassVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioState.subBassVolume}
                onChange={(e) => ambientEngine.setLayerVolume('subBass', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Neon Rain */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <CloudRain size={11} className="text-amber-400" /> Neon Rain (Pink Noise)
                </span>
                <span>{Math.round(audioState.rainVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audioState.rainVolume}
                onChange={(e) => ambientEngine.setLayerVolume('rain', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Center Holographic Telemetry HUD */}
        <div className="max-w-4xl mx-auto w-full my-auto space-y-6">
          {/* Main Key Metric Meters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-md shadow-xl">
              <div className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={12} className="text-cyan-400 animate-pulse" /> INDEXED STREAM
              </div>
              <div className="text-3xl font-black text-white mt-1">
                {metrics.totalIndexed}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Real-time candidate buffer</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-purple-500/30 backdrop-blur-md shadow-xl">
              <div className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Target size={12} className="text-purple-400" /> HIGH FIT DENSITY
              </div>
              <div className="text-3xl font-black text-purple-300 mt-1">
                {metrics.matchDensity}%
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{metrics.highMatchCount} roles &gt; 85% match</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-md shadow-xl">
              <div className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-400" /> PIPELINE FLOW
              </div>
              <div className="text-3xl font-black text-emerald-300 mt-1">
                {metrics.pipelineCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{metrics.velocityFactor} conversion</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-md shadow-xl">
              <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={12} className="text-amber-400" /> AUTONOMOUS AGENT
              </div>
              <div className="text-3xl font-black text-amber-300 mt-1">
                {agentState.stats.screenedJobs || metrics.totalIndexed}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Continuous background audit</div>
            </div>
          </div>

          {/* Opportunity Flow Stream (Real-Time Drift Cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 font-mono text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={13} className="text-cyan-400" /> REAL-TIME OPPORTUNITY FLOW
              </span>
              <span className="text-slate-500 text-[11px]">Click opportunity for telemetry details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {flowJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id || `${job.company}_${job.title}`}
                  onClick={() => onOpenJobModal && onOpenJobModal(job)}
                  className="p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-850/90 border border-slate-800 hover:border-cyan-500/60 transition-all cursor-pointer backdrop-blur-md group shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate">
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {job.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold truncate mt-0.5">
                        {job.company}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-black text-emerald-400 shrink-0">
                      {Math.round(job.score || 85)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    <span>{formatJobPostedAge(job.date)}</span>
                    <span className="text-cyan-400 group-hover:underline flex items-center gap-0.5">
                      DETAILS <ArrowUpRight size={10} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Ambient Ticker & Shortcut Prompt */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 font-mono text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>HEARTBEAT PULSE: 50 BPM</span>
            <span className="text-slate-700">|</span>
            <span>CHORD CYCLES: Dm9 • Bbmaj7#11 • Fmaj9 • Am9</span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span>[SPACE] TOGGLE SOUND</span>
            <span>•</span>
            <span>[ESC] EXIT TO DASHBOARD</span>
          </div>
        </div>

      </div>
    </div>
  );
}
