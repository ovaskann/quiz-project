const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");
const SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
    next();
    } catch {
      req.log.warn({}, "Error authenticating");
      throw new ForbiddenError("Invalid or expired token");
  }
}

module.exports = authenticate;