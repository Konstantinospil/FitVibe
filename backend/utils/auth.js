import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// --- Require any authenticated user ---
export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1]; // Expect "Bearer <token>"
    if (!token) return res.status(401).json({ error: "Invalid auth header" });

    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.sub,
      username: decoded.username || null,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// --- Require admin user ---
export async function requireAdmin(req, res, next) {
  try {
    // First check if authenticated
    requireAuth(req, res, async () => {
      const user = await db("users").where({ id: req.user.id }).first();
      if (!user) return res.status(401).json({ error: "User not found" });

      if (user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
      }

      next();
    });
  } catch (err) {
    console.error("Admin auth error:", err.message);
    return res.status(500).json({ error: "Server error" });
  }
}