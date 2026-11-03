"use client";

import { FlaskConical, KeyRound, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignIcon } from "@/components/road/sign-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROVIDER_PRESETS,
  type AiConfigView,
  type ProviderPreset,
} from "@/features/why/shared/providers";

const SAVE_ERRORS: Record<string, string> = {
  keys_not_configured:
    "This server can't store API keys yet: the operator needs to set AI_KEYS_SECRET.",
  key_required: "This provider needs an API key.",
  unsafe_url: "The base URL must be a public https address.",
  invalid_body: "Fill in the model (and base URL for this provider).",
};

function presetFor(view: AiConfigView): ProviderPreset {
  return (
    PROVIDER_PRESETS.find((p) => p.label === view.label && p.provider === view.provider) ??
    PROVIDER_PRESETS.find(
      (p) => p.provider === view.provider && p.baseUrl && p.baseUrl === view.baseUrl,
    ) ??
    PROVIDER_PRESETS.find((p) => p.provider === view.provider) ??
    PROVIDER_PRESETS[0]!
  );
}

export function AiCard({
  teamId,
  isOwner,
  initial,
}: {
  teamId: string;
  isOwner: boolean;
  initial: AiConfigView;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [preset, setPreset] = useState<ProviderPreset>(() => presetFor(initial));
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? preset.baseUrl);
  const [model, setModel] = useState(initial.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const items = useMemo(() => Object.fromEntries(PROVIDER_PRESETS.map((p) => [p.id, p.label])), []);

  const isBuiltin = preset.provider === "builtin";
  const keyIsSaved = saved.hasKey && saved.provider === preset.provider;
  const needsBaseUrl = preset.provider === "openai_compatible";

  function choose(id: string) {
    const next = PROVIDER_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPreset(next);
    setBaseUrl(next.baseUrl);
    setModel(next.provider === "anthropic" ? next.modelHint : "");
    setApiKey("");
    setTestResult(null);
  }

  function payload(): Record<string, string> {
    const body: Record<string, string> = { provider: preset.provider, label: preset.label };
    if (!isBuiltin) {
      body.model = model.trim();
      if (needsBaseUrl) body.baseUrl = baseUrl.trim();
      if (apiKey.trim()) body.apiKey = apiKey.trim();
    }
    return body;
  }

  async function send(path: string, method: "POST" | "PUT") {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    return {
      ok: response.ok,
      body: (await response.json().catch(() => ({}))) as Record<string, unknown>,
    };
  }

  async function test() {
    setBusy("test");
    setTestResult(null);
    try {
      const { body } = await send(`/api/teams/${teamId}/ai/test`, "POST");
      setTestResult(
        body.ok
          ? { ok: true, text: String(body.text) }
          : { ok: false, text: String(body.error ?? "The test failed.") },
      );
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      const { ok, body } = await send(`/api/teams/${teamId}/ai`, "PUT");
      if (!ok) {
        toast.error(SAVE_ERRORS[String(body.error)] ?? "Couldn't save the AI settings.");
        return;
      }
      setSaved(body as unknown as AiConfigView);
      setApiKey("");
      toast.success(
        isBuiltin ? "Using built-in explanations." : `"Why?" now uses ${preset.label}.`,
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeKey() {
    setBusy("save");
    try {
      const response = await fetch(`/api/teams/${teamId}/ai`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), apiKey: "" }),
      });
      if (response.ok) {
        setSaved((await response.json()) as AiConfigView);
        toast.success("API key removed.");
      } else {
        toast.error("Couldn't remove the key.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card id="ai" className="scroll-mt-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <SignIcon>
            <Sparkles />
          </SignIcon>
          AI explanations
        </CardTitle>
        <CardDescription>
          What the &ldquo;Why?&rdquo; button on gate cards uses. Bring your own provider (paid, free
          tier or self-hosted) or keep the free built-in explanations. Explanations never approve or
          deny anything.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!isOwner ? (
          <p className="text-sm">
            Using <span className="font-medium">{saved.label ?? "Built-in (free, no AI)"}</span>
            {saved.model && (
              <>
                {" "}
                · <span className="font-mono text-xs">{saved.model}</span>
              </>
            )}
            . Only the team owner can change this.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Select
                items={items}
                value={preset.id}
                onValueChange={(value) => choose(String(value))}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preset.note && <p className="text-xs text-muted-foreground">{preset.note}</p>}
            </div>

            {!isBuiltin && (
              <>
                {needsBaseUrl && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ai-base-url">Base URL</Label>
                    <Input
                      id="ai-base-url"
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder="https://…/v1"
                      spellCheck={false}
                      className="font-mono text-xs"
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-model">Model</Label>
                  <Input
                    id="ai-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder={preset.modelHint}
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ai-key">
                    API key {!preset.keyRequired && <span className="font-normal">(optional)</span>}
                  </Label>
                  <Input
                    id="ai-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      keyIsSaved
                        ? `Saved key ••••${saved.keyLast4} (leave empty to keep)`
                        : "Paste your key"
                    }
                  />
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <KeyRound className="size-3" aria-hidden />
                    Encrypted on the server and never shown again.
                    {keyIsSaved && (
                      <button
                        type="button"
                        onClick={removeKey}
                        className="text-destructive underline-offset-4 hover:underline"
                      >
                        Remove saved key
                      </button>
                    )}
                  </p>
                  {!saved.canSaveKeys && (
                    <p className="text-xs text-gate-pending-fg">
                      This server isn&apos;t set up to store keys yet (AI_KEYS_SECRET). Keyless
                      providers still work.
                    </p>
                  )}
                </div>
              </>
            )}

            {testResult && (
              <div
                role="status"
                className={
                  testResult.ok
                    ? "rounded-lg border border-gate-approved/30 bg-gate-approved-bg p-3 text-sm"
                    : "rounded-lg border border-gate-denied/30 bg-gate-denied-bg p-3 text-sm text-gate-denied-fg"
                }
              >
                <p className="mb-1 text-xs font-medium">
                  {testResult.ok ? "It works. Sample explanation:" : "Test failed"}
                </p>
                <p className="whitespace-pre-wrap">{testResult.text}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={test} disabled={busy !== null}>
                {busy === "test" ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                Test
              </Button>
              <Button onClick={save} disabled={busy !== null}>
                {busy === "save" && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
