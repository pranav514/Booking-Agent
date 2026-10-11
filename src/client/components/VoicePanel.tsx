import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Zap, Terminal, ShieldCheck, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import Vapi from '@vapi-ai/web';

interface VoicePanelProps {
  onCallLogged: () => void;
}

interface TranscriptItem {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ onCallLogged }) => {
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'connected' | 'completed'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [vapiConfig, setVapiConfig] = useState<{
    publicKey: string;
    assistantId: string;
    serverUrl: string;
    isConfigured: boolean;
  }>({
    publicKey: '',
    assistantId: '',
    serverUrl: '',
    isConfigured: false,
  });

  const vapiRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  // Load Vapi public configuration on mount
  useEffect(() => {
    fetch('/api/vapi/config')
      .then((res) => res.json())
      .then((data) => {
        setVapiConfig(data);
      })
      .catch((err) => console.warn('Failed to load Vapi config:', err));
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Duration timer
  useEffect(() => {
    if (callStatus === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startLiveVoiceCall = async () => {
    if (!vapiConfig.publicKey || !vapiConfig.assistantId) {
      alert('Vapi Public Key or Assistant ID not configured in .env yet.');
      return;
    }

    try {
      setCallStatus('connecting');
      setTranscript([
        { role: 'system', text: 'Initializing WebRTC voice channel to Cedar Lane Receptionist...' },
      ]);

      const vapiInstance = new Vapi(vapiConfig.publicKey);
      vapiRef.current = vapiInstance;

      vapiInstance.on('call-start', () => {
        setCallStatus('connected');
        setTranscript((prev) => [
          ...prev,
          { role: 'system', text: 'Call connected! Say hello or ask for availability.' },
        ]);
      });

      vapiInstance.on('call-end', () => {
        setCallStatus('completed');
        setTranscript((prev) => [
          ...prev,
          { role: 'system', text: 'Call completed. Full call recording and transcript synced to Google Sheets.' },
        ]);
        onCallLogged();
      });

      vapiInstance.on('message', (message: any) => {
        if (message.type === 'transcript') {
          if (message.transcriptType === 'final') {
            const role = message.role === 'assistant' ? 'assistant' : 'user';
            setTranscript((prev) => [
              ...prev,
              { role, text: message.transcript },
            ]);
          }
        }
        if (message.type === 'tool-calls') {
          const tools = (message.toolCalls || []).map((t: any) => t.function?.name || t.name).join(', ');
          setTranscript((prev) => [
            ...prev,
            { role: 'system', text: `⚡ Executed Calendar / Sheets Tool: [${tools}]` },
          ]);
        }
      });

      vapiInstance.on('volume-level', (volume: number) => {
        setVolumeLevel(Math.min(100, Math.round(volume * 100)));
      });

      vapiInstance.on('error', (e: any) => {
        console.error('Vapi Call error:', e);
        setTranscript((prev) => [
          ...prev,
          { role: 'system', text: `Voice connection note: ${e?.message || 'Error occurred'}` },
        ]);
      });

      await vapiInstance.start(vapiConfig.assistantId);
    } catch (err: any) {
      console.error('Failed to start call:', err);
      setCallStatus('idle');
      alert(`Could not start voice call: ${err.message}`);
    }
  };

  const endLiveVoiceCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      vapiRef.current = null;
    }
    setCallStatus('completed');
    onCallLogged();
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      const nextMute = !isMuted;
      vapiRef.current.setMuted(nextMute);
      setIsMuted(nextMute);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1322]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      {/* Voice Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0c101d]/90 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 p-[1px] shadow-md shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0d1322] rounded-[11px] flex items-center justify-center text-indigo-400">
                <Phone className="w-4 h-4" />
              </div>
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[#0d1322] rounded-full ${
              callStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-indigo-500'
            }`}></span>
          </div>

          <div>
            <h2 className="font-semibold text-white text-sm tracking-tight">
              Live Voice Telephony (Phase 2)
            </h2>
            <p className="text-[11px] text-indigo-400 font-medium flex items-center gap-1.5">
              <span>●</span> Deepgram Nova-2 + Cartesia Sonic (&lt; 1.2s SLA)
            </p>
          </div>
        </div>

        {/* Call Timer or Status */}
        {callStatus === 'connected' && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{formatTimer(callDuration)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Hero Voice Visualizer Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#121929] to-[#0c101d] border border-white/[0.08] p-6 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="relative mb-5 flex items-center justify-center">
            {/* Pulsing Concentric Rings */}
            <div className={`absolute w-36 h-36 rounded-full transition-all duration-300 ${
              callStatus === 'connected'
                ? 'bg-indigo-500/15 animate-ping'
                : 'bg-indigo-500/5'
            }`}></div>
            <div className={`absolute w-28 h-28 rounded-full transition-all duration-300 ${
              callStatus === 'connected'
                ? 'bg-purple-500/20 animate-pulse'
                : 'bg-purple-500/5'
            }`}></div>

            {/* Center Orb */}
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              callStatus === 'connected'
                ? 'bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 shadow-indigo-500/50 scale-105'
                : 'bg-gradient-to-tr from-slate-800 to-slate-900 border border-white/10 text-slate-400 shadow-black/40'
            }`}>
              {callStatus === 'connected' ? (
                <Mic className="w-8 h-8 text-white animate-pulse" />
              ) : (
                <Phone className="w-8 h-8 text-indigo-400" />
              )}
            </div>
          </div>

          <h3 className="text-base font-bold text-white tracking-tight mb-1">
            {callStatus === 'connected'
              ? 'Voice Call in Progress'
              : callStatus === 'connecting'
              ? 'Connecting to Cedar Lane AI...'
              : 'Talk Directly with AI Receptionist'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-5">
            {callStatus === 'connected'
              ? 'Speak naturally into your microphone. The AI receptionist will check Google Calendar and respond instantly with low-latency audio.'
              : 'Speak via your laptop microphone or open this page on your smartphone. The agent checks real-time availability and books appointments.'}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {callStatus === 'connected' ? (
              <>
                <button
                  onClick={toggleMute}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isMuted
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.1] text-slate-200'
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4" />}
                  <span>{isMuted ? 'Muted' : 'Mute Mic'}</span>
                </button>

                <button
                  onClick={endLiveVoiceCall}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 transition-all"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Call</span>
                </button>
              </>
            ) : (
              <button
                onClick={startLiveVoiceCall}
                disabled={callStatus === 'connecting'}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-xl shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Mic className="w-4 h-4" />
                <span>{callStatus === 'connecting' ? 'Connecting Mic...' : 'Start Live Voice Call'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Latency & Telemetry Metric Cards */}
        <div className="p-4 rounded-2xl bg-[#0c101d]/90 border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Tuned Voice Stack Latency Budget
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium border border-emerald-500/20">
              SLA: &lt; 1,200ms
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[#111726] border border-white/[0.05]">
              <span className="text-[10px] text-slate-400 block mb-1">STT (Deepgram Nova-2)</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">~150 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-[#111726] border border-white/[0.05]">
              <span className="text-[10px] text-slate-400 block mb-1">LLM (GPT-4o-mini)</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">~220 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-[#111726] border border-white/[0.05]">
              <span className="text-[10px] text-slate-400 block mb-1">TTS (Cartesia Sonic)</span>
              <span className="font-mono text-emerald-400 font-bold text-sm">~120 ms</span>
            </div>
            <div className="p-3 rounded-xl bg-[#111726] border border-white/[0.05]">
              <span className="text-[10px] text-slate-400 block mb-1">Round-Trip Latency</span>
              <span className="font-mono text-emerald-300 font-bold text-sm">~570 ms</span>
            </div>
          </div>
        </div>

        {/* Live Conversation Stream Drawer */}
        <div className="p-4 rounded-2xl bg-[#0c101d]/90 border border-white/[0.08] min-h-[180px] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-400" />
              Live Conversation Stream & Webhook Events
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-medium ${
              callStatus === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                : callStatus === 'connecting'
                ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                : 'bg-white/[0.06] text-slate-400'
            }`}>
              STATUS: {callStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-xs max-h-[220px]">
            {transcript.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-3">
                <Volume2 className="w-6 h-6 mb-2 stroke-1 opacity-60" />
                <p className="text-slate-400 font-medium">Ready for Speech Input</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click <strong>"Start Live Voice Call"</strong> above to test via your microphone.
                </p>
              </div>
            ) : (
              transcript.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                    item.role === 'system'
                      ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20 text-[11px]'
                      : item.role === 'assistant'
                      ? 'text-emerald-300 bg-emerald-950/40 border border-emerald-900/40'
                      : 'text-blue-200 bg-blue-950/40 border border-blue-900/40'
                  }`}
                >
                  <strong className="block text-[10px] uppercase tracking-wider mb-1 opacity-75">
                    {item.role === 'assistant' ? 'Cedar Lane Receptionist' : item.role === 'user' ? 'Caller' : 'System Action'}
                  </strong>
                  {item.text}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
