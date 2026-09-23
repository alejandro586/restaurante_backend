// controllers/facialController.js
const { detectFaceLandmarks, compareFacesBiometric } = require('../services/azureFaceService');

const getLandmarks = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debes enviar una imagen válida en el campo "image".' });
    }

    const landmarks = await detectFaceLandmarks(req.file.buffer);
    return res.status(200).json(landmarks);
  } catch (error) {
    console.error('Error en getLandmarks:', error.message);
    return res.status(500).json({ error: error.message || 'Fallo interno al procesar Face API' });
  }
};

const compareFaces = async (req, res) => {
  try {
    if (!req.files || !req.files.imageA || !req.files.imageB) {
      return res.status(400).json({ error: 'Debes enviar ambas imágenes: "imageA" e "imageB".' });
    }

    const bufferA = req.files.imageA[0].buffer;
    const bufferB = req.files.imageB[0].buffer;

    const result = await compareFacesBiometric(bufferA, bufferB);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error en compareFaces:', error.message);
    return res.status(500).json({ error: error.message || 'Fallo interno al comparar rostros' });
  }
};

module.exports = {
  getLandmarks,
  compareFaces
};