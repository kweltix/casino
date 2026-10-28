import { getStore } from "../../../server/db";
import { createApi } from "../../../server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = (request: Request) => createApi(getStore())(request);
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
