'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { integrationsApi } from '@/lib/api/integrations';
import { getAccessToken } from '@/lib/api/client';
import {
  CheckCircle, XCircle, RefreshCw, Trash2, Plus, X,
  Mail, Lock, Shield, Cloud, Code, Monitor, Users,
  Laptop, Ticket, Activity, ChevronRight, Search,
  AlertTriangle, Zap, ExternalLink, Sparkles, TrendingUp, ArrowRight,
  Database, Key, GraduationCap, UserCheck, Building2, HardDrive, Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'https://ai-compliance-copilot-production.up.railway.app/api/v1').replace(/\/api\/v1\/?$/, '');

// ─── Provider Registry ────────────────────────────────────────────────────────

type ProviderStatus = 'available' | 'request_access';

type Provider = {
  key: string;
  label: string;
  category: string;
  description: string;
  controlsCovered: string[];
  evidenceTypes: string[];
  status: ProviderStatus;
  authType?: 'oauth' | 'api_key';
  fields?: { name: string; label: string; type: string; placeholder?: string }[];
};

const PROVIDERS: Provider[] = [
  // ── Identity & Access Management ──────────────────────────────────────────
  {
    key: 'okta', label: 'Okta', category: 'Identity', status: 'available',
    description: 'MFA enforcement, user access reviews, SSO policies',
    controlsCovered: ['CC6.1', 'CC6.2', 'CC6.3', 'A.8.2', 'A.8.3'],
    evidenceTypes: ['mfa_config', 'user_access_list', 'sso_policy'],
    fields: [
      { name: 'domain', label: 'Okta Domain', type: 'text', placeholder: 'yourorg.okta.com' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'google_workspace', label: 'Google Workspace', category: 'Identity', status: 'available',
    authType: 'oauth',
    description: '2-Step Verification, user provisioning, admin role assignments',
    controlsCovered: ['CC6.1', 'CC6.2', 'CC6.3'],
    evidenceTypes: ['2sv_enrollment', 'user_list', 'admin_roles'],
  },
  {
    key: 'azure', label: 'Azure AD / Entra', category: 'Identity', status: 'available',
    authType: 'oauth',
    description: 'Conditional access, MFA status, privileged identity management',
    controlsCovered: ['CC6.1', 'CC6.2', 'A.8.2', 'A.8.3'],
    evidenceTypes: ['conditional_access', 'mfa_status', 'pim_config'],
  },
  {
    key: 'onelogin', label: 'OneLogin', category: 'Identity', status: 'available',
    description: 'SSO, MFA, adaptive authentication, access provisioning',
    controlsCovered: ['CC6.1', 'CC6.2', 'CC6.3'],
    evidenceTypes: ['sso_config', 'mfa_policy', 'user_provisioning'],
    fields: [{ name: 'accessToken', label: 'Access Token', type: 'password' }],
  },
  {
    key: 'auth0', label: 'Auth0', category: 'Identity', status: 'available',
    description: 'Universal Login, RBAC, anomaly detection, MFA',
    controlsCovered: ['CC6.1', 'CC6.2', 'A.8.2'],
    evidenceTypes: ['mfa_config', 'rbac_config', 'login_anomalies'],
    fields: [
      { name: 'domain', label: 'Auth0 Domain', type: 'text', placeholder: 'yourapp.auth0.com' },
      { name: 'accessToken', label: 'Management API Token', type: 'password' },
    ],
  },
  {
    key: 'duo', label: 'Duo Security', category: 'Identity', status: 'available',
    description: 'MFA enforcement, device trust, zero-trust access',
    controlsCovered: ['CC6.1', 'CC6.2', 'A.8.3'],
    evidenceTypes: ['mfa_enforcement', 'device_trust', 'user_enrollment'],
    fields: [
      { name: 'integrationKey', label: 'Integration Key', type: 'text' },
      { name: 'secretKey', label: 'Secret Key', type: 'password' },
      { name: 'apiHostname', label: 'API Hostname', type: 'text', placeholder: 'api-xxxxxxxx.duosecurity.com' },
    ],
  },
  {
    key: 'jumpcloud', label: 'JumpCloud', category: 'Identity', status: 'available',
    description: 'Directory-as-a-Service, MDM, SSO, device management',
    controlsCovered: ['CC6.1', 'CC6.2', 'A.8.2'],
    evidenceTypes: ['user_directory', 'device_compliance', 'sso_config'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'ping_identity', label: 'Ping Identity', category: 'Identity', status: 'available',
    description: 'Intelligent identity, MFA, CIAM, workforce IAM',
    controlsCovered: ['CC6.1', 'CC6.2'],
    evidenceTypes: ['sso_policies', 'mfa_config'],
    fields: [
      { name: 'environmentId', label: 'Environment ID', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'cyberark', label: 'CyberArk', category: 'Identity', status: 'available',
    description: 'Privileged access management, vaulting, session isolation',
    controlsCovered: ['CC6.1', 'A.8.2', 'A.9.2'],
    evidenceTypes: ['pam_config', 'privileged_accounts', 'session_recording'],
    fields: [
      { name: 'baseUrl', label: 'Base URL', type: 'text' },
      { name: 'sessionToken', label: 'Session Token', type: 'password' },
    ],
  },
  {
    key: 'delinea', label: 'Delinea', category: 'Identity', status: 'available',
    description: 'Secrets management, privileged access workflows',
    controlsCovered: ['CC6.1', 'A.8.2'],
    evidenceTypes: ['secrets_inventory', 'access_workflows'],
    fields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'beyondtrust', label: 'BeyondTrust', category: 'Identity', status: 'available',
    description: 'Privileged access, remote access, endpoint privilege management',
    controlsCovered: ['CC6.1', 'A.8.2'],
    evidenceTypes: ['pam_policies', 'privileged_sessions'],
    fields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },

  // ── Cloud Infrastructure ───────────────────────────────────────────────────
  {
    key: 'aws', label: 'AWS', category: 'Cloud', status: 'available',
    description: 'IAM policies, S3 encryption, CloudTrail, GuardDuty findings',
    controlsCovered: ['CC6.1', 'CC7.1', 'CC7.2', 'A.12.4'],
    evidenceTypes: ['iam_policy', 's3_encryption', 'cloudtrail_logs', 'guardduty'],
    fields: [
      { name: 'accessKeyId', label: 'Access Key ID', type: 'text' },
      { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
      { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    ],
  },
  {
    key: 'gcp', label: 'Google Cloud', category: 'Cloud', status: 'available',
    description: 'IAM bindings, Cloud Audit Logs, Security Command Center',
    controlsCovered: ['CC6.1', 'CC7.1', 'A.12.4'],
    evidenceTypes: ['iam_policy', 'audit_logs', 'scc_findings'],
    fields: [
      { name: 'serviceAccountJson', label: 'Service Account JSON', type: 'password' },
      { name: 'projectId', label: 'Project ID', type: 'text' },
    ],
  },
  {
    key: 'digitalocean', label: 'DigitalOcean', category: 'Cloud', status: 'available',
    description: 'Firewall rules, monitoring alerts, audit logs, managed databases',
    controlsCovered: ['CC6.1', 'CC7.1', 'A.12.4'],
    evidenceTypes: ['firewall_rules', 'monitoring_alerts', 'audit_logs'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'cloudflare', label: 'Cloudflare', category: 'Cloud', status: 'available',
    description: 'WAF, DDoS protection, Zero Trust, network security rules',
    controlsCovered: ['CC6.6', 'CC7.1', 'A.13.1'],
    evidenceTypes: ['waf_config', 'ddos_protection', 'firewall_rules'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'vercel', label: 'Vercel', category: 'Cloud', status: 'available',
    description: 'Deployment protection, environment variable security, preview environments',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['deployment_config', 'env_var_encryption'],
    fields: [{ name: 'accessToken', label: 'Access Token', type: 'password' }],
  },
  {
    key: 'heroku', label: 'Heroku', category: 'Cloud', status: 'available',
    description: 'Pipeline security, config vars encryption, 2FA enforcement',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['pipeline_config', 'config_var_security'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },

  // ── Source Control & CI/CD ─────────────────────────────────────────────────
  {
    key: 'github', label: 'GitHub', category: 'Code', status: 'available',
    authType: 'oauth',
    description: 'Branch protection, secret scanning, Dependabot, code review enforcement',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['branch_protection', 'secret_scan', 'dependabot_alerts'],
  },
  {
    key: 'gitlab', label: 'GitLab', category: 'Code', status: 'available',
    authType: 'oauth',
    description: 'Merge request approvals, SAST/DAST scanning, secret detection',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['mr_approvals', 'pipeline_config', 'secret_detection'],
  },
  {
    key: 'bitbucket', label: 'Bitbucket', category: 'Code', status: 'available',
    authType: 'oauth',
    description: 'Branch restrictions, merge checks, repository permissions',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['branch_restrictions', 'repository_security'],
  },
  {
    key: 'azure_devops', label: 'Azure DevOps', category: 'Code', status: 'available',
    description: 'Branch policies, pipeline approvals, artifact security',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['branch_policies', 'pipeline_approvals'],
    fields: [
      { name: 'organization', label: 'Organization', type: 'text' },
      { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password' },
    ],
  },
  {
    key: 'circleci', label: 'CircleCI', category: 'Code', status: 'available',
    description: 'Pipeline configuration, security context, artifact scanning',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['pipeline_config', 'security_scans'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'jenkins', label: 'Jenkins', category: 'Code', status: 'available',
    description: 'Pipeline jobs, Matrix-based security, plugin compliance',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['pipeline_jobs', 'security_config'],
    fields: [
      { name: 'url', label: 'Jenkins URL', type: 'text', placeholder: 'https://jenkins.yourcompany.com' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'sonarqube', label: 'SonarQube', category: 'Code', status: 'available',
    description: 'Code quality gates, security hotspots, OWASP vulnerability detection',
    controlsCovered: ['A.12.6', 'CC8.1'],
    evidenceTypes: ['quality_gates', 'security_hotspots'],
    fields: [
      { name: 'url', label: 'SonarQube URL', type: 'text', placeholder: 'https://sonarqube.yourcompany.com' },
      { name: 'token', label: 'User Token', type: 'password' },
    ],
  },
  {
    key: 'semgrep', label: 'Semgrep', category: 'Code', status: 'available',
    description: 'SAST scanning, custom security rules, CI integration',
    controlsCovered: ['A.12.6', 'CC8.1'],
    evidenceTypes: ['sast_findings', 'rule_enforcement'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'codecov', label: 'Codecov', category: 'Code', status: 'available',
    description: 'Test coverage enforcement, coverage reports, CI gates',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['coverage_reports'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },

  // ── Security & Vulnerability ───────────────────────────────────────────────
  {
    key: 'crowdstrike', label: 'CrowdStrike', category: 'Security', status: 'available',
    description: 'EDR, threat detection, endpoint protection, vulnerability assessment',
    controlsCovered: ['CC7.1', 'CC7.2', 'CC6.7'],
    evidenceTypes: ['edr_status', 'detections', 'device_policy'],
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'sentinelone', label: 'SentinelOne', category: 'Security', status: 'available',
    description: 'AI-powered EDR, threat intelligence, device compliance',
    controlsCovered: ['CC7.1', 'CC7.2', 'CC6.7'],
    evidenceTypes: ['endpoint_protection', 'threat_intelligence'],
    fields: [
      { name: 'managementUrl', label: 'Management URL', type: 'text', placeholder: 'https://yourcompany.sentinelone.net' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'wiz', label: 'Wiz', category: 'Security', status: 'available',
    description: 'Cloud security posture, container scanning, secrets detection',
    controlsCovered: ['CC7.1', 'CC6.6', 'A.12.6'],
    evidenceTypes: ['cspm_issues', 'container_security', 'vulnerability_findings'],
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'tenable', label: 'Tenable.io', category: 'Security', status: 'available',
    description: 'Vulnerability management, cloud security, web application scanning',
    controlsCovered: ['CC7.1', 'A.12.6'],
    evidenceTypes: ['vulnerability_scans', 'web_app_scanning'],
    fields: [
      { name: 'accessKey', label: 'Access Key', type: 'text' },
      { name: 'secretKey', label: 'Secret Key', type: 'password' },
    ],
  },
  {
    key: 'rapid7', label: 'Rapid7', category: 'Security', status: 'available',
    description: 'InsightVM vulnerability management, InsightIDR SIEM',
    controlsCovered: ['CC7.1', 'A.12.6'],
    evidenceTypes: ['vulnerability_findings', 'siem_alerts'],
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'region', label: 'Region', type: 'text', placeholder: 'us' },
    ],
  },
  {
    key: 'qualys', label: 'Qualys', category: 'Security', status: 'available',
    description: 'Cloud-based vulnerability management, compliance monitoring, patch management',
    controlsCovered: ['CC7.1', 'A.12.6'],
    evidenceTypes: ['vulnerability_scans', 'compliance_scans'],
    fields: [
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
      { name: 'platform', label: 'Platform URL', type: 'text', placeholder: 'qualysapi.qualys.com' },
    ],
  },
  {
    key: 'lacework', label: 'Lacework', category: 'Security', status: 'available',
    description: 'Cloud workload protection, anomaly detection, compliance reporting',
    controlsCovered: ['CC7.1', 'CC7.2'],
    evidenceTypes: ['cspm_findings', 'anomaly_events'],
    fields: [
      { name: 'account', label: 'Account', type: 'text', placeholder: 'yourcompany.lacework.net' },
      { name: 'apiKey', label: 'API Key', type: 'text' },
      { name: 'apiSecret', label: 'API Secret', type: 'password' },
    ],
  },
  {
    key: 'carbon_black', label: 'Carbon Black', category: 'Security', status: 'available',
    description: 'Endpoint security, behavioral detection, incident response',
    controlsCovered: ['CC7.1', 'CC7.2'],
    evidenceTypes: ['edr_alerts', 'endpoint_policy'],
    fields: [
      { name: 'orgKey', label: 'Org Key', type: 'text' },
      { name: 'apiId', label: 'API ID', type: 'text' },
      { name: 'apiSecret', label: 'API Secret Key', type: 'password' },
    ],
  },
  {
    key: 'aqua_security', label: 'Aqua Security', category: 'Security', status: 'available',
    description: 'Container security, image scanning, runtime protection',
    controlsCovered: ['CC6.6', 'A.12.6'],
    evidenceTypes: ['container_scanning', 'image_vulnerabilities'],
    fields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text' },
      { name: 'token', label: 'Token', type: 'password' },
    ],
  },
  {
    key: 'veracode', label: 'Veracode', category: 'Security', status: 'available',
    description: 'SAST, DAST, SCA — application security testing platform',
    controlsCovered: ['A.12.6', 'CC8.1'],
    evidenceTypes: ['sast_findings', 'policy_compliance'],
    fields: [
      { name: 'apiId', label: 'API ID', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'snyk', label: 'Snyk', category: 'Security', status: 'available',
    description: 'Container and dependency vulnerability scanning, IaC security',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['vulnerability_scan'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'bugcrowd', label: 'Bugcrowd', category: 'Security', status: 'available',
    description: 'Bug bounty program management, vulnerability disclosure, pentesting',
    controlsCovered: ['CC7.1', 'A.12.6'],
    evidenceTypes: ['bounty_program', 'vulnerability_reports'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'hackerone', label: 'HackerOne', category: 'Security', status: 'available',
    description: 'Bug bounty, vulnerability disclosure, pentest-as-a-service',
    controlsCovered: ['CC7.1', 'A.12.6'],
    evidenceTypes: ['vdp_program', 'resolved_reports'],
    fields: [
      { name: 'apiName', label: 'API Name', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },

  // ── Device Management (MDM) ────────────────────────────────────────────────
  {
    key: 'jamf', label: 'Jamf', category: 'MDM', status: 'available',
    description: 'Apple device compliance, disk encryption, OS patch management',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'disk_encryption', 'patch_level'],
    fields: [
      { name: 'url', label: 'Jamf URL', type: 'text', placeholder: 'https://yourorg.jamfcloud.com' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  },
  {
    key: 'kandji', label: 'Kandji', category: 'MDM', status: 'available',
    description: 'Apple device management, compliance blueprints, zero-touch deployment',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'patch_level'],
    fields: [
      { name: 'subdomain', label: 'Subdomain', type: 'text', placeholder: 'yourorg' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'intune', label: 'Microsoft Intune', category: 'MDM', status: 'available',
    description: 'Windows/Android device management, compliance policies, conditional access',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'disk_encryption'],
    fields: [
      { name: 'tenantId', label: 'Tenant ID', type: 'text' },
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'mosyle', label: 'Mosyle', category: 'MDM', status: 'available',
    description: 'Apple MDM, compliance baselines, app management',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'compliance_baselines'],
    fields: [{ name: 'accessToken', label: 'Access Token', type: 'password' }],
  },
  {
    key: 'fleet', label: 'Fleet', category: 'MDM', status: 'available',
    description: 'osquery-based device management, compliance queries, vulnerability detection',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_inventory', 'compliance_queries'],
    fields: [
      { name: 'url', label: 'Fleet URL', type: 'text', placeholder: 'https://fleet.yourcompany.com' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'hexnode', label: 'Hexnode', category: 'MDM', status: 'available',
    description: 'Multi-platform MDM, device compliance, kiosk management',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['device_policy'],
    fields: [
      { name: 'portalUrl', label: 'Portal URL', type: 'text', placeholder: 'https://yourorg.hexnodemdm.com' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'vmware_workspace_one', label: 'VMware Workspace ONE', category: 'MDM', status: 'available',
    description: 'Unified endpoint management, zero trust access, app security',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['device_compliance'],
    fields: [
      { name: 'apiUrl', label: 'API URL', type: 'text' },
      { name: 'token', label: 'Bearer Token', type: 'password' },
    ],
  },

  // ── HR & People Management ─────────────────────────────────────────────────
  {
    key: 'rippling', label: 'Rippling', category: 'HR', status: 'available',
    description: 'Employee onboarding/offboarding, access provisioning, org chart',
    controlsCovered: ['CC6.2', 'CC6.3', 'A.7.2'],
    evidenceTypes: ['employee_list', 'offboarding_log', 'access_provisioning'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'bamboohr', label: 'BambooHR', category: 'HR', status: 'available',
    description: 'Employee records, org chart, offboarding workflows, training tracking',
    controlsCovered: ['CC6.2', 'A.7.2'],
    evidenceTypes: ['employee_list', 'offboarding_log'],
    fields: [
      { name: 'domain', label: 'Company Domain', type: 'text', placeholder: 'yourcompany' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'workday', label: 'Workday', category: 'HR', status: 'available',
    description: 'HCM, employee lifecycle, provisioning workflows, role management',
    controlsCovered: ['CC6.2', 'CC6.3', 'A.7.2'],
    evidenceTypes: ['employee_records', 'provisioning_workflows', 'offboarding'],
    fields: [
      { name: 'tenant', label: 'Tenant', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'adp', label: 'ADP Workforce Now', category: 'HR', status: 'available',
    description: 'Payroll, benefits, workforce management, termination workflows',
    controlsCovered: ['CC6.2', 'A.7.2'],
    evidenceTypes: ['employee_records', 'termination_log'],
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'gusto', label: 'Gusto', category: 'HR', status: 'available',
    authType: 'oauth',
    description: 'Payroll, benefits, onboarding checklists, contractor management',
    controlsCovered: ['CC6.2', 'A.6.3'],
    evidenceTypes: ['employee_list', 'onboarding_workflows'],
  },
  {
    key: 'hibob', label: 'HiBob', category: 'HR', status: 'available',
    description: 'People management, org chart, offboarding automation, time tracking',
    controlsCovered: ['CC6.2'],
    evidenceTypes: ['people_directory'],
    fields: [{ name: 'serviceToken', label: 'Service User Token', type: 'password' }],
  },
  {
    key: 'personio', label: 'Personio', category: 'HR', status: 'available',
    description: 'HR software for SMBs — recruiting, onboarding, absence management',
    controlsCovered: ['CC6.2'],
    evidenceTypes: ['employee_directory'],
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'deel', label: 'Deel', category: 'HR', status: 'available',
    description: 'Global hiring, contractor compliance, EOR, equipment provisioning',
    controlsCovered: ['CC6.2', 'A.7.2'],
    evidenceTypes: ['contractor_records', 'contract_compliance'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },

  // ── Ticketing & Project Management ─────────────────────────────────────────
  {
    key: 'jira', label: 'Jira', category: 'Ticketing', status: 'available',
    authType: 'oauth',
    description: 'Vulnerability tickets, change management, audit trail, workflow automation',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['vulnerability_tickets', 'change_management'],
  },
  {
    key: 'servicenow', label: 'ServiceNow', category: 'Ticketing', status: 'available',
    description: 'ITSM, change management, incident response, CMDB',
    controlsCovered: ['CC8.1', 'CC7.3'],
    evidenceTypes: ['change_records', 'incident_records'],
    fields: [
      { name: 'instance', label: 'Instance', type: 'text', placeholder: 'yourcompany' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  },
  {
    key: 'zendesk', label: 'Zendesk', category: 'Ticketing', status: 'available',
    description: 'Customer support tickets, SLA tracking, security incident logging',
    controlsCovered: ['CC7.3'],
    evidenceTypes: ['support_tickets'],
    fields: [
      { name: 'subdomain', label: 'Subdomain', type: 'text', placeholder: 'yourcompany' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'freshservice', label: 'Freshservice', category: 'Ticketing', status: 'available',
    description: 'ITSM, change management, asset management, CMDB',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['change_records'],
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'yourcompany.freshservice.com' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'linear', label: 'Linear', category: 'Ticketing', status: 'available',
    description: 'Issue tracking, project management, engineering workflow',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['issue_tracking'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'asana', label: 'Asana', category: 'Ticketing', status: 'available',
    authType: 'oauth',
    description: 'Project tracking, workflow automation, team management',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['project_workflows'],
  },
  {
    key: 'monday', label: 'Monday.com', category: 'Ticketing', status: 'available',
    description: 'Work OS, project tracking, compliance workflows',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['board_workflows'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'clickup', label: 'ClickUp', category: 'Ticketing', status: 'available',
    authType: 'oauth',
    description: 'Project management, task tracking, doc management',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['task_tracking'],
  },
  {
    key: 'notion', label: 'Notion', category: 'Ticketing', status: 'available',
    authType: 'oauth',
    description: 'Documentation, wikis, project management, compliance docs',
    controlsCovered: ['CC2.1'],
    evidenceTypes: ['documentation'],
  },
  {
    key: 'confluence', label: 'Confluence', category: 'Ticketing', status: 'available',
    description: 'Team wiki, policy documentation, knowledge base',
    controlsCovered: ['CC2.1', 'A.5.1'],
    evidenceTypes: ['policy_documents', 'documentation'],
    fields: [
      { name: 'domain', label: 'Domain', type: 'text', placeholder: 'yourcompany.atlassian.net' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },

  // ── Monitoring & Observability ─────────────────────────────────────────────
  {
    key: 'datadog', label: 'Datadog', category: 'Monitoring', status: 'available',
    description: 'Security signals, compliance monitors, APM, infrastructure monitoring',
    controlsCovered: ['CC7.1', 'CC7.2', 'A.12.4'],
    evidenceTypes: ['security_signals', 'monitors', 'anomaly_alerts'],
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'appKey', label: 'Application Key', type: 'password' },
    ],
  },
  {
    key: 'newrelic', label: 'New Relic', category: 'Monitoring', status: 'available',
    description: 'APM, infrastructure monitoring, security alerts, log management',
    controlsCovered: ['CC7.1', 'CC7.2'],
    evidenceTypes: ['app_monitoring', 'alert_policies'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'grafana', label: 'Grafana', category: 'Monitoring', status: 'available',
    description: 'Dashboards, alerting, log aggregation, incident correlation',
    controlsCovered: ['CC7.1', 'A.12.4'],
    evidenceTypes: ['monitoring_dashboards', 'alert_rules'],
    fields: [
      { name: 'url', label: 'Grafana URL', type: 'text', placeholder: 'https://grafana.yourcompany.com' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'sentry', label: 'Sentry', category: 'Monitoring', status: 'available',
    authType: 'oauth',
    description: 'Error tracking, performance monitoring, release health',
    controlsCovered: ['CC7.2', 'A.12.4'],
    evidenceTypes: ['error_tracking', 'alert_notifications'],
  },
  {
    key: 'dynatrace', label: 'Dynatrace', category: 'Monitoring', status: 'available',
    description: 'AI-powered observability, AIOps, security analytics, CSPM',
    controlsCovered: ['CC7.1'],
    evidenceTypes: ['app_monitoring'],
    fields: [
      { name: 'environmentId', label: 'Environment ID', type: 'text' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'sumo_logic', label: 'Sumo Logic', category: 'Monitoring', status: 'available',
    description: 'Log management, SIEM, security analytics, CloudSIEM',
    controlsCovered: ['CC7.1', 'A.12.4'],
    evidenceTypes: ['log_collection', 'security_dashboards'],
    fields: [
      { name: 'accessId', label: 'Access ID', type: 'text' },
      { name: 'accessKey', label: 'Access Key', type: 'password' },
      { name: 'endpoint', label: 'API Endpoint', type: 'text', placeholder: 'api.sumologic.com' },
    ],
  },
  {
    key: 'splunk', label: 'Splunk', category: 'Monitoring', status: 'available',
    description: 'SIEM, log management, threat detection, security operations',
    controlsCovered: ['CC7.2', 'A.12.4'],
    evidenceTypes: ['siem_alerts', 'log_retention'],
    fields: [
      { name: 'host', label: 'Host', type: 'text', placeholder: 'splunk.yourcompany.com' },
      { name: 'token', label: 'Bearer Token', type: 'password' },
    ],
  },
  {
    key: 'elastic', label: 'Elastic / SIEM', category: 'Monitoring', status: 'available',
    description: 'Elasticsearch SIEM, detection rules, log analytics, threat hunting',
    controlsCovered: ['CC7.2', 'A.12.4'],
    evidenceTypes: ['siem_rules', 'audit_indices'],
    fields: [
      { name: 'url', label: 'Elasticsearch URL', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'pagerduty', label: 'PagerDuty', category: 'Monitoring', status: 'available',
    description: 'Incident response, on-call management, alert routing, postmortems',
    controlsCovered: ['CC7.3', 'CC7.4'],
    evidenceTypes: ['incident_records', 'on_call_schedules'],
    fields: [{ name: 'apiToken', label: 'API Token', type: 'password' }],
  },
  {
    key: 'opsgenie', label: 'OpsGenie', category: 'Monitoring', status: 'available',
    description: 'On-call schedules, alert deduplication, incident management',
    controlsCovered: ['CC7.3', 'CC7.4'],
    evidenceTypes: ['on_call_schedules', 'alert_policies'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'victorops', label: 'Splunk On-Call (VictorOps)', category: 'Monitoring', status: 'available',
    description: 'Incident management, on-call routing, alert escalation',
    controlsCovered: ['CC7.3'],
    evidenceTypes: ['on_call_schedule'],
    fields: [
      { name: 'apiId', label: 'API ID', type: 'text' },
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  {
    key: 'firehydrant', label: 'FireHydrant', category: 'Monitoring', status: 'available',
    description: 'Incident management, runbooks, retrospectives, SLO tracking',
    controlsCovered: ['CC7.3', 'CC7.4'],
    evidenceTypes: ['incident_runbooks', 'incident_reports'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'statuspage', label: 'Statuspage', category: 'Monitoring', status: 'available',
    description: 'Public status pages, incident communication, SLA management',
    controlsCovered: ['CC7.4'],
    evidenceTypes: ['public_status'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },

  // ── Collaboration & Communication ──────────────────────────────────────────
  {
    key: 'slack', label: 'Slack', category: 'Collaboration', status: 'available',
    authType: 'oauth',
    description: 'Audit logs, message retention, DLP policies, workspace security',
    controlsCovered: ['CC6.7', 'A.12.4'],
    evidenceTypes: ['audit_logs', 'dlp_policy'],
  },
  {
    key: 'microsoft_teams', label: 'Microsoft Teams', category: 'Collaboration', status: 'available',
    description: 'Message compliance, retention policies, meeting security',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['message_compliance'],
    fields: [
      { name: 'tenantId', label: 'Tenant ID', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'zoom', label: 'Zoom', category: 'Collaboration', status: 'available',
    description: 'Meeting security, recording compliance, waiting room enforcement',
    controlsCovered: ['A.12.4'],
    evidenceTypes: ['meeting_security'],
    fields: [
      { name: 'accountId', label: 'Account ID', type: 'text' },
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    key: 'mattermost', label: 'Mattermost', category: 'Collaboration', status: 'available',
    description: 'Self-hosted team messaging, data retention, audit logging',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['data_retention'],
    fields: [
      { name: 'serverUrl', label: 'Server URL', type: 'text', placeholder: 'https://mattermost.yourcompany.com' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },

  // ── Secrets & Password Management ─────────────────────────────────────────
  {
    key: 'onepassword', label: '1Password', category: 'Secrets', status: 'available',
    description: 'Enterprise password management, secret storage, audit logs',
    controlsCovered: ['CC6.1', 'A.9.4'],
    evidenceTypes: ['vault_security', 'access_controls'],
    fields: [{ name: 'serviceAccountToken', label: 'Service Account Token', type: 'password' }],
  },
  {
    key: 'hashicorp_vault', label: 'HashiCorp Vault', category: 'Secrets', status: 'available',
    description: 'Secrets engine, dynamic credentials, PKI, encryption-as-a-service',
    controlsCovered: ['CC6.1', 'A.9.4'],
    evidenceTypes: ['secrets_management', 'access_policies'],
    fields: [
      { name: 'address', label: 'Vault Address', type: 'text', placeholder: 'https://vault.yourcompany.com' },
      { name: 'token', label: 'Vault Token', type: 'password' },
    ],
  },
  {
    key: 'doppler', label: 'Doppler', category: 'Secrets', status: 'available',
    description: 'Secret management, environment variables, access controls',
    controlsCovered: ['CC6.1', 'A.9.4'],
    evidenceTypes: ['secret_storage', 'access_logs'],
    fields: [{ name: 'apiKey', label: 'Service Token', type: 'password' }],
  },
  {
    key: 'lastpass', label: 'LastPass', category: 'Secrets', status: 'available',
    description: 'Enterprise password management, dark web monitoring',
    controlsCovered: ['CC6.1'],
    evidenceTypes: ['password_policy'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'bitwarden', label: 'Bitwarden', category: 'Secrets', status: 'available',
    description: 'Open-source password management, enterprise vault, secure sharing',
    controlsCovered: ['CC6.1'],
    evidenceTypes: ['vault_security'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },

  // ── Security Training ──────────────────────────────────────────────────────
  {
    key: 'knowbe4', label: 'KnowBe4', category: 'Training', status: 'available',
    description: 'Security awareness training, phishing simulations, risk scores',
    controlsCovered: ['CC1.4', 'A.6.3'],
    evidenceTypes: ['training_completion', 'phishing_simulation'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'proofpoint', label: 'Proofpoint', category: 'Training', status: 'available',
    description: 'Security awareness training, email security, threat intelligence',
    controlsCovered: ['CC1.4', 'A.6.3'],
    evidenceTypes: ['training_completion', 'email_security'],
    fields: [
      { name: 'principal', label: 'Service Principal', type: 'text' },
      { name: 'secret', label: 'Service Secret', type: 'password' },
    ],
  },
  {
    key: 'infosec_iq', label: 'Infosec IQ', category: 'Training', status: 'available',
    description: 'Security awareness, role-based training, compliance training programs',
    controlsCovered: ['CC1.4'],
    evidenceTypes: ['training_completion'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },

  // ── Background Checks ──────────────────────────────────────────────────────
  {
    key: 'checkr', label: 'Checkr', category: 'Background Checks', status: 'available',
    description: 'Employment background screening, criminal records, identity verification',
    controlsCovered: ['A.7.1'],
    evidenceTypes: ['background_checks'],
    fields: [{ name: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    key: 'sterling', label: 'Sterling', category: 'Background Checks', status: 'available',
    description: 'Pre-employment screening, drug testing, occupational health checks',
    controlsCovered: ['A.7.1'],
    evidenceTypes: ['screening_results'],
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },

  // ── CRM & Business ─────────────────────────────────────────────────────────
  {
    key: 'salesforce', label: 'Salesforce', category: 'CRM', status: 'available',
    authType: 'oauth',
    description: 'Org security health, user permissions, session policies, audit trail',
    controlsCovered: ['CC6.1', 'CC6.3'],
    evidenceTypes: ['security_health', 'profile_permissions'],
  },
  {
    key: 'hubspot', label: 'HubSpot', category: 'CRM', status: 'available',
    authType: 'oauth',
    description: 'User permissions, data privacy settings, access logs',
    controlsCovered: ['CC6.3'],
    evidenceTypes: ['user_permissions'],
  },

  // ── Document & File Storage ────────────────────────────────────────────────
  {
    key: 'box', label: 'Box', category: 'Storage', status: 'available',
    authType: 'oauth',
    description: 'Data classification, external sharing controls, DLP, watermarking',
    controlsCovered: ['CC6.7', 'A.8.2'],
    evidenceTypes: ['data_classification', 'sharing_controls'],
  },
  {
    key: 'dropbox', label: 'Dropbox Business', category: 'Storage', status: 'available',
    authType: 'oauth',
    description: 'Sharing policies, external link controls, data governance',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['sharing_policies'],
  },
  {
    key: 'sharepoint', label: 'SharePoint', category: 'Storage', status: 'available',
    description: 'Site permissions, data classification, sensitivity labels',
    controlsCovered: ['CC6.7', 'A.8.2'],
    evidenceTypes: ['site_permissions', 'data_classification'],
    fields: [
      { name: 'tenantId', label: 'Tenant ID', type: 'text' },
      { name: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    key: 'google_drive', label: 'Google Drive', category: 'Storage', status: 'available',
    description: 'Sharing settings, DLP, Drive audit logs',
    controlsCovered: ['CC6.7'],
    evidenceTypes: ['sharing_policies'],
    fields: [{ name: 'accessToken', label: 'OAuth Access Token', type: 'password' }],
  },

  // ── Data & Analytics ───────────────────────────────────────────────────────
  {
    key: 'snowflake', label: 'Snowflake', category: 'Data', status: 'available',
    description: 'Network policies, role-based access, audit logging, data masking',
    controlsCovered: ['CC6.1', 'A.8.2'],
    evidenceTypes: ['network_policy', 'rbac_config'],
    fields: [
      { name: 'account', label: 'Account Identifier', type: 'text', placeholder: 'orgname-accountname' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  },
  {
    key: 'mongodb_atlas', label: 'MongoDB Atlas', category: 'Data', status: 'available',
    description: 'IP access lists, encryption, Security Advisor, audit logs',
    controlsCovered: ['CC6.1', 'A.12.6'],
    evidenceTypes: ['access_list', 'security_advisor'],
    fields: [
      { name: 'publicKey', label: 'Public Key', type: 'text' },
      { name: 'privateKey', label: 'Private Key', type: 'password' },
    ],
  },
  {
    key: 'databricks', label: 'Databricks', category: 'Data', status: 'available',
    description: 'Cluster policies, workspace permissions, audit logs, Unity Catalog',
    controlsCovered: ['CC6.1', 'A.8.2'],
    evidenceTypes: ['cluster_policies', 'workspace_permissions'],
    fields: [
      { name: 'workspaceUrl', label: 'Workspace URL', type: 'text', placeholder: 'https://adb-xxxx.azuredatabricks.net' },
      { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password' },
    ],
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Identity':          Users,
  'Cloud':             Cloud,
  'Code':              Code,
  'Monitoring':        Activity,
  'MDM':               Laptop,
  'Ticketing':         Ticket,
  'HR':                Users,
  'Security':          Shield,
  'Collaboration':     Mail,
  'Secrets':           Key,
  'Training':          GraduationCap,
  'Background Checks': UserCheck,
  'CRM':               Building2,
  'Storage':           HardDrive,
  'Data':              Database,
};

// ─── Connect Modal ────────────────────────────────────────────────────────────

function ConnectModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const connect = useMutation({
    mutationFn: () => integrationsApi.connect(provider.key, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Connection failed. Check your credentials.'),
  });

  const CategoryIcon = CATEGORY_ICONS[provider.category] ?? Shield;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <CategoryIcon className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Connect {provider.label}</h2>
              <p className="text-xs text-gray-400">{provider.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-5">{provider.description}</p>

          {provider.controlsCovered.length > 0 && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-xs text-gray-400">Controls:</span>
              {provider.controlsCovered.slice(0, 4).map((c) => (
                <span key={c} className="text-xs font-mono bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">{c}</span>
              ))}
              {provider.controlsCovered.length > 4 && (
                <span className="text-xs text-gray-400">+{provider.controlsCovered.length - 4} more</span>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {(provider.fields ?? []).map((f) => (
              <div key={f.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  className="input"
                  placeholder={f.placeholder}
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Connected Card ───────────────────────────────────────────────────────────

function ConnectedCard({ integration }: { integration: any }) {
  const qc = useQueryClient();
  const providerMeta = PROVIDERS.find((p) => p.key === integration.provider);
  const CategoryIcon = providerMeta ? (CATEGORY_ICONS[providerMeta.category] ?? Shield) : Shield;
  const isActive = ['active', 'connected'].includes(integration.status);

  const sync = useMutation({
    mutationFn: () => integrationsApi.sync(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const disconnect = useMutation({
    mutationFn: () => integrationsApi.disconnect(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 flex items-center gap-4 transition-all',
      isActive ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 opacity-60',
    )}>
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        <CategoryIcon className="w-5 h-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900">{providerMeta?.label ?? integration.provider}</p>
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" /> {integration.status}
            </span>
          )}
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{providerMeta?.category}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {integration.lastSyncedAt && <span>Synced {new Date(integration.lastSyncedAt).toLocaleDateString()}</span>}
          {providerMeta?.controlsCovered && <span>{providerMeta.controlsCovered.length} controls covered</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1" onClick={() => sync.mutate()} disabled={sync.isPending || !isActive}>
          <RefreshCw className={cn('w-3 h-3', sync.isPending && 'animate-spin')} /> Sync
        </button>
        <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500" onClick={() => disconnect.mutate()} disabled={disconnect.isPending} title="Disconnect">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({ provider, onConnect }: { provider: Provider; onConnect: (p: Provider) => void }) {
  const CategoryIcon = CATEGORY_ICONS[provider.category] ?? Shield;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-150 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <CategoryIcon className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900">{provider.label}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{provider.category}</span>
        </div>
        <p className="text-xs text-gray-500 mb-2 leading-relaxed">{provider.description}</p>
        <div className="flex items-center gap-1 flex-wrap">
          {provider.controlsCovered.slice(0, 3).map((c) => (
            <span key={c} className="text-xs font-mono bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{c}</span>
          ))}
          {provider.controlsCovered.length > 3 && (
            <span className="text-xs text-gray-400">+{provider.controlsCovered.length - 3}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {provider.authType === 'oauth' && (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
            <ExternalLink className="w-2.5 h-2.5" /> OAuth
          </span>
        )}
        <button
          className={cn(
            'text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors',
            'bg-brand-600 text-white hover:bg-brand-700',
          )}
          onClick={() => onConnect(provider)}
        >
          <Plus className="w-3 h-3" /> Connect
        </button>
      </div>
    </div>
  );
}

// ─── AI Advisor ───────────────────────────────────────────────────────────────

type IntegrationRec = {
  providerKey: string; providerName: string; priority: 'critical' | 'high' | 'medium';
  reason: string; controlsCovered: string[]; estimatedEvidenceItems: number; category: string;
};
type AdvisorResult = { connectedCount: number; gapCategories: string[]; recommendations: IntegrationRec[]; generatedAt: string };

const PRIORITY_CFG: Record<string, { badge: string }> = {
  critical: { badge: 'bg-red-100 text-red-700 border border-red-200' },
  high:     { badge: 'bg-orange-100 text-orange-700 border border-orange-200' },
  medium:   { badge: 'bg-blue-100 text-blue-700 border border-blue-200' },
};

function AdvisorPanel({ result, onClose, onConnect }: { result: AdvisorResult; onClose: () => void; onConnect: (key: string) => void }) {
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Integration Advisor</p>
            <p className="text-xs text-purple-700">{result.recommendations.length} integration{result.recommendations.length !== 1 ? 's' : ''} recommended</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-purple-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      {result.recommendations.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">You&apos;re well-connected!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {result.recommendations.map((rec) => {
            const cfg = PRIORITY_CFG[rec.priority] ?? PRIORITY_CFG.medium;
            return (
              <div key={rec.providerKey} className="bg-white rounded-xl border border-purple-100 p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.badge)}>{rec.priority}</span>
                    <p className="text-sm font-semibold text-gray-900">{rec.providerName}</p>
                  </div>
                  <button onClick={() => onConnect(rec.providerKey)} className="flex items-center gap-1 text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 shrink-0">
                    <ArrowRight className="w-3 h-3" /> Connect
                  </button>
                </div>
                <p className="text-xs text-gray-600 mb-2">{rec.reason}</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{rec.controlsCovered.slice(0, 4).join(', ')}{rec.controlsCovered.length > 4 && ` +${rec.controlsCovered.length - 4}`}</span>
                  {rec.estimatedEvidenceItems > 0 && <span>~{rec.estimatedEvidenceItems} evidence items</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function IntegrationsContent() {
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [advisorResult, setAdvisorResult] = useState<AdvisorResult | null>(null);
  const searchParams = useSearchParams();
  const qcPage = useQueryClient();

  const advisorMutation = useMutation({
    mutationFn: () => integrationsApi.aiRecommend() as Promise<AdvisorResult>,
    onSuccess: (res) => setAdvisorResult(res),
  });

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      setToast({ type: 'success', message: `${connected.charAt(0).toUpperCase() + connected.slice(1).replace(/_/g, ' ')} connected successfully via OAuth!` });
      qcPage.invalidateQueries({ queryKey: ['integrations'] });
      window.history.replaceState({}, '', '/integrations');
      setTimeout(() => setToast(null), 5000);
    } else if (error) {
      setToast({ type: 'error', message: `OAuth error: ${error.replace(/_/g, ' ')}` });
      window.history.replaceState({}, '', '/integrations');
      setTimeout(() => setToast(null), 6000);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
  });

  const integrations: any[] = data ?? [];
  const connectedKeys = new Set(integrations.map((i) => i.provider));
  const available = PROVIDERS.filter((p) => !connectedKeys.has(p.key));

  const allCategories = ['All', ...Array.from(new Set(PROVIDERS.map((p) => p.category))).sort()];

  const filteredAvailable = available.filter((p) => {
    const matchesSearch = !search.trim() ||
      p.label.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = selectedCategory === 'All'
    ? [...new Set(filteredAvailable.map((p) => p.category))]
    : [selectedCategory];

  function handleConnect(p: Provider) {
    if (p.authType === 'oauth') {
      const accessToken = getAccessToken() ?? '';
      const oauthUrl = `${RAW_API_URL}/api/v1/integrations/oauth/${p.key}?token=${encodeURIComponent(accessToken)}`;
      window.location.href = oauthUrl;
    } else {
      setConnectingProvider(p);
    }
  }

  function handleConnectByKey(key: string) {
    const provider = PROVIDERS.find((p) => p.key === key);
    if (provider) handleConnect(provider);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium',
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800',
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect your tools to automatically collect compliance evidence · {PROVIDERS.length} integrations available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => advisorMutation.mutate()}
            disabled={advisorMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          >
            {advisorMutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> AI Advisor</>}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
            <span className="font-semibold text-gray-700">{integrations.length}</span> connected ·
            <span className="font-semibold text-gray-700">{PROVIDERS.length}</span> total
          </div>
        </div>
      </div>

      {/* AI Advisor panel */}
      {advisorResult && <AdvisorPanel result={advisorResult} onClose={() => setAdvisorResult(null)} onConnect={handleConnectByKey} />}

      {/* Connected section */}
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : integrations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected ({integrations.length})</h2>
          <div className="space-y-2">
            {integrations.map((i) => <ConnectedCard key={i.id} integration={i} />)}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors',
                selectedCategory === cat ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filteredAvailable.length} available</span>
      </div>

      {/* Available section */}
      <div>
        {categories.map((category) => {
          const categoryProviders = filteredAvailable.filter((p) => p.category === category);
          if (categoryProviders.length === 0) return null;
          return (
            <div key={category} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                {(() => { const Icon = CATEGORY_ICONS[category] ?? Shield; return <Icon className="w-3.5 h-3.5 text-gray-400" />; })()}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</span>
                <span className="text-xs text-gray-400">({categoryProviders.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryProviders.map((provider) => (
                  <ProviderCard key={provider.key} provider={provider} onConnect={handleConnect} />
                ))}
              </div>
            </div>
          );
        })}
        {filteredAvailable.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Flame className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            No integrations match your search.
          </div>
        )}
      </div>

      {connectingProvider && <ConnectModal provider={connectingProvider} onClose={() => setConnectingProvider(null)} />}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center h-48"><div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
