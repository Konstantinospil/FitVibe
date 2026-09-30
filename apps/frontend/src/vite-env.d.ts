/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SOCIAL_INSTAGRAM_URL?: string;
  readonly VITE_SOCIAL_LINKEDIN_URL?: string;
  readonly VITE_SOCIAL_YOUTUBE_URL?: string;
  readonly VITE_SOCIAL_GITHUB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
