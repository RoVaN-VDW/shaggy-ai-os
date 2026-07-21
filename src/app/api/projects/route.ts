import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/security";
import { requireLocalAccess } from "@/lib/local/server";
import {
  createProjectsStore,
  ProjectsMutationConflictError,
  resolveProjectsDataRoot,
} from "@/lib/local/projects-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MUTATION_BODY_BYTES = 8 * 1024;
const projectsStore = createProjectsStore({ dataRoot: resolveProjectsDataRoot() });

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "local-projects", 60);
  if (limited) return noStore(limited);

  const access = await requireLocalAccess(req);
  if (access.error) return noStore(access.error);

  try {
    const projects = await projectsStore.readAll();
    return NextResponse.json(
      {
        ok: true,
        source: "local-projects-store",
        observedAt: new Date().toISOString(),
        projects,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Local projects store unavailable", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: "Local projects source is unavailable.",
        availability: "local-only",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "local-projects-mutation", 20);
  if (limited) return noStore(limited);

  const access = await requireLocalAccess(req);
  if (access.error) return noStore(access.error);

  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MUTATION_BODY_BYTES) {
    return NextResponse.json(
      { error: "Local project mutation is too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const idempotencyKey = req.headers.get("Idempotency-Key") ?? "";
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_MUTATION_BODY_BYTES) {
    return NextResponse.json(
      { error: "Local project mutation is too large." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Local project mutation is malformed." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await projectsStore.create(input, { idempotencyKey });
    return NextResponse.json(
      {
        ok: true,
        source: "local-projects-store",
        project: result.project,
        receipt: {
          mutationId: result.receipt.mutationId,
          idempotencyKey: result.receipt.idempotencyKey,
          operation: result.receipt.operation,
          projectId: result.receipt.projectId,
          committedAt: result.receipt.committedAt,
        },
        replayed: result.replayed,
      },
      { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ProjectsMutationConflictError) {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof Error && (
      error.message === "Local project mutation is malformed"
      || error.message === "Invalid projects idempotency key"
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("Local projects mutation unavailable", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Local projects mutation is unavailable.", availability: "local-only" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
