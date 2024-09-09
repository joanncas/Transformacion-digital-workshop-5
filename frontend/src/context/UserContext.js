import React, { createContext, useState } from 'react';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [resumes, setResumes] = useState([]);

  const uploadResume = (file) => {
    const newResume = { name: file.name, uploadDate: new Date().toISOString() };
    setResumes(prevResumes => [...prevResumes, newResume]);
  };

  return (
    <UserContext.Provider value={{ resumes, uploadResume }}>
      {children}
    </UserContext.Provider>
  );
};
