import { listBrands } from "@/lib/data/brands.server";
import { getSettings } from "@/lib/data/settings.server";
import {
  addBrandAction,
  removeBrandAction,
  updateSettingsAction,
} from "@/app/actions/storeAdmin";

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
  const settings = getSettings();
  const brands = listBrands();

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl text-ivory">Settings</h1>
      <p className="mt-1 text-sm text-ivory-dim">
        Payment details shown at checkout, and the brand list offered when adding products.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Bank transfer details */}
        <form
          action={updateSettingsAction}
          className="flex flex-col gap-5 rounded-lg border border-line bg-ink p-6"
        >
          <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">
            Bank Transfer Details
          </h2>
          <p className="-mt-2 text-[11px] text-ivory-dim">
            Shown to customers on the checkout payment step.
          </p>

          {(
            [
              { name: "bankName", label: "Bank", value: settings.bankName },
              { name: "accountName", label: "Account name", value: settings.accountName },
              { name: "accountNumber", label: "Account number", value: settings.accountNumber },
              { name: "swift", label: "SWIFT", value: settings.swift },
            ] as const
          ).map((field) => (
            <label key={field.name} className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-ivory-dim">{field.label}</span>
              <input
                type="text"
                name={field.name}
                defaultValue={field.value}
                required
                className="border border-line bg-transparent px-3 py-2 text-sm text-ivory focus:border-gold focus:outline-none"
              />
            </label>
          ))}

          {settingsFlag === "saved" && (
            <p className="text-sm text-gold" role="status">Settings saved.</p>
          )}

          <button
            type="submit"
            className="self-start bg-gold-deep px-6 py-3 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
          >
            Save Settings
          </button>
        </form>

        {/* Brands manager */}
        <div className="rounded-lg border border-line bg-ink p-6">
          <h2 className="text-xs uppercase tracking-[0.2em] text-ivory">Brands</h2>
          <p className="mt-1 text-[11px] text-ivory-dim">
            These populate the Brand dropdown on the product form.
          </p>

          <form action={addBrandAction} className="mt-5 flex gap-3">
            <input
              type="text"
              name="name"
              required
              placeholder="New brand name…"
              className="flex-1 border border-line bg-transparent px-3 py-2 text-sm text-ivory placeholder:text-ivory-dim focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              className="bg-gold-deep px-5 py-2 text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90"
            >
              Add
            </button>
          </form>

          {brandFlag === "exists" && (
            <p className="mt-3 text-sm text-red-400" role="alert">That brand already exists.</p>
          )}
          {brandFlag === "added" && (
            <p className="mt-3 text-sm text-gold" role="status">Brand added.</p>
          )}

          <ul className="mt-5 flex flex-col divide-y divide-line border-t border-line">
            {brands.map((brand) => (
              <li key={brand} className="flex items-center justify-between py-2.5">
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
                    className="text-xs uppercase tracking-[0.1em] text-ivory-dim transition-colors hover:text-red-400"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ivory-dim/80">
            Removing a brand doesn&apos;t change existing products — they keep their brand.
          </p>
        </div>
      </div>
    </div>
  );
}
