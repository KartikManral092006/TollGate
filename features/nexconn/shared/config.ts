export const NEXCONN_AREAS = {
  SG: { primary: "https://api.sg-light-api.com", backup: "https://api-b.sg-light-api.com" },
  NA: { primary: "https://api.us-light-api.com", backup: "https://api-b.us-light-api.com" },
  SA: { primary: "https://api.sau-light-api.com", backup: "https://api-b.sau-light-api.com" },
} as const;

export type NexconnArea = keyof typeof NEXCONN_AREAS;

export const DEV_TEAM_CHANNEL_ID = "tgdevteam1";
// Test identities for the /dev/nexconn lab. The token route accepts them only when dev
// routes are enabled. tollgatebot is never a dev identity; its token stays on the server.
// They count toward the App Key's MAU, so keep test users to these two.
export const DEV_TEST_USERS = ["tgalice", "tgbob"] as const;
export type DevTestUser = (typeof DEV_TEST_USERS)[number];

// Sends every TG:* message through the server API. It never connects, so it is not MAU.
export const SYSTEM_USER_ID = "tollgatebot";
export const SYSTEM_USER_NAME = "Tollgate";
