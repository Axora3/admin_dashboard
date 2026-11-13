import { selectCustomerSite } from "@/app/store-admin/site-actions";
export function SiteSwitcher({ sites, selected }: { sites: Array<{ id: string; name: string }>; selected: string }) {
  return <form action={selectCustomerSite} className="flex items-end gap-2"><label className="grid gap-1 text-xs"><span>Удирдах сайт</span><select name="siteId" defaultValue={selected} className="max-w-64 rounded-lg border border-teal-800 bg-teal-900 px-3 py-2 text-sm text-white">{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><button className="rounded-lg border border-teal-700 px-3 py-2 text-sm">Сонгох</button></form>;
}
