import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Trash2, ArrowRight } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatAdvisorProps {
  systemContext?: string;
  defaultSuggestions?: string[];
  themeColor?: 'blue' | 'purple' | 'emerald' | 'indigo';
}

export const AIChatAdvisor: React.FC<AIChatAdvisorProps> = ({
  systemContext,
  defaultSuggestions = [
    "How can I improve my content quality score?",
    "Explain standard wave normalization constants.",
    "Draft a robust syllabus rubric for machine learning.",
    "State direct feedback on academic run-on sentences."
  ],
  themeColor = 'blue'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Greetings! I am the NeuroClass AI Learning Advisor powered by Gemini 3.5. How can I facilitate your curriculum planning or clarify grading criteria today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          systemInstruction: systemContext
        })
      });

      if (!response.ok) {
        throw new Error('Connection to GenAI workspace timed out.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || 'No response compiled.' }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message || 'Failure to synthesize AI feedback. Check your internet connection.'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Clear session history?')) {
      setMessages([
        { role: 'assistant', content: 'Session cleared. I am ready to evaluate new prompts.' }
      ]);
    }
  };

  const activeColor = 
    themeColor === 'purple' ? 'from-purple-600 to-indigo-600 bg-purple-600 shadow-purple-500/20 text-purple-500' :
    themeColor === 'emerald' ? 'from-emerald-500 to-teal-600 bg-emerald-500 shadow-emerald-500/20 text-emerald-500' :
    themeColor === 'indigo' ? 'from-indigo-600 to-blue-600 bg-indigo-600 shadow-indigo-500/20 text-indigo-500' :
    'from-blue-600 to-cyan-600 bg-blue-600 shadow-blue-500/20 text-blue-500';

  return (
    <>
      {/* Floating Sparkles Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-8 right-8 z-[150] h-14 px-6 rounded-full bg-gradient-to-tr ${activeColor.split(' bg-')[0]} text-white font-bold text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl cursor-pointer hover:scale-105 transition-all duration-300`}
      >
        <Sparkles size={16} className="animate-pulse" />
        AI Advisor
      </button>

      {/* Slide-out Panel Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex justify-end">
          {/* Dismiss Back-area */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsOpen(false)} />

          {/* Core Panel Content */}
          <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-l border-black/5 dark:border-white/10 z-10">
            {/* Header */}
            <div className={`p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-r ${activeColor.split(' bg-')[0]} text-white`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">AI Core Advisor</h3>
                  <p className="text-[9px] opacity-75 font-semibold uppercase tracking-widest">Active Gemini 3.5 Agent</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={clearChat}
                  title="Clear history"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer transition-all"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white cursor-pointer transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Message Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-black/10">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300' : 'bg-blue-500/10 text-blue-500'}`}>
                    {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-tl-none text-slate-800 dark:text-slate-200'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <Bot size={14} className="animate-spin" />
                  </div>
                  <div className="p-4 rounded-2xl text-xs bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 rounded-tl-none text-slate-400">
                    <span className="animate-pulse">Thinking & evaluating parameters...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Predefined prompt helpers */}
            {messages.length < 3 && !loading && (
              <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50/30 dark:bg-black/5 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider opacity-40 px-1">Suggested Prompts</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {defaultSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      className="w-full text-left p-3 rounded-xl border border-black/5 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-[11px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer flex items-center justify-between"
                    >
                      <span>{s}</span>
                      <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 translate-x-2 transition-all text-blue-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-4 border-t border-black/5 dark:border-white/5">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="relative"
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask advisor about grading details..."
                  className="w-full pl-5 pr-12 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-transparent focus:border-blue-500/30 focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-xs text-slate-800 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-white transition-all cursor-pointer disabled:opacity-35 ${activeColor.split(' hover:')[0]}`}
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
