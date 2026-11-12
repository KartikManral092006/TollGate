export const NexconnCode = {
  Ok: 0,
  InvalidParams: 1002,
  SignatureFailed: 1004,
  RateLimited: 1008,
  ServiceNotEnabled: 1009,
  RegisteredUserLimit: 2007,
  GroupExists: 25409,
  GroupMissing: 25410,
  GroupFull: 25411,
  AlreadyMember: 25412,
  OpenChannelMissing: 23410,
  OpenChannelExists: 23435,
  TranslationNotEnabled: 28400,
  TranslationQuotaExceeded: 28405,
} as const;

export const ClientCode = {
  TokenInvalid: 31004,
  AppKeyMismatch: 31005,
  UserBlocked: 31009,
  KickedByOtherDevice: 31010,
  NotInitialized: 33001,
  NotConnected: 30002,
  SendRateLimited: 30004,
  ChatUIChannelNotReady: 39005,
  TranslateTextMissing: 35060,
} as const;

// Call SDK result codes we branch on (Nexconn docs: /callsdk-web/code.md).
export const CallCode = {
  Ok: 0,
  AlreadyInCall: 80002,
  CallNotEnabled: 80006,
  EmptyCallees: 80007,
  NotConnected: 80012,
} as const;

export const ALREADY_DONE: ReadonlySet<number> = new Set([
  NexconnCode.GroupExists,
  NexconnCode.AlreadyMember,
  NexconnCode.OpenChannelExists,
]);
