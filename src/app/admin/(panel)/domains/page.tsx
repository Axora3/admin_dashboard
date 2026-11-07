import {
  CheckCircle2,
  Globe,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { getRepository } from "@/lib/data";
import { getStoreContext } from "@/lib/store-context";
import {
  deleteDomainAction,
  setPrimaryDomainAction,
  verifyDomainAction,
} from "@/app/admin/actions/domains";
import { PageHeader } from "@/components/admin/page-header";
import { FilterBar } from "@/components/admin/filter-bar";
import { DomainCreateButton } from "@/components/admin/domain-create";
import { StatCard } from "@/components/admin/stat-card";
import {
  DomainStatusBadge,
  SslBadge,
  VerificationBadge,
} from "@/components/admin/status-badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime, formatNumber } from "@/lib/format";
import { buildQuery, safeInt } from "@/lib/utils";

function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata = { title: "Домэйн удирдлага" };

export default async function DomainsPage({
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
    search: str(params.search),
    storeId: requestedStore,
    status: str(params.status) ?? "all",
    page: str(params.page),
  };

  const [result, stores, all, active] = await Promise.all([
    repository.listDomains({
      storeId,
      search: current.search,
      status: current.status as never,
      page: safeInt(current.page, 1),
      pageSize: 20,
    }),
    repository.listStoreOptions(),
    repository.listDomains({ storeId, page: 1, pageSize: 1 }),
    repository.listDomains({ storeId, status: "active", page: 1, pageSize: 1 }),
  ]);

  const activeStore = storeId ? stores.find((store) => store.id === storeId) : null;
  const back = `/admin/domains${buildQuery(current, { page: current.page })}`;
  const checked = str(params.checked);

  return (
    <>
      <PageHeader
        title="Домэйн удирдлага"
        description={
          activeStore
            ? `${activeStore.name} дэлгүүрийн домэйн, DNS болон SSL.`
            : "Бүх custom домэйн, DNS баталгаажуулалт, SSL төлөв."
        }
        meta={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">Нийт {all.total}</Badge>
            <Badge tone="success" dot>
              {active.total} идэвхтэй
            </Badge>
            <Badge tone="warning" dot>
              {all.total - active.total} хүлээгдэж байна
            </Badge>
          </div>
        }
        actions={
          <DomainCreateButton
            stores={stores}
            defaultStoreId={storeId}
            back={back}
          />
        }
      />

      {checked === "ok" ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-success-100 bg-success-50/70 px-3.5 py-3 text-[13px] text-success-700">
          <CheckCircle2 className="h-4 w-4" /> Домэйн амжилттай баталгаажлаа.
        </div>
      ) : null}
      {checked === "failed" ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger-100 bg-danger-50/70 px-3.5 py-3 text-[13px] text-danger-700">
          <TriangleAlert className="h-4 w-4" /> DNS эсвэл SSL шалгалт амжилтгүй.
          Бичлэгүүдээ шалгаад дахин оролдоно уу.
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Нийт домэйн"
          value={formatNumber(all.total)}
          hint="Бүртгэлтэй custom домэйн"
          icon={Globe}
          accent="brand"
        />
        <StatCard
          label="Идэвхтэй"
          value={formatNumber(active.total)}
          hint="SSL идэвхтэй"
          icon={ShieldCheck}
          accent="success"
        />
        <StatCard
          label="Анхаарал шаардлагатай"
          value={formatNumber(Math.max(all.total - active.total, 0))}
          hint="DNS эсвэл SSL хүлээгдэж байна"
          icon={TriangleAlert}
          accent="warning"
        />
      </div>

      <FilterBar
        basePath="/admin/domains"
        searchPlaceholder="Домэйн эсвэл дэлгүүр…"
        current={current}
        filters={[
          {
            name: "storeId",
            label: "Бүх дэлгүүр",
            options: stores.map((store) => ({ value: store.id, label: store.name })),
          },
          {
            name: "status",
            label: "Бүх төлөв",
            options: [
              { value: "pending", label: "Хүлээгдэж байна" },
              { value: "verified", label: "Баталгаажсан" },
              { value: "ssl_pending", label: "SSL хүлээгдэж байна" },
              { value: "active", label: "Идэвхтэй" },
              { value: "error", label: "Алдаатай" },
              { value: "unconnected", label: "Холбогдоогүй" },
            ],
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Globe}
            title="Домэйн байхгүй"
            description="Дэлгүүрт custom домэйн холбож, public website-ээ өөрийн хаягаар нээнэ үү."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="axora-scroll">
            <table className="axora-table min-w-[1050px]">
              <thead>
                <tr>
                  <th>Домэйн</th>
                  <th>Дэлгүүр</th>
                  <th>Баталгаажуулалт</th>
                  <th>SSL</th>
                  <th>Төлөв</th>
                  <th>Сүүлд шалгасан</th>
                  <th className="w-40" />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((domain) => (
                  <tr key={domain.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-ink-400" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                            <span className="truncate">{domain.domain}</span>
                            {domain.isPrimary ? (
                              <Star className="h-3 w-3 fill-warning-600 text-warning-600" />
                            ) : null}
                          </p>
                          <p className="truncate text-2xs text-ink-400">
                            {domain.expectedTarget}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-ink-600">
                      {domain.storeName}
                    </td>
                    <td>
                      <VerificationBadge status={domain.verificationStatus} />
                    </td>
                    <td>
                      <SslBadge status={domain.sslStatus} />
                    </td>
                    <td>
                      <DomainStatusBadge status={domain.status} />
                    </td>
                    <td className="whitespace-nowrap text-2xs text-ink-400">
                      {domain.lastCheckedAt ? formatDateTime(domain.lastCheckedAt) : "—"}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <form action={verifyDomainAction}>
                          <input type="hidden" name="domainId" value={domain.id} />
                          <input type="hidden" name="back" value={back} />
                          <button
                            type="submit"
                            title="DNS болон SSL шалгах"
                            className={buttonClasses("secondary", "sm")}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Шалгах
                          </button>
                        </form>
                        {!domain.isPrimary ? (
                          <form action={setPrimaryDomainAction}>
                            <input type="hidden" name="domainId" value={domain.id} />
                            <input type="hidden" name="back" value={back} />
                            <button
                              type="submit"
                              title="Үндсэн домэйн болгох"
                              className={buttonClasses("ghost", "icon", "h-8 w-8")}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteDomainAction}>
                          <input type="hidden" name="domainId" value={domain.id} />
                          <input type="hidden" name="back" value={back} />
                          <ConfirmSubmit
                            message={`"${domain.domain}" домэйныг устгах уу?`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-danger-500 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/admin/domains"
            query={current}
          />
        </Card>
      )}

      <div className="mt-4 rounded-xl border border-ink-100 bg-white p-4 text-2xs leading-relaxed text-ink-500 shadow-card">
        <p className="mb-1 font-semibold text-ink-700">DNS тохиргооны заавар</p>
        <p>
          Домэйны DNS дээр <code className="font-mono">CNAME</code> бичлэгийг{" "}
          <code className="font-mono">cname.axora.mn</code> рүү чиглүүлэх эсвэл{" "}
          <code className="font-mono">TXT _axora.домэйн</code> бичлэгт
          баталгаажуулалтын token-ыг нэмнэ. Дараа нь «Шалгах» товчоор бодит DNS
          болон TLS холболтыг шалгана.
        </p>
      </div>
    </>
  );
}
