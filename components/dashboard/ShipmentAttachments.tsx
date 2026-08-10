"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/dashboard/ToastProvider";
import { deleteShipmentFileAction, uploadShipmentFileAction, type ImportOutcome } from "@/app/actions/stock";

export type AttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  /** Signed, short-lived. Null if the link couldn't be minted (missing object, storage down). */
  downloadUrl: string | null;
};

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,text/csv,.csv,.xls,.xlsx";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(contentType: string, fileName: string) {
  if (contentType.startsWith("image/")) return "Image";
  if (contentType === "application/pdf" || /\.pdf$/i.test(fileName)) return "PDF";
  if (/csv/i.test(contentType) || /\.csv$/i.test(fileName)) return "CSV";
  if (/excel|spreadsheet/i.test(contentType) || /\.xlsx?$/i.test(fileName)) return "Excel";
  return "File";
}

/**
 * Shipment paperwork: supplier invoice, packing list, photos of whatever
 * turned up damaged. Attaching stays available after a shipment is received
 * (unlike its quantity lines, which lock) because a credit note or damage
 * claim normally only arrives after the box has been unpacked.
 *
 * Download links are signed and short-lived, minted server-side per render
 * rather than stored -- see lib/storage.ts for why these files aren't in a
 * public bucket.
 */
export default function ShipmentAttachments({
  shipmentId,
  files,
}: {
  shipmentId: string;
  files: AttachmentView[];
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [imports, setImports] = useState<ImportOutcome[]>([]);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  const upload = () => {
    if (selected.length === 0) return;
    const formData = new FormData();
    for (const f of selected) formData.append("files", f);
    startTransition(async () => {
      try {
        const { imports } = await uploadShipmentFileAction(shipmentId, formData);
        setSelected([]);
        if (inputRef.current) inputRef.current.value = "";
        setImports(imports);

        const totalLines = imports.reduce((n, i) => n + i.imported + i.updated, 0);
        const unmatched = imports.reduce((n, i) => n + i.unmatched.length, 0);
        if (totalLines > 0) {
          showToast(
            `Attached. ${totalLines} line(s) filled in from the sheet${unmatched > 0 ? `, ${unmatched} row(s) unmatched` : ""}.`,
            "success"
          );
        } else {
          showToast("Attached.", "success");
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't attach that file.", "error");
      }
    });
  };

  const remove = (file: AttachmentView) => {
    startTransition(async () => {
      try {
        await deleteShipmentFileAction(file.id);
        showToast(`Removed ${file.fileName}.`, "success");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't remove that file.", "error");
      }
    });
  };

  return (
    <div className="border border-line p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ivory-dim">Attachments</h2>
      <p className="mt-2 text-sm text-ivory-dim">
        Invoice, packing list, or photos of anything damaged. PDF, image, CSV, or Excel, up to 15 MB each. Attach a CSV
        or Excel packing list and the lines above fill in automatically, matched on product name or SKU.
      </p>

      {imports.map((imp) => (
        <div key={imp.fileName} className="mt-4 border border-line bg-ink/40 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ivory-dim">{imp.fileName}</p>
          {imp.problem ? (
            <p className="mt-2 text-sm text-red-400">{imp.problem}</p>
          ) : (
            <p className="mt-2 text-sm text-ivory">
              {imp.imported} line(s) added
              {imp.updated > 0 ? `, ${imp.updated} updated` : ""}.
            </p>
          )}
          {imp.unmatched.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-red-400">
                {imp.unmatched.length} row(s) didn&apos;t match a product and were skipped. Add them by hand above, or
                rename them to match the catalogue and re-upload.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {imp.unmatched.slice(0, 8).map((u) => (
                  <li key={`${u.rowNumber}-${u.name}`} className="font-mono text-[11px] text-ivory-dim">
                    Row {u.rowNumber}: {u.name} {u.qty > 0 ? `(qty ${u.qty})` : ""}
                  </li>
                ))}
                {imp.unmatched.length > 8 && (
                  <li className="font-mono text-[11px] text-ivory-dim">
                    and {imp.unmatched.length - 8} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      ))}

      {files.length > 0 && (
        <ul className="mt-5 flex flex-col border-t border-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
              <div className="min-w-0">
                {f.downloadUrl ? (
                  <a
                    href={f.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-ivory transition-colors hover:text-gold-deep"
                  >
                    {f.fileName}
                  </a>
                ) : (
                  <span className="truncate text-sm text-ivory-dim">{f.fileName}</span>
                )}
                <p className="font-mono text-[11px] text-ivory-dim">
                  {kindLabel(f.contentType, f.fileName)} · {formatBytes(f.sizeBytes)} ·{" "}
                  {new Date(f.createdAt).toLocaleDateString()}
                  {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => remove(f)}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ivory-dim transition-colors hover:text-red-400 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => setSelected(Array.from(e.target.files ?? []))}
          className="max-w-full text-xs text-ivory-dim file:mr-3 file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:font-mono file:text-[11px] file:uppercase file:tracking-[0.15em] file:text-ivory-dim hover:file:border-gold-deep hover:file:text-gold-deep"
        />
        <button
          type="button"
          disabled={isPending || selected.length === 0}
          onClick={upload}
          className="bg-gold-deep px-5 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-gold-deep/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Attaching…" : selected.length > 0 ? `Attach ${selected.length} file(s)` : "Attach"}
        </button>
      </div>

      {files.length === 0 && selected.length === 0 && (
        <p className="mt-4 text-xs text-ivory-dim/80">Nothing attached to this shipment yet.</p>
      )}
    </div>
  );
}
