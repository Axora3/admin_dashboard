import { timingSafeEqual } from "node:crypto";
import { runPlatformJobs } from "@/lib/platform/jobs";
export const runtime="nodejs";
export const maxDuration=300;
export async function POST(request:Request) {
  const secret=process.env.AXORA_JOB_SECRET;
  const expected=`Bearer ${secret??""}`,received=request.headers.get("authorization")??"";
  if(!secret||secret.length<32||Buffer.byteLength(expected)!==Buffer.byteLength(received)||!timingSafeEqual(Buffer.from(expected),Buffer.from(received)))return Response.json({error:"Unauthorized"},{status:401});
  try{return Response.json(await runPlatformJobs());}catch{return Response.json({error:"Job failed. Check platform monitoring."},{status:503});}
}
