import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config.js";
import { registerRoutes } from "./routes/index.js";
import { registerAdminRoutes } from "./routes/adminRoutes.js";
import { registerInternalRoutes } from "./routes/internalRoutes.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });
await app.register(websocket);
await app.register(registerRoutes, { prefix: "/api" });
// Отдельный префикс и отдельная авторизация (JWT, не Telegram initData) —
// раздел 5 ТЗ: "отдельное SPA + защищённое REST API... с ролевым доступом".
await app.register(registerAdminRoutes, { prefix: "/api/admin" });
// Server-to-server: bot -> backend после pre_checkout_query/successful_payment
// (Stars Payments, раздел 2.2 ТЗ) — своя авторизация, см. middleware/internalAuth.ts.
await app.register(registerInternalRoutes, { prefix: "/api/internal" });

app.get("/health", async () => ({ status: "ok" }));

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then(() => app.log.info(`NEO MERZ backend запущен на порту ${config.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
