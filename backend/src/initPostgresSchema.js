import { ensurePostgresSchema } from "./lib/storage/postgresStore.js";

async function main() {
    await ensurePostgresSchema();
    console.log("PostgreSQL schema is ready.");
}

main().catch(error => {
    console.error("Failed to initialize PostgreSQL schema.", error);
    process.exitCode = 1;
});
