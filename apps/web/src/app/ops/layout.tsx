import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessOps, getStaffRole } from "@/lib/roles";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login?next=/ops");
  }
  if (!canAccessOps(getStaffRole(session))) {
    redirect("/");
  }
  return children;
}
