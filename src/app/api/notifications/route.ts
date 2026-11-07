import { getCurrentAdmin,requireStoreAdmin } from "@/lib/auth/server";
import { notificationPage } from "@/lib/platform/notifications";
export async function GET() {const admin=await getCurrentAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:401});if(!admin.isSuperAdmin)await requireStoreAdmin();const result=await notificationPage(admin);return Response.json({unread:result.unread},{headers:{"Cache-Control":"no-store"}});}
