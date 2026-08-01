import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") { super(message); }
}

export function apiError(error: unknown, requestId?: string) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message, code: error.code, requestId }, { status: error.status });
  if (error instanceof Error && (error as { code?: string }).code === "INVALID_TRANSITION") return NextResponse.json({ error: error.message, code: "INVALID_TRANSITION", requestId }, { status: 409 });
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation failed", code: "VALIDATION_ERROR", details: error.flatten().fieldErrors, requestId }, { status: 400 });
  if (error instanceof Error && (error as { code?: string }).code === "ER_DUP_ENTRY") {
    const isUser = /users_(email|username)_uq/.test(error.message);
    return NextResponse.json({ error: isUser ? "Email or username already exists" : "A record with that unique value already exists", code: isUser ? "DUPLICATE_USER" : "DUPLICATE_RECORD", requestId }, { status: 409 });
  }
  console.error("API request failed", { requestId, name: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: "An unexpected error occurred", code: "INTERNAL_ERROR", requestId }, { status: 500 });
}
