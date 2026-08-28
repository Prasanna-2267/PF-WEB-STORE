import { prisma } from "../db/prisma.js";
import { runLearnerReminderSweep } from "../services/learnerNotificationService.js";

try {
  await prisma.$connect();
  console.log(JSON.stringify(await runLearnerReminderSweep()));
} finally {
  await prisma.$disconnect();
}
