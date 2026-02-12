"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useConversation } from "@/hooks/useConversation";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import type { Emotion, VoiceMode } from "@/types";

const VRMViewer = dynamic(
  () => import("@/components/VRMViewer").then((mod) => mod.VRMViewer),
  { ssr: false }
);
const ChatPanel = dynamic(
  () => import("@/components/ChatPanel").then((mod) => mod.ChatPanel),
  { ssr: false }
);
const VoiceControl = dynamic(
  () => import("@/components/VoiceControl").then((mod) => mod.VoiceControl),
  { ssr: false }
);
const ModeSelector = dynamic(
  () => import("@/components/ModeSelector").then((mod) => mod.ModeSelector),
  { ssr: false }
);

export default function Home() {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("aws");
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [volume, setVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const {
    messages,
    isLoading,
    sendTextMessage,
    addMessage,
  } = useConversation();

  const handleEmotionChange = useCallback((emotion: Emotion) => {
    setCurrentEmotion(emotion);
  }, []);

  const { isListening, toggleListening } = useVoiceChat({
    mode: voiceMode,
    onMessage: addMessage,
    onEmotionChange: handleEmotionChange,
    onVolumeChange: setVolume,
    onSpeakingChange: setIsSpeaking,
  });

  const handleSendMessage = useCallback(
    async (content: string) => {
      const aiMessage = await sendTextMessage(content);
      if (aiMessage?.emotion) {
        setCurrentEmotion(aiMessage.emotion as Emotion);
      }
    },
    [sendTextMessage]
  );

  return (
    <main className="relative h-[100dvh] w-screen flex flex-col md:flex-row overflow-hidden">
      {/* 3D Avatar Area */}
      <div className="flex-1 relative min-h-[40vh] md:min-h-0 min-w-0">
        <VRMViewer
          emotion={currentEmotion}
          isTalking={isSpeaking}
          volume={volume}
        />

        {/* Glassmorphism overlay for controls */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 md:gap-3 z-10">
          <ModeSelector mode={voiceMode} onModeChange={setVoiceMode} />
          <VoiceControl
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListening={toggleListening}
          />
        </div>

        {/* Status indicator */}
        {isListening && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 status-badge z-10">
            <div className="recording-dot" />
            <span className="text-xs font-medium text-white/90">
              {isSpeaking ? "あいが話しています..." : "聞いています..."}
            </span>
          </div>
        )}
      </div>

      {/* Chat Panel - right side on desktop, bottom on mobile */}
      <div className="w-full md:w-[340px] lg:w-[380px] h-[60vh] md:h-full flex-shrink-0 border-t md:border-t-0 md:border-l border-white/10">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </main>
  );
}
