import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import { getAllProducts } from "@/lib/data/products.server";
import { filterProducts, readProductFilters } from "@/lib/dashboard/productFilters";
import { buildInventoryWorkbook, inventoryFilename } from "@/lib/dashboard/productExport";

/**
 * Downloads the dashboard product list as a .xlsx workbook.
 *
 * Lives under /dashboard rather than /api on purpose: middleware.ts guards
 * /dashboard/* for admins but explicitly skips /api, so the same route under
 * /api would have served the catalog's whole cost basis -- floors, medians,
 * stock on hand -- to anyone who guessed the URL. The role check below is a
 * second lock on the same door, so this stays safe if that matcher is ever
 * rewritten.
 *
 * Takes the same query string as the page, so Export returns exactly the
 * rows on screen rather than silently re-widening to the full catalog.
 */

// Reads live rows from Postgres on every request; nothing here is cacheable.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const filters = readProductFilters(new URL(request.url).searchParams);
  const all = await getAllProducts();
  const rows = filterProducts(all, filters);

  const workbook = buildInventoryWorkbook({
    rows,
    totalCount: all.length,
    filters,
    exportedBy: user.email,
  });
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${inventoryFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
