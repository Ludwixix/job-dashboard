terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "acaa-agent"
}

variable "region" {
  description = "GCP deployment region"
  type        = string
  default     = "australia-southeast1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "job-dashboard"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Artifact Registry Repository for Container Images
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "cloud-run-source-deploy"
  description   = "Container repository for Career Agent Cloud Run deployments"
  format        = "DOCKER"
}

# Persistent Google Cloud Storage Bucket for Job Scrapes and State
resource "google_storage_bucket" "data_bucket" {
  name          = "${var.project_id}-job-dashboard-data"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Cloud Run Service Definition (v2)
resource "google_cloud_run_v2_service" "job_dashboard" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    max_instance_request_concurrency = 10
    timeout                          = "3600s"

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.service_name}:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "JOB_DASHBOARD_DATA_DIR"
        value = "/app/data"
      }
      env {
        name  = "JOB_DASHBOARD_GCS_DATA_BUCKET"
        value = google_storage_bucket.data_bucket.name
      }
      env {
        name  = "JOB_DASHBOARD_SEEK_CACHE_PATH"
        value = "/app/data/seek_cache.json"
      }
      env {
        name  = "JOB_DASHBOARD_SEEK_CACHE_FALLBACK"
        value = "true"
      }
      env {
        name  = "JOB_DASHBOARD_LINKEDIN_ENABLED"
        value = "false"
      }

      startup_probe {
        initial_delay_seconds = 10
        timeout_seconds       = 5
        period_seconds        = 10
        failure_threshold     = 5
        http_get {
          path = "/health"
          port = 8080
        }
      }

      liveness_probe {
        timeout_seconds   = 5
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/health"
          port = 8080
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow unauthenticated public access for the web portal
resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.job_dashboard.location
  project  = var.project_id
  service  = google_cloud_run_v2_service.job_dashboard.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" {
  description = "Production URL of Career Agent dashboard"
  value       = google_cloud_run_v2_service.job_dashboard.uri
}

