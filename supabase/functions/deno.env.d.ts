/**
 * Stubs for Supabase Edge Functions when typechecked with the repo TypeScript (Deno supplies real APIs at runtime).
 */

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module "https://esm.sh/@supabase/supabase-js@2.49.8" {
  export * from "@supabase/supabase-js";
}
