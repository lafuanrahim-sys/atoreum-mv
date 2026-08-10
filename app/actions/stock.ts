"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/currentUser.server";
import { isAdminRole } from "@/lib/auth/userSession";
import path from "path";
import crypto from "crypto";
import {
  addShipmentFile,
  applyStockCount,
  createShipment,
  deleteDraftShipment,
  deleteShipmentFile,
  listShipmentFiles,
  mergeShipmentLines,
  receiveShipment,
  saveShipmentLines,
} from "@/lib/data/stock.server";
import { buildImportPreview } from "@/lib/data/shipmentImport.server";
import { getAllProducts } from "@/lib/data/products.server";
import { SHIPMENT_FILES_BUCKET, deleteFile, uploadPrivateFile } from "@/lib/storage";

/** Server actions are public endpoints, so the role check lives inside each one, not only on the page. */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/login");
  return user;
}

function revalidateStock() {
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard/shipments");
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
}

export type StockLineInput = { productId: string; qtyExpected: number; qtyReceived: number; qtyFaulty: number; note: string };

export async function createShipmentAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const shippedDate = String(formData.get("shippedDate") ?? "").trim();
  const id = await createShipment({
    reference: String(formData.get("reference") ?? "").trim(),
    supplier: String(formData.get("supplier") ?? "").trim(),
    shippedDate: shippedDate || null,
    notes: String(formData.get("notes") ?? "").trim(),
    createdBy: admin.name,
  });
  revalidateStock();
  redirect(`/dashboard/shipments/${id}`);
}

export async function saveShipmentLinesAction(shipmentId: string, lines: StockLineInput[]) {
  await requireAdmin();
  const clean = lines
    .map((l) => ({
      productId: l.productId,
      qtyExpected: Math.max(0, Math.floor(Number(l.qtyExpected) || 0)),
      qtyReceived: Math.max(0, Math.floor(Number(l.qtyReceived) || 0)),
      qtyFaulty: Math.max(0, Math.floor(Number(l.qtyFaulty) || 0)),
      note: String(l.note ?? "").slice(0, 300),
    }))
    // A line with nothing on it at all is just an empty row in the UI, not data.
    .filter((l) => l.productId && (l.qtyExpected > 0 || l.qtyReceived > 0 || l.qtyFaulty > 0 || l.note));

  const result = await saveShipmentLines(shipmentId, clean);
  if (!result.ok) throw new Error(result.error);
  revalidateStock();
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
}

export async function receiveShipmentAction(shipmentId: string) {
  const admin = await requireAdmin();
  const result = await receiveShipment(shipmentId, admin.name);
  if (!result.ok) throw new Error(result.error);
  revalidateStock();
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  return result;
}

export async function deleteShipmentAction(shipmentId: string): Promise<void> {
  await requireAdmin();
  // Remove the stored blobs first. The rows themselves cascade with the
  // shipment, but Supabase Storage has no foreign key to cascade with, so
  // skipping this would leave the files orphaned in the bucket forever.
  const files = await listShipmentFiles(shipmentId);
  for (const f of files) {
    await deleteFile(SHIPMENT_FILES_BUCKET, f.storagePath).catch((err) =>
      console.error("[stock] orphaned shipment file:", f.storagePath, err)
    );
  }
  await deleteDraftShipment(shipmentId);
  revalidateStock();
  redirect("/dashboard/shipments");
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
// Same family the checkout receipt upload accepts, plus the spreadsheet/doc
// formats a supplier actually sends an invoice or packing list in. SVG is
// excluded for the same reason as product images: it's XML that can carry
// an embedded <script>.
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_ATTACHMENT_EXT = /\.(jpe?g|png|webp|heic|heif|pdf|csv|xlsx?)$/i;

export type ImportOutcome = {
  fileName: string;
  imported: number;
  updated: number;
  unmatched: { rowNumber: number; name: string; qty: number }[];
  problem: string | null;
};

export async function uploadShipmentFileAction(
  shipmentId: string,
  formData: FormData
): Promise<{ imports: ImportOutcome[] }> {
  const admin = await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Choose at least one file to attach.");

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} is too large. The limit is 15 MB.`);
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type) && !ALLOWED_ATTACHMENT_EXT.test(file.name)) {
      throw new Error(`${file.name} isn't a supported file. Attach a PDF, image, CSV, or Excel file.`);
    }
  }

  const catalogue = (await getAllProducts()).map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
  const imports: ImportOutcome[] = [];

  for (const file of files) {
    const ext = path.extname(file.name) || "";
    // Namespaced by shipment and randomly named: the original filename is
    // kept for display only, never used as the storage key, so a supplier's
    // filename can't collide with another's or shape the path.
    const storagePath = `${shipmentId}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    await uploadPrivateFile({ bucket: SHIPMENT_FILES_BUCKET, path: storagePath, bytes, contentType });
    await addShipmentFile({
      shipmentId,
      fileName: file.name.slice(0, 200),
      storagePath,
      contentType,
      sizeBytes: file.size,
      uploadedBy: admin.name,
    });

    // A spreadsheet also populates the shipment's lines. Anything else (a
    // PDF invoice, a photo of a crushed box) is stored and left alone.
    const preview = await buildImportPreview({ bytes, fileName: file.name, contentType, products: catalogue });
    if (preview.notASheet) continue;

    if (preview.problem) {
      imports.push({ fileName: file.name, imported: 0, updated: 0, unmatched: [], problem: preview.problem });
      continue;
    }

    const merge = await mergeShipmentLines(
      shipmentId,
      preview.matched.map((m) => ({
        productId: m.productId,
        qtyExpected: m.qtyExpected,
        qtyReceived: m.qtyReceived,
        qtyFaulty: m.qtyFaulty,
        // Records what the supplier called it, which is what makes a later
        // mismatch traceable back to their paperwork.
        note: m.sourceName.toLowerCase() === m.productName.toLowerCase() ? "" : `Sheet: ${m.sourceName}`.slice(0, 300),
      }))
    );

    imports.push({
      fileName: file.name,
      imported: merge.ok ? merge.added : 0,
      updated: merge.ok ? merge.updated : 0,
      unmatched: preview.unmatched,
      problem: merge.ok ? null : merge.error,
    });
  }

  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  revalidateStock();
  return { imports };
}

export async function deleteShipmentFileAction(fileId: string) {
  await requireAdmin();
  const removed = await deleteShipmentFile(fileId);
  if (!removed) return;
  await deleteFile(SHIPMENT_FILES_BUCKET, removed.storagePath).catch((err) =>
    console.error("[stock] file row deleted but blob remained:", removed.storagePath, err)
  );
  revalidatePath(`/dashboard/shipments/${removed.shipmentId}`);
}

export async function applyStockCountAction(input: {
  countedOn: string;
  notes: string;
  lines: { productId: string; countedQty: number }[];
}) {
  const admin = await requireAdmin();
  const lines = input.lines
    .filter((l) => l.productId && Number.isFinite(l.countedQty))
    .map((l) => ({ productId: l.productId, countedQty: Math.max(0, Math.floor(Number(l.countedQty))) }));

  const result = await applyStockCount({
    countedOn: input.countedOn,
    notes: String(input.notes ?? "").slice(0, 500),
    createdBy: admin.name,
    lines,
  });
  if (!result.ok) throw new Error(result.error);
  revalidateStock();
  return result;
}
