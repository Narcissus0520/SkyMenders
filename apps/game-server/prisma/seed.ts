import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;
if (connectionString === undefined)
  throw new Error("DATABASE_URL is required for database seeding");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
await prisma.$connect();
await prisma.$disconnect();
