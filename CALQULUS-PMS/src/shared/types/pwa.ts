/** The `beforeinstallprompt` event fired by browsers that support native PWA install prompts (Chrome/Android). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
