import React from 'react';
import UserList from '../components/UserList';
import ResumeUpload from '../components/ResumeUpload';

function Users() {
  return (
    <div>
      <h1>Users</h1>
      <ResumeUpload />
      <UserList />
    </div>
  );
}

export default Users;
