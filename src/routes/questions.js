const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
  };
}

// Apply authentication to ALL routes in this router
router.use(authenticate);

// GET /api/questions/
// GET /api/questions?keyword=geography
// List all questions
router.get("/", async (req, res) => {
    const { keyword } = req.query;

    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

    const filteredQuestions = await prisma.question.findMany({
        where,
        include: { keywords: true },
        orderBy: { id: "asc"},
    });

    res.json(filteredQuestions.map(formatQuestion));
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { keywords: true },
    });

    if (!question) {
        return res.status(404).json({message: "Question not found"});
    }
    res.json(formatQuestion(question));
})

// POST /api/questions
// Create a new question
router.post("/", async (req,res) => {
    const {question, answer, keywords} = req.body;
    
    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"})
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];

    const newQuestion = await prisma.question.create({
        data: {
            question,
            answer,
            userId: req.user.userId,
            keywords: {
                connectOrCreate: keywordsArray.map((kw) => ({
                    where: { name: kw }, create: { name: kw },
                }))
            }
        },
        include:{ keywords: true },
    });
    
    res.status(201).json(formatQuestion(newQuestion));
});

// PUT /api/questions/:questionId
// Edit a question
router.put("/:questionId", isOwner, async (req,res) => {
    const questionId = Number(req.params.questionId);
    const {question, answer, keywords} = req.body;
    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) {
        return res.status(404).json({msg: "Question not found"});
    }

    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"})
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data: {
            question,
            answer,
            keywords: {
                set: [],
                connectOrCreate: keywordsArray.map((kw) => ({
                    where: { name: kw },
                    create: { name: kw },
                })),
            },
        },
        include: { keywords: true },
    });    
    res.json(formatQuestion(updatedQuestion));
});

// DELETE /api/questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async (req,res) => {
    const questionId = Number(req.params.questionId);
    
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { keywords: true },
    });

    if (!question) {
        return res.status(404).json({msg: "Question not found"});
    }

    await prisma.question.delete({ where: { id: questionId } });

    res.json({
        msg: "Question deleted succesfully",
        question: formatQuestion(question),
    });
});

module.exports = router;