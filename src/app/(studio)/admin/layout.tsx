import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import "./admin.css";
import { isAdmin, requireUser } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/creer");
  return (
    <div className="adm">
      <aside>
        <span className="eyebrow">Admin</span>
        <AdminNav />
      </aside>
      <div className="adm-main stack">{children}</div>
    </div>
  );
}
