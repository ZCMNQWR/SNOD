package com.reader.reader_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.reader.reader_backend.model.FileRecord;

@Repository
public interface FileRecordRepository extends JpaRepository<FileRecord, String> {

}
