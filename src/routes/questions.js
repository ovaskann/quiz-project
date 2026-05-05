const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: path.join(__dirname, "..","..","public","uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const newName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, newName);
    }
})

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
    limits: {fileSize: 5 * 1024 * 1024}
})

function parseKeywords(keywords) {
    if(Array.isArray(keywords)) return keywords;
    if(typeof keywords === "string") {
        return keywords.split(",").map((k) =>
            k.trim()).filter(Boolean);
    }
    return [];
}

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user ? question.user.name : null,
    attempted: question.attempts ? question.attempts.length > 0 : false,
    attemptCount: question._count?.attempts ?? 0,
    solved: question.attempts && question.attempts.length > 0 ? question.attempts[0].isCorrect : false,
    user: undefined,
    attempts: undefined,
    _count: undefined,
  };
}

// Apply authentication to ALL routes in this router
router.use(authenticate);
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err?.message === "Only image files are allowed") {
        return res.status(400).json({msg: err.message});
    }
    next(err);
});

// GET /api/questions/
// GET /api/questions?keyword=geography&page=1&limit=5
// List all questions
router.get("/", async (req, res) => {
    const { keyword } = req.query;

    const where = keyword ? { keywords: { some: { name: keyword } } } : {};

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page-1)*limit;

    const [filteredQuestions, total ] = await Promise.all([
        prisma.question.findMany({
            where,
            include: {
                keywords: true,
                user: true,
                attempts: {where: {userId: req.user.userId}, take: 1},
                _count: {select: {attempts: true}}
            },
            orderBy: { id: "asc"},
            skip,
            take: limit,
        }),
        prisma.question.count({where}),
    ]);

    res.json({
        data: filteredQuestions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total/limit),
    })
});

// GET /api/questions/:questionId
// Show a specific question
router.get("/:questionId", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: {
            keywords: true,
            user: true,
            attempts: {where: {userId: req.user.userId}, take: 1},
            _count: {select: {attempts: true}}
        },
    });

    if (!question) {
        return res.status(404).json({message: "Question not found"});
    }
    res.json(formatQuestion(question));
})

// POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req,res) => {
    const {question, answer, keywords} = req.body;
    
    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"})
    }

    const keywordsArray = parseKeywords(keywords);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const newQuestion = await prisma.question.create({
        data: {
            question,
            answer,
            userId: req.user.userId,
            keywords: {
                connectOrCreate: keywordsArray.map((kw) => ({
                    where: { name: kw }, create: { name: kw },
                }))
            },
            imageUrl,
        },
        include:{ keywords: true, user: true },
    });
    
    res.status(201).json(formatQuestion(newQuestion));
});

// PUT /api/questions/:questionId
// Edit a question
router.put("/:questionId", upload.single("image"), isOwner, async (req,res) => {
    const questionId = Number(req.params.questionId);
    const {question, answer, keywords} = req.body;
    const existingQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existingQuestion) {
        return res.status(404).json({msg: "Question not found"});
    }

    if (!question || !answer) {
        return res.status(400).json({msg: "question and answer are required"})
    }

    const keywordsArray = parseKeywords(keywords);
    const data = {
        question,
        answer,
        keywords: {
            set: [],
            connectOrCreate: keywordsArray.map((kw) => ({
                where: { name: kw },
                create: { name: kw },
            })),
        },
    }

    if(req.file) data.imageUrl = `/uploads/${req.file.filename}`;

    const updatedQuestion = await prisma.question.update({
        where: { id: questionId },
        data,
        include: { keywords: true, user: true },
    });    
    res.json(formatQuestion(updatedQuestion));
});

// DELETE /api/questions/:questionId
// Delete a question
router.delete("/:questionId", isOwner, async (req,res) => {
    const questionId = Number(req.params.questionId);
    
    const question = await prisma.question.findUnique({
        where: { id: questionId },
        include: { keywords: true, user: true },
    });

    if (!question) {
        return res.status(404).json({msg: "Question not found"});
    }

    await prisma.attempt.deleteMany({ where: { questionId } });
    await prisma.question.delete({ where: { id: questionId } });

    res.json({
        msg: "Question deleted succesfully",
        question: formatQuestion(question),
    });
});

// POST /api/questions/:questionId/play
// Answer a question
router.post("/:questionId/play", async (req, res) => {
    const questionId = Number(req.params.questionId);
    const submittedAnswer = req.body.answer;

    const question = await prisma.question.findUnique({where: {id: questionId}});
    if (!question) {
        return res.status(404).json({message: "Question not found"});
    }

    const isCorrect = submittedAnswer.toLowerCase() === question.answer.toLowerCase();

    const attempt = await prisma.attempt.upsert({
        where: {userId_questionId: {userId: req.user.userId, questionId}},
        update: {
            submittedAnswer,
            isCorrect,
        },
        create: {
            userId: req.user.userId,
            questionId,
            submittedAnswer,
            isCorrect
        }
    })

    const attemptCount = await prisma.attempt.count({where: {questionId}});

    res.status(201).json({
        id: attempt.id,
        questionId,
        correct: attempt.isCorrect,
        submittedAnswer: attempt.submittedAnswer,
        correctAnswer: question.answer,
        createdAt: attempt.createdAt.toISOString().split("T")[0],
    })
})

module.exports = router;