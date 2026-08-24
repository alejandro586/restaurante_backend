export const normalizeName = (value) => {
  if (!value) return ""

  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}
