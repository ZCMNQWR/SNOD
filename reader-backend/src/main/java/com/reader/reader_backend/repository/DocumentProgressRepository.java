package com.reader.reader_backend.repository; // Updated for your folder structure

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.reader.reader_backend.model.DocumentProgress;

@Repository
public interface DocumentProgressRepository extends JpaRepository<DocumentProgress, Long> {
    Optional<DocumentProgress> findByUserIdAndDocumentId(String userId, String documentId);
    Optional<DocumentProgress> findTopByDocumentIdOrderByUpdatedAtDesc(String documentId);
    void deleteByDocumentId(String documentId);
}