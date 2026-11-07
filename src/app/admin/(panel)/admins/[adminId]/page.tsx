import { requireSuperAdmin } from "@/lib/auth/server";
import { getRepository } from "@/lib/data";
import Link from "next/link";
export default async function AdminHistory({ params, searchParams }: { params: Promise<{ adminId: string }>; searchParams: Promise<{ page?: string }> }) {
  await requireSuperAdmin();
  const { adminId } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const logs = await getRepository().listAuditLogs({ actorUserId: adminId, page, pageSize: 30 });
  return <div className="space-y-4"><Link href="/admin/admins">← Admin Management</Link><h1 className="text-2xl font-bold">Admin-ийн үйлдлийн түүх</h1>{logs.rows.map(log => <details key={log.id} className="rounded-xl border bg-white p-4"><summary>{log.actorName} · {log.storeName} · {log.action} · {log.createdAt}</summary><pre className="mt-4 overflow-auto text-xs">{JSON.stringify(log.metadata,null,2)}</pre></details>)}{!logs.total && <p>Үйлдэл бүртгэгдээгүй.</p>}<div className="flex gap-4">{page > 1 && <Link href={`?page=${page-1}`}>← Өмнөх</Link>}{page < logs.pageCount && <Link href={`?page=${page+1}`}>Дараах →</Link>}</div></div>;
}
