// services/azureFaceService.js

/**
 * Consulta puntos anatómicos (landmarks) a Azure Face API
 */
const detectFaceLandmarks = async (imageBuffer) => {
  const faceUrl = `${process.env.FACE_ENDPOINT.replace(/\/$/, '')}/face/v1.0/detect?returnFaceLandmarks=true&recognitionModel=recognition_04&detectionModel=detection_01`;

  const response = await fetch(faceUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.FACE_KEY,
      'Content-Type': 'application/octet-stream'
    },
    body: imageBuffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en Azure Face API: ${errorText}`);
  }

  return await response.json();
};

/**
 * Consulta clasificación a Custom Vision
 */
const classifyFaceImage = async (imageBuffer) => {
  const response = await fetch(process.env.CV_ENDPOINT, {
    method: 'POST',
    headers: {
      'Prediction-Key': process.env.CV_KEY,
      'Content-Type': 'application/octet-stream'
    },
    body: imageBuffer
  });

  return await response.json();
};

/**
 * Compara dos rostros concurrentemente mediante Custom Vision
 */
const compareFacesBiometric = async (bufferA, bufferB) => {
  const [dataA, dataB] = await Promise.all([
    classifyFaceImage(bufferA),
    classifyFaceImage(bufferB)
  ]);

  if (!dataA.predictions || !dataB.predictions) {
    throw new Error(dataA.message || dataB.message || 'Error al obtener respuesta de Custom Vision.');
  }

  const predA = dataA.predictions[0];
  const predB = dataB.predictions[0];

  const nameA = predA.tagName.split('_')[0];
  const nameB = predB.tagName.split('_')[0];
  const isMatch = nameA.toLowerCase() === nameB.toLowerCase();
  const averageConfidence = (((predA.probability + predB.probability) / 2) * 100).toFixed(1);

  return {
    verdict: {
      isMatch,
      identityA: nameA,
      identityB: nameB,
      averageConfidence
    },
    predictionsA: dataA.predictions,
    predictionsB: dataB.predictions
  };
};

module.exports = {
  detectFaceLandmarks,
  compareFacesBiometric
};