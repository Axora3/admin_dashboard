import "server-only";
import { platformDb,platformEnabled } from "./db";
/** Best-effort diagnostic metadata; never log URLs, request bodies or Google messages. */
export async function sheetApiFailure(code:string) {
  if(!platformEnabled())return;
  try{await platformDb().from("platform_health").insert({component:"google_api",status:"error",code,store_id:null});}catch{ /* Preserve the original API failure. */ }
}
