import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import express, { type Express } from "express";
import cors from "cors";

import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import { errorHandler } from "./middlewares/errorHandler";

const allowedOrigins = [
  "http://localhost:5173",
  "https://infrastruc.vercel.app",
];
const app: Express = express();
app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    level: process.env.NODE_ENV === "test" ? "silent" : undefined,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(
        { origin },
        "Blocked CORS origin"
      );

      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(authMiddleware);

app.use("/api", router);
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.resolve(__dirname, "../../field-inspector/dist/public");



app.use(express.static(publicDir));

app.use((_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use(errorHandler);

export default app;
