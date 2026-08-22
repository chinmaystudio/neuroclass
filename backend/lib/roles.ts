export type BackendRole = "teacher" | "student" | "admin" | "unknown";

export function normalizeBackendRole(value: unknown): BackendRole {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["teacher", "instructor", "educator"].includes(role)) return "teacher";
  if (["student", "learner", "pupil"].includes(role)) return "student";
  if (["admin", "administrator"].includes(role)) return "admin";
  return "unknown";
}
