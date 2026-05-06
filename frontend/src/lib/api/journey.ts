import { apiClient } from './client';

export const journeyApi = {
  listJourneys: () =>
    apiClient.get('/compliance-journey').then((r) => r.data),

  getJourney: (journeyId: string) =>
    apiClient.get(`/compliance-journey/${journeyId}`).then((r) => r.data),

  getPendingCheckpoints: () =>
    apiClient.get('/compliance-journey/checkpoints/pending').then((r) => r.data),

  resolveCheckpoint: (
    checkpointId: string,
    decision: 'approved' | 'rejected' | 'override',
    comments?: string,
    overrideReason?: string,
  ) =>
    apiClient
      .patch(`/compliance-journey/checkpoints/${checkpointId}/resolve`, {
        decision,
        comments,
        overrideReason,
      })
      .then((r) => r.data),

  getProfileVersions: () =>
    apiClient.get('/onboarding/profile/versions').then((r) => r.data),
};
