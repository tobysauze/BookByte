declare module "pdf-parse" {
  export type PDFMetadata = {
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
  };

  export type PDFParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata?: Record<string, unknown> | null;
  };

  export type PDFParseOptions = {
    pagerender?: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => Promise<string> | string;
    max?: number;
    version?: string;
  };

  export default function pdfParse(
    data: Buffer | Uint8Array,
    options?: PDFParseOptions,
  ): Promise<PDFParseResult>;
}







