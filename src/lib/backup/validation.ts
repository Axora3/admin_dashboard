import { z } from "zod";
export const cellSchema=z.object({stringValue:z.string().optional(),numberValue:z.number().finite().optional(),boolValue:z.boolean().optional(),formulaValue:z.string().optional()}).strict().refine(c=>Object.keys(c).length<=1);
export const gridSchema=z.array(z.object({name:z.string().min(1),rows:z.array(z.array(cellSchema))}));
export const snapshotSchema=z.object({version:z.literal(1),storeId:z.string().min(1),sourceRef:z.string(),mode:z.enum(["google","local"]),createdAt:z.string(),configuration:z.record(z.unknown()),grid:gridSchema});
export type Cell=z.infer<typeof cellSchema>;
export type Grid=z.infer<typeof gridSchema>;
export function normalizedGrid(grid:Grid):string {
  return JSON.stringify([...grid].sort((a,b)=>a.name.localeCompare(b.name)).map(tab=>{
    const rows=tab.rows.map(row=>{const next=row.map(c=>Object.fromEntries(Object.entries(c).filter(([,v])=>v!==undefined)));while(next.length&&Object.keys(next.at(-1)!).length===0)next.pop();return next;});
    while(rows.length&&!rows.at(-1)!.length)rows.pop();return {name:tab.name,rows};
  }));
}
export function assertSnapshotOwnership(snapshot:z.infer<typeof snapshotSchema>,storeId:string,sourceRef:string) {
  if(snapshot.storeId!==storeId||snapshot.sourceRef!==sourceRef)throw new Error("Backup belongs to a different store or spreadsheet.");
  if(new Set(snapshot.grid.map(t=>t.name)).size!==snapshot.grid.length)throw new Error("Duplicate backup tabs.");
}
