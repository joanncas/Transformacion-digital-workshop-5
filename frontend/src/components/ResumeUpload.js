import React, { useState } from 'react';

function ResumeUpload() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
    setError(null);
    setUploadSummary(null);
  };

  const handleUpload = async () => {
    setProgress(0);
    setUploadSummary(null);
    setError(null);

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadSummary({
        totalFiles: result.files.length,
        successfulUploads: result.files.length,
        failedUploads: 0
      });
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="resume-upload">
      <h2>Upload Resumes</h2>
      <input 
        type="file" 
        multiple 
        accept=".pdf,.doc,.docx" 
        onChange={handleFileChange} 
      />
      <button onClick={handleUpload} disabled={files.length === 0}>
        Upload
      </button>
      {progress > 0 && (
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      {uploadSummary && (
        <div className="upload-summary">
          <h3>Upload Summary</h3>
          <p>Total files: {uploadSummary.totalFiles}</p>
          <p>Successful uploads: {uploadSummary.successfulUploads}</p>
          <p>Failed uploads: {uploadSummary.failedUploads}</p>
        </div>
      )}
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
}

export default ResumeUpload;
