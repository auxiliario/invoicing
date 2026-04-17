"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef, useCallback } from "react"
import InvoicePreview from "@/app/components/invoice-preview"
import { COMPANY } from "@/lib/db"

/* ── types ── */
interface Client { id: number; name: string; address: string; email: string }
interface LineItem { id: string; description: string; quantity: number; rate: number }
interface Invoice {
  id: number; number: string; date: string; due_date: string;
  client_name: string; client_email: string; notes: string;
  status: string; payment_proof_url: string | null;
  items: { description: string; quantity: number; rate: number }[]
}
interface Bill {
  id: number; client_id: number; client_name: string; client_email: string;
  description: string; amount: number; date: string; due_date: string | null;
  notes: string; status: string; payment_proof_url: string | null;
}

const uid = () => Math.random().toString(36).slice(2, 9)
const money = (n: number) => Number(n).toLocaleString("en-CA", { style: "currency", currency: "CAD" })
const emptyItem = (): LineItem => ({ id: uid(), description: "", quantity: 1, rate: 0 })

/* ── component ── */
export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const previewRef = useRef<HTMLDivElement>(null)

  const [tab, setTab] = useState<"invoice" | "invoices" | "bills" | "newbill" | "clients">("invoice")
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [dbReady, setDbReady] = useState(false)
  const [msg, setMsg] = useState("")

  /* invoice form state */
  const [invNumber, setInvNumber] = useState("")
  const [invDate, setInvDate] = useState("")
  const [invDue, setInvDue] = useState("")
  const [invClientId, setInvClientId] = useState<number | "">("")
  const [invItems, setInvItems] = useState<LineItem[]>([emptyItem()])
  const [invNotes, setInvNotes] = useState("")

  /* client form */
  const [cName, setCName] = useState("")
  const [cAddress, setCAddress] = useState("")
  const [cEmail, setCEmail] = useState("")

  /* bill form */
  const [billClientId, setBillClientId] = useState<number | "">("")
  const [billDesc, setBillDesc] = useState("")
  const [billAmt, setBillAmt] = useState<number | "">("")
  const [billDate, setBillDate] = useState("")
  const [billDue, setBillDue] = useState("")
  const [billNotes, setBillNotes] = useState("")

  /* auth guard */
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/")
    if (session && (session as any).role !== "admin") router.replace("/portal")
  }, [session, status, router])

  /* setup db + load data */
  const load = useCallback(async () => {
    const [c, i, b] = await Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/bills").then((r) => r.json()),
    ])
    if (!c.error) setClients(c)
    if (!i.error) setInvoices(i)
    if (!b.error) setBills(b)
  }, [])

  const setupDb = useCallback(async () => {
    const res = await fetch("/api/setup", { method: "POST" })
    if (res.ok) {
      setDbReady(true)
      await load()
    }
  }, [load])

  useEffect(() => {
    if (session && (session as any).role === "admin") {
      setupDb()
    }
  }, [session, setupDb])

  /* set default dates */
  useEffect(() => {
    const today = new Date()
    setInvDate(today.toISOString().slice(0, 10))
    setBillDate(today.toISOString().slice(0, 10))
    const due = new Date(today); due.setDate(due.getDate() + 30)
    setInvDue(due.toISOString().slice(0, 10))
    setBillDue(due.toISOString().slice(0, 10))
  }, [])

  /* auto invoice number */
  useEffect(() => {
    if (invoices.length === 0) { setInvNumber("INV-001"); return }
    const nums = invoices.map((i) => parseInt(i.number.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    setInvNumber("INV-" + String(max + 1).padStart(3, "0"))
  }, [invoices])

  /* helpers */
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500) }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setInvItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))

  const selectedClient = clients.find((c) => c.id === invClientId)

  const subtotal = invItems.reduce((s, i) => s + i.quantity * i.rate, 0)

  /* ── API actions ── */
  const saveClient = async () => {
    if (!cName.trim() || !cEmail.trim()) return
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName.trim(), address: cAddress.trim(), email: cEmail.trim().toLowerCase() }),
    })
    setCName(""); setCAddress(""); setCEmail("")
    await load(); flash("Client saved")
  }

  const deleteClient = async (id: number) => {
    await fetch("/api/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  const saveInvoice = async () => {
    if (!invClientId || !invNumber) return
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: invNumber, date: invDate, dueDate: invDue,
        clientId: invClientId, notes: invNotes,
        items: invItems.filter((i) => i.description.trim()),
      }),
    })
    setInvItems([emptyItem()]); setInvNotes(""); setInvClientId("")
    await load(); flash("Invoice saved"); setTab("invoices")
  }

  const exportPDF = async () => {
    const html2pdf = (await import("html2pdf.js")).default
    const el = previewRef.current
    if (!el) return
    html2pdf().set({
      margin: [0.4, 0.5, 0.4, 0.5], filename: `${invNumber}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    }).from(el).save()
  }

  const toggleStatus = async (type: "invoices" | "bills", id: number, current: string) => {
    const next = current === "paid" ? "invoiced" : "paid"
    await fetch(`/api/${type}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    await load()
  }

  const deleteInvoice = async (id: number) => {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" })
    await load()
  }

  const saveBill = async () => {
    if (!billClientId || !billDesc.trim() || !billAmt) return
    await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: billClientId, description: billDesc.trim(),
        amount: billAmt, date: billDate, dueDate: billDue || null, notes: billNotes,
      }),
    })
    setBillDesc(""); setBillAmt(""); setBillNotes("")
    await load(); flash("Bill saved"); setTab("bills")
  }

  const deleteBill = async (id: number) => {
    await fetch(`/api/bills/${id}`, { method: "DELETE" })
    await load()
  }

  if (status === "loading" || !session) return null

  /* ── render ── */
  const tabs = [
    { key: "invoice", label: "New Invoice" },
    { key: "invoices", label: `Invoices (${invoices.length})` },
    { key: "newbill", label: "New Bill" },
    { key: "bills", label: `Bills (${bills.length})` },
    { key: "clients", label: `Clients (${clients.length})` },
  ] as const

  return (
    <div className="min-h-screen pb-16">
      {/* top bar */}
      <header className="no-print bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">{COMPANY.name}</h1>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-green-600 font-medium">{msg}</span>}
            <span className="text-xs text-gray-400">{session.user?.email}</span>
            <button onClick={() => signOut()} className="text-xs text-red-500 hover:text-red-700">Sign out</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-2 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition ${
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-6">
        {/* ─── NEW INVOICE TAB ─── */}
        {tab === "invoice" && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* form */}
            <div className="space-y-5 no-print">
              {/* client select */}
              <section className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="font-semibold text-gray-800">Client</h2>
                <select value={invClientId} onChange={(e) => setInvClientId(Number(e.target.value) || "")}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Select client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </section>

              {/* details */}
              <section className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="font-semibold text-gray-800">Details</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Invoice #</label>
                    <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                    <input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </section>

              {/* line items */}
              <section className="bg-white rounded-lg shadow p-5 space-y-3">
                <h2 className="font-semibold text-gray-800">Line Items</h2>
                {invItems.map((item) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <input placeholder="Description" value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      className="flex-1 border rounded px-3 py-2 text-sm" />
                    <input type="number" min="0" placeholder="Qty" value={item.quantity || ""}
                      onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-16 border rounded px-2 py-2 text-sm text-center" />
                    <input type="number" min="0" step="0.01" placeholder="Rate" value={item.rate || ""}
                      onChange={(e) => updateItem(item.id, "rate", parseFloat(e.target.value) || 0)}
                      className="w-24 border rounded px-2 py-2 text-sm text-right" />
                    <span className="w-24 py-2 text-sm text-right text-gray-700 tabular-nums">{money(item.quantity * item.rate)}</span>
                    <button onClick={() => setInvItems((p) => p.length === 1 ? p : p.filter((i) => i.id !== item.id))}
                      className="py-2 px-1 text-gray-400 hover:text-red-500 text-lg">&times;</button>
                  </div>
                ))}
                <button onClick={() => setInvItems((p) => [...p, emptyItem()])}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add line</button>
              </section>

              {/* notes */}
              <section className="bg-white rounded-lg shadow p-5">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea rows={2} value={invNotes} onChange={(e) => setInvNotes(e.target.value)}
                  placeholder="Payment terms, bank details, etc."
                  className="w-full border rounded px-3 py-2 text-sm" />
              </section>

              {/* actions */}
              <div className="flex gap-3">
                <button onClick={exportPDF}
                  className="flex-1 bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-800 transition">
                  Download PDF
                </button>
                <button onClick={async () => { await saveInvoice(); exportPDF() }}
                  disabled={!invClientId}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40">
                  Save &amp; Download
                </button>
              </div>
            </div>

            {/* preview */}
            <div>
              <div className="no-print text-xs text-gray-400 mb-2 uppercase tracking-wide">Live Preview</div>
              <div ref={previewRef} className="rounded-lg shadow">
                <InvoicePreview
                  invoiceNumber={invNumber} invoiceDate={invDate} dueDate={invDue}
                  clientName={selectedClient?.name ?? ""} clientAddress={selectedClient?.address ?? ""}
                  clientEmail={selectedClient?.email ?? ""} items={invItems} notes={invNotes}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── INVOICES LIST ─── */}
        {tab === "invoices" && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">All Invoices</h2>
            {invoices.length === 0 ? (
              <p className="text-gray-500 text-sm">No invoices yet.</p>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {invoices.map((inv) => (
                  <div key={inv.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-medium">{inv.number}</span>
                      <span className="text-sm text-gray-600">{inv.client_name}</span>
                      <span className="text-xs text-gray-400">{inv.date}</span>
                      <button onClick={() => toggleStatus("invoices", inv.id, inv.status)}
                        className={`px-2 py-0.5 rounded text-xs font-medium uppercase cursor-pointer ${
                          inv.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {inv.status}
                      </button>
                      {inv.payment_proof_url && (
                        <a href={inv.payment_proof_url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline">View proof</a>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-sm">
                        {money(inv.items.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.rate), 0) * 1.14975)}
                      </span>
                      <button onClick={() => deleteInvoice(inv.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── NEW BILL TAB ─── */}
        {tab === "newbill" && (
          <div className="max-w-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">New Bill</h2>
            <div className="bg-white rounded-lg shadow p-5 space-y-4">
              <select value={billClientId} onChange={(e) => setBillClientId(Number(e.target.value) || "")}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
              </select>
              <input placeholder="Description" value={billDesc} onChange={(e) => setBillDesc(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount</label>
                  <input type="number" min="0" step="0.01" value={billAmt}
                    onChange={(e) => setBillAmt(parseFloat(e.target.value) || "")}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                  <input type="date" value={billDue} onChange={(e) => setBillDue(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <textarea rows={2} placeholder="Notes" value={billNotes} onChange={(e) => setBillNotes(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
              <button onClick={saveBill} disabled={!billClientId || !billDesc.trim() || !billAmt}
                className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40">
                Save Bill
              </button>
            </div>
          </div>
        )}

        {/* ─── BILLS LIST ─── */}
        {tab === "bills" && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">All Bills</h2>
            {bills.length === 0 ? (
              <p className="text-gray-500 text-sm">No bills yet.</p>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {bills.map((b) => (
                  <div key={b.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">{b.description}</span>
                      <span className="text-sm text-gray-600">{b.client_name}</span>
                      <span className="text-xs text-gray-400">{b.date}</span>
                      <button onClick={() => toggleStatus("bills", b.id, b.status)}
                        className={`px-2 py-0.5 rounded text-xs font-medium uppercase cursor-pointer ${
                          b.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {b.status}
                      </button>
                      {b.payment_proof_url && (
                        <a href={b.payment_proof_url} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline">View proof</a>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-sm">{money(Number(b.amount))}</span>
                      <button onClick={() => deleteBill(b.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── CLIENTS TAB ─── */}
        {tab === "clients" && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Clients</h2>
            <div className="bg-white rounded-lg shadow p-5 space-y-3 mb-6">
              <h3 className="text-sm font-medium text-gray-700">Add Client</h3>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="Name" value={cName} onChange={(e) => setCName(e.target.value)}
                  className="border rounded px-3 py-2 text-sm" />
                <input placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)}
                  className="border rounded px-3 py-2 text-sm" />
                <input placeholder="Address" value={cAddress} onChange={(e) => setCAddress(e.target.value)}
                  className="border rounded px-3 py-2 text-sm" />
              </div>
              <button onClick={saveClient} disabled={!cName.trim() || !cEmail.trim()}
                className="bg-gray-900 text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-40">
                Save Client
              </button>
            </div>
            {clients.length === 0 ? (
              <p className="text-gray-500 text-sm">No clients yet.</p>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {clients.map((c) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{c.name}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-sm text-gray-500">{c.email}</span>
                      {c.address && <><span className="mx-2 text-gray-300">|</span><span className="text-xs text-gray-400">{c.address}</span></>}
                    </div>
                    <button onClick={() => deleteClient(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
