import multer from "multer"

const allowed = [".csv", ".xlsx", ".xls"]

const fileFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase()
  const valid = allowed.some((ext) => name.endsWith(ext))

  if (!valid) {
    return cb(new Error("Formato no permitido. Use CSV, XLSX o XLS"))
  }

  cb(null, true)
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
})
