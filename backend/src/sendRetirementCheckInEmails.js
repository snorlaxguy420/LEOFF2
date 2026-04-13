import { sendRetirementCheckInEmail } from "./lib/email.js";
import { readStore, withStore } from "./lib/store.js";

function normalizeRetirementCheckInFrequency(value) {
    const normalized = String(value || "").trim().toLowerCase();

    if (normalized === "monthly") {
        return "monthly";
    }

    if (
        normalized === "every_6_months" ||
        normalized === "every-6-months" ||
        normalized === "semiannual"
    ) {
        return "every_6_months";
    }

    if (normalized === "yearly" || normalized === "annual") {
        return "yearly";
    }

    return "never";
}

function getFrequencyMonths(frequency) {
    switch (normalizeRetirementCheckInFrequency(frequency)) {
    case "monthly":
        return 1;
    case "every_6_months":
        return 6;
    case "yearly":
        return 12;
    default:
        return 0;
    }
}

function addMonths(dateValue, months) {
    const next = new Date(dateValue);
    const day = next.getDate();

    next.setMonth(next.getMonth() + months);

    if (next.getDate() < day) {
        next.setDate(0);
    }

    return next;
}

function getNextDueDate(user) {
    const months = getFrequencyMonths(user?.retirementCheckInFrequency);

    if (!months) {
        return null;
    }

    const anchorValue =
        user?.lastRetirementCheckInSentAt ||
        user?.createdAt;
    const anchorDate = new Date(anchorValue);

    if (!Number.isFinite(anchorDate.getTime())) {
        return null;
    }

    return addMonths(anchorDate, months);
}

function getDueUsers(users = [], now = new Date()) {
    return users
        .filter(user => {
            if (!user?.email) {
                return false;
            }

            const dueDate = getNextDueDate(user);

            return Boolean(dueDate) && dueDate.getTime() <= now.getTime();
        })
        .sort((left, right) => {
            const leftDue = getNextDueDate(left)?.getTime() || 0;
            const rightDue = getNextDueDate(right)?.getTime() || 0;
            return leftDue - rightDue;
        });
}

function getLatestPlanForUser(plans = [], userId) {
    return plans
        .filter(plan => plan.userId === userId)
        .sort((left, right) =>
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        )[0] || null;
}

async function main() {
    const now = new Date();
    const store = await readStore();
    const dueUsers = getDueUsers(store.users, now);
    const successfulUserIds = [];
    const failedEmails = [];

    for (const user of dueUsers) {
        const latestPlan =
            getLatestPlanForUser(store.plans, user.id);
        const planCount =
            store.plans.filter(plan => plan.userId === user.id).length;

        try {
            const result = await sendRetirementCheckInEmail({
                toEmail: user.email,
                displayName: user.displayName || "",
                planCount,
                latestPlanName: latestPlan?.name || "",
                frequency: user.retirementCheckInFrequency
            });

            if (result.mode === "resend") {
                successfulUserIds.push(user.id);
            }

            console.info(
                [
                    "Retirement check-in processed.",
                    `mode=${result.mode}`,
                    `email=${user.email}`,
                    `frequency=${user.retirementCheckInFrequency}`,
                    `planCount=${planCount}`
                ].join(" ")
            );
        } catch (error) {
            failedEmails.push(user.email);
            console.error(
                `Retirement check-in failed for ${user.email}.`,
                error
            );
        }
    }

    if (successfulUserIds.length) {
        const sentAt = now.toISOString();

        await withStore(currentStore => ({
            ...currentStore,
            users: currentStore.users.map(user => (
                successfulUserIds.includes(user.id)
                    ? {
                        ...user,
                        lastRetirementCheckInSentAt: sentAt,
                        updatedAt: sentAt
                    }
                    : user
            ))
        }));
    }

    console.info(
        [
            "Retirement check-in job finished.",
            `dueUsers=${dueUsers.length}`,
            `emailsSent=${successfulUserIds.length}`,
            `failures=${failedEmails.length}`
        ].join(" ")
    );

    if (failedEmails.length) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error("Retirement check-in job failed.", error);
    process.exitCode = 1;
});
