// routes/facialRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getLandmarks, compareFaces } = require('../controllers/faciaController');

// Almacenamiento en memoria RAM (máx 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/facial/landmarks
router.post('/landmarks', upload.single('image'), getLandmarks);

// POST /api/facial/compare
router.post('/compare', upload.fields([
  { name: 'imageA', maxCount: 1 },
  { name: 'imageB', maxCount: 1 }
]), compareFaces);

module.exports = router;