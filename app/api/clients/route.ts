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

  const { name, address, email, aliases } = await req.json()

  // clean aliases: lowercase, trim, remove blanks and duplicates
  const cleanAliases = (aliases || [])
    .map((a: string) => a.trim().toLowerCase())
    .filter((a: string) => a && a !== email.trim().toLowerCase())
    .filter((a: string, i: number, arr: string[]) => arr.indexOf(a) === i)

  const row = await sql`
    INSERT INTO clients (name, address, email, aliases)
    VALUES (${name}, ${address || ""}, ${email.trim().toLowerCase()}, ${cleanAliases})
    ON CONFLICT (email) DO UPDATE
      SET name = ${name}, address = ${address || ""}, aliases = ${cleanAliases}
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
