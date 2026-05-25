import axios from 'axios';

// This matches the exact address where your Spring Boot backend is listening
const API_BASE_URL = 'http://localhost:8080/api/progress';

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
    const response = await axios.post(API_BASE_URL, progress);
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
    const response = await axios.get(`${API_BASE_URL}/${userId}/${documentId}`);
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
    const response = await axios.get('http://localhost:8080/api/files');
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
    const response = await axios.post('http://localhost:8080/api/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } catch (err) {
    console.error('Upload failed', err);
    throw err;
  }
}

export async function removeFile(filename: string, deleteRelatedData = true): Promise<void> {
  try {
    await axios.delete(`http://localhost:8080/api/files/${encodeURIComponent(filename)}`, {
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
  return `http://localhost:8080/api/files/download/${filename}`;
}