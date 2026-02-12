"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { VoiceMode, ChatMessage, Emotion } from "@/types";
import { GeminiLiveSession } from "@/lib/voice/gemini-live";
import {
  float32ToInt16,
  downsampleBuffer,
  calculateVolume,
} from "@/lib/voice/audio-utils";

type UseVoiceChatOptions = {
  mode: VoiceMode;
  onMessage: (message: ChatMessage) => void;
  onEmotionChange: (emotion: Emotion) => void;
  onVolumeChange: (volume: number) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
};

export function useVoiceChat({
  mode,
  onMessage,
  onEmotionChange,
  onVolumeChange,
  onSpeakingChange,
}: UseVoiceChatOptions) {
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const geminiSessionRef = useRef<GeminiLiveSession | null>(null);

  // 音声再生キュー管理
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 音声チャンクをキューに追加し、順番に再生する
   */
  const enqueueAudioChunk = useCallback(
    (audioData: ArrayBuffer, audioContext: AudioContext) => {
      audioQueueRef.current.push(audioData);
      if (!isPlayingRef.current) {
        playNextChunk(audioContext);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * キューの次の音声チャンクを再生する
   */
  const playNextChunk = useCallback(
    (audioContext: AudioContext) => {
      const chunk = audioQueueRef.current.shift();
      if (!chunk) {
        isPlayingRef.current = false;
        onSpeakingChange(false);
        onVolumeChange(0);
        return;
      }

      isPlayingRef.current = true;
      onSpeakingChange(true);

      // PCMデータをAudioBufferに変換（24kHz = Gemini出力サンプルレート）
      const sampleRate = 24000;
      const audioBuffer = audioContext.createBuffer(
        1,
        chunk.byteLength / 2,
        sampleRate
      );
      const channelData = audioBuffer.getChannelData(0);
      const view = new DataView(chunk);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = view.getInt16(i * 2, true) / 32768;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = 1.2; // ピッチを上げてかわいくする

      // ボリュームモニタリング用のAnalyserNode
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      const dataArray = new Float32Array(analyser.frequencyBinCount);
      const monitorInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);
        onVolumeChange(calculateVolume(dataArray));
      }, 50);

      source.onended = () => {
        clearInterval(monitorInterval);
        // 次のチャンクを再生
        playNextChunk(audioContext);
      };

      source.start();
    },
    [onSpeakingChange, onVolumeChange]
  );

  const startListening = useCallback(async () => {
    try {
      // マイクアクセスを取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      if (mode === "aws") {
        await startAWSMode(processor, source, audioContext);
      } else {
        await startGeminiLiveMode(processor, source, audioContext);
      }

      setIsListening(true);
    } catch (error) {
      console.error("音声接続開始に失敗:", error);
      alert(
        `音声接続に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`
      );
    }
  }, [mode, onMessage, onEmotionChange, onVolumeChange, onSpeakingChange]);

  const startAWSMode = async (
    processor: ScriptProcessorNode,
    source: MediaStreamAudioSourceNode,
    audioContext: AudioContext
  ) => {
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

    if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/aws-voice`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start-listening" }));
    };

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "transcription":
          if (msg.data.isFinal) {
            onMessage({
              id: uuidv4(),
              role: "user",
              content: msg.data.text,
              timestamp: Date.now(),
            });
          }
          break;
        case "response-text":
          onMessage({
            id: uuidv4(),
            role: "assistant",
            content: msg.data.text,
            emotion: msg.data.emotion as Emotion,
            timestamp: Date.now(),
          });
          break;
        case "emotion":
          onEmotionChange(msg.data as Emotion);
          break;
        case "response-audio":
          playBase64Audio(msg.data, audioContext);
          break;
        case "error":
          console.error("サーバーエラー:", msg.data);
          break;
      }
    };

    // 音声処理・WebSocketへの送信
    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const volume = calculateVolume(inputData);
      onVolumeChange(volume);

      // 48kHz → 16kHzにダウンサンプリング
      const downsampled = downsampleBuffer(
        inputData,
        audioContext.sampleRate,
        16000
      );
      const pcm = float32ToInt16(downsampled);
      ws.send(pcm.buffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const startGeminiLiveMode = async (
    processor: ScriptProcessorNode,
    source: MediaStreamAudioSourceNode,
    audioContext: AudioContext
  ) => {
    // 音声再生キューをクリア
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    const session = new GeminiLiveSession({
      onAudioChunk: (audioData) => {
        // キューイングで順番に再生
        enqueueAudioChunk(audioData, audioContext);
      },
      onTranscription: (text) => {
        // 音声との同期のため少し遅延させる
        setTimeout(() => {
          onMessage({
            id: uuidv4(),
            role: "assistant",
            content: text,
            timestamp: Date.now(),
          });
        }, 600);
      },
      onError: (error) => {
        console.error("Gemini Liveエラー:", error);
      },
      onClose: () => {
        onSpeakingChange(false);
      },
    });

    geminiSessionRef.current = session;
    await session.connect();

    // マイク音声をGemini Live APIに送信
    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const volume = calculateVolume(inputData);
      onVolumeChange(volume);

      // 48kHz → 16kHzにダウンサンプリング
      const downsampled = downsampleBuffer(
        inputData,
        audioContext.sampleRate,
        16000
      );
      const pcm = float32ToInt16(downsampled);
      session.sendAudio(pcm.buffer as ArrayBuffer);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const playBase64Audio = (base64Data: string, audioContext: AudioContext) => {
    onSpeakingChange(true);
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 16000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    const monitorInterval = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);
      onVolumeChange(calculateVolume(dataArray));
    }, 50);

    source.onended = () => {
      clearInterval(monitorInterval);
      onVolumeChange(0);
      onSpeakingChange(false);
    };

    source.start();
  };

  const stopListening = useCallback(() => {
    // WebSocket停止
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop-listening" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    // Geminiセッション停止
    if (geminiSessionRef.current) {
      geminiSessionRef.current.disconnect();
      geminiSessionRef.current = null;
    }

    // 音声処理停止
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // メディアストリーム停止
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // AudioContext停止
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 音声キューのクリア
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setIsListening(false);
    onVolumeChange(0);
  }, [onVolumeChange]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
  };
}
