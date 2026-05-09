export class CreateNonconformityDto {
  title: string;
  description: string;
  source: string;  // internal_audit | customer_complaint | process_failure | product_failure | supplier_issue | management_review | other
  severity?: string; // major | minor | observation
  reportedBy?: string;
  assignedTo?: string;
}

export class UpdateNonconformityDto {
  status?: string;
  rootCause?: string;
  capaId?: string;
  notes?: string;
  containedAt?: string;
  closedAt?: string;
  closedBy?: string;
}

export class CreateQualityObjectiveDto {
  metric: string;
  target: number;
  unit: string;
  targetDirection?: string; // above | below | equal
  measurementFrequency?: string;
  ownerId?: string;
}

export class RecordMeasurementDto {
  value: number;
  note?: string;
}

export class CreateProcessAuditDto {
  processName: string;
  scheduledAt: string;  // ISO date
  auditorId?: string;
}

export class UpdateProcessAuditDto {
  status?: string;
  findings?: any[];
  notes?: string;
  completedAt?: string;
  evidenceId?: string;
}
