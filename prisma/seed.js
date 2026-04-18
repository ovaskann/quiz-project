const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestions = [
    {
        question: "What is the capital of Finland?",
        answer: "Helsinki",
        keywords: ["geography", "capital"]
    },
    {
        question: "What is the capital of Norway?",
        answer: "Oslo",
        keywords: ["geography", "capital"]
    },
    {
        question: "Who composed Für Elise?",
        answer: "Ludwig van Beethoven",
        keywords: ["music", "composer"]
    },
    {
        question: "Which scientist developed the theory of relativity?",
        answer: "Albert Einstein",
        keywords: ["science", "physics"]
    }
];

async function main() {
    await prisma.question.deleteMany();
    await prisma.keyword.deleteMany();

    for (const question of seedQuestions) {
        await prisma.question.create({
            data: {
                question: question.question,
                answer: question.answer,
                keywords: {
                    connectOrCreate: question.keywords.map((kw) => ({
                        where: { name: kw },
                        create: { name: kw },
                    })),
                },
            },
        });
    }

    console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());