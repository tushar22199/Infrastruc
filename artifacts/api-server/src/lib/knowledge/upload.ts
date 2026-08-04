import { extractPdfText } from "./extractor";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },



  filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname);

      cb(
          null,
          `${randomUUID()}${extension}`
      );
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const validMimeTypes = [
      "application/pdf",
      "application/octet-stream",
      "application/x-pdf",
    ];

    if (ext === ".pdf" && validMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    return cb(
      new Error(
        `Only PDF files are allowed. Got ${file.mimetype}`
      )
    );
  },
});