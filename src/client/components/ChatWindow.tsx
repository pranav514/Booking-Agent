import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Wrench, RefreshCw, Sparkles, ArrowRight } from "lucide-react";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface ChatWindowProps {
  onEventOrSheetUpdated: () => void;
}

const QUICK_PROMPTS = [
  "Is tomorrow at 4:00 PM open for an Express Wash?",
  "What is included in the Full Signature Detail?",
  "I'm running 15 minutes late for my appointment",
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  onEventOrSheetUpdated,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, thanks for calling Cedar Lane Auto Detailing! I can help you check availability, book or reschedule an appointment, answer questions about our detailing packages, or assist if you are running late. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastTools, setLastTools] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
          channel: "Text Chat",
        }),
      });

      const data = await res.json();
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
        if (data.toolsExecuted && data.toolsExecuted.length > 0) {
          setLastTools(data.toolsExecuted);
        }
        onEventOrSheetUpdated();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error checking the schedule. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1322]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      {/* Chat Window Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#0c101d]/90 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-[1px] shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-[#0d1322] rounded-[11px] flex items-center justify-center text-blue-400">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#0d1322] rounded-full"></span>
          </div>

          <div>
            <h2 className="font-semibold text-white text-sm tracking-tight">
              Cedar Lane AI Receptionist
            </h2>
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
              <span>●</span> Phase 1 Interactive Text Engine (Online)
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                role: "assistant",
                content:
                  "Hi, thanks for calling Cedar Lane Auto Detailing! How can I help you today?",
              },
            ]);
            setLastTools([]);
          }}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          title="Reset conversation"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                isUser ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-sm ${
                  isUser
                    ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20"
                    : "bg-[#131b2e] text-emerald-300 border border-emerald-500/20 shadow-emerald-500/10"
                }`}
              >
                {isUser ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all ${
                  isUser
                    ? "bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white rounded-tr-sm shadow-md shadow-blue-600/15 font-medium"
                    : "bg-[#121929]/95 text-slate-100 border border-white/[0.08] rounded-tl-sm shadow-lg shadow-black/20"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Live Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#131b2e] text-emerald-300 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#121929]/90 border border-white/[0.08] px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.3s]"></span>
              </div>
              <span className="text-xs text-slate-400 font-medium ml-1">
                Checking Google Calendar & shop policies...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Tool Calling Execution Indicator */}
      {lastTools.length > 0 && (
        <div className="px-5 py-2 bg-[#0a0f1c] border-t border-white/[0.06] flex items-center gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Calendar Tool Executed:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lastTools.map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[11px]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-[#0b101e]/80 border-t border-white/[0.05] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold shrink-0">
          Try:
        </span>
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => sendMessage(prompt)}
            disabled={isLoading}
            className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] hover:border-blue-500/40 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <span>{prompt}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-3.5 bg-[#0a0e1a] border-t border-white/[0.08] flex items-center gap-2.5"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type what the caller says (e.g. 'Can I book tomorrow at 4 PM?')..."
            className="w-full bg-[#111726] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:hover:from-blue-600 disabled:hover:to-indigo-600 text-white rounded-xl transition-all shadow-md shadow-blue-600/20 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
