import { ScrollText } from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AUDIT_ACTIONS, auditActionLabel } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Аудит лог" };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const repository = getRepository();
  const context = await getStoreContext();
  const requestedStore = str(params.storeId);
  const storeId = requestedStore ?? context.storeId ?? undefined;

  const current = {
    storeId: requestedStore,
    action: str(params.action) ?? "all",
    page: str(params.page),
  };

  const [result, stores] = await Promise.all([
    repository.listAuditLogs({
      storeId,
      action: current.action,
      page: safeInt(current.page, 1),
      pageSize: 30,
    }),
    repository.listStoreOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Аудит лог"
        description="Бүх мэдээллийн өөрчлөлт, нэвтрэлт болон админ үйлдлийн бүртгэл."
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {result.total}</Badge>
            <Badge tone="brand" dot>
              Өөрчлөлт бүр бүртгэгдэнэ
            </Badge>
          </div>
        }
      />

      <FilterBar
        basePath="/admin/audit-logs"
        searchPlaceholder="Хайх…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
          {
            name: "action",
            label: "Бүх үйлдэл",
            options: AUDIT_ACTIONS,
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="Бүртгэл байхгүй"
            description="Админ үйлдэл хийгдэхэд аудит лог автоматаар үүснэ."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[980px]">
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Үйлдэл</th>
                  <th>Дэлгүүр</th>
                  <th>Гүйцэтгэсэн</th>
                  <th>Нөөц</th>
                  <th>Дэлгэрэнгүй</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((log) => {
                  const metadata = JSON.stringify(log.metadata ?? {});
                  return (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-2xs text-ink-400">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td>
                        <p className="text-[13px] font-medium text-ink-800">
                          {auditActionLabel(log.action)}
                        </p>
                        <p className="font-mono text-2xs text-ink-400">{log.action}</p>
                      </td>
                      <td className="whitespace-nowrap text-[13px] text-ink-600">
                        {log.storeName ?? "Платформ"}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={log.actorName} size="xs" />
                          <span className="whitespace-nowrap text-[13px] text-ink-700">
                            {log.actorName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Badge tone="neutral">{log.resourceType}</Badge>
                        {log.resourceId ? (
                          <p className="mt-0.5 max-w-[160px] truncate font-mono text-2xs text-ink-400">
                            {log.resourceId}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <p
                          className="max-w-[280px] truncate font-mono text-2xs text-ink-500"
                          title={metadata}
                        >
                          {metadata === "{}" ? "—" : metadata}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/admin/audit-logs"
            query={current}
          />
        </Card>
      )}
    </>
  );
}
