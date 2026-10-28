import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "../../components/login-form";
import { SessionAuth, cookieName } from "../../server/auth";
import { getStore } from "../../server/db";
export default async function LoginPage() {
  const jar = await cookies();
  const auth = new SessionAuth(getStore());
  if (
    auth.configured &&
    auth.isAuthenticated(jar.get(cookieName())?.value || "")
  )
    redirect("/");
  return <LoginForm configured={auth.configured} />;
}
