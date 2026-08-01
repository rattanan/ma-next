import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { roleValues, type Role } from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { authConfig } from "./config";
import { rolePermissions, type Permission } from "./permissions";
import type { RequestMeta } from "./request";

export const SESSION_COOKIE = "atlas_session";
export const sessionCookieOptions = (expires: Date) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires, priority: "high" as const });
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, meta: RequestMeta, rememberMe = false) {
  const token = randomBytes(32).toString("base64url");
  const hours = rememberMe ? authConfig.rememberMeMaxAgeHours : authConfig.sessionMaxAgeHours;
  const now = new Date(); const expiresAt = new Date(now.getTime() + hours * 3600000);
  await prisma.session.create({ data: { id: randomUUID(), userId, sessionTokenHash: hashToken(token), ipAddress: meta.ipAddress, userAgent: meta.userAgent, lastActiveAt: now, expiresAt, createdAt: now } });
  return { token, expiresAt };
}

export type AuthenticatedUser = { id: string; fullName: string; username: string; email: string; role: Role; permissions: Permission[]; mustChangePassword: boolean };
export async function getSessionByToken(token?: string) {
  if (!token) return null;
  const now = new Date();
  const row = await prisma.session.findFirst({ where: { sessionTokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: now } }, include: { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } } });
  if (!row || row.user.status !== "ACTIVE") return null;
  await prisma.session.update({ where: { id: row.id }, data: { lastActiveAt: now } });
  const role = roleValues.includes(row.user.legacyRole as Role) ? row.user.legacyRole as Role : "VIEWER";
  const assigned = row.user.roles.flatMap((assignment) => assignment.role.active ? assignment.role.permissions.map((item) => item.permission.code as Permission) : []);
  const permissions = [...new Set(assigned.length ? assigned : [...rolePermissions[role]])];
  return { sessionId: row.id, user: { id: row.user.id, fullName: row.user.fullName, username: row.user.username, email: row.user.email, role, permissions, mustChangePassword: row.user.mustChangePassword } satisfies AuthenticatedUser, expiresAt: row.expiresAt };
}
export async function getSession(request: NextRequest) { return getSessionByToken(request.cookies.get(SESSION_COOKIE)?.value); }
export async function getCurrentSession() { return getSessionByToken((await cookies()).get(SESSION_COOKIE)?.value); }

export async function requireSession(request: NextRequest) {
  const session = await getSession(request);
  if (!session) throw new HttpError(401, "Authentication required", "UNAUTHENTICATED");
  return session;
}
export async function requirePermission(request: NextRequest, permission: Permission) {
  const session = await requireSession(request);
  if (!session.user.permissions.includes(permission)) throw new HttpError(403, "You do not have permission to perform this action", "FORBIDDEN");
  return session;
}
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  const now = new Date();
  return prisma.session.updateMany({ where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId }, expiresAt: { gt: now } } : {}) }, data: { revokedAt: now } });
}
export async function revokeSession(sessionId: string) { await prisma.session.updateMany({ where: { id: sessionId }, data: { revokedAt: new Date() } }); }
export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) { response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt)); }
export function clearSessionCookie(response: NextResponse) { response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 }); }
