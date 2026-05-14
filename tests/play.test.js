const { request, app, resetDb, registerAndLogin, createQuestion } = require("./helpers");

beforeEach(resetDb);

describe("POST /api/questions/:questionId/play", () => {
    it("returns 404 when playing an unknown question", async () => {
        const token = await registerAndLogin();
        const res = await request(app)
            .post("/api/questions/99999/play")
            .set("Authorization", `Bearer ${token}`)
            .send({ answer: "World" });
        expect(res.status).toBe(404);
    });

    it("returns 201 with attempted=true and playerCount=1 on first play", async () => {
        const token = await registerAndLogin();
        const question = await createQuestion(token);
        const res = await request(app)
            .post(`/api/questions/${question.id}/play`)
            .set("Authorization", `Bearer ${token}`)
            .send({ answer: "World" });
        expect(res.status).toBe(201);
        expect(res.body.attempted).toBe(true);
        expect(res.body.playerCount).toBe(1);
    });

    it("returns 201 with correct=false for a wrong answer", async () => {
        const token = await registerAndLogin();
        const question = await createQuestion(token, { answer: "A" });
        const res = await request(app)
            .post(`/api/questions/${question.id}/play`)
            .set("Authorization", `Bearer ${token}`)
            .send({ answer: "B" });
        expect(res.status).toBe(201);
        expect(res.body.correct).toBe(false);
    });
});