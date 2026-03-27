import http from "node:http";
import { config } from "./config.js";
import { handleRequest } from "./app.js";

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
