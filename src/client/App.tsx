import React, { useState, useEffect } from 'react';
import { ChatWindow } from './components/ChatWindow.js';
import { VoicePanel } from './components/VoicePanel.js';
import { MessageSquare, Phone, Calendar, Sparkles, CheckCircle2, ShieldCheck, Clock, MapPin } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'phase1' | 'phase2'>('phase1');
  const [healthStatus, setHealthStatus] = useState<{
    googleConfigured: boolean;
    openaiConfigured: boolean;
    shop: string;
  }>({
    googleConfigured: false,
    openaiConfigured: true,
    shop: 'Cedar Lane Auto Detailing',
  });

  const checkHealth = async () => {
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      console.error('Failed to check health:', err);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#070a12] bg-radial-glow text-slate-100 selection:bg-blue-600/30 selection:text-blue-200">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#0c111d]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Shop Info */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/20">
                <div className="w-full h-full bg-[#0d1322] rounded-[15px] flex items-center justify-center text-xl transition-transform group-hover:scale-105">
                  ✨
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c111d] rounded-full"></span>
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-bold text-white text-base sm:text-lg tracking-tight flex items-center gap-2">
                  Cedar Lane Detailing
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  AI Receptionist Live
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Mon–Sat 8am–6pm (Closed Sun)
                </span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="hidden sm:flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-500" />
                  (415) 555-0100
                </span>
              </div>
            </div>
          </div>

          {/* Phase 1 / Phase 2 Segmented Tabs */}
          <div className="flex items-center p-1 bg-slate-900/90 rounded-2xl border border-white/[0.08] shadow-inner shadow-black/40">
            <button
              onClick={() => setActiveTab('phase1')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'phase1'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Text Chat</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 text-white/90 font-mono">P1</span>
            </button>
            <button
              onClick={() => setActiveTab('phase2')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === 'phase2'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Voice Telephony</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 text-white/90 font-mono">Vapi</span>
            </button>
          </div>

          {/* System Status Badges */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Calendar:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">LLM:</span>
              <span className="text-emerald-400 font-medium">Groq</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6 max-w-5xl w-full mx-auto flex flex-col">
        <div className="flex-1 flex flex-col h-[calc(100vh-125px)] min-h-[580px]">
          {activeTab === 'phase1' ? (
            <ChatWindow onEventOrSheetUpdated={checkHealth} />
          ) : (
            <VoicePanel onCallLogged={checkHealth} />
          )}
        </div>
      </main>
    </div>
  );
}
