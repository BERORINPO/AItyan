"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const EMOTION_EMOJI: Record<string, string> = {
  happy: "😊",
  surprised: "😲",
  shy: "😳",
  sad: "😢",
  neutral: "",
  angry: "😤",
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatPanel({ messages, onSendMessage, isLoading }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full chat-panel-bg">
      {/* Header */}
      <div className="p-4 border-b border-white/10 chat-header">
        <div className="flex items-center gap-3">
          <div className="avatar-icon">
            <span className="text-lg">💕</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-pink-200">あい</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-white/50">オンライン</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 messages-area">
        {messages.length === 0 && (
          <div className="text-center mt-12 px-4">
            <div className="text-5xl mb-4 animate-bounce-slow">💝</div>
            <p className="text-sm text-white/40 leading-relaxed">
              あいに話しかけてみてね！
              <br />
              テキストでも音声でもOKだよ♪
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} message-appear`}
          >
            <div className="flex flex-col gap-1 max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                    ? "user-bubble rounded-br-md"
                    : "ai-bubble rounded-bl-md"
                  }`}
              >
                {msg.role === "assistant" && msg.emotion && EMOTION_EMOJI[msg.emotion] && (
                  <span className="mr-1">{EMOTION_EMOJI[msg.emotion]}</span>
                )}
                {msg.content}
              </div>
              <span
                className={`text-[10px] text-white/30 px-2 ${msg.role === "user" ? "text-right" : "text-left"
                  }`}
              >
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start message-appear">
            <div className="ai-bubble rounded-2xl rounded-bl-md px-4 py-3">
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/8">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
