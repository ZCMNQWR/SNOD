package com.reader.reader_backend.repository;

import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.reader.reader_backend.model.DocumentProgress;

@Repository
public interface DocumentProgressRepository extends JpaRepository<DocumentProgress, Long> {
    Optional<DocumentProgress> findByUserIdAndDocumentId(String userId, String documentId);
    Optional<DocumentProgress> findTopByDocumentIdOrderByUpdatedAtDesc(String documentId);
    @Query("select d from DocumentProgress d where d.userId = :userId")
    List<DocumentProgress> findAllByUserId(@Param("userId") String userId);
    void deleteByDocumentId(String documentId);
}