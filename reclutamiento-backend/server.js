const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const winston = require('winston');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de CORS
app.use(cors());

// Configuración de logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'reclutamiento-backend' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Configuración de Multer para la carga de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Solo se permiten archivos PDF, DOC o DOCX.');
    }
  },
});

// Endpoint para la carga de archivos
app.post('/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No se han subido archivos.' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    logger.info(`Archivos subidos exitosamente: ${JSON.stringify(uploadedFiles)}`);
    res.status(200).json({ message: 'Archivos subidos exitosamente', files: uploadedFiles });
  } catch (error) {
    logger.error(`Error al subir archivos: ${error.message}`);
    res.status(500).json({ message: 'Error al subir archivos', error: error.message });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
