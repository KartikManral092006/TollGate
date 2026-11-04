import type * as NexconnCall from "@nexconn/call";
import type * as NexconnChat from "@nexconn/chat";
import type { NCChatUIApplication, ServiceHooks } from "@nexconn/chatui";
import { devHooks } from "@/features/nexconn/client/dev-hooks";
import { chatUIRegistrations, TG_REGISTRATIONS } from "@/features/nexconn/client/registrations";
import { ClientCode } from "@/features/nexconn/shared/codes";
import type { DevTestUser, NexconnArea } from "@/features/nexconn/shared/config";

export type ChatModule = typeof NexconnChat;
export type CallModule = typeof NexconnCall;
export type ChatMessage = NexconnChat.Message<Record<string, unknown>>;

export type NexconnEvent = { id: number; at: number; kind: string; data: unknown };

type Listener = (event: NexconnEvent) => void;

type ClientStore = {
  listeners: Set<Listener>;
  eventId: number;
  received: Map<string, ChatMessage>;
  engine: Engine | null;
  session: Promise<NexconnSession> | null;
};

const store: ClientStore = ((
  globalThis as { __tollgateNexconn?: ClientStore }
).__tollgateNexconn ??= {
  listeners: new Set(),
  eventId: 0,
  received: new Map(),
  engine: null,
  session: null,
});

export const nexconnEvents = {
  subscribe(listener: Listener): () => void {
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  },
  emit(kind: string, data: unknown) {
    const event = { id: ++store.eventId, at: Date.now(), kind, data };
    for (const listener of store.listeners) listener(event);
  },
};

export function getReceivedMessage(messageId: string): ChatMessage | undefined {
  return store.received.get(messageId);
}

export function describeMessage(message: ChatMessage) {
  return {
    messageId: message.messageId,
    messageType: message.messageType,
    channelId: message.channelIdentifier.channelId,
    channelType: message.channelIdentifier.channelType,
    senderUserId: message.senderUserId,
    sentTime: message.sentTime,
    direction: message.direction,
    contentType: typeof message.content,
    content: message.content,
    metadata: Object.fromEntries(message.metadata ?? new Map()),
  };
}

type TokenResponse = { appKey: string; area: NexconnArea; userId: string; accessToken: string };

export class NexconnConnectError extends Error {
  override readonly name = "NexconnConnectError";

  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

// Without devUser the server issues the token for the signed-in user.
type TokenIdentity = { devUser?: DevTestUser };

async function fetchToken(identity: TokenIdentity, refresh: boolean): Promise<TokenResponse> {
  const response = await fetch("/api/nexconn/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...identity, refresh }),
  });
  if (!response.ok) {
    throw new Error(`Token request failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as TokenResponse;
}

function addHandlers(chat: ChatModule) {
  const { NCEngine } = chat;

  NCEngine.addConnectionStatusHandler(
    "tollgate",
    new chat.ConnectionStatusHandler({
      onConnectionStatusChanged({ status, code }) {
        nexconnEvents.emit("connection", { status, code });
      },
    }),
  );

  NCEngine.addMessageHandler(
    "tollgate",
    new chat.MessageHandler({
      onMessageReceived({ messages }) {
        for (const message of messages as ChatMessage[]) {
          store.received.set(message.messageId, message);
          nexconnEvents.emit("message", describeMessage(message));
        }
      },
      onMessageMetadataUpdated({ messageId, channelIdentifier, metadata }) {
        nexconnEvents.emit("metadataUpdated", {
          messageId,
          channelId: channelIdentifier.channelId,
          metadata,
        });
      },
      onMessageMetadataDeleted(event) {
        nexconnEvents.emit("metadataDeleted", event);
      },
      onStreamMessageRequestInit({ messageId }) {
        nexconnEvents.emit("streamInit", { messageId });
      },
      onStreamMessageRequestDelta({ messageId, chunkInfo }) {
        nexconnEvents.emit("streamDelta", {
          messageId,
          chunk: chunkInfo.content,
          text: chunkInfo.messageContent,
        });
      },
      onStreamMessageRequestComplete({ messageId, code }) {
        nexconnEvents.emit("streamComplete", { messageId, code });
      },
      onMessageBlocked({ info }) {
        nexconnEvents.emit("messageBlocked", info);
      },
      onMessageReceiptResponse({ responses }) {
        for (const response of responses) {
          nexconnEvents.emit("receipt", {
            messageId: response.messageId,
            users: response.users.map((user) => user.userId),
          });
        }
      },
    }),
  );

  NCEngine.addTranslateHandler(
    "tollgate",
    new chat.TranslateHandler({
      onTranslationCompleted({ results }) {
        nexconnEvents.emit("translation", results);
      },
    }),
  );
}

function addCallHandler(engine: NexconnCall.NCCallEngine) {
  const describe = (session: NexconnCall.NCCallSession) => ({
    callId: session.getCallId(),
    callerUserId: session.getCallerUserId(),
    callType: session.getCallType(),
    state: session.getCallState(),
    remote: session.getRemoteParticipants().map((user) => ({
      userId: user.userId,
      state: user.userState,
      mic: user.isMicrophoneEnabled,
    })),
  });
  // Set straight after initialize, or onCallReceived never fires (docs/nexconn.md §6).
  engine.setCallEventHandler({
    onCallReceived({ session, extra }) {
      nexconnEvents.emit("callReceived", { ...describe(session), extra: extra ?? null });
    },
    onCallConnected({ session }) {
      nexconnEvents.emit("callConnected", describe(session));
    },
    onCallEnded({ session, reason }) {
      nexconnEvents.emit("callEnded", { ...describe(session), reason });
    },
    onRemoteUserStateChanged({ callId, userId, userState, reason }) {
      nexconnEvents.emit("callUserState", { callId, userId, userState, reason });
    },
    onRemoteMicrophoneStateChanged({ callId, userId, disabled }) {
      nexconnEvents.emit("callMic", { callId, userId, disabled });
    },
    onStartTimeReceived({ startTime }) {
      nexconnEvents.emit("callStartTime", { startTime });
    },
  });
}

type Engine = {
  chat: ChatModule;
  chatui: NCChatUIApplication | null;
  call: { module: CallModule; engine: NexconnCall.NCCallEngine } | null;
};

export type NexconnSession = Engine & { userId: string };

type EngineOptions = { withChatUI: boolean; withCall: boolean; chatUIHooks?: ServiceHooks };

async function initEngine(token: TokenResponse, options: EngineOptions): Promise<Engine> {
  if (store.engine) return store.engine;

  const chat = await import("@nexconn/chat");
  // Call boot order: install() → NCEngine.initialize → NCCallEngine.initialize → handler →
  // NCEngine.connect. Any call API before connect succeeds fails with 80012.
  const callModule = options.withCall ? await import("@nexconn/call") : null;
  callModule?.NCCallEngine.install();

  chat.NCEngine.initialize({
    appKey: token.appKey,
    areaCode: chat.AreaCode[token.area],
    logLevel: chat.LogLevel.WARN,
  });

  let call: Engine["call"] = null;
  if (callModule) {
    const engine = callModule.NCCallEngine.initialize({
      logOutputLevel: callModule.NCCallLogLevel.WARN,
    });
    addCallHandler(engine);
    call = { module: callModule, engine };
  }

  let chatui: NCChatUIApplication | null = null;
  if (options.withChatUI) {
    const { NCChatUIApplication } = await import("@nexconn/chatui");
    chatui = NCChatUIApplication.initialize({
      hooks: options.chatUIHooks ?? devHooks,
      language: "en_US",
    });
    if (!chatui) throw new Error("ChatUI could not initialize in this browser");
    const registered = chatui.registerCustomMessages(chatUIRegistrations());
    nexconnEvents.emit("chatuiRegister", { code: registered.code });
    chatui.setChannelBarSwitch(false);
    chatui.ready();
  } else {
    chat.NCEngine.registerCustomMessages(TG_REGISTRATIONS);
  }

  addHandlers(chat);
  store.engine = { chat, chatui, call };
  return store.engine;
}

type StartOptions = TokenIdentity & EngineOptions;

async function connect(options: StartOptions): Promise<NexconnSession> {
  const identity: TokenIdentity = options.devUser ? { devUser: options.devUser } : {};
  const token = await fetchToken(identity, false);
  const { chat, chatui, call } = await initEngine(token, options);

  let result = await chat.NCEngine.connect({ token: token.accessToken });
  if (result.code === ClientCode.TokenInvalid) {
    nexconnEvents.emit("tokenRefresh", { reason: result.code });
    const fresh = await fetchToken(identity, true);
    result = await chat.NCEngine.connect({ token: fresh.accessToken });
  }
  if (!result.isOk) {
    throw new NexconnConnectError(result.code, result.msg ?? "Nexconn connect failed");
  }

  const userId = result.data?.userId ?? token.userId;
  nexconnEvents.emit("connected", { userId });
  return { chat, chatui, call, userId };
}

export function startNexconn(options: StartOptions): Promise<NexconnSession> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Nexconn can only start in the browser"));
  }
  store.session ??= connect(options).catch((error: unknown) => {
    store.session = null;
    throw error;
  });
  return store.session;
}
