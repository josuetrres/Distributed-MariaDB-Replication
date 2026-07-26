package com.banco.acid.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MetricasInnodbDTO {

    private String lsnSequenceNumber;
    private String logFlushedUpTo;
    private String lastCheckpointAt;
    private String pendingLogWrites;
    private String bufferPoolHitRate;
    private String statusRaw;
}
