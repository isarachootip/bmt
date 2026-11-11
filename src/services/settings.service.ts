import type { PrismaClient } from '@prisma/client';
import { subtractMoney } from '@/domain/money/decimal';
import { assertRole, type ActorContext } from '@/lib/auth';
import { AuditRepository } from '@/repositories/audit.repo';
import { ConfigRepository } from '@/repositories/config.repo';
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from '@/schemas/settings.schema';

export class SettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getSettings() {
    const cfgRepo = new ConfigRepository(this.prisma);
    const system = await cfgRepo.getSystemSetting();
    const rules = await cfgRepo.ensureDefaultJobRules();
    const staff = await this.prisma.user.findMany({
      where: { active: true },
      select: { fullName: true, role: true, email: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      requiredDeposit: Number(system.requiredDeposit),
      approverLimit: Number(system.approverLimit),
      dispatchCadence: system.dispatchCadence,
      oracleSimMode: system.oracleSimMode,
      rules: rules.map((r) => ({
        jobType: r.jobType,
        stage1Percent: Number(r.stage1Percent),
        stage2Percent: Number(r.stage2Percent),
        warrantyDays: r.warrantyDays,
      })),
      staff,
    };
  }

  async updateSettings(input: UpdateSettingsInput & { actor: ActorContext }) {
    assertRole(input.actor, ['ADMIN']);
    const parsed = updateSettingsSchema.parse(input);

    return this.prisma.$transaction(async (tx) => {
      const cfgRepo = new ConfigRepository(tx);
      const oldSystem = await cfgRepo.getSystemSetting();

      await tx.systemSetting.update({
        where: { id: 'singleton' },
        data: {
          requiredDeposit: parsed.requiredDeposit,
          approverLimit: parsed.approverLimit,
          dispatchCadence: parsed.dispatchCadence,
        },
      });

      for (const r of parsed.rules) {
        const stage2Pct = subtractMoney(100, r.stage1Percent);
        await tx.jobRuleConfig.upsert({
          where: { jobType: r.jobType },
          update: {
            stage1Percent: r.stage1Percent,
            stage2Percent: stage2Pct,
            warrantyDays: r.warrantyDays,
          },
          create: {
            jobType: r.jobType,
            stage1Percent: r.stage1Percent,
            stage2Percent: stage2Pct,
            warrantyDays: r.warrantyDays,
          },
        });
      }

      const ruleSummary = parsed.rules
        .map((r) => `${r.jobType}:${r.stage1Percent}/${100 - r.stage1Percent} (${r.warrantyDays}d)`)
        .join(', ');

      await new AuditRepository(tx).append({
        actorName: input.actor.fullName,
        actorRole: input.actor.role,
        actorUserId: input.actor.id,
        action: 'บันทึกการตั้งค่าระบบ BMT',
        entityRef: 'SYSTEM-CONFIG',
        oldValue: `ค้ำประกัน ${Number(oldSystem.requiredDeposit)} · วงเงิน ${Number(oldSystem.approverLimit)}`,
        newValue: `ค้ำประกัน ${parsed.requiredDeposit} · วงเงิน ${parsed.approverLimit} · ${ruleSummary}`,
      });

      return { updated: true };
    });
  }
}
