/**
 * Domain events emitted by DocumentsService.
 * Consumed by audit, notification, and evidence listeners.
 */

export class DocumentCreatedEvent {
  readonly type = 'document.created' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly title:      string,
    public readonly actorId:    string,
  ) {}
}

export class DocumentUpdatedEvent {
  readonly type = 'document.updated' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly actorId:    string,
  ) {}
}

export class DocumentApprovalRequestedEvent {
  readonly type = 'document.approval_requested' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly title:      string,
    public readonly requestedBy: string,
    public readonly ownerId:    string | null,
  ) {}
}

export class DocumentApprovedEvent {
  readonly type = 'document.approved' as const;
  constructor(
    public readonly orgId:          string,
    public readonly documentId:     string,
    public readonly title:          string,
    public readonly approvedBy:     string,
    public readonly classification: string,
    public readonly controlIds:     string[],
  ) {}
}

export class DocumentRejectedEvent {
  readonly type = 'document.rejected' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly title:      string,
    public readonly rejectedBy: string,
    public readonly reason:     string,
    public readonly authorId:   string | null,
  ) {}
}

export class DocumentArchivedEvent {
  readonly type = 'document.archived' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly actorId:    string,
  ) {}
}

export class DocumentVersionCreatedEvent {
  readonly type = 'document.version_created' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly version:    number,
    public readonly actorId:    string,
  ) {}
}

export class DocumentLegalHoldSetEvent {
  readonly type = 'document.legal_hold.set' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly actorId:    string,
    public readonly reason:     string,
  ) {}
}

export class DocumentLegalHoldReleasedEvent {
  readonly type = 'document.legal_hold.released' as const;
  constructor(
    public readonly orgId:      string,
    public readonly documentId: string,
    public readonly actorId:    string,
  ) {}
}

export type AnyDocumentEvent =
  | DocumentCreatedEvent
  | DocumentUpdatedEvent
  | DocumentApprovalRequestedEvent
  | DocumentApprovedEvent
  | DocumentRejectedEvent
  | DocumentArchivedEvent
  | DocumentVersionCreatedEvent
  | DocumentLegalHoldSetEvent
  | DocumentLegalHoldReleasedEvent;
