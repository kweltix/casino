import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "../components/workspace";
import { SessionAuth, cookieName } from "../server/auth";
import { getStore } from "../server/db";
export default async function Page() {
  const jar = await cookies();
  const auth = new SessionAuth(getStore());
  if (
    !auth.configured ||
    !auth.isAuthenticated(jar.get(cookieName())?.value || "")
  )
    redirect("/login");
  return <Workspace />;
}
