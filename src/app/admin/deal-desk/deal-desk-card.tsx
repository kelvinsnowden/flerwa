"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { lookupCustomer, convertRequest, declineRequest } from "./actions";

const FULFILMENT_MODES = [
  { value: "on_site_customer_present", label: "On-site, customer present" },
  { value: "on_site_customer_absent", label: "On-site, customer absent" },
  { value: "at_provider", label: "At the provider's location" },
  { value: "remote_digital", label: "Remote / digital" },
  { value: "representation", label: "Representation" },
];

interface Props {
  request: {
    id: string;
    providerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    description: string;
    proposedAmountMinor: number | null;
    createdAt: string;
  };
  categories: { id: string; name: string }[];
}

export function DealDeskCard({ request, categories }: Props) {
  const [contact, setContact] = useState(request.customerPhone ?? request.customerEmail ?? "");
  const [customer, setCustomer] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fulfilmentMode, setFulfilmentMode] = useState(FULFILMENT_MODES[0].value);
  const [amountKes, setAmountKes] = useState(request.proposedAmountMinor ? String(request.proposedAmountMinor / 100) : "");
  const [feeKes, setFeeKes] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ transactionId: string } | "declined" | null>(null);
  const [isPending, startTransition] = useTransition();

  if (outcome === "declined") {
    return (
      <div className="card p-4">
        <p className="badge-warn inline-flex">Declined</p>
      </div>
    );
  }
  if (outcome) {
    return (
      <div className="card p-4">
        <p className="badge-trust inline-flex mb-2">Converted</p>
        <Link href={`/account/bookings/${outcome.transactionId}`} className="text-sm font-semibold" style={{ color: "var(--trust)" }}>
          View booking →
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{request.providerName}</p>
        <span className="badge-warn">pending</span>
      </div>
      <p className="text-sm mt-2">{request.description}</p>
      <p className="text-xs text-[var(--muted)] mt-1">
        Customer: {request.customerPhone ?? "—"} {request.customerEmail ? `· ${request.customerEmail}` : ""}
        {request.proposedAmountMinor != null && <> · Proposed {formatMoney(request.proposedAmountMinor, "KES")}</>}
      </p>
      <p className="text-xs text-[var(--muted-2)] mt-1">{new Date(request.createdAt).toLocaleString("en-KE")}</p>

      <div className="mt-3 flex flex-col gap-2">
        <label className="text-xs font-medium">
          Find the customer's account (phone or email)
          <div className="mt-1 flex gap-2">
            <input value={contact} onChange={(e) => setContact(e.target.value)} className="flex-1" />
            <button
              type="button"
              className="btn-secondary text-xs shrink-0"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await lookupCustomer(contact);
                  if (res.error) {
                    setError(res.error);
                    setCustomer(null);
                  } else if (res.customer) {
                    setCustomer(res.customer);
                  }
                })
              }
            >
              Look up
            </button>
          </div>
        </label>

        {customer && (
          <p className="text-xs badge-trust inline-flex w-fit">
            Found: {customer.full_name ?? customer.email ?? customer.id}
          </p>
        )}

        {customer && (
          <>
            <label className="text-xs font-medium">
              Category
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Fulfilment mode
              <select value={fulfilmentMode} onChange={(e) => setFulfilmentMode(e.target.value)} className="mt-1">
                {FULFILMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <label className="text-xs font-medium flex-1">
                Amount (KSh)
                <input type="number" min="1" step="1" value={amountKes} onChange={(e) => setAmountKes(e.target.value)} className="mt-1" />
              </label>
              <label className="text-xs font-medium flex-1">
                Platform fee (KSh)
                <input type="number" min="0" step="1" value={feeKes} onChange={(e) => setFeeKes(e.target.value)} className="mt-1" />
              </label>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)] mt-2">{error}</p>}

      <div className="mt-3 flex gap-2">
        {customer && (
          <button
            className="btn-primary text-sm"
            disabled={isPending || !categoryId || Number(amountKes) <= 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await convertRequest(
                  request.id,
                  customer.id,
                  categoryId,
                  fulfilmentMode,
                  Number(amountKes),
                  Number(feeKes) || 0
                );
                if (res.error) setError(res.error);
                else if (res.transactionId) setOutcome({ transactionId: res.transactionId });
              })
            }
          >
            {isPending ? "Converting…" : "Convert to booking"}
          </button>
        )}
        <button
          className="btn-secondary text-sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await declineRequest(request.id, "Declined by admin");
              if (res?.error) setError(res.error);
              else setOutcome("declined");
            })
          }
        >
          Decline
        </button>
      </div>
    </div>
  );
}
