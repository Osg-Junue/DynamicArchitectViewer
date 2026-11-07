# GitHub Actions configuration consumed by .github/workflows/ci.yml

resource "github_repository_environment" "production" {
  repository  = var.github_repository
  environment = "production"

  deployment_branch_policy {
    protected_branches     = false
    custom_branch_policies = true
  }
}

resource "github_repository_environment_deployment_policy" "production_main" {
  repository     = var.github_repository
  environment    = github_repository_environment.production.environment
  branch_pattern = "main"
}

locals {
  github_variables = {
    GCP_PROJECT_ID    = var.project_id
    GCP_REGION        = var.region
    GCP_AR_REPOSITORY = google_artifact_registry_repository.app.repository_id
    CLOUD_RUN_SERVICE = google_cloud_run_v2_service.web.name
    GCP_DEPLOY_SA     = google_service_account.deployer.email
    GCP_WIF_PROVIDER  = google_iam_workload_identity_pool_provider.github.name
  }
}

resource "github_actions_variable" "gcp" {
  for_each = local.github_variables

  repository    = var.github_repository
  variable_name = each.key
  value         = each.value
}
