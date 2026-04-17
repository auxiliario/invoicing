"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import InvoicePreview from "@/app/components/invoice-preview"
import { COMPANY } from "@/lib/db"

interface Invoice {
  id: number; number: string; date: string; due_date: string;
  client_name: string; client_email: string; notes: string;
  status: string; payment_proof_url: string | null;
  items: { description: string; quantity: number; rate: number }[]
}
interface Bill {
  id: number; description: string; amount: number; date: string;
  due_date: string | null; notes: string; status: string;
  payment_proof_url: string | null; client_name: string;
}

const money = (n: number) => Number(n).toLocaleString("en-CA", { style: "currency", currency: "CAD" })

export default function Portal() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const previewRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<"invoices" | "bills">("invoices")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/")
    if (session && (session as any).role === "admin") router.replace("/dashboard")
  }, [session, status, router])

  const load = useCallback(async () => {
    const [i, b] = await Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/bills").then((r) => r.json()),
    ])
    if (!i.error) setInvoices(i)
    if (!b.error) setBills(b)
  }, [])

  useEffect(() => {
    if (session && (session as any).role === "client") load()
  }, [session, load])

  /* upload proof of payment */
  const uploadProof = async (type: "invoices" | "bills", id: number, file: File) => {
    setUploading(`${type}-${id}`)
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: form })
    if (!res.ok) { setUploading(null); return }
    const { url } = await res.json()

    await fetch(`/api/${type}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentProofUrl: url, status: "paid" }),
    })
    setUploading(null)
    await load()
  }

  const exportPDF = async (inv: Invoice) => {
    setViewInvoice(inv)
    // wait for render
    await new Promise((r) => setTimeout(r, 100))
    const html2pdf = (await import("html2pdf.js")).default
    const el = previewRef.current
    if (!el) return
    html2pdf().set({
      margin: [0.4, 0.5, 0.4, 0.5], filename: `${inv.number}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    }).from(el).save()
  }

  if (status === "loading" || !session) return null

  return (
    <div className="min-h-screen pb-16">
      {/* top bar */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">{COMPANY.name}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{session.user?.email}</span>
            <button onClick={() => signOut()} className="text-xs text-red-500 hover:text-red-700">Sign out</button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-1 pb-2">
          <button onClick={() => { setTab("invoices"); setViewInvoice(null) }}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              tab === "invoices" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}>
            My Invoices ({invoices.length})
          </button>
          <button onClick={() => { setTab("bills"); setViewInvoice(null) }}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              tab === "bills" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}>
            My Bills ({bills.length})
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* ─── INVOICE DETAIL VIEW ─── */}
        {viewInvoice && (
          <div className="mb-6">
            <button onClick={() => setViewInvoice(null)}
              className="text-sm text-blue-600 hover:text-blue-800 mb-3">&larr; Back to list</button>
            <div ref={previewRef} className="rounded-lg shadow">
              <InvoicePreview
                invoiceNumber={viewInvoice.number} invoiceDate={viewInvoice.date}
                dueDate={viewInvoice.due_date}
                clientName={viewInvoice.client_name} clientAddress="" clientEmail={viewInvoice.client_email}
                items={viewInvoice.items} notes={viewInvoice.notes} status={viewInvoice.status}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => exportPDF(viewInvoice)}
                className="bg-gray-900 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-gray-800">
                Download PDF
              </button>
              {viewInvoice.status !== "paid" && (
                <label className="bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 cursor-pointer">
                  {uploading === `invoices-${viewInvoice.id}` ? "Uploading..." : "Upload Proof of Payment"}
                  <input type="file" accept="image/*,.pdf" className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadProof("invoices", viewInvoice.id, f)
                    }} />
                </label>
              )}
              {viewInvoice.payment_proof_url && (
                <a href={viewInvoice.payment_proof_url} target="_blank" rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline self-center">View proof</a>
              )}
            </div>
          </div>
        )}

        {/* ─── INVOICES LIST ─── */}
        {tab === "invoices" && !viewInvoice && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">My Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices found for your account.</p>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {invoices.map((inv) => {
                  const total = inv.items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.rate), 0) * 1.14975
                  return (
                    <div key={inv.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button onClick={() => setViewInvoice(inv)}
                          className="font-mono text-sm font-medium text-blue-600 hover:underline">{inv.number}</button>
                        <span className="text-xs text-gray-400">{inv.date}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>{inv.status}</span>
                        {inv.payment_proof_url && (
                          <a href={inv.payment_proof_url} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline">Proof attached</a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm">{money(total)}</span>
                        {inv.status !== "paid" && (
                          <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                            Upload proof
                            <input type="file" accept="image/*,.pdf" className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadProof("invoices", inv.id, f)
                              }} />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── BILLS LIST ─── */}
        {tab === "bills" && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">My Bills</h2>
            {bills.length === 0 ? (
              <p className="text-gray-500 text-sm">No bills found for your account.</p>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {bills.map((b) => (
                  <div key={b.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">{b.description}</span>
                      <span className="text-xs text-gray-400">{b.date}</span>
                      {b.due_date && <span className="text-xs text-gray-400">Due: {b.due_date}</span>}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                        b.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{b.status}</span>
                      {b.payment_proof_url && (
                        <a href={b.payment_proof_url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline">Proof attached</a>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{money(Number(b.amount))}</span>
                      {b.status !== "paid" && (
                        <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                          {uploading === `bills-${b.id}` ? "Uploading..." : "Upload proof"}
                          <input type="file" accept="image/*,.pdf" className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) uploadProof("bills", b.id, f)
                            }} />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
