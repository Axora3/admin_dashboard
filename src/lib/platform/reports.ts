import "server-only";
import { z } from "zod";
import { getStoreRegistry } from "@/lib/registry";
import { readStoreReportData } from "@/lib/data/google-repository";
import { aggregateReport,localDay } from "./report-rules";
export const reportFilters=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),group:z.enum(["daily","weekly","monthly"])}).refine(v=>v.from<=v.to&&Number.isFinite(Date.parse(v.from))&&Number.isFinite(Date.parse(v.to)),"Invalid report range");
export function parseReportFilters(query:Record<string,string|undefined>) {return reportFilters.parse({from:query.from||localDay(new Date(Date.now()-29*86400000).toISOString()),to:query.to||localDay(new Date().toISOString()),group:query.group||"daily"});}
export async function getReports(storeId:string|undefined,query:Record<string,string|undefined>) {
  const filters=parseReportFilters(query);const stores=storeId?[await getStoreRegistry().get(storeId)].filter(s=>s!==null):await getStoreRegistry().list();
  const reports: Array<{id:string;name:string;currency:string;refreshedAt:string;data:ReturnType<typeof aggregateReport>}>=[],unavailable:string[]=[];
  for(const store of stores){try{const raw=await readStoreReportData(store.id);reports.push({id:store.id,name:store.name,currency:store.currency,refreshedAt:raw.refreshedAt,data:aggregateReport(raw.orders,raw.products,filters.from,filters.to,filters.group)});}catch{unavailable.push(store.name);}}
  return {filters,reports,unavailable,storeCount:stores.length};
}
