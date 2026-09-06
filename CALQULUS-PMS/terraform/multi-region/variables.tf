variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "calqulusrms"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "production"
}

variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "us-east-1"
}

variable "secondary_region" {
  description = "Secondary AWS region for disaster recovery"
  type        = string
  default     = "us-west-2"
}

variable "primary_vpc_cidr" {
  description = "CIDR block for primary VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "secondary_vpc_cidr" {
  description = "CIDR block for secondary VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "primary_availability_zones" {
  description = "Availability zones for primary region"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "secondary_availability_zones" {
  description = "Availability zones for secondary region"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

variable "primary_private_subnet_cidrs" {
  description = "CIDR blocks for primary private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "primary_public_subnet_cidrs" {
  description = "CIDR blocks for primary public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "secondary_private_subnet_cidrs" {
  description = "CIDR blocks for secondary private subnets"
  type        = list(string)
  default     = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
}

variable "secondary_public_subnet_cidrs" {
  description = "CIDR blocks for secondary public subnets"
  type        = list(string)
  default     = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS clusters"
  type        = string
  default     = "1.28"
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
  default     = "calqulusrms.com"
}
