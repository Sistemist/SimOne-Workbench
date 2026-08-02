export interface CanonQuery {
  query: string;
  topK: number;
  scoreThreshold: number | null;
}

export interface CanonPassage {
  title: string;
  url: string | null;
  content: string;
  score: number | null;
  documentId: string;
  chunkId: string;
}

export interface CanonQueryResult {
  query: string;
  passages: CanonPassage[];
}

export interface CanonRetriever {
  query(input: CanonQuery): Promise<CanonQueryResult>;
}
