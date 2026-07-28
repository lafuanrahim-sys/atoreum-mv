import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import ProfileForms from "@/components/account/ProfileForms";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function DashboardProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; password?: string }>;
}) {
  const { profile = "", password = "" } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?from=%2Fdashboard%2Fprofile");

  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Account" title="My Profile" description="Update your display name and password." />
      <div className="mt-10">
        <ProfileForms user={user} back="/dashboard/profile" flags={{ profile, password }} />
      </div>
    </div>
  );
}
