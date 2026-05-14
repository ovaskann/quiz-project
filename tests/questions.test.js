const { resetDb, registerAndLogin, createQuestion, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

describe("GET /api/questions", () => {
    it("returns 401 without a token", async () => {
        const res = await request(app)
            .get("/api/questions");
        expect(res.status).toBe(401);
    });

    it("returns 403 when the token is malformed", async () => {
        const res = await request(app)
            .get("/api/questions")
            .set("Authorization", "Bearer not.a.real.jwt");
        expect(res.status).toBe(403);
    });

    it("returns questions with data, page, limit, total, totalPages", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .get("/api/questions")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            data: expect.any(Array),
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number),
        });
    });

    it("does not include user password in any question in the response", async () => {
        const token = await registerAndLogin();
        await createQuestion(token);
        const res = await request(app)
            .get("/api/questions")
            .set("Authorization", `Bearer ${token}`);
        expect(JSON.stringify(res.body)).not.toContain("password");
    });
});

describe("GET /api/questions/:questionId", () => {
    it("returns 404 for unknown question", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .get("/api/questions/99999")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Question not found");
    });

    it("returns 200 with the correct shape for a known question", async () => {
        const token = await registerAndLogin();
        const created = await createQuestion(token, { question: "Hello", answer: "World" });
        const res = await request(app)
            .get(`/api/questions/${created.id}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            id: created.id,
            question: "Hello",
            answer: "World",
            userName: "A",
            attempted: false,
            playerCount: 0,
            solved: false,
        });
    });
});

describe("POST /api/questions", () => {
    it("returns 400 for invalid question body", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({ question: "" });
        expect(res.status).toBe(400);
    });

    it("sets userId from the JWT, not from the body", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({
                question: "Hello",
                answer: "World",
                userId: 99999,
            });
        expect(res.status).toBe(201);
        const question = await prisma.question.findUnique({ where: { id: res.body.id } });
        expect(question.userId).not.toBe(99999);
    });
});


describe("PUT /api/questions/:questionId", () => {
    it("returns 403 when editing someone else's question", async () => {
        const aliceToken = await registerAndLogin("alice@test.io", "Alice");
        const question = await createQuestion(aliceToken, { question: "Alice's question" });

        const bobToken = await registerAndLogin("bob@test.io", "Bob");
        const res = await request(app)
            .put(`/api/questions/${question.id}`)
            .set("Authorization", `Bearer ${bobToken}`)
            .send({ question: "Bob's question", answer: "Bob edited your question" });

        expect(res.status).toBe(403);

        const after = await prisma.question.findUnique({ where: { id: question.id } });
        expect(after.question).toBe("Alice's question");
    });
});

describe("DELETE /api/questions/:questionId", () => {
    it("returns 200 and removes the question from the database", async () => {
        const token = await registerAndLogin();
        const question = await createQuestion(token);
        const res = await request(app)
            .delete(`/api/questions/${question.id}`)
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        const after = await prisma.question.findUnique({ where: { id: question.id } });
        expect(after).toBeNull();
    });

    it("returns 404 when deleting an unknown question", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .delete("/api/questions/99999")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it("returns 403 when deleting someone else's question", async () => {
        const aliceToken = await registerAndLogin("alice@test.io", "Alice");
        const question = await createQuestion(aliceToken);

        const bobToken = await registerAndLogin("bob@test.io", "Bob");
        const res = await request(app)
            .delete(`/api/questions/${question.id}`)
            .set("Authorization", `Bearer ${bobToken}`);
        expect(res.status).toBe(403);
    });
});

describe("unknown routes", () => {
    it("returns 404 with a message for unknown routes", async () => {
        const res = await request(app).get("/api/unknownroute");
        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Not found");
    });
});

describe("body parsing", () => {
    it("returns 400 for malformed JSON", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .set("Content-Type", "application/json")
            .send("{not valid json");
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Invalid JSON in request body");
    });
});