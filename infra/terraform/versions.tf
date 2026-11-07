terraform {
  required_version = ">= 1.17.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # Bucket is created by the bootstrap step (see docs/04-operations/cloud-run-deploy.md).
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region

  # Required for APIs that need a quota project when using user credentials (e.g. Billing Budgets).
  user_project_override = true
  billing_project       = var.project_id
}

# Token is supplied via the GITHUB_TOKEN environment variable (e.g. `gh auth token`).
provider "github" {
  owner = var.github_owner
}
