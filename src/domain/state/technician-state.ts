export const TechnicianStatus = {
  PENDING_DEPOSIT: 'PENDING_DEPOSIT',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  OFFBOARDING: 'OFFBOARDING',
  CLOSED: 'CLOSED',
} as const;

export type TechnicianStatusValue =
  (typeof TechnicianStatus)[keyof typeof TechnicianStatus];

export class StateTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`ไม่อนุญาตให้เปลี่ยนสถานะ ${entity} ข้ามขั้นจาก ${from} ไปเป็น ${to}`);
    this.name = 'StateTransitionError';
  }
}

const ALLOWED_TECHNICIAN_TRANSITIONS: Record<
  TechnicianStatusValue,
  readonly TechnicianStatusValue[]
> = {
  PENDING_DEPOSIT: ['ACTIVE', 'OFFBOARDING'],
  ACTIVE: ['SUSPENDED', 'OFFBOARDING'],
  SUSPENDED: ['ACTIVE', 'OFFBOARDING'],
  OFFBOARDING: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionTechnician(
  from: TechnicianStatusValue,
  to: TechnicianStatusValue,
): boolean {
  return ALLOWED_TECHNICIAN_TRANSITIONS[from].includes(to);
}

export function assertTechnicianTransition(
  from: TechnicianStatusValue,
  to: TechnicianStatusValue,
): void {
  if (!canTransitionTechnician(from, to)) {
    throw new StateTransitionError('Technician', from, to);
  }
}
