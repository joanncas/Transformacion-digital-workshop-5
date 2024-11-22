const express = require('express');
const cors = require('cors');
const path = require('path');
const winston = require('winston');
const fs = require('fs').promises;
const fsf = require('fs');
require('dotenv').config();
const OpenAI = require('openai');
const multer = require('multer');

// Create uploads folder if it doesn't exist
const uploadsFolder = 'uploads';

async function ensureUploadsFolder() {
  try {
    await fs.access(uploadsFolder);
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fs.mkdir(uploadsFolder);
        console.log('Uploads folder created successfully.');
      } catch (mkdirError) {
        console.error('Error creating uploads folder:', mkdirError);
      }
    } else {
      console.error('Error accessing uploads folder:', error);
    }
  }
}

ensureUploadsFolder();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

const normalizeFileName = (originalname) => {
  return originalname
    .toLowerCase()                        // Convert to lowercase
    .replace(/\s+/g, '-')                 // Replace spaces with dashes
    .replace(/[^\w\-\.]+/g, '');          // Remove special characters except alphanumeric, dash, and dot
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Specify the uploads folder

  },
  filename: (req, file, cb) => {
    // Use Date.now() to make the filename unique
    const normalizedFileName = normalizeFileName(file.originalname);
    const finalFileName = `${normalizedFileName}`;
    cb(null, finalFileName);
  }
});

// Initialize multer with the storage configuration
const upload = multer({ storage: storage });

app.post('/process-folder', upload.array('files'), async (req, res) => {

  try {
    const files = req.files;
    const jobDescription = req.body.jobDescription;
    const folderPath = 'uploads/';

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No se han subido archivos.' });
    }

    if (!jobDescription) {
      return res.status(400).json({ message: 'No se ha proporcionado una descripción del trabajo.' });
    }

    const filesInFolder = await fs.readdir(folderPath);
    const validFiles = filesInFolder.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pdf', '.doc', '.docx'].includes(ext);
    });

    if (validFiles.length === 0) {
      return res.status(400).json({ message: 'No se encontraron archivos válidos en la carpeta seleccionada.' });
    }

    const processedFiles = validFiles.map((file) => 
      path.join(folderPath, file)
    );    

    try {

      const fileStreams = processedFiles.map((path) =>
        fsf.createReadStream(path),
      );

      let vectorStore = await openai.beta.vectorStores.create({
        name: "CV Analysis Store",
        expires_after: {
          anchor: "last_active_at",
          days: 2
        }
      });
      
      await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {
        files: fileStreams,
      });  

      console.log(`Archivos subidos exitosamente`);

      // Create or update the assistant
      const assistant = await openai.beta.assistants.create({
        name: "CV Analyzer",
        instructions: "You are a CV analyzer finding the best profiles based on the job description that the user provides. Analyze the uploaded CVs and extract insights such as years of experience, english level, technologies, soft skills, achievements, studies and certifications.",
        tools: [{ type: "file_search" }],
        model: "gpt-4o-mini",
        tool_resources: {
          file_search: { vector_store_ids: [vectorStore.id] }
        },
        temperature: 0.5
      });

      console.log(assistant);

      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content:
              "I have the following job description: " + jobDescription + ". Generate a score from 1 to 100 for each resume according to attributes and job description. Create a ranking and answer only with a JSON with the top 10 suitable candidates, in this JSON please include their name, contact data, score, a extense detail about why they are suitable for the job including the reasoning for the score and why is not the number 1 (in Spanish), and some questions for the interview to validate why is not the number 1",
          },
        ],
      });

      console.log(thread)

      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistant.id,
      });

      console.log(run)
      
      const messages = await openai.beta.threads.messages.list(thread.id, {
        run_id: run.id,
      });

      console.log(messages)

      const message = messages.data.pop()
      
      if (message.content[0].type === "text") {
        const { text } = message.content[0];
        const { annotations } = text;
        const citations = [];
      
        let index = 0;
        for (let annotation of annotations) {
          text.value = text.value.replace(annotation.text, "[" + index + "]");
          const { file_citation } = annotation;
          if (file_citation) {
            const citedFile = await openai.files.retrieve(file_citation.file_id);
            citations.push("[" + index + "]" + citedFile.filename);
          }
          index++;
        }
      
        // console.log(text.value);
        
        const response = text.value
        const jsonResponse = response.replace(/```json|```/g, '');
        const parcedResponse = JSON.parse(jsonResponse);
        console.log(parcedResponse)
        console.log(citations.join("\n"));
        
        res.status(200).json({ 
          files: processedFiles,
          response: parcedResponse
        });
      }

    } catch (error) {

      console.log(`Error: ${error.message}`);
      res.status(500).json({ message: `Error con OpenAI: ${error.message}` });
    }

  } catch (error) {

    logger.error(`Error al procesar archivos: ${error.message}`);
    res.status(500).json({ message: `Error al procesar archivos: ${error.message}` });
  } finally {
    // Ensure the uploads folder is recreated for future operations
    try {
      await fs.rmdir('uploads/', { recursive: true });
      console.log('Uploads folder cleaned up');
      await fs.mkdir('uploads/');
      console.log('Uploads folder recreated');
    } catch (error) {
      console.error('Error cleaning up or recreating uploads folder:', error);
    }
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
