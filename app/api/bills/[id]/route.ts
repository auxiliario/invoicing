import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

// PATCH /api/bills/[id]  — update status/proof OR full edit (admin)
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
    const { clientId, description, amount, date, dueDate, notes } = body
    await sql`
      UPDATE bills
      SET client_id = ${clientId}, description = ${description}, amount = ${amount},
          date = ${date}, due_date = ${dueDate || null}, notes = ${notes || ""}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  }

  // Partial updates
  if (body.status) {
    await sql`UPDATE bills SET status = ${body.status} WHERE id = ${id}`
  }
  if (body.paymentProofUrl) {
    await sql`UPDATE bills SET payment_proof_url = ${body.paymentProofUrl} WHERE id = ${id}`
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = parseInt(params.id, 10)
  await sql`DELETE FROM bills WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
