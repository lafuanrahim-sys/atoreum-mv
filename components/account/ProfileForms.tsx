import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import type { PublicUser } from "@/lib/data/users.server";

/**
 * Name + password forms, shared between the customer account page and the
 * admin dashboard profile page. `back` is the URL the actions bounce back
 * to with a status flag; `flags` carries those status params for feedback.
 */
export default function ProfileForms({
  user,
  back,
  flags,
}: {
  user: PublicUser;
  back: string;
  flags: { profile?: string; password?: string };
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <form action={updateProfileAction} className="flex flex-col gap-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Profile</h2>
        <input type="hidden" name="back" value={back} />

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Name</span>
          <input
            type="text"
            name="name"
            defaultValue={user.name}
            required
            autoComplete="name"
            className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Email</span>
          <input
            type="email"
            value={user.email}
            disabled
            className="border border-line bg-transparent px-4 py-3 text-sm text-ivory-dim opacity-60"
          />
          <span className="text-[11px] text-ivory-dim/70">
            Email is your sign-in and can&apos;t be changed here.
          </span>
        </label>

        {flags.profile === "saved" && (
          <p className="text-sm text-gold" role="status">Profile saved.</p>
        )}

        <button
          type="submit"
          className="self-start bg-gold-deep px-6 py-3 text-xs uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-deep/90"
        >
          Save Changes
        </button>
      </form>

      <form action={changePasswordAction} className="flex flex-col gap-5">
        <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Change Password</h2>
        <input type="hidden" name="back" value={back} />

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">Current password</span>
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
            className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.15em] text-ivory-dim">New password (min 8 characters)</span>
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            autoComplete="new-password"
            className="border border-line bg-transparent px-4 py-3 text-sm text-ivory focus:border-gold focus:outline-none"
          />
        </label>

        {flags.password === "changed" && (
          <p className="text-sm text-gold" role="status">Password updated.</p>
        )}
        {flags.password === "wrong" && (
          <p className="text-sm text-red-400" role="alert">Current password is incorrect.</p>
        )}
        {flags.password === "short" && (
          <p className="text-sm text-red-400" role="alert">New password must be at least 8 characters.</p>
        )}

        <button
          type="submit"
          className="self-start border border-line px-6 py-3 text-xs uppercase tracking-[0.2em] text-ivory-dim transition-colors hover:border-gold hover:text-gold"
        >
          Update Password
        </button>
      </form>
    </div>
  );
}
