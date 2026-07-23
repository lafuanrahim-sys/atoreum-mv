import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import ProfileForms from "@/components/account/ProfileForms";

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
      <h1 className="font-display text-2xl text-ivory">My Profile</h1>
      <p className="mt-1 text-sm text-ivory-dim">Update your display name and password.</p>
      <div className="mt-8">
        <ProfileForms user={user} back="/dashboard/profile" flags={{ profile, password }} />
      </div>
    </div>
  );
}
