package com.reader.reader_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "file_record")
public class FileRecord {

    @Id
    @Column(name = "id", nullable = false)
    private String id; // filename

    @Column(name = "added_epoch")
    private Long addedEpoch;

    public FileRecord() {}

    public FileRecord(String id, Long addedEpoch) {
        this.id = id;
        this.addedEpoch = addedEpoch;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Long getAddedEpoch() {
        return addedEpoch;
    }

    public void setAddedEpoch(Long addedEpoch) {
        this.addedEpoch = addedEpoch;
    }
}
