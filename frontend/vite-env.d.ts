/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALGOD_SERVER_URL?: string;
  readonly VITE_ALGORAND_PORT?: string;
  readonly VITE_NEUROCLASS_TREASURY_ADDRESS?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
