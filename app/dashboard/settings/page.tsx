import { listBrands } from "@/lib/data/brands.server";
import { getSettings } from "@/lib/data/settings.server";
import {
  addBrandAction,
  removeBrandAction,
  updateSettingsAction,
} from "@/app/actions/storeAdmin";
import PageHeader from "@/components/dashboard/PageHeader";

/**
 * Store settings: bank-transfer details shown at checkout, plus the brand
 * list that feeds the product form's dropdown. Both currently live in the
 * file-based stores (lib/data/settings.server.ts, brands.server.ts) that
 * are designed to be swapped for Supabase tables later without touching
 * this page.
 */
export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ settings?: string; brand?: string }>;
}) {
  const { settings: settingsFlag = "", brand: brandFlag = "" } = await searchParams;
  const [settings, brands] = await Promise.all([getSettings(), listBrands()]);

  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Payment details shown at checkout, and the brand list offered when adding products."
      />

      <div className="mt-10 flex flex-col gap-12 lg:flex-row lg:gap-0">
        {/* Bank transfer details */}
        <form action={updateSettingsAction} className="flex flex-col gap-6 lg:flex-1 lg:pr-10">
          <div>
            <h2 className="font-display text-xl italic text-ivory">Bank Transfer Details</h2>
            <p className="mt-1 text-xs text-ivory-dim">Shown to customers on the checkout payment step.</p>
          </div>

          {(
            [
              { name: "bankName", label: "Bank", value: settings.bankName },
              { name: "accountName", label: "Account name", value: settings.accountName },
              { name: "accountNumber", label: "Account number", value: settings.accountNumber },
              { name: "swift", label: "SWIFT", value: settings.swift },
            ] as const
          ).map((field) => (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">{field.label}</span>
              <input
                type="text"
                name={field.name}
                defaultValue={field.value}
                required
                className="border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory focus:border-gold-deep focus:outline-none"
              />
            </label>
          ))}

          {settingsFlag === "saved" && (
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold-deep" role="status">Settings saved.</p>
          )}

          <button
            type="submit"
            className="self-start bg-gold-deep px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            Save Settings
          </button>
        </form>

        <div className="hidden w-px shrink-0 bg-line lg:block" aria-hidden="true" />

        {/* Brands manager */}
        <div className="lg:w-96 lg:shrink-0 lg:pl-10">
          <h2 className="font-display text-xl italic text-ivory">Brands</h2>
          <p className="mt-1 text-xs text-ivory-dim">These populate the Brand dropdown on the product form.</p>

          <form action={addBrandAction} className="mt-6 flex gap-3">
            <input
              type="text"
              name="name"
              required
              placeholder="New brand name…"
              className="flex-1 border-b border-line bg-transparent px-1 py-2 font-mono text-sm text-ivory placeholder:text-ivory-dim/70 focus:border-gold-deep focus:outline-none"
            />
            <button
              type="submit"
              className="bg-gold-deep px-5 py-2 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              Add
            </button>
          </form>

          {brandFlag === "exists" && (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-red-400" role="alert">That brand already exists.</p>
          )}
          {brandFlag === "added" && (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-gold-deep" role="status">Brand added.</p>
          )}

          <ul className="mt-6 flex flex-col border-t border-line">
            {brands.map((brand) => (
              <li key={brand} className="flex items-center justify-between border-b border-line py-3">
                <span className="text-sm text-ivory">{brand}</span>
                <form
                  action={async () => {
                    "use server";
                    await removeBrandAction(brand);
                  }}
                >
                  <button
                    type="submit"
                    aria-label={`Remove ${brand}`}
                    className="font-mono text-xs uppercase tracking-[0.1em] text-ivory-dim transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-ivory-dim/80">
            Removing a brand doesn&apos;t change existing products — they keep their brand.
          </p>
        </div>
      </div>
    </div>
  );
}
