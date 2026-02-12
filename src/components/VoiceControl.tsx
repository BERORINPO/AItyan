"use client";

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggleListening: () => void;
}

export function VoiceControl({
  isListening,
  isSpeaking,
  onToggleListening,
}: VoiceControlProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <div className="absolute inset-0 w-20 h-20 -m-2 rounded-full bg-pink-500/20 animate-pulse-ring" />
          <div className="absolute inset-0 w-20 h-20 -m-2 rounded-full bg-pink-500/10 animate-pulse-ring delay-300" />
        </>
      )}

      <button
        onClick={onToggleListening}
        disabled={isSpeaking}
        className={`mic-button ${isListening ? "mic-button-active" : ""}`}
        title={isListening ? "音声入力を停止" : "音声入力を開始"}
      >
        {isListening ? (
          /* Stop icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7"
          >
            <path
              fillRule="evenodd"
              d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          /* Mic icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7"
          >
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
