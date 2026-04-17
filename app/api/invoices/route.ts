import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET /api/invoices  — admin: all, client: filtered by email
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const email = searchParams.get("email")

  let rows
  if (isAdmin(session.user.email) && !email) {
    rows = await sql`
      SELECT i.*, c.name AS client_name, c.email AS client_email,
        COALESCE(json_agg(json_build_object(
          'id', it.id, 'description', it.description,
          'quantity', it.quantity, 'rate', it.rate
        )) FILTER (WHERE it.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN invoice_items it ON it.invoice_id = i.id
      GROUP BY i.id, c.name, c.email
      ORDER BY i.created_at DESC
    `
  } else {
    const filterEmail = (email || session.user.email).toLowerCase()
    rows = await sql`
      SELECT i.*, c.name AS client_name, c.email AS client_email,
        COALESCE(json_agg(json_build_object(
          'id', it.id, 'description', it.description,
          'quantity', it.quantity, 'rate', it.rate
        )) FILTER (WHERE it.id IS NOT NULL), '[]') AS items
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN invoice_items it ON it.invoice_id = i.id
      WHERE c.email = ${filterEmail} OR ${filterEmail} = ANY(c.aliases)
      GROUP BY i.id, c.name, c.email
      ORDER BY i.created_at DESC
    `
  }

  // ensure items is always a parsed array (Neon may return it as a string)
  const parsed = rows.rows.map((r: any) => ({
    ...r,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items ?? [],
  }))

  return NextResponse.json(parsed)
}

// POST /api/invoices  — admin only
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { number, date, dueDate, clientId, notes, items } = body

  const inv = await sql`
    INSERT INTO invoices (number, date, due_date, client_id, notes, status)
    VALUES (${number}, ${date}, ${dueDate}, ${clientId}, ${notes || ""}, 'invoiced')
    RETURNING id
  `
  const invoiceId = inv.rows[0].id

  for (const item of items) {
    await sql`
      INSERT INTO invoice_items (invoice_id, description, quantity, rate)
      VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.rate})
    `
  }

  return NextResponse.json({ id: invoiceId })
}
