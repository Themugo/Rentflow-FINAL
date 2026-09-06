terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket         = "calqulusrms-terraform-state"
    key            = "calqulusrms/multi-region/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "calqulusrms-terraform-locks"
  }
}

provider "aws" {
  region = var.primary_region

  default_tags {
    tags = {
      Project     = "CALQULUS RMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Tier        = "Multi-Region"
    }
  }
}

provider "aws" {
  alias  = "secondary"
  region = var.secondary_region

  default_tags {
    tags = {
      Project     = "CALQULUS RMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Tier        = "Multi-Region"
    }
  }
}

# Primary Region Resources
module "primary_vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  providers = {
    aws = aws
  }

  name = "${var.project_name}-${var.environment}-primary-vpc"
  cidr = var.primary_vpc_cidr

  azs             = var.primary_availability_zones
  private_subnets = var.primary_private_subnet_cidrs
  public_subnets  = var.primary_public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
}

module "primary_eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  providers = {
    aws = aws
  }

  cluster_name    = "${var.project_name}-${var.environment}-primary-cluster"
  cluster_version = var.kubernetes_version

  vpc_id     = module.primary_vpc.vpc_id
  subnet_ids = module.primary_vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.large", "t3a.large"]
      min_size       = 3
      max_size       = 10
      desired_size   = 3

      labels = {
        role = "general"
      }
    }
  }

  tags = {
    Environment = var.environment
    Region      = var.primary_region
  }
}

# Secondary Region Resources
module "secondary_vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  providers = {
    aws = aws.secondary
  }

  name = "${var.project_name}-${var.environment}-secondary-vpc"
  cidr = var.secondary_vpc_cidr

  azs             = var.secondary_availability_zones
  private_subnets = var.secondary_private_subnet_cidrs
  public_subnets  = var.secondary_public_subnet_cidrs

  enable_nat_gateway     = true
  single_nat_gateway     = true
  enable_vpn_gateway     = false
  enable_dns_hostnames   = true
  enable_dns_support     = true
}

module "secondary_eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  providers = {
    aws = aws.secondary
  }

  cluster_name    = "${var.project_name}-${var.environment}-secondary-cluster"
  cluster_version = var.kubernetes_version

  vpc_id     = module.secondary_vpc.vpc_id
  subnet_ids = module.secondary_vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }

  eks_managed_node_groups = {
    general = {
      name           = "general"
      instance_types = ["t3.large", "t3a.large"]
      min_size       = 2
      max_size       = 5
      desired_size   = 2

      labels = {
        role = "general"
      }
    }
  }

  tags = {
    Environment = var.environment
    Region      = var.secondary_region
  }
}

# Global Route53 for multi-region DNS
resource "aws_route53_zone" "primary" {
  name = var.domain
}

resource "aws_route53_record" "primary" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "app.${var.domain}"
  type    = "A"

  alias {
    evaluate_target_health = true
    name                   = module.primary_eks.cluster_endpoint
    zone_id                = module.primary_eks.cluster_zone_id
  }
}

resource "aws_route53_record" "secondary" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "app-secondary.${var.domain}"
  type    = "A"

  alias {
    evaluate_target_health = true
    name                   = module.secondary_eks.cluster_endpoint
    zone_id                = module.secondary_eks.cluster_zone_id
  }
}

# Route53 health checks for failover
resource "aws_route53_health_check" "primary" {
  fqdn              = "app.${var.domain}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  request_interval  = 30
  failure_threshold = 3
}

resource "aws_route53_health_check" "secondary" {
  fqdn              = "app-secondary.${var.domain}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  request_interval  = 30
  failure_threshold = 3
}

# Global Accelerator for multi-region traffic routing
resource "aws_globalaccelerator_accelerator" "calqulusrms" {
  name            = "${var.project_name}-accelerator"
  ip_address_type = "IPV4"
  enabled         = true
}

resource "aws_globalaccelerator_listener" "http" {
  accelerator_arn = aws_globalaccelerator_accelerator.calqulusrms.id
  protocol        = "TCP"
  port_range      = ["80"]
}

resource "aws_globalaccelerator_listener" "https" {
  accelerator_arn = aws_globalaccelerator_accelerator.calqulusrms.id
  protocol        = "TCP"
  port_range      = ["443"]
}

resource "aws_globalaccelerator_endpoint_group" "primary" {
  listener_arn = aws_globalaccelerator_listener.http.id
}

resource "aws_globalaccelerator_endpoint_group" "secondary" {
  listener_arn = aws_globalaccelerator_listener.http.id
}

resource "aws_globalaccelerator_endpoint" "primary" {
  accelerator_arn = aws_globalaccelerator_accelerator.calqulusrms.id
  endpoint_group_arn = aws_globalaccelerator_endpoint_group.primary.id
  
  endpoint_configuration {
    endpoint_id = module.primary_eks.cluster_endpoint
    weight       = 100
  }
}

resource "aws_globalaccelerator_endpoint" "secondary" {
  accelerator_arn = aws_globalaccelerator_accelerator.calqulusrms.id
  endpoint_group_arn = aws_globalaccelerator_endpoint_group.secondary.id
  
  endpoint_configuration {
    endpoint_id = module.secondary_eks.cluster_endpoint
    weight       = 0
  }
}
