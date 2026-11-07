import type { Order,Product } from "@/lib/types";
export type Granularity="daily"|"weekly"|"monthly";
export function localDay(iso:string):string {const date=new Date(iso);if(!Number.isFinite(date.getTime()))return "";return new Date(date.getTime()+8*3600000).toISOString().slice(0,10);}
export function bucketFor(day:string,group:Granularity):string {
  if(group==="monthly")return day.slice(0,7);
  if(group==="weekly"){const d=new Date(`${day}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
  return day;
}
export function aggregateReport(orders:Order[],products:Product[],from:string,to:string,group:Granularity) {
  const valid=orders.filter(o=>localDay(o.createdAt)>=from&&localDay(o.createdAt)<=to&&Number.isFinite(o.totalAmount)&&o.totalAmount>=0);
  const paid=valid.filter(o=>o.paymentStatus==="paid"&&o.orderStatus!=="cancelled");
  const buckets=new Map<string,{label:string;orders:number;revenue:number}>();
  for(const o of valid){const label=bucketFor(localDay(o.createdAt),group);const b=buckets.get(label)??{label,orders:0,revenue:0};b.orders++;if(o.paymentStatus==="paid"&&o.orderStatus!=="cancelled")b.revenue+=o.totalAmount;buckets.set(label,b);}
  const ranking=new Map<string,{id:string;name:string;quantity:number;revenue:number}>();
  for(const order of paid)for(const item of order.items){if(!Number.isFinite(item.quantity)||!Number.isFinite(item.unitPrice)||item.quantity<0||item.unitPrice<0)continue;const key=item.productId??item.productName;const p=ranking.get(key)??{id:key,name:item.productName,quantity:0,revenue:0};p.quantity+=item.quantity;p.revenue+=item.quantity*item.unitPrice;ranking.set(key,p);}
  const revenue=paid.reduce((sum,o)=>sum+o.totalAmount,0);
  return {orders:valid.length,revenue,averageOrderValue:paid.length?revenue/paid.length:0,customers:new Set(valid.map(o=>o.customerPhone||o.customerEmail||o.customerName)).size,products:products.length,lowStock:products.filter(p=>p.stock<=5).length,outOfStock:products.filter(p=>p.stock===0).length,pending:valid.filter(o=>["new","confirmed","processing"].includes(o.orderStatus)).length,completed:valid.filter(o=>o.orderStatus==="delivered").length,cancelled:valid.filter(o=>o.orderStatus==="cancelled").length,buckets:[...buckets.values()].sort((a,b)=>a.label.localeCompare(b.label)),topProducts:[...ranking.values()].sort((a,b)=>b.revenue-a.revenue).slice(0,10),recent:valid.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5),invalidOrders:orders.filter(o=>!localDay(o.createdAt)||!Number.isFinite(o.totalAmount)||o.totalAmount<0).length};
}
