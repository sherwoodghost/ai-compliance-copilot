export class CreateProcessingActivityDto {
  name: string;
  purpose: string;
  lawfulBasis: string;
  dataCategories?: string[];
  dataSubjects?: string[];
  retentionPeriod?: string;
  internationalTransfers?: boolean;
  transferMechanisms?: string[];
  processorName?: string;
  dpaRequired?: boolean;
  dpaSigned?: boolean;
  dpiaRequired?: boolean;
  notes?: string;
}

export class UpdateProcessingActivityDto extends CreateProcessingActivityDto {}

export class CreateDsarDto {
  type: string;    // access | erasure | portability | rectification | objection | restriction
  requestorEmail?: string;
  description?: string;
  assignedTo?: string;
}

export class UpdateDsarDto {
  status?: string;
  assignedTo?: string;
  notes?: string;
  completedAt?: string;
}

export class CreateDpiaDto {
  processingActivityId?: string;
  title: string;
}

export class CreateBreachNotificationDto {
  incidentId?: string;
  detectedAt: string;   // ISO date string
  breachDescription?: string;
  affectedDataSubjects?: number;
  affectedDataCategories?: string[];
  likelyConsequences?: string;
  measuresAdopted?: string;
}

export class UpdateBreachNotificationDto {
  status?: string;
  supervisoryNotifiedAt?: string;
  dataSubjectsNotifiedAt?: string;
  supervisoryAuthority?: string;
  breachDescription?: string;
  likelyConsequences?: string;
  measuresAdopted?: string;
}
