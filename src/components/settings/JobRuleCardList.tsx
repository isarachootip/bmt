export interface RuleDto {
  jobType: 'Q' | 'R' | 'MA';
  stage1Percent: number;
  stage2Percent: number;
  warrantyDays: number;
}

export function JobRuleCardList({
  rules,
  isAdmin,
  onUpdateRule,
}: {
  rules: RuleDto[];
  isAdmin: boolean;
  onUpdateRule: (idx: number, patch: Partial<RuleDto>) => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <h2 className="text-base font-bold text-slate-900">
        สัดส่วนแบ่งจ่ายและระยะประกันตามประเภทงาน
      </h2>
      {rules.map((r, idx) => (
        <div
          key={r.jobType}
          className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 grid grid-cols-3 gap-3 items-end"
        >
          <div>
            <span className="text-xs font-bold text-slate-700">ประเภทงาน {r.jobType}</span>
            <div className="text-xs text-slate-500 mt-1">Hold งวด 2: {r.stage2Percent}%</div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            จ่ายงวดแรก (%)
            <input
              type="number"
              disabled={!isAdmin}
              min={1}
              max={100}
              step="0.01"
              value={r.stage1Percent}
              onChange={(e) => onUpdateRule(idx, { stage1Percent: Number(e.target.value) })}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono-code"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            รับประกัน (วัน)
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={730}
              value={r.warrantyDays}
              onChange={(e) => onUpdateRule(idx, { warrantyDays: Number(e.target.value) })}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-mono-code"
            />
          </label>
        </div>
      ))}
    </section>
  );
}
