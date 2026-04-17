import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await sql`SELECT * FROM clients ORDER BY name`
  return NextResponse.json(rows.rows)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, address, email } = await req.json()

  // upsert — update if email exists
  const row = await sql`
    INSERT INTO clients (name, address, email)
    VALUES (${name}, ${address || ""}, ${email})
    ON CONFLICT (email) DO UPDATE SET name = ${name}, address = ${address || ""}
    RETURNING id
  `

  return NextResponse.json({ id: row.rows[0].id })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await req.json()
  await sql`DELETE FROM clients WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
