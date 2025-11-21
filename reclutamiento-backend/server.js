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
  
  // Verify the client is properly initialized
  if (!openai) {
    throw new Error('El objeto OpenAI es null o undefined');
  }
  
  // Debug: Log the structure of the client
  console.log('   Cliente OpenAI creado. Verificando estructura...');
  console.log('   - openai existe:', !!openai);
  console.log('   - openai.beta existe:', !!openai.beta);
  console.log('   - openai.files existe:', !!openai.files);
  console.log('   - openai.vectorStores existe:', !!openai.vectorStores);
  console.log('   - openai.beta.vectorStores existe:', !!(openai.beta && openai.beta.vectorStores));
  console.log('   - openai.beta.assistants existe:', !!(openai.beta && openai.beta.assistants));
  console.log('   - openai.beta.threads existe:', !!(openai.beta && openai.beta.threads));
  
  // Check if beta exists, if not, it might be a version issue
  let openaiVersion = 'desconocida';
  try {
    const fs = require('fs');
    const path = require('path');
    const packagePath = path.join(__dirname, 'node_modules', 'openai', 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    openaiVersion = packageData.version;
  } catch (e) {
    // Ignore if we can't read the version
  }
  
  if (!openai.beta) {
    console.error('\n⚠️  ADVERTENCIA: La propiedad "beta" no está disponible.');
    console.error('   Esto puede indicar un problema con la versión del SDK.');
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
  
  // Check for vectorStores in both locations (newer versions have it at root level)
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
  // Track uploaded files for cleanup (declared at function scope for finally block)
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
      // Validate OpenAI client is available
      if (!openai) {
        throw new Error('OpenAI client no está inicializado. El servidor debe reiniciarse después de configurar OPENAI_API_KEY.');
      }
      
      if (!openai.beta) {
        console.error('Error: openai.beta no está disponible');
        console.error('Estructura del cliente:', Object.keys(openai));
        let version = 'desconocida';
        try {
          version = require('openai/package.json')?.version || 'desconocida';
        } catch (e) {
          // Ignore
        }
        throw new Error(`La propiedad "beta" no está disponible en el cliente OpenAI. Esto puede indicar un problema con la versión del SDK. Versión instalada: ${version}`);
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

      // Create vector store if the API is available, otherwise use file_ids directly
      // In SDK v6.9.1, vectorStores is at openai.vectorStores, not openai.beta.vectorStores
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
          
          // Add files to vector store
          if (vectorStoresAPI.files) {
            for (const fileId of uploadedFiles) {
              await vectorStoresAPI.files.create(vectorStoreId, {
                file_id: fileId
              });
            }
            console.log('✅ Archivos agregados al vector store');
          } else if (vectorStoresAPI.fileBatches) {
            // Use fileBatches if available
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

      console.log(`Archivos subidos exitosamente`);

      // Create or update the assistant
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
          temperature: 0.2
        };

      // Configure tool_resources based on what's available
      if (vectorStoreId) {
        assistantConfig.tool_resources = {
          file_search: { vector_store_ids: [vectorStoreId] }
        };
      } else {
        // Fallback: use file_ids directly (may not work with file_search, but worth trying)
        assistantConfig.tool_resources = {
          file_search: { file_ids: uploadedFiles }
        };
      }

      const assistant = await openai.beta.assistants.create(assistantConfig);
      assistantId = assistant.id;
      console.log(`✅ Assistant creado: ${assistant.id}`);

      console.log(assistant);

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
          "detail": string,  // explicación extensa en ESPAÑOL
          "why_not_first": string, // explicación en ESPAÑOL de por qué no es el #1
          "interview_questions": [string] // preguntas en ESPAÑOL para validar por qué no es el #1
        }
        
        Rules:
        - Respond ONLY with valid JSON. No extra text.
        - "detail", "why_not_first" and "interview_questions" MUST be in Spanish.
        `
          }
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
      
      if (!message || !message.content || message.content.length === 0) {
        throw new Error('No se recibió respuesta del assistant');
      }
      
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
      
        // Extract and parse JSON response
        let responseText = text.value.trim();
        console.log('📄 Respuesta cruda del assistant (primeros 500 caracteres):', responseText.substring(0, 500));
        
        // Try to extract JSON from markdown code blocks
        let jsonResponse = responseText;
        
        // Remove markdown code blocks if present
        jsonResponse = jsonResponse.replace(/```json\n?/g, '');
        jsonResponse = jsonResponse.replace(/```\n?/g, '');
        jsonResponse = jsonResponse.trim();
        
        // Try to find JSON array or object in the response
        // First try to find a complete JSON array - use non-greedy match to find the full array
        let jsonMatch = null;
        let startPos = jsonResponse.indexOf('[');
        if (startPos !== -1) {
          // Find the matching closing bracket
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
        
        // If no array found, try to find a JSON object
        if (!jsonMatch) {
          let startPos = jsonResponse.indexOf('{');
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
        
        // Log the extracted JSON length for debugging
        if (jsonMatch) {
          console.log('📏 Longitud del JSON extraído:', jsonResponse.length, 'caracteres');
          console.log('📏 Últimos 200 caracteres del JSON:', jsonResponse.substring(Math.max(0, jsonResponse.length - 200)));
        }
        
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(jsonResponse);
          console.log('✅ JSON parseado correctamente');
          // Debug: Check structure after parsing
          console.log('🔍 Tipo de respuesta parseada:', Array.isArray(parsedResponse) ? 'Array' : typeof parsedResponse);
          if (Array.isArray(parsedResponse) && parsedResponse.length > 0) {
            const firstElement = parsedResponse[0];
            console.log('🔍 Primer elemento del array:', typeof firstElement);
            console.log('🔍 Campos del primer elemento:', typeof firstElement === 'object' ? Object.keys(firstElement) : 'N/A');
            // Check if it's an array containing objects with "candidates" property
            if (typeof firstElement === 'object' && firstElement.candidates) {
              console.log('🔍 Primer elemento tiene campo "candidates" con', firstElement.candidates.length, 'elementos');
              if (firstElement.candidates.length > 0) {
                const firstCandidate = firstElement.candidates[0];
                console.log('🔍 Primer candidato real:', Object.keys(firstCandidate));
                console.log('🔍 Valor de detail/details:', (firstCandidate.detail || firstCandidate.details) ? (firstCandidate.detail || firstCandidate.details).substring(0, 100) + '...' : 'undefined o null');
                console.log('🔍 Tipo de contact:', typeof firstCandidate.contact);
              }
            } else {
              // It's a direct array of candidates
              console.log('🔍 Array directo de candidatos');
              console.log('🔍 Campos del primer candidato:', Object.keys(firstElement));
            }
          } else if (parsedResponse && typeof parsedResponse === 'object') {
            console.log('🔍 Estructura del objeto:', Object.keys(parsedResponse));
            if (parsedResponse.candidates) {
              console.log('🔍 Campo "candidates" encontrado con', parsedResponse.candidates.length, 'elementos');
            }
          }
        } catch (parseError) {
          console.error('❌ Error al parsear JSON:', parseError.message);
          console.error('JSON que falló (primeros 1500 caracteres):', jsonResponse.substring(0, 1500));
          // Try to extract at least partial data
          try {
            // Try to find individual candidate objects
            const candidateMatches = jsonResponse.match(/\{[^}]*"name"[^}]*\}/g);
            if (candidateMatches && candidateMatches.length > 0) {
              console.log('⚠️  Intentando parsear candidatos individuales...');
              parsedResponse = candidateMatches.map(match => {
                try {
                  return JSON.parse(match);
                } catch (e) {
                  return null;
                }
              }).filter(c => c !== null);
              console.log(`✅ Se extrajeron ${parsedResponse.length} candidatos parcialmente`);
            } else {
              throw parseError;
            }
          } catch (fallbackError) {
            throw new Error(`Error al parsear la respuesta JSON del assistant: ${parseError.message}. Respuesta recibida: ${jsonResponse.substring(0, 500)}...`);
          }
        }
        
        // Normalize the response structure to match frontend expectations
        // Frontend expects: name, score, contact {email, phone}, details, interview_questions
        // New prompt returns: { "candidates": [...] } with contact as string and "detail" (singular)
        // But sometimes it's wrapped in an array: [{ "candidates": [...] }]
        
        // First, extract candidates array if it's nested in an object
        let candidatesArray = null;
        if (Array.isArray(parsedResponse)) {
          // Check if it's an array of objects with "candidates" property
          if (parsedResponse.length > 0 && typeof parsedResponse[0] === 'object' && parsedResponse[0].candidates) {
            // Handle case: [{ "candidates": [...] }]
            candidatesArray = parsedResponse[0].candidates || parsedResponse[0].candidatos || null;
            // If first element has candidates, check if others do too and merge them
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
            // It's a direct array of candidates
            candidatesArray = parsedResponse;
          }
        } else if (parsedResponse && typeof parsedResponse === 'object') {
          // Handle new format: { "candidates": [...] }
          candidatesArray = parsedResponse.candidates || parsedResponse.candidatos || null;
          if (!candidatesArray && !Array.isArray(parsedResponse)) {
            // If it's an object but no candidates key, try to use it as a single candidate
            candidatesArray = [parsedResponse];
          }
        }
        
        if (candidatesArray && Array.isArray(candidatesArray)) {
          parsedResponse = candidatesArray.map(candidate => {
            // Handle contact - can be string or object
            let contactObj = {};
            if (typeof candidate.contact === 'string') {
              // If contact is a string, try to extract email and phone
              const contactStr = candidate.contact.trim();
              // Try to find email
              const emailMatch = contactStr.match(/[\w\.-]+@[\w\.-]+\.\w+/);
              // Try to find phone (look for patterns like +51 934 685 890, +1234567890, etc.)
              // More flexible phone regex that handles international formats
              // Look for phone patterns: + followed by digits, or digits with spaces/dashes
              const phoneMatch = contactStr.match(/(\+?\d{1,4}[\s\-]?)?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9}/);
              
              let extractedEmail = emailMatch ? emailMatch[0] : null;
              let extractedPhone = phoneMatch ? phoneMatch[0].trim() : null;
              
              // If contact string is just an email (no phone found), use it as email
              if (!extractedEmail && contactStr.includes('@')) {
                extractedEmail = contactStr;
              }
              
              contactObj = {
                email: extractedEmail || candidate.email || 'No disponible',
                phone: extractedPhone || candidate.phone || candidate.telefono || 'No disponible'
              };
              
              console.log('📞 Contact string parseado:', contactStr, '->', contactObj);
            } else if (typeof candidate.contact === 'object' && candidate.contact !== null) {
              // If contact is already an object
              contactObj = candidate.contact;
            } else {
              // Fallback to individual fields
              contactObj = {
                email: candidate.email || 'No disponible',
                phone: candidate.phone || candidate.telefono || 'No disponible'
              };
            }
            
            const email = contactObj.email || candidate.email || 'No disponible';
            const phone = contactObj.phone || candidate.phone || candidate.telefono || 'No disponible';
            
            // Get name from various possible fields
            const name = candidate.nombre || candidate.name || 'No disponible';
            
            // Get score from various possible fields
            const score = candidate.puntuacion || candidate.score || 0;
            
            // Get details - new prompt uses "detail" (singular), also check "details" (plural)
            const details = candidate.detail || candidate.details || candidate.reasoning || candidate.detalles || candidate.descripcion || candidate.description || candidate.detalle || 'No disponibles';
            
            // Get why_not_first (new field from prompt)
            const whyNotFirst = candidate.why_not_first || candidate.whyNotFirst || candidate.razonNoNumero1 || candidate.razonNoNumeroUno || '';
            
            // Get interview questions from various possible fields
            const interviewQuestions = Array.isArray(candidate.interview_questions) ? candidate.interview_questions : 
                        Array.isArray(candidate.preguntas) ? candidate.preguntas : 
                        Array.isArray(candidate.questions) ? candidate.questions : 
                        Array.isArray(candidate.preguntasEntrevista) ? candidate.preguntasEntrevista : [];
            
            // Return in format expected by frontend
            return {
              name: name,
              score: score,
              contact: {
                email: email,
                phone: phone
              },
              details: details,
              why_not_first: whyNotFirst, // Include new field
              interview_questions: interviewQuestions,
              // Also include Spanish fields for backward compatibility
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
          // If we still don't have an array, log a warning
          console.warn('⚠️  La respuesta no es un array ni tiene campo candidates. Tipo:', typeof parsedResponse);
          console.warn('⚠️  Estructura recibida:', JSON.stringify(parsedResponse, null, 2).substring(0, 500));
          parsedResponse = [];
        }
        
        console.log('📊 Respuesta procesada (primer candidato):', JSON.stringify(parsedResponse[0] || parsedResponse, null, 2));
        console.log('📊 Total de candidatos:', Array.isArray(parsedResponse) ? parsedResponse.length : 0);
        console.log('📚 Citas:', citations.join("\n"));
        
        // Ensure we're sending an array
        if (!Array.isArray(parsedResponse)) {
          console.warn('⚠️  La respuesta no es un array, convirtiendo...');
          parsedResponse = [parsedResponse];
        }
        
        // Validate that we have valid data
        if (parsedResponse.length === 0) {
          console.error('❌ No se encontraron candidatos en la respuesta');
          throw new Error('No se encontraron candidatos en la respuesta del assistant');
        }
        
        // Log first candidate structure for debugging
        const firstCandidate = parsedResponse[0];
        console.log('🔍 Estructura del primer candidato:');
        console.log('  - name:', firstCandidate.name);
        console.log('  - score:', firstCandidate.score);
        console.log('  - contact:', firstCandidate.contact);
        console.log('  - details:', firstCandidate.details ? firstCandidate.details.substring(0, 100) + '...' : 'No disponible');
        console.log('  - interview_questions:', Array.isArray(firstCandidate.interview_questions) ? firstCandidate.interview_questions.length : 'No es array');
        
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
    // Cleanup: Delete uploaded files from OpenAI
    if (uploadedFileIds.length > 0) {
      console.log('🧹 Limpiando archivos subidos a OpenAI...');
      for (const fileId of uploadedFileIds) {
        try {
          // In SDK v6.9.1, use delete() instead of del()
          await openai.files.delete(fileId);
          console.log(`✅ Archivo eliminado de OpenAI: ${fileId}`);
        } catch (cleanupError) {
          console.warn(`⚠️  No se pudo eliminar archivo ${fileId}:`, cleanupError.message);
        }
      }
    }
    
    // Cleanup: Delete assistant if created
    if (assistantId) {
      try {
        // In SDK v6.9.1, use delete() instead of del()
        await openai.beta.assistants.delete(assistantId);
        console.log(`✅ Assistant eliminado: ${assistantId}`);
      } catch (cleanupError) {
        console.warn(`⚠️  No se pudo eliminar assistant ${assistantId}:`, cleanupError.message);
      }
    }
    
    // Cleanup: Delete vector store if created
    if (vectorStoreId) {
      try {
        const vectorStoresAPI = openai.vectorStores || (openai.beta && openai.beta.vectorStores);
        if (vectorStoresAPI) {
          // In SDK v6.9.1, use delete() instead of del()
          await vectorStoresAPI.delete(vectorStoreId);
          console.log(`✅ Vector store eliminado: ${vectorStoreId}`);
        }
      } catch (cleanupError) {
        console.warn(`⚠️  No se pudo eliminar vector store ${vectorStoreId}:`, cleanupError.message);
      }
    }
    
    // Ensure the uploads folder is recreated for future operations
    try {
      // Use fs.rm instead of fs.rmdir (deprecated)
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
