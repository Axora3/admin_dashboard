import { requireSuperAdmin } from "@/lib/auth/server";
import { NotificationCenter } from "@/components/admin/notification-center";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}) {return <NotificationCenter admin={await requireSuperAdmin()} page={Math.max(1,Number((await searchParams).page)||1)}/>;}
