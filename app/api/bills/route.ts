import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET /api/bills
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  let rows
  if (isAdmin(session.user.email) && !email) {
    rows = await sql`
      SELECT b.*, c.name AS client_name, c.email AS client_email
      FROM bills b LEFT JOIN clients c ON b.client_id = c.id
      ORDER BY b.created_at DESC
    `
  } else {
    const filterEmail = (email || session.user.email).toLowerCase()
    rows = await sql`
      SELECT b.*, c.name AS client_name, c.email AS client_email
      FROM bills b LEFT JOIN clients c ON b.client_id = c.id
      WHERE c.email = ${filterEmail} OR ${filterEmail} = ANY(c.aliases)
      ORDER BY b.created_at DESC
    `
  }

  return NextResponse.json(rows.rows)
}

// POST /api/bills  — admin only
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { clientId, description, amount, date, dueDate, notes } = await req.json()

  const row = await sql`
    INSERT INTO bills (client_id, description, amount, date, due_date, notes, status)
    VALUES (${clientId}, ${description}, ${amount}, ${date}, ${dueDate || null}, ${notes || ""}, 'invoiced')
    RETURNING id
  `

  return NextResponse.json({ id: row.rows[0].id })
}
