import type { JobRuleConfig, JobType, SystemSetting } from '@prisma/client';
import type { DbClient } from './audit.repo';

const DEFAULT_JOB_RULES: ReadonlyArray<{
  jobType: JobType;
  stage1Percent: number;
  stage2Percent: number;
  warrantyDays: number;
}> = [
  { jobType: 'Q', stage1Percent: 90, stage2Percent: 10, warrantyDays: 30 },
  { jobType: 'R', stage1Percent: 90, stage2Percent: 10, warrantyDays: 90 },
  { jobType: 'MA', stage1Percent: 90, stage2Percent: 10, warrantyDays: 90 },
];

export class ConfigRepository {
  constructor(private readonly db: DbClient) {}

  async getSystemSetting(): Promise<SystemSetting> {
    return this.db.systemSetting.upsert({
      where: { id: 'singleton' },
      update: {},
      create: {
        id: 'singleton',
        requiredDeposit: 10000,
        approverLimit: 50000,
        dispatchCadence: 'IMMEDIATE',
        oracleSimMode: 'NORMAL',
      },
    });
  }

  async ensureDefaultJobRules(): Promise<JobRuleConfig[]> {
    const results: JobRuleConfig[] = [];
    for (const r of DEFAULT_JOB_RULES) {
      const item = await this.db.jobRuleConfig.upsert({
        where: { jobType: r.jobType },
        update: {},
        create: {
          jobType: r.jobType,
          stage1Percent: r.stage1Percent,
          stage2Percent: r.stage2Percent,
          warrantyDays: r.warrantyDays,
        },
      });
      results.push(item);
    }
    return results;
  }

  async getRuleForJobType(jobType: JobType): Promise<JobRuleConfig> {
    await this.ensureDefaultJobRules();
    const found = await this.db.jobRuleConfig.findUnique({ where: { jobType } });
    if (!found) {
      throw new Error(`ไม่พบกติกาการคำนวณของประเภทงาน ${jobType}`);
    }
    return found;
  }
}
