export function studioToday(timeZone: string, instant = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
export function weekThrough(date: string) {
  const end = new Date(date + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}
