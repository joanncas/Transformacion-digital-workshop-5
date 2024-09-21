import React, { useState } from 'react';
import axios from 'axios';
import { 
  Button, 
  LinearProgress, 
  Typography, 
  Container, 
  Paper, 
  Box,
  Chip,
  Divider,
  ThemeProvider,
  createTheme,
  TextField,
  Card,
  Grid,
  CardContent,
  CardHeader,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Create a custom theme with blue and white colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(4),
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
}));

function App() {
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [assistantResponse, setAssistantResponse] = useState([]);

  const handleFolderChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    if (selectedFiles.length > 0) {
      setFolderPath(selectedFiles[0].webkitRelativePath.split('/')[0]);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setErrorMessage('No se han seleccionado archivos.');
      return;
    }

    if (!jobDescription.trim()) {
      setErrorMessage('Por favor, ingrese una descripción del trabajo.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);
    setErrorMessage('');
    setAssistantResponse([]);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('jobDescription', jobDescription);

    try {
      const response = await axios.post('http://localhost:5000/process-folder', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      // Parse the response to an array of candidates
      setAssistantResponse(response.data.response);
    } catch (error) {
      console.error('Error al procesar archivos:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'Error desconocido al procesar archivos');
      setUploadResults(files.map(file => ({ filename: file.name, status: 'error' })));
    } finally {
      setUploading(false);
    }
  };

  const renderAssistantResponse = () => {
    if (!assistantResponse || assistantResponse.length === 0) return null;

    return (
      <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Respuesta del Asistente:</Typography>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: 2
      }}>
        {assistantResponse.map((candidate, index) => (
          <Card key={index}>
            <CardHeader title={candidate.name} />
            <CardContent>
              {Object.entries(candidate.contact_data).map(([key, value]) => (
                <Typography key={key} variant="body2" sx={{ mb: 1 }}>
                  <strong>{key}:</strong> {value}
                </Typography>
              ))}
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Puntuación:</strong> {candidate.score}
              </Typography>
              <Typography variant="body2">
                <strong>Detalles:</strong> {candidate.details}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md">
        <StyledPaper elevation={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" component="h1" sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 'bold' }}>
              Analizador hojas de vida
            </Typography>
          </Box>
          <Divider sx={{ my: 3 }} />
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            label="Descripción del trabajo"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <input
              accept=".pdf,.doc,.docx"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              webkitdirectory=""
              directory=""
              onChange={handleFolderChange}
            />
            <label htmlFor="raised-button-file">
              <Button 
                variant="contained" 
                color="primary" 
                component="span" 
                startIcon={<CloudUpload />}
                sx={{ py: 1.5, px: 4, borderRadius: 2 }}
              >
                Seleccionar Carpeta
              </Button>
            </label>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              {files.length} archivo(s) seleccionado(s)
            </Typography>
          </Box>
          {files.length > 0 && (
            <Box sx={{ mb: 3 }}>
              {files.map((file, index) => (
                <Chip
                  key={index}
                  label={`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`}
                  sx={{ mr: 1, mb: 1, bgcolor: 'primary.light', color: 'white', fontWeight: 'medium' }}
                />
              ))}
            </Box>
          )}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || !jobDescription.trim()}
            sx={{ mt: 2, py: 1.5, px: 4, borderRadius: 2 }}
          >
            Procesar Hojas de Vida
          </Button>
          {uploading && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress variant="determinate" value={uploadProgress} color="primary" sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                {`${uploadProgress}%`}
              </Typography>
            </Box>
          )}
          {renderAssistantResponse()}
          {errorMessage && (
            <Typography color="error" sx={{ mt: 2 }}>
              {errorMessage}
            </Typography>
          )}
        </StyledPaper>
      </Container>
    </ThemeProvider>
  );
}

export default App;
