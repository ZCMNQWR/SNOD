package com.reader.reader_backend.controller; // Updated for your folder structure

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.reader.reader_backend.model.DocumentProgress;
import com.reader.reader_backend.repository.DocumentProgressRepository;

@RestController
@RequestMapping("/api/progress")
@CrossOrigin(origins = {"http://localhost:5173", "https://ZCMNQWR.github.io"})
public class DocumentController {

    private static final Logger logger = LoggerFactory.getLogger(DocumentController.class);

    private final DocumentProgressRepository repository;

    public DocumentController(DocumentProgressRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    public ResponseEntity<DocumentProgress> saveOrUpdateProgress(@RequestBody DocumentProgress incomingProgress) {
        logger.info("saveOrUpdateProgress called: user={} document={} type={} page={}", incomingProgress.getUserId(), incomingProgress.getDocumentId(), incomingProgress.getDocumentType(), incomingProgress.getCurrentPage());
        Optional<DocumentProgress> existingProgress = repository.findByUserIdAndDocumentId(
                incomingProgress.getUserId(), 
                incomingProgress.getDocumentId()
        );

        DocumentProgress progressToSave;
        if (existingProgress.isPresent()) {
            progressToSave = existingProgress.get();
            progressToSave.setCurrentPage(incomingProgress.getCurrentPage());
            progressToSave.setSyncDataJson(incomingProgress.getSyncDataJson());
            progressToSave.setDocumentType(incomingProgress.getDocumentType());
        } else {
            progressToSave = incomingProgress;
        }

        return ResponseEntity.ok(repository.save(progressToSave));
    }

    @GetMapping("/{userId}/{documentId}")
    public ResponseEntity<DocumentProgress> getProgress(@PathVariable String userId, @PathVariable String documentId) {
        Optional<DocumentProgress> found = repository.findByUserIdAndDocumentId(userId, documentId);
        if (found.isPresent()) {
            DocumentProgress dp = found.get();
            logger.info("getProgress: user={} document={} page={}", userId, documentId, dp.getCurrentPage());
            return ResponseEntity.ok(dp);
        }
        logger.info("getProgress: not found for user={} document={}", userId, documentId);
        return ResponseEntity.notFound().build();
    }
}