import { sql } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions, isAdmin } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      aliases TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // add aliases column if table already exists without it
  await sql`
    DO $$ BEGIN
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
    EXCEPTION WHEN others THEN NULL;
    END $$
  `

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      date DATE NOT NULL,
      due_date DATE NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'invoiced',
      payment_proof_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
      rate NUMERIC(10,2) NOT NULL DEFAULT 0
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      date DATE NOT NULL,
      due_date DATE,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'invoiced',
      payment_proof_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  return NextResponse.json({ ok: true })
}
