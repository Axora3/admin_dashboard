import { getCurrentAdmin,requireStoreAdmin } from "@/lib/auth/server";
import { withStoreAdmin } from "@/lib/auth/store-scope";
import { getReports } from "@/lib/platform/reports";
import { enforceLimit } from "@/lib/platform/subscriptions";
export async function GET(request:Request) {
  const admin=await getCurrentAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:401});
  const query=Object.fromEntries(new URL(request.url).searchParams);
  const run=async(storeId?:string)=>{if(storeId)await enforceLimit(storeId,"write",0,0,"reports");const result=await getReports(storeId,query);if(result.unavailable.length)return Response.json({error:"Report data is incomplete"},{status:503});const csv=["store_id,currency,period,orders,paid_revenue",...result.reports.flatMap(r=>r.data.buckets.map(b=>[r.id,r.currency,b.label,b.orders,b.revenue].map(value=>`"${String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`).join(",")))].join("\r\n");return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=axora-report.csv","Cache-Control":"no-store"}});};
  try{if(admin.isSuperAdmin)return await run(query.storeId);await requireStoreAdmin();return await withStoreAdmin(actor=>run(actor.storeId));}catch{return Response.json({error:"Report unavailable or plan does not allow export"},{status:403});}
}
