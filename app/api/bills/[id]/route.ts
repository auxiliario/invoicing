import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const id = parseInt(params.id, 10)

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
