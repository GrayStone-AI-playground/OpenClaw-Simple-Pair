import { Request, Response, NextFunction } from "express";
import { Role } from "./types.js";

function roleFrom(req: Request): Role {
  const raw = (req.header("x-role") || "viewer").toLowerCase();
  return raw === "owner" ? "owner" : "viewer";
}

export function requireStart(req: Request, res: Response, next: NextFunction) {
  if (roleFrom(req) !== "owner") {
    return res.status(403).json({ error: { code: "forbidden", message: "pairing:start required" } });
  }
  next();
}

export function requireApprove(req: Request, res: Response, next: NextFunction) {
  if (roleFrom(req) !== "owner") {
    return res.status(403).json({ error: { code: "forbidden", message: "pairing:approve required" } });
  }
  next();
}
