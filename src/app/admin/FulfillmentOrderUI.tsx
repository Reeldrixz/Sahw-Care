"use client";

import { useEffect, useState } from "react";
import { TRACKING_LINK_HELP, DELIVERED_EVIDENCE_NOTE } from "@/lib/trackingLink";

// The order pieces of the admin Register fulfilment queue (step 9): Record
// order for ticked queued items, a purchase with no tracking link (note
// required), the order shown on each purchased item with its number editable
// in place, and the edit form for total, tax, link and date.

export interface QueueOrder {
  id: string; orderNumber: string | null; totalCents: number; taxCents: number | null;
  trackingUrl: string | null; estimatedDeliveryOn: string;
}

const ymd = (iso: string) => iso.slice(0, 10);
const dollars = (c: number) => (c / 100).toFixed(2);

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<string | null> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.error ?? "Something went wrong.";
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: "var(--mid)", marginTop: 4, fontFamily: "Nunito, sans-serif" }}>{hint}</div>}
    </div>
  );
}

function Modal({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: sub ? 6 : 16 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16, fontFamily: "Nunito, sans-serif" }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

const errStyle = { fontSize: 12.5, color: "#c0392b", marginBottom: 12, fontFamily: "Nunito, sans-serif" } as const;

// ── Record order ────────────────────────────────────────────────────────────

export function RecordOrderModal({ queueIds, itemNames, motherFirstName, fundedCents, onClose, onDone }: {
  queueIds: string[]; itemNames: string[]; motherFirstName: string; fundedCents: number;
  onClose: () => void; onDone: () => void;
}) {
  const [f, setF] = useState({ orderNumber: "", total: "", tax: "", trackingUrl: "", estimatedDeliveryOn: "", purchasedFrom: "Amazon", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title="Record order" sub={`${motherFirstName} · ${itemNames.join(", ")} · funded $${dollars(fundedCents)}`}>
      <div style={{ fontSize: 13, background: "#e8f5f1", color: "#14614b", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
        {TRACKING_LINK_HELP}
      </div>
      <Field label="Order number (optional)" hint="Admin only. Never shown to the streamer.">
        <input className="form-input" value={f.orderNumber} onChange={set("orderNumber")} placeholder="e.g. 702-1234567-1234567" />
      </Field>
      <Field label="Order total ($), tax and shipping included">
        <input className="form-input" inputMode="decimal" value={f.total} onChange={set("total")} placeholder="e.g. 54.37" />
      </Field>
      <Field label="Tax included in the total ($, optional)">
        <input className="form-input" inputMode="decimal" value={f.tax} onChange={set("tax")} placeholder="e.g. 6.12" />
      </Field>
      <Field label="Tracking link" hint="a.co/d/… or amazon.ca/progress-tracker/package/share…giftView=1">
        <input className="form-input" value={f.trackingUrl} onChange={set("trackingUrl")} placeholder="https://a.co/d/…" />
      </Field>
      <Field label="Estimated delivery">
        <input className="form-input" type="date" value={f.estimatedDeliveryOn} onChange={set("estimatedDeliveryOn")} />
      </Field>
      <Field label="Supplier (optional)">
        <input className="form-input" value={f.purchasedFrom} onChange={set("purchasedFrom")} />
      </Field>
      <Field label="Notes (optional)">
        <input className="form-input" value={f.notes} onChange={set("notes")} placeholder="Internal notes" />
      </Field>
      {err && <div style={errStyle}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
        <button disabled={busy} className="btn-apply" style={{ flex: 2 }}
          onClick={async () => {
            setBusy(true); setErr(null);
            const e = await send("/api/admin/fulfillment-orders", "POST", { queueIds, ...f });
            setBusy(false);
            if (e) setErr(e); else onDone();
          }}>
          {busy ? "Saving…" : `Record order (${queueIds.length} item${queueIds.length === 1 ? "" : "s"})`}
        </button>
      </div>
    </Modal>
  );
}

// ── Edit order: total, link, date ───────────────────────────────────────────

export function EditOrderModal({ order, onClose, onDone }: { order: QueueOrder; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    total: dollars(order.totalCents), tax: order.taxCents === null ? "" : dollars(order.taxCents),
    trackingUrl: order.trackingUrl ?? "", estimatedDeliveryOn: ymd(order.estimatedDeliveryOn),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Modal title="Edit order" sub="Changes apply to every item in this order.">
      <div style={{ fontSize: 13, background: "#e8f5f1", color: "#14614b", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
        {TRACKING_LINK_HELP}
      </div>
      <Field label="Order total ($), tax and shipping included">
        <input className="form-input" inputMode="decimal" value={f.total} onChange={set("total")} />
      </Field>
      <Field label="Tax included in the total ($, optional)">
        <input className="form-input" inputMode="decimal" value={f.tax} onChange={set("tax")} />
      </Field>
      <Field label="Tracking link">
        <input className="form-input" value={f.trackingUrl} onChange={set("trackingUrl")} />
      </Field>
      <Field label="Estimated delivery">
        <input className="form-input" type="date" value={f.estimatedDeliveryOn} onChange={set("estimatedDeliveryOn")} />
      </Field>
      {err && <div style={errStyle}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
        <button disabled={busy} className="btn-apply" style={{ flex: 2 }}
          onClick={async () => {
            setBusy(true); setErr(null);
            const e = await send(`/api/admin/fulfillment-orders/${order.id}`, "PATCH", f);
            setBusy(false);
            if (e) setErr(e); else onDone();
          }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ── Purchased without a tracking link ───────────────────────────────────────

export function NoLinkPurchaseModal({ queueId, itemName, onClose, onDone }: {
  queueId: string; itemName: string; onClose: () => void; onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Purchased, no tracking link" sub={itemName}>
      <div style={{ fontSize: 13, background: "#fdf3e1", color: "#8a5a00", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontFamily: "Nunito, sans-serif" }}>
        With no tracking link there is no evidence to show, so this item stays <b>Funded ✓</b> on the overlay and never
        shows <b>Order placed ✓</b>. Use Record order instead when you have a share-tracking link.
      </div>
      <Field label="Why there's no tracking link (required)">
        <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. bought in store" />
      </Field>
      <Field label="Supplier (optional)">
        <input className="form-input" value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} />
      </Field>
      {err && <div style={errStyle}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
        <button disabled={busy || !notes.trim()} className="btn-apply" style={{ flex: 2 }}
          onClick={async () => {
            setBusy(true); setErr(null);
            const e = await send(`/api/admin/fulfillment-queue/${queueId}`, "PATCH", { status: "PURCHASED", notes, purchasedFrom });
            setBusy(false);
            if (e) setErr(e); else onDone();
          }}>
          {busy ? "Saving…" : "Mark purchased"}
        </button>
      </div>
    </Modal>
  );
}

// ── The order on a queue row ────────────────────────────────────────────────

export function OrderCell({ order, notes, onEdit, onSaved, onError }: {
  order: QueueOrder | null; notes: string | null; onEdit: () => void; onSaved: () => void; onError: (msg: string) => void;
}) {
  const [num, setNum] = useState(order?.orderNumber ?? "");
  useEffect(() => { setNum(order?.orderNumber ?? ""); }, [order?.orderNumber]);
  if (!order) {
    return (
      <div style={{ display: "grid", gap: 4, minWidth: 180 }}>
        <span style={{ fontWeight: 700 }}>No tracking link · shows Funded ✓ on air</span>
        {notes && <span>Note: {notes}</span>}
      </div>
    );
  }

  const save = async () => {
    if (num.trim() === (order.orderNumber ?? "")) return;
    const e = await send(`/api/admin/fulfillment-orders/${order.id}`, "PATCH", { orderNumber: num });
    if (e) { onError(e); setNum(order.orderNumber ?? ""); } else onSaved();
  };

  return (
    <div style={{ display: "grid", gap: 4, minWidth: 180 }}>
      <input aria-label="Order number" className="form-input" value={num} placeholder="Order number"
        onChange={(e) => setNum(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{ fontSize: 12, padding: "4px 8px" }} />
      <span>
        ${dollars(order.totalCents)} incl. {order.taxCents !== null ? `$${dollars(order.taxCents)} tax` : "tax"} & shipping · est. {ymd(order.estimatedDeliveryOn)}
      </span>
      <span>
        {order.trackingUrl
          ? <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#1a7a5e" }}>Order page ↗</a>
          : <span>No tracking link</span>}
        {" · "}
        <button onClick={onEdit} style={{ background: "none", border: "none", padding: 0, color: "#1a7a5e", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>Edit order</button>
      </span>
    </div>
  );
}

export function DeliveredNote() {
  return <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 6, maxWidth: 200, fontFamily: "Nunito, sans-serif" }}>{DELIVERED_EVIDENCE_NOTE}</div>;
}
