const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const upload = require('../middleware/fileUpload');

router.post('/upload', upload.array('files', 10), fileController.uploadFiles);

module.exports = router;
