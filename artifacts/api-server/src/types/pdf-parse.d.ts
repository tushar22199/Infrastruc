declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }

  export default function pdf(
    dataBuffer: Buffer
  ): Promise<PDFData>;
}