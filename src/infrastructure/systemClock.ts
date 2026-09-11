import { Clock } from "../application/auth/ports";

export class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
