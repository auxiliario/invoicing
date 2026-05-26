import { sql } from "@vercel/postgres"
export { sql }

export const GST_RATE = 0.05
export const QST_RATE = 0.09975

export const COMPANY = {
  name: "9292-1022 QC Inc.",
  address: "1140 3e Rang, Saint-Luc de Vincennes",
  city: "G0X 3K0, QC, Canada",
  phone: "438 323-1495",
  gst: "827352337RT0001",
  qst: "1219843247TQ0001",
}

export const DOGS = ["Blu", "Quinta", "Milo", "Moose", "Dakota", "Luke", "Bobby", "Sam"] as const

export function boardingDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function boardingRate(year: number, month: number) {
  if (year > 2026 || (year === 2026 && month >= 4)) return 10
  return 25
}
