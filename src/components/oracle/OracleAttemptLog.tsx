'use client';

import { StatusPill } from '@/components/ui/StatusPill';

export interface OracleAttemptDto {
  id: string;
  timestamp: string;
  idempotencyKey: string | null;
  attempt: number;
  httpStatus: number;
  success: boolean;
  requestBody: string;
  responseBody: string;
}

export function OracleAttemptLog({ attempts }: { attempts: OracleAttemptDto[] }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
      <h2 className="text-sm font-bold text-slate-900">
        Log การเรียก Oracle API ล่าสุด ({attempts.length})
      </h2>
      <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 text-xs">
        {attempts.map((a) => (
          <div
            key={a.id}
            className="border border-slate-200 rounded-lg p-2.5 flex flex-wrap justify-between items-center gap-2"
          >
            <span>
              {a.timestamp} · ครั้งที่ {a.attempt} ·{' '}
              <code className="font-mono-code">{a.idempotencyKey}</code>
            </span>
            <StatusPill
              label={`HTTP ${a.httpStatus}`}
              tone={a.success ? 'ok' : 'fail'}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
