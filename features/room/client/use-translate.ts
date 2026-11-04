"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nexconnEvents, startNexconn } from "@/features/nexconn/client/engine";

export type Translation =
  { state: "loading" } | { state: "done"; text: string } | { state: "failed" };

// Results come back through Nexconn's translation event, not the call itself.
const TIMEOUT_MS = 12_000;

// The reader's language, from the browser ("es-MX" → "es").
function readerLanguage(): string {
  return (navigator.language || "en").split("-")[0]!.toLowerCase();
}

// Nexconn machine translation of chat messages into the reader's language, on request.
// The source language is detected, so it works whatever a teammate or client wrote in.
export function useTranslate(callsEnabled: boolean) {
  const [translations, setTranslations] = useState<Map<string, Translation>>(new Map());
  // Request identifier → the message ids waiting on it.
  const waiting = useRef(new Map<string, string[]>());

  const set = useCallback(
    (ids: string[], value: Translation) =>
      setTranslations((current) => {
        const next = new Map(current);
        for (const id of ids) next.set(id, value);
        return next;
      }),
    [],
  );

  useEffect(
    () =>
      nexconnEvents.subscribe((event) => {
        if (event.kind !== "translation") return;
        const results = event.data as {
          identifier: string;
          code: number;
          translateInfo?: { translatedText?: string };
        }[];
        for (const result of results) {
          const ids = waiting.current.get(result.identifier);
          if (!ids) continue;
          waiting.current.delete(result.identifier);
          const text = result.translateInfo?.translatedText;
          set(ids, result.code === 0 && text ? { state: "done", text } : { state: "failed" });
        }
      }),
    [set],
  );

  const translate = useCallback(
    async (messageId: string, text: string) => {
      set([messageId], { state: "loading" });
      try {
        const { chat } = await startNexconn({ withChatUI: false, withCall: callsEnabled });
        const param = new chat.TranslateTextParam(text, "auto", readerLanguage());
        waiting.current.set(param.identifier, [
          ...(waiting.current.get(param.identifier) ?? []),
          messageId,
        ]);
        const result = await chat.NCEngine.translateModule.translateTexts({ list: [param] });
        if (!result.isOk) throw new Error(`translate ${result.code}`);
        setTimeout(() => {
          if (!waiting.current.has(param.identifier)) return;
          waiting.current.delete(param.identifier);
          set([messageId], { state: "failed" });
        }, TIMEOUT_MS);
      } catch {
        set([messageId], { state: "failed" });
      }
    },
    [callsEnabled, set],
  );

  const hide = useCallback(
    (messageId: string) =>
      setTranslations((current) => {
        const next = new Map(current);
        next.delete(messageId);
        return next;
      }),
    [],
  );

  return { translations, translate, hide };
}
