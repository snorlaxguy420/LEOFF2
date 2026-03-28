import { config } from "./config.js";
import { sendDailySignupSummaryEmail } from "./lib/email.js";
import { readStore } from "./lib/store.js";

function getSummaryWindow() {
    const summaryEnd = new Date();
    const summaryStart = new Date(summaryEnd.getTime() - (24 * 60 * 60 * 1000));

    return {
        summaryStart,
        summaryEnd
    };
}

function filterUsersCreatedWithinWindow(users, summaryStart, summaryEnd) {
    const startTime = summaryStart.getTime();
    const endTime = summaryEnd.getTime();

    return users
        .filter(user => {
            const createdAt = new Date(user?.createdAt).getTime();

            return (
                Number.isFinite(createdAt) &&
                createdAt >= startTime &&
                createdAt <= endTime
            );
        })
        .sort((left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        )
        .map(user => ({
            email: user.email,
            createdAt: user.createdAt
        }));
}

async function main() {
    const { summaryStart, summaryEnd } = getSummaryWindow();
    const store = await readStore();
    const newUsers = filterUsersCreatedWithinWindow(
        store.users,
        summaryStart,
        summaryEnd
    );

    const result = await sendDailySignupSummaryEmail({
        recipientEmail: config.signupSummaryRecipient,
        summaryStart: summaryStart.toISOString(),
        summaryEnd: summaryEnd.toISOString(),
        newUsers,
        totalUsers: store.users.length
    });

    console.info(
        [
            "Daily signup summary sent.",
            `mode=${result.mode}`,
            `recipient=${config.signupSummaryRecipient}`,
            `newAccounts=${newUsers.length}`,
            `totalAccounts=${store.users.length}`
        ].join(" ")
    );
}

main().catch(error => {
    console.error("Daily signup summary job failed.", error);
    process.exitCode = 1;
});
