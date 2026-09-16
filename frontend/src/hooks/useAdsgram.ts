import { useCallback, useEffect, useRef } from "react";

// Точно по документации AdsGram:
// https://docs.adsgram.ai/publisher/reward-interstitial-code-examples
// Скрипт подключается в index.html: <script src="https://sad.adsgram.ai/js/sad.min.js">

export interface ShowPromiseResult {
  done: boolean;
  description: string;
  state: "load" | "render" | "playing" | "destroy";
  error: boolean;
}

interface AdController {
  show: () => Promise<ShowPromiseResult>;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean; debugBannerType?: string }) => AdController;
    };
  }
}

export interface UseAdsgramParams {
  blockId: string;
  onReward: () => void;
  onError?: (result: ShowPromiseResult) => void;
}

export function useAdsgram({ blockId, onReward, onError }: UseAdsgramParams): () => Promise<void> {
  const controllerRef = useRef<AdController | undefined>(undefined);

  useEffect(() => {
    controllerRef.current = window.Adsgram?.init({ blockId });
  }, [blockId]);

  return useCallback(async () => {
    if (!controllerRef.current) {
      onError?.({
        error: true,
        done: false,
        state: "load",
        description: "Adsgram script не загружен",
      });
      return;
    }
    try {
      await controllerRef.current.show();
      // Промис резолвится, если пользователь досмотрел ролик до конца.
      onReward();
    } catch (result) {
      onError?.(result as ShowPromiseResult);
    }
  }, [onReward, onError]);
}
