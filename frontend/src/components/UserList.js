import React, { useContext } from 'react';
import { UserContext } from '../context/UserContext';

function UserList() {
  const { resumes, uploadResume } = useContext(UserContext);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadResume(file);
    }
  };

  return (
    <div>
      <h2>User Documents</h2>
      <div>
        <h3>Upload Document</h3>
        <input type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
      </div>
      {resumes.length > 0 ? (
        <ul>
          {resumes.map((resume, index) => (
            <li key={index}>{resume.name} - Uploaded: {new Date(resume.uploadDate).toLocaleString()}</li>
          ))}
        </ul>
      ) : (
        <p>No documents uploaded yet.</p>
      )}
    </div>
  );
}

export default UserList;
