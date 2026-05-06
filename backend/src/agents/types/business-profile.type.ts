export interface BusinessProfile {
  companyName: string;
  companyType: 'startup' | 'smb' | 'enterprise' | 'nonprofit' | 'government';
  industry: string;
  subIndustry?: string;
  employeeCount: string;
  engineeringCount?: string;
  hqCountry?: string;
  operatesIn?: string[];

  infrastructure: {
    cloudProviders: string[];
    usesTerraform?: boolean;
    usesKubernetes?: boolean;
    usesDocker?: boolean;
    ciCd?: string[];
    awsDetails?: {
      multiAccount?: boolean;
      servicesUsed?: string[];
    };
  };

  tools: {
    versionControl?: string;
    identityProvider?: string;
    ticketing?: string;
    monitoring?: string;
    communication?: string;
    hrSystem?: string;
    endpointMgmt?: string;
    secretMgmt?: string;
  };

  dataHandling: {
    dataTypes: string[];
    piiVolume?: string;
    storesDataIn?: string;
    dataResidency?: string[];
    customerDataAccess?: string;
  };

  currentPosture: {
    hasSecurityTeam?: boolean;
    securityTeamSize?: number;
    hasExistingPolicies?: boolean;
    usesMfa?: string;
    hasSso?: boolean;
    hasVulnScanning?: boolean;
    hasIncidentResponsePlan?: boolean;
    hasPenTestDone?: boolean;
    hasBackgroundChecks?: boolean;
    securityTrainingDone?: boolean;
  };

  complianceGoals: {
    frameworks: string[];
    soc2Type?: 'type_i' | 'type_ii';
    targetDate?: string;
    driver?: string;
    hasExistingAuditor?: boolean;
    auditorName?: string;
  };

  riskProfile: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskFactors: string[];
    recommendedPriority: string[];
    estimatedReadiness: number;
  };
}
