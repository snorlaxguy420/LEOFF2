import http from "node:http";
import { config } from "./config.js";
import { handleRequest } from "./app.js";
import { ensureConfiguredStoreReady } from "./lib/store.js";

async function main() {
    await ensureConfiguredStoreReady();

    const server = http.createServer((req, res) => {
        handleRequest(req, res).catch(error => {
            console.error("Unhandled backend request failure", error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({
                error: "Internal server error."
            }));
        });
    });

    server.listen(config.port, config.host, () => {
        console.log(
            `LEOFF Helper backend listening on http://${config.host}:${config.port}`
        );
    });
}

main().catch(error => {
    console.error("LEOFF Helper backend failed to start.", error);
    process.exitCode = 1;
});
