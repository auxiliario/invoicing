import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

// PATCH /api/invoices/[id]  — update status/proof OR full edit (admin)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const id = parseInt(params.id, 10)

  // Full edit (admin only)
  if (body.fullEdit && isAdmin(session.user.email)) {
    const { number, date, dueDate, clientId, notes, items } = body

    await sql`
      UPDATE invoices
      SET number = ${number}, date = ${date}, due_date = ${dueDate},
          client_id = ${clientId}, notes = ${notes || ""}
      WHERE id = ${id}
    `

    // replace all line items
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`
    for (const item of items) {
      await sql`
        INSERT INTO invoice_items (invoice_id, description, quantity, rate)
        VALUES (${id}, ${item.description}, ${item.quantity}, ${item.rate})
      `
    }

    return NextResponse.json({ ok: true })
  }

  // Partial updates (status / proof)
  if (body.status) {
    await sql`UPDATE invoices SET status = ${body.status} WHERE id = ${id}`
  }
  if (body.paymentProofUrl) {
    await sql`UPDATE invoices SET payment_proof_url = ${body.paymentProofUrl} WHERE id = ${id}`
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/invoices/[id]  — admin only
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = parseInt(params.id, 10)
  await sql`DELETE FROM invoices WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
