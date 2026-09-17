import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronRight,
  Sparkles,
  X,
  Award,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import {
  INTERVIEW_TRACKS,
  isSpeechSynthesisSupported,
  isSpeechRecognitionSupported,
  speakQuestion,
  createSpeechRecognizer,
  evaluateStarResponse,
} from '../services/voiceInterviewService';

export default function VoiceMockInterviewModal({ isOpen, onClose }) {
  const [selectedTrackId, setSelectedTrackId] = useState('engineering');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [speechError, setSpeechError] = useState(null);

  const recognizerRef = useRef(null);
  const cancelSpeechRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const currentTrack = INTERVIEW_TRACKS[selectedTrackId] || INTERVIEW_TRACKS.engineering;
  const currentQuestion = currentTrack.questions[questionIndex] || currentTrack.questions[0];

  // Stop recording and speaking when modal closes
  const cleanupAudio = useCallback(() => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch {
        // Ignore stop error
      }
      recognizerRef.current = null;
    }
    if (cancelSpeechRef.current) {
      cancelSpeechRef.current();
      cancelSpeechRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupAudio();
    }
    return cleanupAudio;
  }, [isOpen, cleanupAudio]);

  // Timer effect for recording
  useEffect(() => {
    if (isRecording) {
      setSecondsElapsed(0);
      timerIntervalRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Read question aloud
  const handleToggleSpeak = () => {
    setSpeechError(null);
    if (isSpeaking) {
      if (cancelSpeechRef.current) cancelSpeechRef.current();
      setIsSpeaking(false);
      return;
    }

    if (!isSpeechSynthesisSupported()) {
      setSpeechError('Text-to-speech is not supported in this browser environment.');
      return;
    }

    setIsSpeaking(true);
    cancelSpeechRef.current = speakQuestion(
      currentQuestion.question,
      () => setIsSpeaking(false),
      (err) => {
        setIsSpeaking(false);
        setSpeechError(err.message || 'Speech synthesis failed.');
      }
    );
  };

  // Toggle voice recording
  const handleToggleRecord = () => {
    setSpeechError(null);
    if (isRecording) {
      cleanupAudio();
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setSpeechError('Voice recording is not natively supported in this browser. You can type your response manually below.');
      return;
    }

    try {
      const recognizer = createSpeechRecognizer({
        onResult: (text) => {
          setTranscript(text);
        },
        onError: (event) => {
          setIsRecording(false);
          setSpeechError(`Microphone error: ${event.error || 'Access denied or unavailable.'}`);
        },
        onEnd: () => {
          setIsRecording(false);
        },
      });

      if (recognizer) {
        recognizerRef.current = recognizer;
        recognizer.start();
        setIsRecording(true);
      } else {
        setSpeechError('Could not initialize microphone input.');
      }
    } catch (err) {
      setIsRecording(false);
      setSpeechError(err.message || 'Microphone activation failed.');
    }
  };

  // Reset drill
  const handleReset = () => {
    cleanupAudio();
    setTranscript('');
    setSecondsElapsed(0);
    setSpeechError(null);
  };

  // Next question
  const handleNextQuestion = () => {
    cleanupAudio();
    setTranscript('');
    setSecondsElapsed(0);
    setSpeechError(null);
    setQuestionIndex((prev) => (prev + 1) % currentTrack.questions.length);
  };

  // Switch Track
  const handleTrackChange = (trackId) => {
    cleanupAudio();
    setSelectedTrackId(trackId);
    setQuestionIndex(0);
    setTranscript('');
    setSecondsElapsed(0);
    setSpeechError(null);
  };

  // Real-time STAR evaluation
  const evaluation = useMemo(() => {
    return evaluateStarResponse(transcript);
  }, [transcript]);

  if (!isOpen) return null;

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mock-interview-title"
    >
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-6 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="mock-interview-title" className="text-lg font-bold text-slate-100">
                  Interactive Voice Mock Interview Studio
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  STAR AI Evaluator
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Practice panel interview drills with real-time speech synthesis, audio recording, and STAR behavioral grading.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track Selection Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-2 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" /> Domain Track:
          </span>
          {Object.values(INTERVIEW_TRACKS).map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackChange(track.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTrackId === track.id
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100 border border-slate-700/50'
              }`}
            >
              {track.name}
              <span className="ml-1.5 opacity-70 text-[10px]">({track.badge})</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Question & Voice Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Question Card */}
            <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/70 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">
                  Question {questionIndex + 1} of {currentTrack.questions.length} · {currentQuestion.title}
                </span>
                <button
                  onClick={handleToggleSpeak}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    isSpeaking
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 border-slate-600'
                  }`}
                  aria-label={isSpeaking ? 'Stop audio' : 'Listen to question'}
                >
                  {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {isSpeaking ? 'Speaking...' : 'Listen Question'}
                </button>
              </div>
              <h3 className="text-base font-semibold text-slate-100 leading-relaxed">
                "{currentQuestion.question}"
              </h3>
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Panel Strategy Tip:</strong> {currentQuestion.tips}</span>
              </div>
            </div>

            {/* Error Banner */}
            {speechError && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{speechError}</span>
              </div>
            )}

            {/* Voice Control Action Area */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 relative overflow-hidden">
              {/* Waveform Pulse Animation */}
              {isRecording && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                  <div className="w-48 h-48 rounded-full bg-emerald-500 animate-ping" />
                </div>
              )}

              <div className="flex items-center gap-6 relative z-10">
                <button
                  onClick={handleToggleRecord}
                  className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-lg ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/30 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  }`}
                  aria-label={isRecording ? 'Stop voice recording' : 'Start speaking'}
                >
                  {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">
                      {isRecording ? 'Listening to your response...' : 'Microphone Inactive'}
                    </span>
                    {isRecording && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Duration: {formatTimer(secondsElapsed)}</span>
                    <span className="text-slate-600">·</span>
                    <span>Target: 90 - 150s</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear & Reset
                </button>
                <button
                  onClick={handleNextQuestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm"
                >
                  Next Question
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Transcript & Manual Editor */}
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label htmlFor="transcript-input" className="font-semibold text-slate-300">
                  Live Spoken Transcript / Response Draft:
                </label>
                <span>{evaluation.wordCount} words</span>
              </div>
              <textarea
                id="transcript-input"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Speak clearly using the microphone button above, or type/paste your STAR answer here to evaluate readiness..."
                rows={5}
                className="w-full px-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-slate-200 text-sm font-sans placeholder-slate-500 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 resize-y"
              />
            </div>
          </div>

          {/* Right Column: Real-Time STAR Feedback Matrix (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/40 p-5 rounded-xl border border-slate-800">
            {/* Overall Score Badge */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <div>
                <div className="text-xs font-medium text-slate-400">STAR Mastery Score</div>
                <div className="text-3xl font-extrabold text-slate-100 mt-0.5">
                  {evaluation.overallScore}%
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                  evaluation.overallScore >= 80
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : evaluation.overallScore >= 50
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600'
                }`}
              >
                <Award className="w-4 h-4" />
                {evaluation.overallScore >= 80
                  ? 'Panel Ready'
                  : evaluation.overallScore >= 50
                  ? 'Needs Polishing'
                  : 'Incomplete STAR'}
              </div>
            </div>

            {/* 4 Pillars Breakdown */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                STAR Pillar Breakdown
              </span>

              {/* Situation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">S · Situation (Context & Setting)</span>
                  <span className="font-semibold text-slate-200">{evaluation.breakdown.situation}/25</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(evaluation.breakdown.situation / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Task */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">T · Task (Responsibility & Objective)</span>
                  <span className="font-semibold text-slate-200">{evaluation.breakdown.task}/25</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${(evaluation.breakdown.task / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">A · Action (Personal Agency & Leadership)</span>
                  <span className="font-semibold text-slate-200">{evaluation.breakdown.action}/25</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${(evaluation.breakdown.action / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Result */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">R · Result (Measurable Metrics & Value)</span>
                  <span className="font-semibold text-slate-200">{evaluation.breakdown.result}/25</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(evaluation.breakdown.result / 25) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Pacing Assessment */}
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-xs">
              <span className="font-semibold text-slate-300">Pacing Assessment:</span>
              <p className="text-slate-400 mt-0.5">{evaluation.pacing}</p>
            </div>

            {/* Actionable Coaching Suggestions */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Actionable Coaching Tips
              </span>
              <div className="space-y-2 overflow-y-auto max-h-48 pr-1">
                {evaluation.feedback.map((tip, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Microphone audio is transcribed locally in your browser with zero external recording storage.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-xs transition-colors border border-slate-700"
          >
            Close Studio
          </button>
        </div>
      </div>
    </div>
  );
}
