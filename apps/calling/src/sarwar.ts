import express from "express";
import { plivoVoiceRoute } from "./routes/plivo-voice";
import cors from "cors"

export function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/plivo-voice", plivoVoiceRoute);

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}