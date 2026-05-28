# 📚 SNOD: Sync Notes on Documents

Welcome to **SNOD** (Sync Notes on Documents) — a comprehensive document reader and annotation platform. SNOD allows users to upload, read, and annotate their documents across multiple formats while keeping their reading progress and notes seamlessly synchronized in the cloud.

🌍 **Live Demo:** [https://zcmnqwr.github.io/SNOD](https://zcmnqwr.github.io/SNOD)

## ✨ Features

* **Multi-Format Document Viewer**: Natively read PDF, DOCX, and plain text (TXT) files right in your browser.
* **Highlighting & Annotations**: Select text to create custom highlights. Attach detailed comments and notes to specific sections of your documents.
* **Cloud Synchronization**: All documents, notes, highlights, and reading progress are synced automatically to your account.
* **Library Management**: Easily upload new files, search through your existing library, and manage your documents.
* **Dynamic Reading Modes**: Seamlessly switch between Single-Page View and Continuous Scroll View.
* **Secure Authentication**: Built-in user registration and sign-in to keep your personal library and notes secure.

## 🛠️ Tech Stack

* **Frontend (`/reader-web`)**:
  * React, TypeScript, Vite
  * Integrations: `react-pdf` (PDF rendering), `docx-preview` (Word documents), `axios` (API requests).
* **Backend (`/reader-backend`)**:
  * Java, Spring Boot
  * Security: Spring Security with JWT/Custom Token Authentication.
  * Database: PostgreSQL (via Spring Data JPA) / H2 for local development.

##  License

This project is licensed under the MIT License.