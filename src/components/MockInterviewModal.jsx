import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, Bot, User, BrainCircuit, Trophy } from 'lucide-react';

export const MockInterviewModal = ({ job, onClose }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch('/api/ai/interview/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_description: job.description || job.notes || '',
            role: job.title,
            question_count: 5
          })
        });
        const data = await res.json();
        setSession(data);
        if (data.questions && data.questions.length > 0) {
          setMessages([{ role: 'interviewer', text: data.questions[0].text, id: data.questions[0].id }]);
        }
      } catch (err) {
        console.error("Failed to start mock interview", err);
        setMessages([{ role: 'interviewer', text: 'Connection to AI Interview service failed. Please ensure the backend is running.' }]);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, [job]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || submitting || !session) return;
    
    const userAns = inputValue.trim();
    const currentQIndex = messages.filter(m => m.role === 'interviewer').length - 1;
    const currentQ = session.questions[currentQIndex];
    
    setMessages(prev => [...prev, { role: 'candidate', text: userAns }]);
    setInputValue('');
    setSubmitting(true);
    
    try {
      const res = await fetch(`/api/ai/interview/${session.session_id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQ.id,
          answer: userAns
        })
      });
      const data = await res.json();
      
      if (data.all_answered) {
        // Fetch feedback
        const fbRes = await fetch(`/api/ai/interview/${session.session_id}/feedback`);
        const fbData = await fbRes.json();
        setFeedback(fbData);
      } else {
        const nextQ = session.questions[currentQIndex + 1];
        setTimeout(() => {
          setMessages(prev => [...prev, { role: 'interviewer', text: nextQ.text, id: nextQ.id }]);
          setSubmitting(false);
        }, 600);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'interviewer', text: 'Error: Could not reach the AI agent. Please check your connection or backend server.' }]);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col h-[85vh] border border-slate-700/60">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/15 border border-indigo-400/30 rounded-xl">
              <BrainCircuit size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Mock Interview Simulator</div>
              <h2 className="text-sm font-bold text-white">{job.title} @ {job.company}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-3 ${m.role === 'candidate' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'candidate' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {m.role === 'candidate' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${m.role === 'candidate' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-50' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              
              {feedback && (
                <div className="mt-8 p-6 bg-slate-800/50 border border-indigo-500/30 rounded-xl space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Trophy className="text-amber-400" size={20} /> Evaluation Score: {feedback.score}/100
                  </h3>
                  <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {feedback.feedback}
                  </div>
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        {!feedback && (
          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={submitting || loading}
                placeholder="Type your answer here..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
              />
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim() || submitting || loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white p-3 rounded-xl transition-colors flex items-center justify-center"
              >
                {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={18} />}
              </button>
            </div>
            <div className="text-[10px] text-slate-500 text-center mt-2">Answers are analyzed in real-time by the LLM Interview Agent</div>
          </div>
        )}
      </div>
    </div>
  );
};
