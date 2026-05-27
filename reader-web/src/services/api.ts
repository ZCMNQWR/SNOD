import axios from 'axios';

// Use an environment variable for the backend URL, falling back to localhost for local development
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const PROGRESS_API_URL = `${BACKEND_URL}/api/progress`;

// Attach the Google OAuth JWT for ALL requests so we can access our private library
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('OAUTH_TOKEN');
  if (token) {
    config.headers.set('Authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      alert('Unauthorized: Your session expired or you used the wrong Google account.');
      localStorage.removeItem('OAUTH_TOKEN');
    }
    return Promise.reject(error);
  }
);

// This defines the structure of data React expects to send/receive
export interface DocumentProgress {
  id?: number;
  userId: string;
  documentId: string;
  documentType: string;
  currentPage: number;
  syncDataJson: string;
}

// 1. Send your current reading page and comments to Spring Boot
export const saveProgress = async (progress: DocumentProgress) => {
  try {
    const response = await axios.post(PROGRESS_API_URL, progress);
    // saveProgress response handled by caller
    return response.data;
  } catch (error) {
    console.error("Failed to connect to the Spring Boot server:", error);
    throw error;
  }
};

// 2. Load the saved reading progress from Spring Boot
export const getProgress = async (userId: string, documentId: string) => {
  try {
    const response = await axios.get(`${PROGRESS_API_URL}/${userId}/${documentId}`);
    return response.data;
  } catch (error) {
    // If the database has never seen this document before, it returns a 404 error.
    // We catch that safely and return null so our app knows to start at page 1.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error("Failed to fetch progress from Spring Boot server:", error);
    throw error;
  }
};

// Fetch the dynamic array of available files from the backend storage directory
export interface AvailableFile {
  id: string;
  name: string;
  type: string;
  totalPages?: number;
  lastModified?: string;
  lastModifiedEpoch?: number;
  lastOpened?: string;
  lastOpenedEpoch?: number;
  addedEpoch?: number;
}

export async function getAvailableFiles(): Promise<AvailableFile[]> {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/files`);
    return response.data;
  } catch (error) {
    console.error("Error mapping backend storage dir", error);
    return [];
  }
}

export async function uploadFile(file: File): Promise<AvailableFile> {
  try {
    const form = new FormData();
    form.append('file', file);
    const response = await axios.post(`${BACKEND_URL}/api/files/upload`, form);
    return response.data;
  } catch (err) {
    console.error('Upload failed', err);
    throw err;
  }
}

export async function removeFile(filename: string, deleteRelatedData = true): Promise<void> {
  try {
    await axios.delete(`${BACKEND_URL}/api/files/${encodeURIComponent(filename)}`, {
      params: { deleteRelatedData },
    });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return;
    }
    console.error('Delete failed', err);
    throw err;
  }
}

// Helper to get the absolute streaming URL for a specific file
export function getFileStreamUrl(filename: string): string {
  return `${BACKEND_URL}/api/files/download/${filename}`;
}