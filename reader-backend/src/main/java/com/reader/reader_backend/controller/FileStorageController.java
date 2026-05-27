package com.reader.reader_backend.controller;

import java.io.File;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.reader.reader_backend.model.FileRecord;
import com.reader.reader_backend.repository.DocumentProgressRepository;
import com.reader.reader_backend.repository.FileRecordRepository;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = {"http://localhost:5173", "https://ZCMNQWR.github.io"})
public class FileStorageController {

    private static final Logger logger = LoggerFactory.getLogger(FileStorageController.class);
    // Target our dedicated local storage directory
    private final String STORAGE_DIR = System.getProperty("user.dir") + File.separator + "storage";

    private final FileRecordRepository fileRecordRepository;
    private final DocumentProgressRepository documentProgressRepository;

    @Autowired
    public FileStorageController(FileRecordRepository fileRecordRepository, DocumentProgressRepository documentProgressRepository) {
        this.fileRecordRepository = fileRecordRepository;
        this.documentProgressRepository = documentProgressRepository;
    }

    @GetMapping
    public List<Map<String, String>> listAvailableFiles() {
        List<Map<String, String>> fileList = new ArrayList<>();
        File folder = new File(STORAGE_DIR);

        // Create the directory automatically if it doesn't exist yet
        if (!folder.exists()) {
            folder.mkdirs();
        }

        File[] listOfFiles = folder.listFiles();
        if (listOfFiles != null) {
            for (File file : listOfFiles) {
                if (file.isFile()) {
                    String filename = file.getName();
                    String extension = "";

                    int i = filename.lastIndexOf('.');
                    if (i > 0) {
                        extension = filename.substring(i + 1).toLowerCase();
                    }

                    if (extension.equals("txt") || extension.equals("pdf") || extension.equals("docx") || extension.equals("pptx")) {
                        Map<String, String> fileInfo = new HashMap<>();
                        fileInfo.put("id", filename);
                        fileInfo.put("name", filename);
                        fileInfo.put("type", extension);

                        // filesystem timestamp
                        long epoch = file.lastModified();
                        fileInfo.put("lastModifiedEpoch", String.valueOf(epoch));
                        fileInfo.put("lastModified", java.time.Instant.ofEpochMilli(epoch).toString());

                        // persisted "added to library" timestamp: create record if missing
                        FileRecord record = fileRecordRepository.findById(filename).orElse(null);
                        if (record == null) {
                            long now = System.currentTimeMillis();
                            record = new FileRecord(filename, now);
                            fileRecordRepository.save(record);
                        }

                        if (record.getAddedEpoch() != null) {
                            fileInfo.put("addedEpoch", String.valueOf(record.getAddedEpoch()));
                        }

                        // Include last opened timestamp if we have progress entries
                        documentProgressRepository.findTopByDocumentIdOrderByUpdatedAtDesc(filename).ifPresent(dp -> {
                            if (dp.getUpdatedAt() != null) {
                                long openedEpoch = dp.getUpdatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                                fileInfo.put("lastOpenedEpoch", String.valueOf(openedEpoch));
                                fileInfo.put("lastOpened", Instant.ofEpochMilli(openedEpoch).toString());
                            }
                        });

                        fileList.add(fileInfo);
                    }
                }
            }
        }
        // Sort files by most recent modification first
        fileList.sort((a, b) -> {
            try {
                long ae = Long.parseLong(a.getOrDefault("lastModifiedEpoch", "0"));
                long be = Long.parseLong(b.getOrDefault("lastModifiedEpoch", "0"));
                return Long.compare(be, ae);
            } catch (NumberFormatException ex) {
                return 0;
            }
        });

        return fileList;
    }

    @PostMapping(path = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile multipart) {
        try {
            if (multipart == null || multipart.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            String filename = multipart.getOriginalFilename();
            if (filename == null || filename.isBlank()) {
                return ResponseEntity.badRequest().build();
            }

            File dest = new File(STORAGE_DIR + File.separator + filename);
            // Save the uploaded file to storage directory
            multipart.transferTo(dest.toPath());

            // Ensure a FileRecord exists for this filename
            FileRecord record = fileRecordRepository.findById(filename).orElse(null);
            if (record == null) {
                long now = System.currentTimeMillis();
                record = new FileRecord(filename, now);
                fileRecordRepository.save(record);
            }

            long epoch = dest.lastModified();
            Map<String, String> fileInfo = new HashMap<>();
            fileInfo.put("id", filename);
            fileInfo.put("name", filename);
            String extension = "";
            int i = filename.lastIndexOf('.');
            if (i > 0) extension = filename.substring(i + 1).toLowerCase();
            fileInfo.put("type", extension);
            fileInfo.put("lastModifiedEpoch", String.valueOf(epoch));
            fileInfo.put("lastModified", java.time.Instant.ofEpochMilli(epoch).toString());
            if (record.getAddedEpoch() != null) {
                fileInfo.put("addedEpoch", String.valueOf(record.getAddedEpoch()));
            }

            return ResponseEntity.ok(fileInfo);
        } catch (IOException ex) {
            logger.error("Failed to save uploaded file", ex);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{filename}")
    public ResponseEntity<Void> deleteFile(
            @PathVariable String filename,
            @RequestParam(name = "deleteRelatedData", defaultValue = "true") boolean deleteRelatedData) {
        try {
            // Ensure any percent-encoding is decoded and strip any path components
            String decoded = java.net.URLDecoder.decode(filename, java.nio.charset.StandardCharsets.UTF_8.name());
            // Prevent path traversal by keeping only the file name portion
            String safeName = new java.io.File(decoded).getName();

            File file = new File(STORAGE_DIR + File.separator + safeName);

            if (file.exists() && file.isFile()) {
                if (!file.delete()) {
                    // Log and continue: treat failure to remove filesystem artifact as non-fatal
                    logger.warn("Warning: failed to delete file on disk: {}", file.getAbsolutePath());
                }
            }

            // Remove library metadata and optionally related progress; be idempotent
            fileRecordRepository.deleteById(safeName);
            if (deleteRelatedData) {
                documentProgressRepository.deleteByDocumentId(safeName);
            }

            return ResponseEntity.noContent().build();
        } catch (UnsupportedEncodingException ex) {
            logger.warn("deleteFile decode error", ex);
            return ResponseEntity.badRequest().build();
        } catch (DataAccessException ex) {
            logger.error("deleteFile DB error", ex);
            return ResponseEntity.internalServerError().build();
        } catch (SecurityException ex) {
            logger.warn("deleteFile security error", ex);
            return ResponseEntity.status(403).build();
        } catch (Exception ex) {
            logger.error("deleteFile unexpected error", ex);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            File file = new File(STORAGE_DIR + File.separator + filename);
            Resource resource = new UrlResource(file.toURI());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            // 1. Determine the official Web Content Type based on file extension
            String contentType = "application/octet-stream"; // Default fallback binary type
            String filenameLower = filename.toLowerCase();
            
            if (filenameLower.endsWith(".pdf")) {
                contentType = "application/pdf";
            } else if (filenameLower.endsWith(".docx")) {
                contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else if (filenameLower.endsWith(".pptx")) {
                contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            } else if (filenameLower.endsWith(".txt")) {
                contentType = "text/plain; charset=UTF-8";
            }

            // 2. Return the file stamped with the explicit Content-Type header
            return ResponseEntity.ok()
                    .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .body(resource);

        } catch (IOException e) {
            logger.error("File stream operation failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }
} // <--- Make sure this final closing brace is exactly here at the end of the file!