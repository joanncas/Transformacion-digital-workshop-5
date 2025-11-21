# Workshop 5:

FrontEnd Job Description
```
We are seeking an exceptional Full Stack Engineer to ensure that our applications are robust, scalable and efficient, working closely with multidisciplinary teams to define, design and launch new features.
Responsibilities:
Develop and maintain robust, scalable, and high-performance application using ReactJS for the frontend and NestJS for the backend.
Collaborate with cross-functional teams to define, design, and ship new features.
Write clean, maintainable, and efficient code.
Conduct code reviews and provide constructive feedback.
Optimize the application for maximum speed and scalability.
Stay updated with emerging technologies and industry trends, applying best practices to improve the development process.
Requirements (Skills & Experience):
5+ years of engineering experience, 3+ years of full stack.
Deep expertise with React & NestJS.
Experience with GraphQL & REST.
Experience with PostgreSQL.
Excellent communication skills and the ability to work effectively in a team environment.
English level: C1
```

## Requerimientos:
- [docs/README.md](./docs/README.md)

# Recruitment Document Upload System

This project consists of a React frontend and a Node.js backend, allowing users to upload and manage recruitment documents.

## Project Structure

- `reclutamiento-frontend/`: React application for the user interface
- `reclutamiento-backend/`: Node.js server for handling file uploads and storage

## Prerequisites

- Node.js (v14 or later recommended)
- npm (usually comes with Node.js)

## Setup and Running

### Backend

1. Navigate to the backend directory:
   ```
   cd reclutamiento-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the backend directory and set your environment variables:
   ```
   PORT=5000
   OPENAI_API_KEY=tu_api_key_de_openai_aqui
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_TEMPERATURE=0.2
   ```
   
   **Importante**: 
   - Necesitas obtener una API key de OpenAI desde https://platform.openai.com/api-keys y agregarla al archivo `.env`. Sin esta clave, la aplicación no funcionará correctamente.
   - **Modelos disponibles**: 
     - `gpt-4o-mini` (recomendado, económico y rápido)
     - `gpt-4o` (mejor calidad, más caro)
     - `gpt-4-turbo` (balance calidad/precio)
   - **Temperatura recomendada**:
     - `0.1-0.3` para análisis y ranking (más consistente y preciso)
     - `0.5-0.7` para análisis más creativo o flexible
     - `0.2` es el valor por defecto recomendado para este caso de uso

4. Start the backend server:
   ```
   npm start
   ```

   The backend should now be running on `http://localhost:5000`.

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
2. Use the file input to upload recruitment documents (PDF, DOC, or DOCX).
3. View the list of uploaded documents on the page.

## Features

- File upload with size and type restrictions
- Server-side logging of upload activities
- Cross-Origin Resource Sharing (CORS) enabled
- Error handling for both client and server

## Development

- Frontend code is located in the `frontend/src` directory.
- Backend code is in `reclutamiento-backend/server.js`.

## API Endpoints

- `POST /upload`: Uploads one or more files (max 10) to the server.

## Troubleshooting

If you encounter any issues:

1. Ensure all dependencies are installed in both frontend and backend.
2. Check that the backend URL in the frontend code matches your backend server address.
3. Verify that the `uploads` directory exists in the backend folder.
4. Check the `error.log` and `combined.log` files in the backend directory for any server-side errors.
5. Clear your browser cache or try in an incognito/private window.

## Notes

- The maximum file size for uploads is set to 5MB.
- Only PDF, DOC, and DOCX file types are allowed.
- Ensure both frontend and backend are running simultaneously for full functionality.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
