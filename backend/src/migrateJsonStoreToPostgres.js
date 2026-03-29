import { readStore as readFileStore } from "./lib/storage/fileStore.js";
import {
    ensurePostgresSchema,
    writeStore as writePostgresStore
} from "./lib/storage/postgresStore.js";

async function main() {
    const store = await readFileStore();

    await ensurePostgresSchema();
    await writePostgresStore(store);

    console.log(
        JSON.stringify(
            {
                users: store.users.length,
                sessions: store.sessions.length,
                plans: store.plans.length,
                passwordResetTokens: store.passwordResetTokens.length
            },
            null,
            2
        )
    );
}

main().catch(error => {
    console.error("JSON-to-PostgreSQL migration failed.", error);
    process.exitCode = 1;
});
