# Workshop 5:
## Requerimientos:
- [docs/README.md](./docs/README.md)

# Document Upload System

This project consists of a React frontend and a backend server, allowing users to upload and view documents.

## Prerequisites

- Node.js (v14 or later recommended)
- npm (usually comes with Node.js)

## Setup

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the backend server:
   ```
   npm start
   ```

   The backend should now be running on `http://localhost:4000` (or your configured port).

### Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the React development server:
   ```
   npm start
   ```

   The frontend should now be running on `http://localhost:3000`.

## Usage

1. Open your browser and go to `http://localhost:3000`.
2. Use the file input to upload documents.
3. View the list of uploaded documents on the page.

## Development

- Frontend code is located in the `frontend` directory.
- Backend code is located in the `backend` directory.

## Notes

- Ensure both frontend and backend are running simultaneously for full functionality.
- The backend server must be running for document uploads to work.

## Troubleshooting

If you encounter any issues:
1. Ensure all dependencies are installed in both frontend and backend.
2. Check that the backend URL in the frontend code matches your backend server address.
3. Clear your browser cache or try in an incognito/private window.
