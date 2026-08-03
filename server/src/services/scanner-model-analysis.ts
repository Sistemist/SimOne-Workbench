import {
  scannerModelAnalysisResponseSchema,
  type ScannerModelAnalysisRequest,
  type ScannerModelAnalysisResponse,
} from "@paperclipai/shared";

export interface ScannerModelAnalyzer {
  analyze(input: ScannerModelAnalysisRequest): Promise<ScannerModelAnalysisResponse>;
}

export async function runScannerModelAnalysis(
  analyzer: ScannerModelAnalyzer,
  input: ScannerModelAnalysisRequest,
) {
  return scannerModelAnalysisResponseSchema.parse(await analyzer.analyze(input));
}
