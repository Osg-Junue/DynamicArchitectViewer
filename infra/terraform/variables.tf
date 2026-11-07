variable "project_id" {
  description = "GCP project ID (created by the bootstrap step)."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run and Artifact Registry."
  type        = string
  default     = "asia-northeast1"
}

variable "billing_account_id" {
  description = "Billing account ID linked to the project (used for the budget alert)."
  type        = string
}

variable "budget_amount_units" {
  description = "Monthly budget in the billing account currency (whole units)."
  type        = number
  default     = 1000
}

variable "github_owner" {
  description = "GitHub repository owner."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name."
  type        = string
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "dav-web"
}

variable "artifact_repository_id" {
  description = "Artifact Registry repository ID."
  type        = string
  default     = "dav"
}

variable "max_instances" {
  description = "Upper bound of Cloud Run instances (cost guard for a public service)."
  type        = number
  default     = 2
}

variable "keep_image_count" {
  description = "Number of most recent container images to keep in Artifact Registry."
  type        = number
  default     = 10
}
