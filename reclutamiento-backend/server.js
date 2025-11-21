const express = require('express');
const cors = require('cors');
const path = require('path');
const winston = require('winston');
const fs = require('fs').promises;
const fsf = require('fs');
const OpenAI = require('openai');
const multer = require('multer');

// Load environment variables with explicit path
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '.env');
const envResult = dotenv.config({ path: envPath });

// Debug: Check if .env file was loaded
if (envResult.error) {
  console.warn('⚠️  Advertencia: No se pudo cargar el archivo .env:', envResult.error.message);
  console.warn('   Ruta esperada:', envPath);
} else {
  console.log('✅ Archivo .env cargado correctamente desde:', envPath);
}

// Validate OpenAI API Key with detailed error messages
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('\n❌ ERROR: OPENAI_API_KEY no está definida en las variables de entorno.');
  console.error('   Verifica que el archivo .env existe en:', envPath);
  console.error('   El archivo debe contener: OPENAI_API_KEY=tu_api_key_aqui');
  console.error('   Sin espacios alrededor del signo =');
  console.error('   Sin comillas alrededor del valor\n');
  process.exit(1);
}

// Check if API key is just whitespace
const trimmedApiKey = apiKey.trim();
if (!trimmedApiKey || trimmedApiKey.length === 0) {
  console.error('\n❌ ERROR: OPENAI_API_KEY está vacía o contiene solo espacios.');
  console.error('   Por favor, verifica el archivo .env y asegúrate de que tenga un valor válido.\n');
  process.exit(1);
}

// Log API key status (without showing the actual key)
console.log(`✅ OPENAI_API_KEY encontrada (longitud: ${trimmedApiKey.length} caracteres)`);

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

// Initialize OpenAI client with validation
let openai;
try {
  console.log('🔧 Inicializando cliente OpenAI...');
  openai = new OpenAI({
    apiKey: trimmedApiKey,
  });
  
  if (!openai) {
    throw new Error('El objeto OpenAI es null o undefined');
  }

  console.log('   Cliente OpenAI creado. Verificando estructura...');
  console.log('   - openai existe:', !!openai);
  console.log('   - openai.beta existe:', !!openai.beta);
  console.log('   - openai.files existe:', !!openai.files);
  console.log('   - openai.vectorStores existe:', !!openai.vectorStores);
  console.log('   - openai.beta.vectorStores existe:', !!(openai.beta && openai.beta.vectorStores));
  console.log('   - openai.beta.assistants existe:', !!(openai.beta && openai.beta.assistants));
  console.log('   - openai.beta.threads existe:', !!(openai.beta && openai.beta.threads));
  
  let openaiVersion = 'desconocida';
  try {
    const fsLocal = require('fs');
    const pkgPath = path.join(__dirname, 'node_modules', 'openai', 'package.json');
    const packageData = JSON.parse(fsLocal.readFileSync(pkgPath, 'utf8'));
    openaiVersion = packageData.version;
  } catch (e) {}

  if (!openai.beta) {
    console.error('\n⚠️  ADVERTENCIA: La propiedad "beta" no está disponible.');
    console.error('   Versión instalada:', openaiVersion);
    throw new Error('La propiedad "beta" es requerida para usar assistants API');
  }

  if (!openai.beta.assistants) {
    console.error('\n⚠️  ADVERTENCIA: La propiedad "beta.assistants" no está disponible.');
    throw new Error('La propiedad "beta.assistants" es requerida para usar assistants API');
  }

  if (!openai.files) {
    console.error('\n⚠️  ADVERTENCIA: La propiedad "files" no está disponible.');
    throw new Error('La propiedad "files" es requerida para subir archivos');
  }

  const hasVectorStores = !!(openai.vectorStores || (openai.beta && openai.beta.vectorStores));
  if (!hasVectorStores) {
    console.warn('\n⚠️  ADVERTENCIA: La propiedad "vectorStores" no está disponible.');
    console.warn('   El código usará file_ids directamente como alternativa.');
    console.warn('   Versión instalada:', openaiVersion);
  } else {
    console.log('✅ Vector stores disponible');
  }
  
  console.log('✅ OpenAI client inicializado correctamente');
  console.log('   Versión del SDK:', openaiVersion);
} catch (error) {
  console.error('\n❌ Error al inicializar OpenAI client:');
  console.error('   Mensaje:', error.message);
  console.error('   Stack:', error.stack);
  console.error('\n   Posibles soluciones:');
  console.error('   1. Verifica que la API key sea válida');
  console.error('   2. Verifica que el paquete openai esté instalado: npm install openai');
  console.error('   3. Verifica la versión del paquete: npm list openai');
  console.error('   4. Reinstala el paquete: npm uninstall openai && npm install openai\n');
  process.exit(1);
}

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
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\.]+/g, '');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const normalizedFileName = normalizeFileName(file.originalname);
    const finalFileName = `${normalizedFileName}`;
    cb(null, finalFileName);
  }
});

const upload = multer({ storage: storage });

app.post('/process-folder', upload.array('files'), async (req, res) => {
  const uploadedFileIds = [];
  let vectorStoreId = null;
  let assistantId = null;

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
      if (!openai) {
        throw new Error('OpenAI client no está inicializado.');
      }
      if (!openai.beta) {
        throw new Error('La propiedad "beta" no está disponible en el cliente OpenAI.');
      }

      // Upload files to OpenAI
      console.log('📤 Subiendo archivos a OpenAI...');
      const uploadedFiles = [];
      
      for (const filePath of processedFiles) {
        try {
          const fileStream = fsf.createReadStream(filePath);
          const fileName = path.basename(filePath);
          
          const file = await openai.files.create({
            file: fileStream,
            purpose: 'assistants'
          });
          
          uploadedFiles.push(file.id);
          uploadedFileIds.push(file.id);
          console.log(`✅ Archivo subido: ${fileName} (ID: ${file.id})`);
        } catch (fileError) {
          console.error(`❌ Error al subir archivo ${filePath}:`, fileError.message);
          throw new Error(`Error al subir archivo ${path.basename(filePath)}: ${fileError.message}`);
        }
      }

      console.log(`✅ ${uploadedFiles.length} archivos subidos exitosamente`);

      // Create vector store if available
      const vectorStoresAPI = openai.vectorStores || (openai.beta && openai.beta.vectorStores);
      
      if (vectorStoresAPI) {
        try {
          console.log('📦 Creando vector store...');
          const vectorStore = await vectorStoresAPI.create({
            name: "CV Analysis Store",
            expires_after: {
              anchor: "last_active_at",
              days: 2
            }
          });
          
          vectorStoreId = vectorStore.id;
          console.log(`✅ Vector store creado: ${vectorStoreId}`);
          
          if (vectorStoresAPI.files) {
            for (const fileId of uploadedFiles) {
              await vectorStoresAPI.files.create(vectorStoreId, {
                file_id: fileId
              });
            }
            console.log('✅ Archivos agregados al vector store');
          } else if (vectorStoresAPI.fileBatches) {
            await vectorStoresAPI.fileBatches.create(vectorStoreId, {
              file_ids: uploadedFiles
            });
            console.log('✅ Archivos agregados al vector store mediante fileBatches');
          }
        } catch (vsError) {
          console.warn('⚠️  No se pudo crear vector store, usando file_ids directamente:', vsError.message);
          vectorStoreId = null;
        }
      } else {
        console.log('ℹ️  Vector stores no disponible, usando file_ids directamente');
      }  

      // Create assistant
      console.log('🤖 Creando assistant...');
      const assistantConfig = {
        name: "CV Analyzer",
        instructions: `
You are an expert CV analyzer and technical recruiter.
Your goal is to find the best profiles based on the job description the user provides.

Always:
- Extract for each CV: years of experience, English level, technologies, soft skills, achievements, studies, and certifications.
- Compare each CV strictly against the job description.
- Be consistent in scoring: similar profiles → similar scores.
- When reasoning or explaining, use Spanish.
Return outputs ONLY in valid JSON when the user requests it.
        `,
        tools: [{ type: "file_search" }],
        model: "gpt-4.1",
        temperature: 0.3
      };

      if (vectorStoreId) {
        assistantConfig.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] }
        };
      } else {
        assistantConfig.tool_resources = {
          file_search: { file_ids: uploadedFiles }
        };
      }

      const assistant = await openai.beta.assistants.create(assistantConfig);
      assistantId = assistant.id;
      console.log(`✅ Assistant creado: ${assistant.id}`);

      const thread = await openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: `
I have the following job description: ${jobDescription}.

Using the uploaded resumes:
1. Generate a score from 1 to 100 for EACH resume according to the job description.
2. Create a ranking and return ONLY a JSON with the TOP 10 candidates.

The JSON MUST be an array named "candidates" with objects like:
{
  "name": string,
  "contact": string,
  "score": number,
  "detail": string,
  "why_not_first": string,
  "interview_questions": [string]
}

Rules:
- Respond ONLY with valid JSON. No extra text.
- "detail", "why_not_first" and "interview_questions" MUST be in Spanish.
            `
          }
        ],
      });

      // Run assistant
      const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: assistant.id,
      });

      console.log('🏁 Run status:', run.status);

      // ✅ NUEVO: validar que terminó bien antes de leer mensajes
      if (run.status !== "completed") {
        throw new Error(`Run no completado. status=${run.status}`);
      }

      // List messages
      const messages = await openai.beta.threads.messages.list(thread.id, {
        run_id: run.id,
      });

      console.log('📨 Mensajes en thread:', messages.data.length);

      // ✅ NUEVO: agarrar explícitamente la respuesta del assistant
      const assistantMsg = messages.data.find(m => m.role === "assistant");

      if (!assistantMsg || !assistantMsg.content || assistantMsg.content.length === 0) {
        throw new Error('No se recibió respuesta del assistant');
      }

      const message = assistantMsg;

      if (message.content[0].type === "text") {
        const { text } = message.content[0];
        const { annotations } = text || {};
        const citations = [];
      
        let index = 0;
        if (annotations && Array.isArray(annotations)) {
          for (let annotation of annotations) {
            if (annotation.text) {
              text.value = text.value.replace(annotation.text, "[" + index + "]");
            }
            const { file_citation } = annotation;
            if (file_citation) {
              try {
                const citedFile = await openai.files.retrieve(file_citation.file_id);
                citations.push("[" + index + "]" + citedFile.filename);
              } catch (citeError) {
                console.warn(`No se pudo obtener información del archivo citado: ${file_citation.file_id}`);
              }
            }
            index++;
          }
        }
      
        let responseText = text.value.trim();
        console.log('📄 Respuesta cruda del assistant (primeros 500 caracteres):', responseText.substring(0, 500));
        
        let jsonResponse = responseText;
        jsonResponse = jsonResponse.replace(/```json\n?/g, '');
        jsonResponse = jsonResponse.replace(/```\n?/g, '');
        jsonResponse = jsonResponse.trim();
        
        let jsonMatch = null;
        let startPos = jsonResponse.indexOf('[');
        if (startPos !== -1) {
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = startPos; i < jsonResponse.length; i++) {
            const char = jsonResponse[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '[') {
                depth++;
              } else if (char === ']') {
                depth--;
                if (depth === 0) {
                  jsonResponse = jsonResponse.substring(startPos, i + 1);
                  jsonMatch = [jsonResponse];
                  break;
                }
              }
            }
          }
        }
        
        if (!jsonMatch) {
          startPos = jsonResponse.indexOf('{');
          if (startPos !== -1) {
            let depth = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = startPos; i < jsonResponse.length; i++) {
              const char = jsonResponse[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') {
                  depth++;
                } else if (char === '}') {
                  depth--;
                  if (depth === 0) {
                    jsonResponse = jsonResponse.substring(startPos, i + 1);
                    jsonMatch = [jsonResponse];
                    break;
                  }
                }
              }
            }
          }
        }
        
        if (jsonMatch) {
          console.log('📏 Longitud del JSON extraído:', jsonResponse.length, 'caracteres');
        }
        
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(jsonResponse);
          console.log('✅ JSON parseado correctamente');
        } catch (parseError) {
          console.error('❌ Error al parsear JSON:', parseError.message);
          console.error('JSON que falló (primeros 1500 caracteres):', jsonResponse.substring(0, 1500));
          throw new Error(`Error al parsear la respuesta JSON del assistant: ${parseError.message}.`);
        }
        
        let candidatesArray = null;
        if (Array.isArray(parsedResponse)) {
          if (parsedResponse.length > 0 && typeof parsedResponse[0] === 'object' && parsedResponse[0].candidates) {
            candidatesArray = parsedResponse[0].candidates || parsedResponse[0].candidatos || null;
            if (parsedResponse.length > 1) {
              const allCandidates = [];
              parsedResponse.forEach(item => {
                if (item.candidates && Array.isArray(item.candidates)) {
                  allCandidates.push(...item.candidates);
                } else if (item.candidatos && Array.isArray(item.candidatos)) {
                  allCandidates.push(...item.candidatos);
                }
              });
              if (allCandidates.length > 0) {
                candidatesArray = allCandidates;
              }
            }
          } else {
            candidatesArray = parsedResponse;
          }
        } else if (parsedResponse && typeof parsedResponse === 'object') {
          candidatesArray = parsedResponse.candidates || parsedResponse.candidatos || null;
          if (!candidatesArray && !Array.isArray(parsedResponse)) {
            candidatesArray = [parsedResponse];
          }
        }
        
        if (candidatesArray && Array.isArray(candidatesArray)) {
          parsedResponse = candidatesArray.map(candidate => {
            let contactObj = {};
            if (typeof candidate.contact === 'string') {
              const contactStr = candidate.contact.trim();
              const emailMatch = contactStr.match(/[\w\.-]+@[\w\.-]+\.\w+/);
              const phoneMatch = contactStr.match(/(\+?\d{1,4}[\s\-]?)?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9}/);
              
              let extractedEmail = emailMatch ? emailMatch[0] : null;
              let extractedPhone = phoneMatch ? phoneMatch[0].trim() : null;
              
              if (!extractedEmail && contactStr.includes('@')) {
                extractedEmail = contactStr;
              }
              
              contactObj = {
                email: extractedEmail || candidate.email || 'No disponible',
                phone: extractedPhone || candidate.phone || candidate.telefono || 'No disponible'
              };
            } else if (typeof candidate.contact === 'object' && candidate.contact !== null) {
              contactObj = candidate.contact;
            } else {
              contactObj = {
                email: candidate.email || 'No disponible',
                phone: candidate.phone || candidate.telefono || 'No disponible'
              };
            }
            
            const email = contactObj.email || candidate.email || 'No disponible';
            const phone = contactObj.phone || candidate.phone || candidate.telefono || 'No disponible';
            const name = candidate.nombre || candidate.name || 'No disponible';
            const score = candidate.puntuacion || candidate.score || 0;
            const details = candidate.detail || candidate.details || candidate.reasoning || candidate.detalles || candidate.descripcion || candidate.description || candidate.detalle || 'No disponibles';
            const whyNotFirst = candidate.why_not_first || candidate.whyNotFirst || candidate.razonNoNumero1 || candidate.razonNoNumeroUno || '';
            const interviewQuestions = Array.isArray(candidate.interview_questions) ? candidate.interview_questions : 
                        Array.isArray(candidate.preguntas) ? candidate.preguntas : 
                        Array.isArray(candidate.questions) ? candidate.questions : 
                        Array.isArray(candidate.preguntasEntrevista) ? candidate.preguntasEntrevista : [];
            
            return {
              name: name,
              score: score,
              contact: {
                email: email,
                phone: phone
              },
              details: details,
              why_not_first: whyNotFirst,
              interview_questions: interviewQuestions,
              nombre: name,
              puntuacion: score,
              email: email,
              telefono: phone,
              detalles: details,
              razonNoNumero1: whyNotFirst,
              preguntas: interviewQuestions
            };
          });
        } else {
          console.warn('⚠️  La respuesta no es un array ni tiene campo candidates.');
          parsedResponse = [];
        }
        
        if (!Array.isArray(parsedResponse)) {
          parsedResponse = [parsedResponse];
        }
        
        if (parsedResponse.length === 0) {
          throw new Error('No se encontraron candidatos en la respuesta del assistant');
        }
        
        res.status(200).json({ 
          files: processedFiles,
          response: parsedResponse
        });
      } else {
        throw new Error(`Tipo de contenido no soportado: ${message.content[0].type}`);
      }

    } catch (error) {
      console.log(`Error: ${error.message}`);
      res.status(500).json({ message: `Error con OpenAI: ${error.message}` });
    }

  } catch (error) {
    logger.error(`Error al procesar archivos: ${error.message}`);
    res.status(500).json({ message: `Error al procesar archivos: ${error.message}` });
  } finally {
    if (uploadedFileIds.length > 0) {
      console.log('🧹 Limpiando archivos subidos a OpenAI...');
      for (const fileId of uploadedFileIds) {
        try {
          await openai.files.delete(fileId);
          console.log(`✅ Archivo eliminado de OpenAI: ${fileId}`);
        } catch (cleanupError) {
          console.warn(`⚠️  No se pudo eliminar archivo ${fileId}:`, cleanupError.message);
        }
      }
    }
    
    if (assistantId) {
      try {
        await openai.beta.assistants.delete(assistantId);
        console.log(`✅ Assistant eliminado: ${assistantId}`);
      } catch (cleanupError) {
        console.warn(`⚠️  No se pudo eliminar assistant ${assistantId}:`, cleanupError.message);
      }
    }
    
    if (vectorStoreId) {
      try {
        const vectorStoresAPI = openai.vectorStores || (openai.beta && openai.beta.vectorStores);
        if (vectorStoresAPI) {
          await vectorStoresAPI.delete(vectorStoreId);
          console.log(`✅ Vector store eliminado: ${vectorStoreId}`);
        }
      } catch (cleanupError) {
        console.warn(`⚠️  No se pudo eliminar vector store ${vectorStoreId}:`, cleanupError.message);
      }
    }
    
    try {
      await fs.rm('uploads/', { recursive: true, force: true });
      console.log('📁 Carpeta uploads limpiada');
      await fs.mkdir('uploads/');
      console.log('📁 Carpeta uploads recreada');
    } catch (error) {
      console.error('Error cleaning up or recreating uploads folder:', error);
    }
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
