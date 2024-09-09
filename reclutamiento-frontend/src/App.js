import React, { useState } from 'react';
import axios from 'axios';
import { 
  Button, 
  LinearProgress, 
  Typography, 
  Container, 
  Paper, 
  List, 
  ListItem, 
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { CloudUpload, CheckCircle, Error } from '@mui/icons-material';

function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);

  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Por favor, selecciona al menos un archivo.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      });

      setUploadResults(response.data.files.map(file => ({ ...file, status: 'success' })));
    } catch (error) {
      console.error('Error al subir archivos:', error);
      setUploadResults(files.map(file => ({ filename: file.name, status: 'error' })));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ padding: '2rem', marginTop: '2rem' }}>
        <Typography variant="h4" gutterBottom>
          Carga de Hojas de Vida
        </Typography>
        <input
          accept=".pdf,.doc,.docx"
          style={{ display: 'none' }}
          id="raised-button-file"
          multiple
          type="file"
          onChange={handleFileChange}
        />
        <label htmlFor="raised-button-file">
          <Button variant="contained" color="primary" component="span" startIcon={<CloudUpload />}>
            Seleccionar Archivos
          </Button>
        </label>
        <Typography variant="body1" sx={{ marginTop: '1rem' }}>
          {files.length > 0 ? `${files.length} archivo(s) seleccionado(s)` : 'Ningún archivo seleccionado'}
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          sx={{ marginTop: '1rem' }}
        >
          Subir Archivos
        </Button>
        {uploading && (
          <div style={{ marginTop: '1rem' }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="body2" color="text.secondary">{`${uploadProgress}%`}</Typography>
          </div>
        )}
        {uploadResults.length > 0 && (
          <List>
            {uploadResults.map((file, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {file.status === 'success' ? <CheckCircle color="primary" /> : <Error color="error" />}
                </ListItemIcon>
                <ListItemText 
                  primary={file.filename} 
                  secondary={file.status === 'success' ? 'Subido exitosamente' : 'Error al subir'}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
}

export default App;
