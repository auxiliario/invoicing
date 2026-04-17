"use client"

import { COMPANY, GST_RATE, QST_RATE } from "@/lib/db"

interface Item {
  description: string
  quantity: number
  rate: number
}

interface Props {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  clientAddress: string
  clientEmail: string
  items: Item[]
  notes: string
  status?: string
}

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" })

export default function InvoicePreview({
  invoiceNumber, invoiceDate, dueDate,
  clientName, clientAddress, clientEmail,
  items, notes, status,
}: Props) {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0)
  const gst = subtotal * GST_RATE
  const qst = subtotal * QST_RATE
  const total = subtotal + gst + qst

  return (
    <div className="bg-white p-8 text-sm text-gray-800" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{COMPANY.name}</h2>
          <p className="text-gray-500 text-xs mt-1">{COMPANY.address}</p>
          <p className="text-gray-500 text-xs">{COMPANY.city}</p>
          <p className="text-gray-500 text-xs">{COMPANY.phone}</p>
        </div>
        <div className="text-right">
          <h3 className="text-2xl font-bold text-gray-300 uppercase tracking-wider">Invoice</h3>
          <p className="font-mono text-sm mt-1">{invoiceNumber}</p>
          {status && (
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium uppercase ${
              status === "paid"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* client + dates */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
          <p className="font-medium">{clientName || "—"}</p>
          {clientAddress && <p className="text-gray-600 text-xs">{clientAddress}</p>}
          {clientEmail && <p className="text-gray-600 text-xs">{clientEmail}</p>}
        </div>
        <div className="text-right space-y-1">
          <div><span className="text-xs text-gray-400">Date: </span><span className="text-xs">{invoiceDate}</span></div>
          <div><span className="text-xs text-gray-400">Due: </span><span className="text-xs">{dueDate}</span></div>
        </div>
      </div>

      {/* table */}
      <table className="w-full mb-6">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 text-xs text-gray-400 uppercase tracking-wide font-medium">Description</th>
            <th className="text-center py-2 text-xs text-gray-400 uppercase tracking-wide font-medium w-16">Qty</th>
            <th className="text-right py-2 text-xs text-gray-400 uppercase tracking-wide font-medium w-24">Rate</th>
            <th className="text-right py-2 text-xs text-gray-400 uppercase tracking-wide font-medium w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">{item.description || "—"}</td>
              <td className="py-2 text-center tabular-nums">{item.quantity}</td>
              <td className="py-2 text-right tabular-nums">{money(Number(item.rate))}</td>
              <td className="py-2 text-right tabular-nums font-medium">{money(Number(item.quantity) * Number(item.rate))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">GST (5%)</span><span className="tabular-nums">{money(gst)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">QST (9.975%)</span><span className="tabular-nums">{money(qst)}</span></div>
          <div className="flex justify-between font-bold pt-2 border-t-2 border-gray-800"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
        </div>
      </div>

      {/* tax numbers */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 space-y-0.5">
        <p>GST/TPS # {COMPANY.gst}</p>
        <p>QST/TVQ # {COMPANY.qst}</p>
      </div>

      {notes && (
        <div className="mt-4 text-xs text-gray-500">
          <p className="font-medium text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p>{notes}</p>
        </div>
      )}
    </div>
  )
}
